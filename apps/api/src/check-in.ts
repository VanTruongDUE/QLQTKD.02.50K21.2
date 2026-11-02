import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Injectable,
  Module,
  Post,
  Query,
  Req,
  UseGuards,
  HttpException,
} from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import {
  checkInSchema,
  confirmCheckInSchema,
  CheckInInput,
} from "@starlight/contracts";
import { AuthModule, AuthRequest, JwtGuard, RoleGuard, Roles } from "./auth";
import { CinemaModule } from "./cinema";
import { BookingService } from "./booking.service";
import { fail, parse, uuid } from "./http";
import { hash } from "./security";

export function checkInWindow(startsAt: Date, now: Date) {
  const delta = startsAt.getTime() - now.getTime();
  if (delta > 30 * 60000)
    fail(
      "CHECK_IN_TOO_EARLY",
      "Chưa đến giờ check-in. Cửa mở trước giờ chiếu 30 phút.",
    );
  if (delta < -15 * 60000)
    fail("CHECK_IN_CLOSED", "Đã quá giờ check-in: hơn 15 phút sau giờ chiếu.");
}

@Injectable()
export class CheckInService {
  constructor(
    @Inject(DataSource) private db: DataSource,
    @Inject(BookingService) private bookings: BookingService,
  ) {}

  async showtimes(staffId: string) {
    return this.db.query(
      `SELECT s.id,m.title,m.description,m.duration_minutes,m.rating,m.poster,
      s.starts_at,s.ends_at,s.status,a.name AS room,c.name AS cinema,
      (SELECT count(*)::int FROM tickets t JOIN booking_items bi ON bi.id=t.item_id
       JOIN bookings b ON b.id=bi.booking_id
       WHERE bi.showtime_id=s.id AND b.status='CONFIRMED' AND t.status IN ('ISSUED','CHECKED_IN')) AS "ticketCount",
      (SELECT count(*)::int FROM tickets t JOIN booking_items bi ON bi.id=t.item_id
       JOIN bookings b ON b.id=bi.booking_id
       WHERE bi.showtime_id=s.id AND b.status='CONFIRMED' AND t.status='ISSUED') AS "eligibleTicketCount",
      (SELECT count(*)::int FROM check_ins ci JOIN tickets t ON t.id=ci.ticket_id
       JOIN booking_items bi ON bi.id=t.item_id JOIN bookings b ON b.id=bi.booking_id
       WHERE bi.showtime_id=s.id AND b.status='CONFIRMED') AS "checkedInCount",
      s.starts_at-interval '30 minutes' AS "checkInOpensAt",s.starts_at+interval '15 minutes' AS "checkInClosesAt"
      FROM showtimes s JOIN movies m ON m.id=s.movie_id JOIN auditoriums a ON a.id=s.auditorium_id
      JOIN cinemas c ON c.id=a.cinema_id JOIN staff_cinema_assignments sa ON sa.cinema_id=c.id
      WHERE sa.user_id=$1 AND s.provenance='OPERATIONAL' AND s.starts_at BETWEEN clock_timestamp()-interval '1 day' AND clock_timestamp()+interval '7 days'
      ORDER BY s.starts_at DESC`,
      [staffId],
    );
  }

  async history(staffId: string, showtimeId: string) {
    await this.authorizeShow(this.db.manager, staffId, showtimeId);
    return this.db.query(
      `SELECT t.id,'CHECKED_IN' AS status,ci.created_at AS "checkedInAt",ci.staff_id AS "staffId",
      u.email AS "staffEmail",i.seat_label,i.movie_title FROM check_ins ci JOIN tickets t ON t.id=ci.ticket_id
      JOIN booking_items i ON i.id=t.item_id JOIN users u ON u.id=ci.staff_id
      WHERE i.showtime_id=$1 ORDER BY ci.created_at DESC LIMIT 50`,
      [showtimeId],
    );
  }

