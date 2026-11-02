import {
  Body,
  Controller,
  Headers,
  Inject,
  Module,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { z } from "zod";
import { AuthModule, AuthRequest, JwtGuard, RoleGuard, Roles } from "./auth";
import { CinemaModule } from "./cinema";
import { ChangesModule, ChangesService } from "./changes";
import { BookingService } from "./booking.service";
import { PaymentGateway } from "./payments";
import { audit, scopedBooking } from "./access";
import { fail, parse, uuid } from "./http";
@Controller("admin/reconciliation")
@UseGuards(JwtGuard, RoleGuard)
@Roles("MANAGER")
export class ReconciliationController {
  constructor(
    @Inject(DataSource) private db: DataSource,
    @Inject(BookingService) private bookings: BookingService,
    @Inject(ChangesService) private changes: ChangesService,
    @Inject(PaymentGateway) private gateway: PaymentGateway,
  ) {}
  @Post(":id/approve-refund") async approve(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string,
  ) {
    uuid(id);
    const { reason } = parse(
      z.object({ reason: z.string().trim().min(1).max(1000) }).strict(),
      body,
    );
    return this.bookings.idempotent(
      req.user.id,
      "reconciliation.approve",
      key,
      { id, reason },
      async (m) => {
        const [ref] = await m.query(
          "SELECT p.booking_id,r.payment_id FROM reconciliation_cases r JOIN payments p ON p.id=r.payment_id WHERE r.id=$1",
          [id],
        );
        if (!ref) fail("NOT_FOUND", "Không tìm thấy trường hợp đối soát.", 404);
        const b = await scopedBooking(m, req.user, ref.booking_id, true);
        const [p] = await m.query(
          "SELECT * FROM payments WHERE id=$1 FOR UPDATE",
          [ref.payment_id],
        );
        const [r] = await m.query(
          "SELECT * FROM reconciliation_cases WHERE id=$1 FOR UPDATE",
          [id],
        );
        if (
          b.provenance !== "OPERATIONAL" ||
          p.status !== "SUCCEEDED" ||
          !p.reconciliation_required
        )
          fail("NO_PAYMENT_EVIDENCE", "Không có bằng chứng tiền thật hợp lệ.");
        if (!["PENDING_APPROVAL", "RECONCILIATION_REQUIRED"].includes(r.status))
          fail("REQUEST_CLOSED", "Đối soát đã xử lý.");
        if (
          (await m.query("SELECT 1 FROM refunds WHERE payment_id=$1", [p.id]))
            .length
        )
          fail(
            "REQUEST_CONFLICT",
            "Khoản thu đã có khoản hoàn; kiểm tra kết quả hiện có.",
          );
        const [refund] = await m.query(
          "INSERT INTO refunds(reconciliation_id,payment_id,amount) VALUES($1,$2,$3) RETURNING id,amount,status",
          [id, p.id, p.amount],
        );
        await m.query(
          "UPDATE reconciliation_cases SET status='APPROVED' WHERE id=$1",
          [id],
        );
        await audit(
          m,
          req.user.id,
          "reconciliation.approved",
          id,
          b.cinema_id,
          { reason, refundId: refund.id },
        );
        return refund;
      },
    );
  }
  @Post("refunds/:id/dispatch") async dispatch(
    @Req() req: AuthRequest,
    @Param("id") id: string,
  ) {
    uuid(id);
    const [r] = await this.db.query(
      "SELECT r.*,p.booking_id,p.provider_reference FROM refunds r JOIN payments p ON p.id=r.payment_id WHERE r.id=$1",
      [id],
    );
    if (!r) fail("NOT_FOUND", "Không tìm thấy khoản hoàn.", 404);
    const b = await scopedBooking(this.db.manager, req.user, r.booking_id);
    this.gateway.assertConfigured();
    if (r.request_id) {
      await this.changes.dispatchRefunds(r.request_id);
      return { id };
    }
    const [claimed] = await this.db.query(
      "WITH u AS (UPDATE refunds SET status='UNKNOWN' WHERE id=$1 AND status='CREATED' RETURNING id) SELECT * FROM u",
      [id],
    );
    if (claimed) {
      await audit(
        this.db.manager,
        req.user.id,
        "refund.dispatched",
        id,
        b.cinema_id,
      );
      try {
        const result = await this.gateway.refund(id, r.payment_id, r.amount);
        if (result.status === "PENDING")
          await this.db.query(
            "UPDATE refunds SET status='PENDING',provider_reference=$2 WHERE id=$1 AND status='UNKNOWN'",
            [id, result.reference || null],
          );
        if (result.status === "FAILED")
          await this.changes.refundEvent({
            eventId: `submission:${id}`,
            id,
            amount: r.amount,
            currency: "VND",
            status: "FAILED",
          });
      } catch {
        /* UNKNOWN requires verification. */
      }
    }
    return (
      await this.db.query("SELECT id,status,amount FROM refunds WHERE id=$1", [
        id,
      ])
    )[0];
  }
  @Post(":kind/:id/query") async query(
    @Req() req: AuthRequest,
    @Param("kind") kind: string,
    @Param("id") id: string,
  ) {
    uuid(id);
    const k = parse(z.enum(["payment", "refund"]), kind);
    const [r] = await this.db.query(
      k === "payment"
        ? "SELECT id,booking_id,amount FROM payments WHERE id=$1"
        : "SELECT r.id,p.booking_id,r.amount FROM refunds r JOIN payments p ON p.id=r.payment_id WHERE r.id=$1",
      [id],
    );
    if (!r) fail("NOT_FOUND", "Không tìm thấy giao dịch.", 404);
    const b = await scopedBooking(this.db.manager, req.user, r.booking_id);
    if (b.provenance !== "OPERATIONAL")
      fail("LEGACY_DATA", "Không đối soát dữ liệu giả lập như tiền thật.");
    this.gateway.assertConfigured();
    const result = await this.gateway.query(k, id);
    if (
      result.id !== id ||
      result.amount !== r.amount ||
      result.currency !== "VND"
    )
      fail(
        "PROVIDER_EVIDENCE_MISMATCH",
        "Bằng chứng nhà cung cấp không khớp giao dịch.",
        422,
      );
    if (result.status === "SUCCEEDED" || result.status === "FAILED") {
      // The adapter must verify amount, currency and merchant reference before returning a terminal result.
      if (k === "payment")
        await this.bookings.callback({
          eventId: result.eventId,
          paymentId: id,
          amount: result.amount,
          currency: result.currency,
          status: result.status,
        });
      else await this.changes.refundEvent(result);
    }
    await audit(
      this.db.manager,
      req.user.id,
      "reconciliation.queried",
      id,
      b.cinema_id,
      { kind: k, status: result.status },
    );
    return { id, status: result.status };
  }
}
@Module({
  imports: [AuthModule, CinemaModule, ChangesModule],
  controllers: [ReconciliationController],
})
export class ReconciliationModule {}
