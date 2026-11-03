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
  HttpCode,
} from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { DataSource } from "typeorm";
import QRCode from "qrcode";
import { holdSchema, bookingSchema } from "@starlight/contracts";
import { AuthModule, JwtGuard, RoleGuard, Roles, AuthRequest } from "./auth";
import { BookingService } from "./booking.service";
import { parse, uuid } from "./http";
import { decrypt } from "./security";
import { PaymentGateway } from "./payments";
@Controller()
export class CatalogController {
  constructor(@Inject(DataSource) private db: DataSource) {}
  @Get("health") async health() {
    await this.db.query("SELECT 1");
    return { ok: true };
  }
  @Get("movies") movies() {
    return this.db.query("SELECT * FROM movies WHERE active AND provenance='OPERATIONAL' ORDER BY title");
  }
  @Get("cinemas") cinemas() {
    return this.db.query("SELECT id,name FROM cinemas WHERE provenance='OPERATIONAL' ORDER BY name");
  }
  @Get("products") products() {
    return this.db.query(
      `SELECT id, name, description, category, price, original_price, image_url,
        recommended_min_people, recommended_max_people, badge, icon_name, sort_order
       FROM products
       WHERE active AND provenance='OPERATIONAL'
       ORDER BY sort_order, price, name`,
    );
  }
  @Get("showtimes") showtimes() {
    return this.db.query(
      `SELECT s.*, a.name AS room, c.name AS cinema, c.id AS cinema_id, m.title AS movie_title FROM showtimes s JOIN auditoriums a ON a.id=s.auditorium_id JOIN cinemas c ON c.id=a.cinema_id JOIN movies m ON m.id=s.movie_id WHERE s.starts_at>clock_timestamp() - interval '2 hours' AND s.status='SCHEDULED' AND s.provenance='OPERATIONAL' AND a.provenance='OPERATIONAL' AND c.provenance='OPERATIONAL' AND m.provenance='OPERATIONAL' ORDER BY s.starts_at`,
    );
  }
  @Get("showtimes/:id/seats") async seats(@Param("id") id: string) {
    return {
      serverTime: new Date(),
      seats: await this.db.query(
        `SELECT ss.seat_id AS id,se.label,CASE WHEN ss.ticket_id IS NOT NULL THEN 'SOLD' WHEN h.status='ACTIVE' AND h.expires_at>clock_timestamp() THEN 'HELD' ELSE 'AVAILABLE' END AS status FROM showtime_seats ss JOIN seats se ON se.id=ss.seat_id JOIN showtimes st ON st.id=ss.showtime_id LEFT JOIN holds h ON h.id=ss.hold_id WHERE ss.showtime_id=$1 AND st.provenance='OPERATIONAL' ORDER BY se.label`,
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
  @Get("me/bookings") @Roles("CUSTOMER") async orders(@Req() req: AuthRequest) {
    return this.db.query(
      `SELECT b.*,h.expires_at,COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id,'status',p.status,'reconciliationRequired',p.reconciliation_required) ORDER BY p.created_at DESC) FROM payments p WHERE p.booking_id=b.id),'[]'::jsonb) AS payments FROM bookings b JOIN holds h ON h.id=b.hold_id WHERE b.owner_id=$1 ORDER BY b.created_at DESC`,
      [req.user.id],
    );
  }
  @Get("me/tickets") @Roles("CUSTOMER") async tickets(@Req() req: AuthRequest) {
    const tickets = await this.db.query(
      `SELECT t.*,i.movie_title,i.seat_label,i.booking_id,i.showtime_id,b.created_at,s.starts_at,s.price,
      a.name AS room,c.id AS cinema_id,c.name AS cinema,m.id AS movie_id,m.duration_minutes,m.rating,m.poster,m.description
      FROM tickets t JOIN booking_items i ON i.id=t.item_id JOIN bookings b ON b.id=i.booking_id
      JOIN showtimes s ON s.id=i.showtime_id JOIN movies m ON m.id=s.movie_id
      JOIN auditoriums a ON a.id=s.auditorium_id JOIN cinemas c ON c.id=a.cinema_id
      WHERE b.owner_id=$1 ORDER BY b.created_at DESC,t.id`,
      [req.user.id],
    );
    return Promise.all(
      tickets.map(async (t: Record<string, any>) => {
        const { qr_hash, qr_encrypted, ...publicTicket } = t;
        void qr_hash;
        if (!["ISSUED", "CHECKED_IN"].includes(t.status)) return publicTicket;
        const qrToken = decrypt(qr_encrypted);
        return {
          ...publicTicket,
          qrToken,
          qrImage: await QRCode.toDataURL(qrToken, {
            width: 220,
            margin: 2,
          }),
        };
      }),
    );
  }
  @Get("admin/reconciliation") @Roles("MANAGER") async reconciliation(
    @Req() req: AuthRequest,
  ) {
    return this.db.query(
      `SELECT r.*,p.amount,b.id AS booking_id FROM reconciliation_cases r JOIN payments p ON p.id=r.payment_id JOIN bookings b ON b.id=p.booking_id JOIN holds h ON h.id=b.hold_id JOIN showtimes s ON s.id=h.showtime_id JOIN auditoriums a ON a.id=s.auditorium_id JOIN staff_cinema_assignments sa ON sa.cinema_id=a.cinema_id WHERE sa.user_id=$1 ORDER BY r.created_at DESC`,
      [req.user.id],
    );
  }
}

@Controller("webhooks/payments")
export class PaymentWebhookController {
  constructor(
    @Inject(BookingService) private bookings: BookingService,
    @Inject(PaymentGateway) private gateway: PaymentGateway,
  ) {}

  @Post("momo")
  @HttpCode(204)
  async momo(@Req() req: RawBodyRequest<Request>, @Headers() headers: Record<string, string>) {
    if (!req.rawBody) throw new Error("Raw request body is required for MoMo signature verification.");
    const event = this.gateway.verifyWebhook(req.rawBody, headers);
    await this.bookings.callback({
      eventId: event.eventId,
      paymentId: event.id,
      amount: event.amount,
      currency: event.currency,
      status: event.status,
    });
  }
}
@Module({
  imports: [AuthModule],
  controllers: [CatalogController, CinemaController, PaymentWebhookController],
  providers: [BookingService, PaymentGateway],
  exports: [BookingService, PaymentGateway],
})
export class CinemaModule {}