  private async authorizeShow(
    m: EntityManager,
    staffId: string,
    showtimeId: string,
  ) {
    const [show] = await m.query(
      `SELECT s.id FROM showtimes s JOIN auditoriums a ON a.id=s.auditorium_id
      JOIN staff_cinema_assignments sa ON sa.cinema_id=a.cinema_id WHERE s.id=$1 AND sa.user_id=$2`,
      [showtimeId, staffId],
    );
    if (!show)
      fail(
        "SHOWTIME_NOT_FOUND",
        "Không tìm thấy suất chiếu trong rạp được phân công.",
        404,
      );
  }

  inspect(staffId: string, input: CheckInInput) {
    return this.db.transaction((m) => this.validateTicket(m, staffId, input));
  }

  async confirm(
    staffId: string,
    input: CheckInInput & { ageVerified: true },
    key?: string,
  ) {
    await this.authorizeShow(this.db.manager, staffId, input.showtimeId);
    return this.bookings.idempotent(
      staffId,
      "check-in",
      key,
      input,
      async (m) => {
        const ticket = await this.validateTicket(m, staffId, input);
        await m.query(
          `UPDATE tickets SET status='CHECKED_IN' WHERE id=$1 AND status='ISSUED'`,
          [ticket.id],
        );
        const [receipt] = await m.query(
          `INSERT INTO check_ins(ticket_id,staff_id,created_at) VALUES($1,$2,clock_timestamp())
        RETURNING ticket_id AS id,created_at AS "checkedInAt",staff_id AS "staffId"`,
          [ticket.id, staffId],
        );
        await m.query(
          `INSERT INTO audit_logs(actor_id,action,entity_id,cinema_id) SELECT $1,'ticket.checked_in',$2,a.cinema_id FROM showtimes s JOIN auditoriums a ON a.id=s.auditorium_id WHERE s.id=$3`,
          [staffId, ticket.id, input.showtimeId],
        );
        return { ...receipt, status: "CHECKED_IN" };
      },
    );
  }

