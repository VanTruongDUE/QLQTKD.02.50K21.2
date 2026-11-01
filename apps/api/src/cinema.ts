import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Headers,
  Req,
  UseGuards,
  Inject,
  Module,
  RawBodyRequest,
} from "@nestjs/common";
import { Request } from "express";
import { DataSource } from "typeorm";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";
import { z } from "zod";
import {
  holdSchema,
  bookingSchema,
  simulationSchema,
  eventSchema,
} from "@starlight/contracts";
import { AuthModule, JwtGuard, RoleGuard, Roles, AuthRequest } from "./auth";
import { BookingService } from "./booking.service";
import { fail, parse, uuid } from "./http";
import { decrypt, hash } from "./security";
import { secret } from "./config";
@Controller()
export class CatalogController {
  constructor(@Inject(DataSource) private db: DataSource) {}
  @Get("health") async health() {
    await this.db.query("SELECT 1");
    return { ok: true };
  }
  @Get("movies") movies() {
    return this.db.query("SELECT * FROM movies WHERE active ORDER BY title");
  }
  @Get("products") products() {
    return this.db.query("SELECT * FROM products WHERE active ORDER BY price");
  }
  @Get("showtimes") showtimes() {
    return this.db.query(
      `SELECT s.*,a.name AS room,c.name AS cinema FROM showtimes s JOIN auditoriums a ON a.id=s.auditorium_id JOIN cinemas c ON c.id=a.cinema_id WHERE s.starts_at>clock_timestamp() AND s.status='SCHEDULED' ORDER BY s.starts_at`,
    );
  }
  @Get("showtimes/:id/seats") async seats(@Param("id") id: string) {
    return {
      serverTime: new Date(),
      seats: await this.db.query(
        `SELECT ss.seat_id AS id,se.label,CASE WHEN ss.ticket_id IS NOT NULL THEN 'SOLD' WHEN h.status='ACTIVE' AND h.expires_at>clock_timestamp() THEN 'HELD' ELSE 'AVAILABLE' END AS status FROM showtime_seats ss JOIN seats se ON se.id=ss.seat_id LEFT JOIN holds h ON h.id=ss.hold_id WHERE ss.showtime_id=$1 ORDER BY se.label`,
        [uuid(id)],
      ),
    };
  }
}
@Controller()
@UseGuards(JwtGuard, RoleGuard)
export class CinemaController {
  constructor(
    @Inject(BookingService) private bookings: BookingService,
    @Inject(DataSource) private db: DataSource,
  ) {}
  @Post("holds") @Roles("CUSTOMER") hold(
    @Req() req: AuthRequest,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string,
  ) {
    return this.bookings.hold(req.user.id, parse(holdSchema, body), key);
  }
  @Post("bookings") @Roles("CUSTOMER") book(
    @Req() req: AuthRequest,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string,
  ) {
    return this.bookings.book(req.user.id, parse(bookingSchema, body), key);
  }
  @Post("bookings/:id/payments") @Roles("CUSTOMER") payment(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Headers("idempotency-key") key: string,
  ) {
    return this.bookings.createPayment(req.user.id, uuid(id), key);
  }
  @Get("me/bookings") async orders(@Req() req: AuthRequest) {
    return this.db.query(
      `SELECT b.*,h.expires_at,COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id,'status',p.status,'reconciliationRequired',p.reconciliation_required) ORDER BY p.created_at DESC) FROM payments p WHERE p.booking_id=b.id),'[]'::jsonb) AS payments FROM bookings b JOIN holds h ON h.id=b.hold_id WHERE b.owner_id=$1 ORDER BY b.created_at DESC`,
      [req.user.id],
    );
  }
  @Get("me/tickets") async tickets(@Req() req: AuthRequest) {
    const tickets = await this.db.query(
      `SELECT t.*,i.movie_title,i.seat_label,i.booking_id,s.starts_at,a.name AS room,c.name AS cinema FROM tickets t JOIN booking_items i ON i.id=t.item_id JOIN bookings b ON b.id=i.booking_id JOIN showtimes s ON s.id=i.showtime_id JOIN auditoriums a ON a.id=s.auditorium_id JOIN cinemas c ON c.id=a.cinema_id WHERE b.owner_id=$1 ORDER BY b.created_at DESC`,
      [req.user.id],
    );
    return Promise.all(
      tickets.map(async (t: Record<string, any>) => {
        const { qr_hash, qr_encrypted, ...publicTicket } = t;
        void qr_hash;
        return {
          ...publicTicket,
          qrToken: decrypt(qr_encrypted),
          qrImage: await QRCode.toDataURL(decrypt(qr_encrypted), {
            width: 220,
            margin: 2,
          }),
        };
      }),
    );
  }
  @Post("payments/:id/simulate") @Roles("CUSTOMER") async simulate(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string,
  ) {
    if (
      process.env.DEMO_PAYMENTS !== "true" ||
      process.env.NODE_ENV === "production"
    )
      fail("DEMO_DISABLED", "Thanh toán giả lập đã tắt.", 403);
    const { outcome } = parse(simulationSchema, body);
    uuid(id);
    const result = (await this.bookings.idempotent(
      req.user.id,
      "simulation",
      key,
      { id, outcome },
      async (m) => {
        const [ref] = await m.query(
          "SELECT b.id FROM bookings b JOIN payments p ON p.booking_id=b.id WHERE p.id=$1 AND b.owner_id=$2",
          [id, req.user.id],
        );
        if (!ref) fail("NOT_FOUND", "Không tìm thấy thanh toán.", 404);
        await m.query("SELECT id FROM bookings WHERE id=$1 FOR UPDATE", [
          ref.id,
        ]);
        const [payment] = await m.query(
          "SELECT * FROM payments WHERE id=$1 FOR UPDATE",
          [id],
        );
        if (outcome === "timeout") {
          if (payment.status === "PENDING")
            await m.query(`UPDATE payments SET status='UNKNOWN' WHERE id=$1`, [
              id,
            ]);
          return { timeout: true };
        }
        return {
          event: {
            eventId: randomUUID(),
            paymentId: id,
            amount: payment.amount,
            currency: "VND" as const,
            status:
              outcome === "success"
                ? ("SUCCEEDED" as const)
                : ("FAILED" as const),
          },
        };
      },
    )) as { timeout?: boolean; event?: z.infer<typeof eventSchema> };
    if (result.timeout)
      return {
        status: "UNKNOWN",
        message: "Chưa xác định kết quả; cần đối soát trước khi thu lại.",
      };
    // The demo adapter creates a provider event; the browser never chooses amount or marks the booking paid.
    return this.bookings.callback(result.event!);
  }
  @Get("admin/reconciliation") @Roles("MANAGER") async reconciliation(
    @Req() req: AuthRequest,
  ) {
    return this.db.query(
      `SELECT r.*,p.amount,b.id AS booking_id FROM reconciliation_cases r JOIN payments p ON p.id=r.payment_id JOIN bookings b ON b.id=p.booking_id JOIN holds h ON h.id=b.hold_id JOIN showtimes s ON s.id=h.showtime_id JOIN auditoriums a ON a.id=s.auditorium_id JOIN staff_cinema_assignments sa ON sa.cinema_id=a.cinema_id WHERE sa.user_id=$1 ORDER BY r.created_at DESC`,
      [req.user.id],
    );
  }
  @Post("check-in/inspect") @Roles("GATE") inspect(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    const { token } = parse(
      z.object({ token: z.string().min(32).max(100) }),
      body,
    );
    return this.db.transaction((m) =>
      this.inspectTicket(m, req.user.id, token, false),
    );
  }
  @Post("check-in/confirm") @Roles("GATE") confirm(
    @Req() req: AuthRequest,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string,
  ) {
    const input = parse(
      z.object({
        token: z.string().min(32).max(100),
        ageVerified: z.literal(true),
      }),
      body,
    );
    return this.bookings.idempotent(
      req.user.id,
      "check-in",
      key,
      input,
      async (m) => {
        const ticket = await this.inspectTicket(
          m,
          req.user.id,
          input.token,
          true,
        );
        await m.query(`UPDATE tickets SET status='CHECKED_IN' WHERE id=$1`, [
          ticket.id,
        ]);
        await m.query(
          "INSERT INTO check_ins(ticket_id,staff_id) VALUES($1,$2)",
          [ticket.id, req.user.id],
        );
        await m.query(
          `INSERT INTO audit_logs(actor_id,action,entity_id) VALUES($1,'ticket.checked_in',$2)`,
          [req.user.id, ticket.id],
        );
        return { id: ticket.id, status: "CHECKED_IN" };
      },
    );
  }
  private async inspectTicket(
    m: import("typeorm").EntityManager,
    staffId: string,
    token: string,
    lock: boolean,
  ) {
    const [ticket] = await m.query(
      `SELECT t.id,t.status,i.movie_title,i.seat_label,s.starts_at,s.status AS show_status,m.rating,a.name AS room FROM tickets t JOIN booking_items i ON i.id=t.item_id JOIN showtimes s ON s.id=i.showtime_id JOIN movies m ON m.id=s.movie_id JOIN auditoriums a ON a.id=s.auditorium_id JOIN staff_cinema_assignments sa ON sa.cinema_id=a.cinema_id WHERE t.qr_hash=$1 AND sa.user_id=$2 ${lock ? "FOR UPDATE OF t" : ""}`,
      [hash(token), staffId],
    );
    if (!ticket)
      fail("NOT_FOUND", "Không tìm thấy vé trong rạp được phân công.", 404);
    const [clock] = await m.query("SELECT clock_timestamp() AS now");
    const delta = ticket.starts_at.getTime() - clock.now.getTime();
    if (
      ticket.status !== "ISSUED" ||
      ticket.show_status !== "SCHEDULED" ||
      delta > 30 * 60000 ||
      delta < -15 * 60000
    )
      fail(
        "TICKET_NOT_ELIGIBLE",
        "Vé đã dùng, vô hiệu hoặc ngoài thời gian check-in.",
      );
    return ticket;
  }
}
@Controller("webhooks/payments")
export class WebhookController {
  constructor(@Inject(BookingService) private bookings: BookingService) {}
  @Post("demo") callback(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-payment-signature") signature: string,
    @Body() body: unknown,
  ) {
    const expected = createHmac("sha256", secret("PAYMENT_WEBHOOK_SECRET"))
      .update(req.rawBody || Buffer.alloc(0))
      .digest();
    const actual = Buffer.from(signature || "", "hex");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      fail("INVALID_SIGNATURE", "Chữ ký thanh toán không hợp lệ.", 401);
    return this.bookings.callback(parse(eventSchema, body));
  }
}
@Module({
  imports: [AuthModule],
  controllers: [CatalogController, CinemaController, WebhookController],
  providers: [BookingService],
  exports: [BookingService],
})
export class CinemaModule {}