  private async validateTicket(
    m: EntityManager,
    staffId: string,
    input: CheckInInput,
  ) {
    await this.authorizeShow(m, staffId, input.showtimeId);
    // Serialize with change/refund operations on the parent booking before locking its ticket/showtime.
    await m.query(
      `SELECT b.id FROM bookings b JOIN booking_items i ON i.booking_id=b.id JOIN tickets t ON t.item_id=i.id
      JOIN showtimes s ON s.id=i.showtime_id JOIN auditoriums a ON a.id=s.auditorium_id JOIN staff_cinema_assignments sa ON sa.cinema_id=a.cinema_id
      WHERE ${input.ticketCode ? "t.id=$1::uuid" : "t.qr_hash=$1"} AND sa.user_id=$2 FOR UPDATE OF b`,
      [input.ticketCode || hash(input.token!), staffId],
    );
    const [ticket] = await m.query(
      `SELECT t.id,t.status,i.movie_title,i.seat_label,i.showtime_id,s.starts_at,
      s.status AS show_status,b.status AS booking_status,b.provenance,m.rating,a.name AS room,c.name AS cinema
      FROM tickets t JOIN booking_items i ON i.id=t.item_id JOIN bookings b ON b.id=i.booking_id
      JOIN showtimes s ON s.id=i.showtime_id JOIN movies m ON m.id=s.movie_id
      JOIN auditoriums a ON a.id=s.auditorium_id JOIN cinemas c ON c.id=a.cinema_id
      JOIN staff_cinema_assignments sa ON sa.cinema_id=c.id
      WHERE ${input.ticketCode ? "t.id=$1::uuid" : "t.qr_hash=$1"} AND sa.user_id=$2
      FOR UPDATE OF b,s,t`,
      [input.ticketCode || hash(input.token!), staffId],
    );
    if (!ticket)
      fail(
        "TICKET_NOT_FOUND",
        "Mã vé hoặc QR không tồn tại trong rạp được phân công.",
        404,
      );
    if (ticket.showtime_id !== input.showtimeId)
      fail(
        "WRONG_SHOWTIME",
        "Vé thuộc suất chiếu khác. Hãy kiểm tra suất trên vé.",
      );
    if (ticket.provenance !== "OPERATIONAL")
      fail(
        "LEGACY_DATA",
        "Vé cũ thuộc dữ liệu giả lập, không dùng cho vận hành.",
      );
    const reasons: Record<string, [string, string]> = {
      CHECKED_IN: [
        "ALREADY_CHECKED_IN",
        "Vé đã check-in, không thể sử dụng lần nữa.",
      ],
      VOIDED: ["TICKET_VOIDED", "Vé đã bị hủy."],
      REFUNDED: ["TICKET_REFUNDED", "Vé đã được hoàn tiền."],
      REPLACED: ["TICKET_REPLACED", "Vé đã được đổi; hãy xuất trình vé mới."],
    };
    const reason = reasons[ticket.status];
    if (reason) fail(...reason);
    if (ticket.status !== "ISSUED" || ticket.booking_status !== "CONFIRMED")
      fail(
        "TICKET_NOT_VALID",
        "Vé chưa được phát hành hợp lệ hoặc đơn đã hủy.",
      );
    if (ticket.show_status !== "SCHEDULED")
      fail(
        "SHOWTIME_UNAVAILABLE",
        "Suất chiếu đã hủy hoặc thay đổi, không thể nhận khách.",
      );
    if (
      (
        await m.query(
          "SELECT ticket_id FROM ticket_operation_locks WHERE ticket_id=$1",
          [ticket.id],
        )
      ).length
    )
      fail(
        "TICKET_OPERATION_PENDING",
        "Vé đang có yêu cầu đổi/hoàn cần xử lý.",
      );
    if (
      (
        await m.query("SELECT ticket_id FROM check_ins WHERE ticket_id=$1", [
          ticket.id,
        ])
      ).length
    )
      fail("ALREADY_CHECKED_IN", "Vé đã check-in, không thể sử dụng lần nữa.");
    const [clock] = await m.query("SELECT clock_timestamp() AS now");
    checkInWindow(ticket.starts_at, clock.now);
    const { show_status, booking_status, ...details } = ticket;
    void show_status;
    void booking_status;
    return details;
  }
  async rejected(staffId: string, showtimeId: string, error: unknown) {
    if (error instanceof HttpException) {
      const body = error.getResponse() as { code?: string };
      await this.db.query(
        `INSERT INTO audit_logs(actor_id,action,entity_id,cinema_id,details)
        SELECT $1,'check-in.rejected',s.id,a.cinema_id,$3 FROM showtimes s JOIN auditoriums a ON a.id=s.auditorium_id
        JOIN staff_cinema_assignments sa ON sa.cinema_id=a.cinema_id WHERE sa.user_id=$1 AND s.id=$2`,
        [
          staffId,
          showtimeId,
          JSON.stringify({ code: body.code || "REQUEST_ERROR" }),
        ],
      );
    }
    throw error;
  }
}

@Controller("check-in")
@UseGuards(JwtGuard, RoleGuard)
@Roles("STAFF")
export class CheckInController {
  constructor(@Inject(CheckInService) private service: CheckInService) {}
  @Get("showtimes") showtimes(@Req() req: AuthRequest) {
    return this.service.showtimes(req.user.id);
  }
  @Get("history") history(
    @Req() req: AuthRequest,
    @Query("showtimeId") id: string,
  ) {
    return this.service.history(req.user.id, uuid(id));
  }
  @Post("inspect") inspect(@Req() req: AuthRequest, @Body() body: unknown) {
    const input = parse(checkInSchema, body);
    return this.service
      .inspect(req.user.id, input)
      .catch((error) =>
        this.service.rejected(req.user.id, input.showtimeId, error),
      );
  }
  @Post("confirm") confirm(
    @Req() req: AuthRequest,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string,
  ) {
    const input = parse(confirmCheckInSchema, body);
    return this.service
      .confirm(req.user.id, input, key)
      .catch((error) =>
        this.service.rejected(req.user.id, input.showtimeId, error),
      );
  }
}
@Module({
  imports: [AuthModule, CinemaModule],
  controllers: [CheckInController],
  providers: [CheckInService],
})
export class CheckInModule {}
