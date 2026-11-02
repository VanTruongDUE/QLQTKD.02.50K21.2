import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Injectable,
  Module,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { Principal } from "@starlight/contracts";
import { AuthModule, AuthRequest, JwtGuard, RoleGuard, Roles } from "./auth";
import { CinemaModule } from "./cinema";
import { BookingService } from "./booking.service";
import { PaymentGateway, VerifiedMoneyEvent } from "./payments";
import { audit, scopedBooking } from "./access";
import { encrypt, hash } from "./security";
import { fail, parse, uuid } from "./http";

const ids = z
  .array(z.uuid())
  .max(8)
  .refine((x) => new Set(x).size === x.length);
const fields = {
  kind: z.enum(["EXCHANGE", "REFUND"]),
  ticketIds: ids.refine((x) => x.length > 0),
  productItemIds: ids.default([]),
  targetShowtimeId: z.uuid().optional(),
  seatIds: ids.optional(),
  ownerVerified: z.boolean().optional(),
};
const quoteSchema = z.object(fields).strict();
const requestSchema = z
  .object({
    ...fields,
    quoteHash: z.string().length(64),
    customerConfirmed: z.literal(true),
  })
  .strict();
type Input = z.infer<typeof quoteSchema>;
type Actor = Pick<Principal, "id" | "role">;
export function changeWindow(startsAt: Date, now: Date) {
  if (startsAt.getTime() - now.getTime() < 3600000)
    fail("CHANGE_TOO_LATE", "Cần ít nhất 60 phút trước giờ chiếu.");
}

@Injectable()
export class ChangesService {
  readonly bookings: BookingService;
  constructor(
    @Inject(DataSource) readonly db: DataSource,
    @Inject(PaymentGateway)
    readonly gateway: PaymentGateway = new PaymentGateway(),
  ) {
    this.bookings = new BookingService(db, gateway);
  }
  private async inspect(
    m: EntityManager,
    actor: Actor,
    p: Input,
    ownRequest?: string,
  ) {
    const [ref] = await m.query(
      "SELECT i.booking_id FROM tickets t JOIN booking_items i ON i.id=t.item_id WHERE t.id=$1",
      [p.ticketIds[0]],
    );
    if (!ref) fail("NOT_FOUND", "Không tìm thấy vé.", 404);
    const b = await scopedBooking(m, actor, ref.booking_id, true);
    if (b.provenance !== "OPERATIONAL")
      fail(
        "LEGACY_DATA",
        "Vé cũ chỉ dùng tra cứu; không chuyển giao dịch giả lập thành tiền thật.",
      );
    if (b.status !== "CONFIRMED")
      fail("TICKET_NOT_ELIGIBLE", "Đơn chưa xác nhận.");
    if (actor.role === "STAFF" && p.ownerVerified !== true)
      fail(
        "OWNER_VERIFICATION_REQUIRED",
        "Nhân viên cần xác minh chủ vé.",
        422,
      );
    const tickets = await m.query(
      `SELECT t.*,i.showtime_id,i.seat_id,s.starts_at,s.status AS show_status,s.movie_id,a.cinema_id FROM tickets t JOIN booking_items i ON i.id=t.item_id JOIN showtimes s ON s.id=i.showtime_id JOIN auditoriums a ON a.id=s.auditorium_id WHERE t.id=ANY($1::uuid[]) AND i.booking_id=$2 ORDER BY t.id FOR UPDATE OF s,t`,
      [p.ticketIds, b.id],
    );
    if (
      tickets.length !== p.ticketIds.length ||
      new Set(tickets.map((t: any) => t.showtime_id)).size !== 1
    )
      fail("NOT_FOUND", "Vé phải thuộc cùng đơn và cùng suất.", 404);
    const [clock] = await m.query("SELECT clock_timestamp() AS now");
    for (const t of tickets) {
      if (t.status !== "ISSUED" || t.show_status !== "SCHEDULED")
        fail("TICKET_NOT_ELIGIBLE", "Vé hoặc suất không còn hợp lệ.");
      changeWindow(t.starts_at, clock.now);
      const [lock] = await m.query(
        "SELECT request_id FROM ticket_operation_locks WHERE ticket_id=$1",
        [t.id],
      );
      if (lock && lock.request_id !== ownRequest)
        fail("REQUEST_CONFLICT", "Vé đang có yêu cầu khác.");
      if (
        (await m.query("SELECT 1 FROM check_ins WHERE ticket_id=$1", [t.id]))
          .length
      )
        fail("TICKET_NOT_ELIGIBLE", "Vé đã check-in.");
    }
    const products = p.productItemIds.length
      ? await m.query(
          "SELECT * FROM order_product_items WHERE id=ANY($1::uuid[]) AND booking_id=$2 ORDER BY id FOR UPDATE",
          [p.productItemIds, b.id],
        )
      : [];
    if (products.length !== p.productItemIds.length)
      fail("NOT_FOUND", "Combo không thuộc đơn.", 404);
    for (const item of products) {
      if (item.status !== "UNREDEEMED")
        fail("PRODUCT_UNAVAILABLE", "Chỉ hoàn combo chưa nhận.");
      const [lock] = await m.query(
        "SELECT request_id FROM product_operation_locks WHERE item_id=$1",
        [item.id],
      );
      if (lock && lock.request_id !== ownRequest)
        fail("REQUEST_CONFLICT", "Combo đang có yêu cầu khác.");
    }
    let target: any = null;
    if (p.kind === "EXCHANGE") {
      if (
        p.productItemIds.length ||
        !p.targetShowtimeId ||
        p.seatIds?.length !== tickets.length
      )
        fail(
          "INVALID_EXCHANGE",
          "Đổi giữ nguyên số vé, combo giữ ở đơn gốc.",
          422,
        );
      const [s] = await m.query(
        "SELECT s.*,a.cinema_id FROM showtimes s JOIN auditoriums a ON a.id=s.auditorium_id WHERE s.id=$1 FOR SHARE OF s",
        [p.targetShowtimeId],
      );
      if (
        !s ||
        s.status !== "SCHEDULED" ||
        s.provenance !== "OPERATIONAL" ||
        s.cinema_id !== b.cinema_id ||
        s.movie_id !== tickets[0].movie_id
      )
        fail("INVALID_EXCHANGE", "Phải đổi cùng phim, cùng rạp.");
      changeWindow(s.starts_at, clock.now);
      target = s;
      if (
        p.targetShowtimeId === tickets[0].showtime_id &&
        p.seatIds!.some((id) => tickets.some((t: any) => t.seat_id === id))
      )
        fail("INVALID_EXCHANGE", "Ghế mới không được trùng ghế đang sử dụng.");
    } else if (p.targetShowtimeId || p.seatIds)
      fail("INVALID_REFUND", "Hoàn vé không có ghế thay thế.", 422);
    const value = tickets.reduce((sum: number, t: any) => sum + t.value_vnd, 0);
    const combo = products.reduce(
      (sum: number, p: any) => sum + p.unit_price * p.quantity,
      0,
    );
    const next = target ? target.price * tickets.length : 0;
    const quote = {
      value,
      combo,
      newValue: next,
      payable: Math.max(0, next - value),
      refundable:
        p.kind === "REFUND" ? value + combo : Math.max(0, value - next),
      fee: 0,
      policyVersion: "MODEL-1.0",
    };
    const expiresAt = new Date(
      Math.min(
        tickets[0].starts_at.getTime(),
        target?.starts_at.getTime() || Infinity,
      ) - 3600000,
    );
    return {
      b,
      tickets,
      products,
      target,
      quote,
      expiresAt,
      quoteHash: hash(JSON.stringify({ p, quote })),
    };
  }
  quote(actor: Actor, p: Input) {
    return this.db.transaction(async (m) => {
      const x = await this.inspect(m, actor, p);
      return { ...x.quote, quoteHash: x.quoteHash, expiresAt: x.expiresAt };
    });
  }
  async create(
    actor: Actor,
    input: z.infer<typeof requestSchema>,
    key?: string,
  ) {
    const { quoteHash, customerConfirmed, ...p } = input;
    void customerConfirmed;
    const [ref] = await this.db.query(
      "SELECT i.booking_id FROM tickets t JOIN booking_items i ON i.id=t.item_id WHERE t.id=$1",
      [p.ticketIds[0]],
    );
    if (!ref) fail("NOT_FOUND", "Không tìm thấy vé.", 404);
    await scopedBooking(this.db.manager, actor, ref.booking_id);
    return this.bookings.idempotent(
      actor.id,
      "change.create",
      key,
      input,
      async (m) => {
        const x = await this.inspect(m, actor, p);
        if (x.quoteHash !== quoteHash)
          fail("QUOTE_CHANGED", "Báo giá đã thay đổi; cần khách xác nhận lại.");
        const [r] = await m.query(
          "INSERT INTO change_requests(owner_id,created_by,cinema_id,booking_id,kind,status,payload,quote,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
          [
            x.b.owner_id,
            actor.id,
            x.b.cinema_id,
            x.b.id,
            p.kind,
            x.quote.refundable > 0 ? "PENDING_APPROVAL" : "APPROVED",
            JSON.stringify(p),
            JSON.stringify(x.quote),
            x.expiresAt,
          ],
        );
        for (const t of x.tickets) {
          await m.query(
            "INSERT INTO ticket_operation_locks(ticket_id,request_id) VALUES($1,$2)",
            [t.id, r.id],
          );
          await m.query(
            "INSERT INTO change_request_items(request_id,old_ticket_id) VALUES($1,$2)",
            [r.id, t.id],
          );
        }
        for (const item of x.products)
          await m.query("INSERT INTO product_operation_locks VALUES($1,$2)", [
            item.id,
            r.id,
          ]);
        await audit(m, actor.id, "change.created", r.id, r.cinema_id, {
          kind: r.kind,
          quote: x.quote,
        });
        return r;
      },
    );
  }
  async get(actor: Actor, id: string, m = this.db.manager, lock = false) {
    const [ref] = await m.query(
      "SELECT booking_id FROM change_requests WHERE id=$1",
      [id],
    );
    if (!ref) fail("NOT_FOUND", "Không tìm thấy yêu cầu.", 404);
    await scopedBooking(m, actor, ref.booking_id, lock);
    const [r] = await m.query(
      `SELECT * FROM change_requests WHERE id=$1 ${lock ? "FOR UPDATE" : ""}`,
      [id],
    );
    return r;
  }
  async details(actor:Actor,id:string) {
    const r=await this.get(actor,id);
    return {...r,
      items:await this.db.query('SELECT old_ticket_id,new_ticket_id FROM change_request_items WHERE request_id=$1',[id]),
      payments:await this.db.query('SELECT id,amount,status,checkout_url,reconciliation_required FROM payments WHERE change_request_id=$1',[id]),
      refunds:await this.db.query('SELECT id,amount,status FROM refunds WHERE request_id=$1',[id])};
  }
  async list(actor: Actor) {
    if (actor.role === "CUSTOMER")
      return this.db.query(
        "SELECT * FROM change_requests WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 100",
        [actor.id],
      );
    return this.db.query(
      "SELECT r.* FROM change_requests r JOIN staff_cinema_assignments sa ON sa.cinema_id=r.cinema_id WHERE sa.user_id=$1 ORDER BY r.created_at DESC LIMIT 100",
      [actor.id],
    );
  }
  private async release(
    m: EntityManager,
    r: any,
    status: string,
    actorId: string,
    reason?: string,
  ) {
    if (r.new_booking_id)
      await m.query("SELECT id FROM bookings WHERE id=$1 FOR UPDATE", [
        r.new_booking_id,
      ]);
    if (r.hold_id) {
      await m.query("SELECT id FROM holds WHERE id=$1 FOR UPDATE", [r.hold_id]);
      await m.query("UPDATE showtime_seats SET hold_id=NULL WHERE hold_id=$1", [
        r.hold_id,
      ]);
      await m.query(
        "UPDATE holds SET status='RELEASED' WHERE id=$1 AND status='ACTIVE'",
        [r.hold_id],
      );
    }
    if (r.new_booking_id)
      await m.query(
        "UPDATE bookings SET status='CANCELLED' WHERE id=$1 AND status='PENDING_PAYMENT'",
        [r.new_booking_id],
      );
    await m.query("DELETE FROM ticket_operation_locks WHERE request_id=$1", [
      r.id,
    ]);
    await m.query("DELETE FROM product_operation_locks WHERE request_id=$1", [
      r.id,
    ]);
    await m.query(
      "UPDATE change_requests SET status=$2,reason=$3 WHERE id=$1",
      [r.id, status, reason || null],
    );
    await audit(
      m,
      actorId,
      `change.${status.toLowerCase()}`,
      r.id,
      r.cinema_id,
      { reason },
    );
    return { id: r.id, status };
  }
  async decide(
    actor: Actor,
    id: string,
    action: "approve" | "reject" | "cancel",
    reason: string,
    key?: string,
  ) {
    await this.get(actor, id);
    return this.bookings.idempotent(
      actor.id,
      `change.${action}`,
      key,
      { id, reason },
      async (m) => {
        const r = await this.get(actor, id, m, true);
        if (!["PENDING_APPROVAL", "APPROVED"].includes(r.status))
          fail("REQUEST_CLOSED", "Không thể duyệt/rút yêu cầu đã thực thi.");
        if (
          action !== "cancel" &&
          (actor.role !== "MANAGER" || r.created_by === actor.id)
        )
          fail(
            "FORBIDDEN_ROLE",
            "Chỉ quản lý khác người lập được duyệt/từ chối.",
            403,
          );
        if (action === "cancel" && actor.role === "MANAGER")
          fail("FORBIDDEN_ROLE", "Quản lý dùng thao tác từ chối.", 403);
        if (action !== "approve")
          return this.release(
            m,
            r,
            action === "cancel" ? "CANCELLED" : "REJECTED",
            actor.id,
            reason,
          );
        if (r.status !== "PENDING_APPROVAL")
          fail("REQUEST_CLOSED", "Yêu cầu không chờ duyệt.");
        const [clock] = await m.query("SELECT clock_timestamp() AS now");
        if (r.expires_at < clock.now)
          return this.release(m, r, "EXPIRED", actor.id);
        // Inspect as owner: managerial scope has already been checked above.
        await this.inspect(
          m,
          { id: r.owner_id, role: "CUSTOMER" },
          r.payload,
          r.id,
        );
        await m.query(
          "UPDATE change_requests SET status='APPROVED',approved_by=$2,reason=$3 WHERE id=$1",
          [id, actor.id, reason],
        );
        await audit(m, actor.id, "change.approved", id, r.cinema_id, {
          reason,
        });
        return { id, status: "APPROVED" };
      },
    );
  }
  private async reserveRefunds(m: EntityManager, r: any, amount: number) {
    if (amount === 0) return;
    const allocations = await m.query(
      `SELECT a.*,p.provider_reference,p.created_at, a.amount-COALESCE((SELECT sum(ra.amount) FROM refund_allocations ra JOIN refunds rf ON rf.id=ra.refund_id WHERE ra.allocation_id=a.id AND rf.status<>'FAILED'),0)::integer AS available
    FROM money_allocations a JOIN payments p ON p.id=a.payment_id WHERE a.active AND p.status='SUCCEEDED' AND (a.ticket_id=ANY($1::uuid[]) OR a.product_item_id=ANY($2::uuid[])) ORDER BY p.created_at DESC,a.id FOR UPDATE OF p,a`,
      [r.payload.ticketIds, r.payload.productItemIds],
    );
    let remaining = amount;
    const groups = new Map<
      string,
      { amount: number; items: { id: string; amount: number }[] }
    >();
    for (const a of allocations) {
      const take = Math.min(remaining, a.available);
      if (take <= 0) continue;
      const group = groups.get(a.payment_id) || { amount: 0, items: [] };
      group.amount += take;
      group.items.push({ id: a.id, amount: take });
      groups.set(a.payment_id, group);
      remaining -= take;
    }
    if (remaining)
      fail("PAYMENT_ALLOCATION_MISSING", "Không đủ số dư thực thu để hoàn.");
    for (const [paymentId, g] of groups) {
      const [balance] = await m.query(
        "SELECT p.amount-COALESCE((SELECT sum(amount) FROM refunds WHERE payment_id=p.id AND status<>'FAILED'),0)::integer AS available FROM payments p WHERE id=$1",
        [paymentId],
      );
      if (balance.available < g.amount)
        fail("REFUND_EXCEEDS_PAYMENT", "Khoản hoàn vượt tiền đã thu.");
      const [refund] = await m.query(
        "INSERT INTO refunds(request_id,payment_id,amount) VALUES($1,$2,$3) RETURNING id",
        [r.id, paymentId, g.amount],
      );
      for (const item of g.items)
        await m.query("INSERT INTO refund_allocations VALUES($1,$2,$3)", [
          refund.id,
          item.id,
          item.amount,
        ]);
    }
  }
  private async prepareExchange(
    m: EntityManager,
    r: any,
    x: Awaited<ReturnType<ChangesService["inspect"]>>,
  ) {
    const seats = await m.query(
      "SELECT ss.*,h.expires_at,h.status AS hold_status FROM showtime_seats ss LEFT JOIN holds h ON h.id=ss.hold_id WHERE ss.showtime_id=$1 AND ss.seat_id=ANY($2::uuid[]) ORDER BY ss.seat_id FOR UPDATE OF ss",
      [x.target.id, r.payload.seatIds],
    );
    const [clock] = await m.query("SELECT clock_timestamp() AS now");
    if (
      seats.length !== x.tickets.length ||
      seats.some(
        (s: any) =>
          s.ticket_id ||
          (s.hold_status === "ACTIVE" && s.expires_at > clock.now),
      )
    )
      fail("SEAT_UNAVAILABLE", "Ghế thay thế không còn trống.");
    const [hold] = await m.query(
      "INSERT INTO holds(owner_id,showtime_id,expires_at) VALUES($1,$2,clock_timestamp()+interval '5 minutes') RETURNING id",
      [r.owner_id, x.target.id],
    );
    const [b] = await m.query(
      "INSERT INTO bookings(owner_id,hold_id,total) VALUES($1,$2,$3) RETURNING id",
      [r.owner_id, hold.id, x.quote.payable],
    );
    for (const seat of seats) {
      await m.query(
        "UPDATE showtime_seats SET hold_id=$1 WHERE showtime_id=$2 AND seat_id=$3",
        [hold.id, x.target.id, seat.seat_id],
      );
      await m.query(
        "INSERT INTO booking_items(booking_id,showtime_id,seat_id,amount,movie_title,seat_label) SELECT $1,$2,se.id,$3,m.title,se.label FROM seats se CROSS JOIN movies m WHERE se.id=$4 AND m.id=$5",
        [b.id, x.target.id, x.target.price, seat.seat_id, x.target.movie_id],
      );
    }
    await m.query(
      "UPDATE change_requests SET hold_id=$2,new_booking_id=$3 WHERE id=$1",
      [r.id, hold.id, b.id],
    );
    r.hold_id = hold.id;
    r.new_booking_id = b.id;
  }
  private async commitExchange(
    m: EntityManager,
    r: any,
    x: Awaited<ReturnType<ChangesService["inspect"]>>,
    extraPayment?: { id: string; amount: number },
  ) {
    const items = await m.query(
      "SELECT * FROM booking_items WHERE booking_id=$1 ORDER BY seat_id",
      [r.new_booking_id],
    );
    const pool = await m.query(
      `SELECT a.*,a.amount-COALESCE((SELECT sum(ra.amount) FROM refund_allocations ra JOIN refunds rf ON rf.id=ra.refund_id WHERE ra.allocation_id=a.id AND rf.status<>'FAILED'),0)::integer AS available FROM money_allocations a WHERE a.active AND a.ticket_id=ANY($1::uuid[]) ORDER BY a.id FOR UPDATE`,
      [r.payload.ticketIds],
    );
    if (extraPayment)
      pool.push({
        payment_id: extraPayment.id,
        available: extraPayment.amount,
      });
    for (const a of pool)
      if (a.id)
        await m.query("UPDATE money_allocations SET active=false WHERE id=$1", [
          a.id,
        ]);
    for (let i = 0; i < items.length; i++) {
      const item = items[i],
        old = x.tickets[i],
        token = randomBytes(32).toString("base64url");
      const [t] = await m.query(
        "INSERT INTO tickets(item_id,value_vnd,qr_hash,qr_encrypted,predecessor_ticket_id) VALUES($1,$2,$3,$4,$5) RETURNING id",
        [item.id, item.amount, hash(token), encrypt(token), old.id],
      );
      await m.query("UPDATE tickets SET status='REPLACED' WHERE id=$1", [
        old.id,
      ]);
      await m.query(
        "UPDATE showtime_seats SET ticket_id=NULL WHERE ticket_id=$1",
        [old.id],
      );
      await m.query(
        "UPDATE showtime_seats SET hold_id=NULL,ticket_id=$1 WHERE showtime_id=$2 AND seat_id=$3",
        [t.id, item.showtime_id, item.seat_id],
      );
      await m.query(
        "UPDATE change_request_items SET new_ticket_id=$3 WHERE request_id=$1 AND old_ticket_id=$2",
        [r.id, old.id, t.id],
      );
      let needed = item.amount;
      for (const a of pool) {
        const take = Math.min(needed, a.available);
        if (take > 0) {
          await m.query(
            "INSERT INTO money_allocations(payment_id,ticket_id,amount) VALUES($1,$2,$3)",
            [a.payment_id, t.id, take],
          );
          a.available -= take;
          needed -= take;
        }
      }
      if (needed)
        fail("PAYMENT_ALLOCATION_MISSING", "Không đủ phân bổ tiền cho vé mới.");
    }
    await m.query("UPDATE holds SET status='CONSUMED' WHERE id=$1", [
      r.hold_id,
    ]);
    await m.query("UPDATE bookings SET status='CONFIRMED' WHERE id=$1", [
      r.new_booking_id,
    ]);
    await m.query("INSERT INTO outbox_events(booking_id) VALUES($1)", [
      r.new_booking_id,
    ]);
    await m.query("DELETE FROM ticket_operation_locks WHERE request_id=$1", [
      r.id,
    ]);
    await m.query(
      "UPDATE change_requests SET exchange_committed=true,status=$2 WHERE id=$1",
      [r.id, x.quote.refundable ? "PROCESSING" : "COMPLETED"],
    );
    await audit(m, r.created_by, "change.exchanged", r.id, r.cinema_id);
  }
  async execute(actor: Actor, id: string, key?: string) {
    const initial = await this.get(actor, id);
    if (actor.role === "MANAGER" && !initial.quote.refundable)
      fail(
        "FORBIDDEN_ROLE",
        "Quản lý chỉ thực thi yêu cầu cần hoàn tiền đã duyệt.",
        403,
      );
    if (initial.quote.payable || initial.quote.refundable)
      this.gateway.assertConfigured();
    const result: any = await this.bookings.idempotent(
      actor.id,
      "change.execute",
      key,
      { id },
      async (m) => {
        const r = await this.get(actor, id, m, true);
        if (r.status !== "APPROVED")
          fail("APPROVAL_REQUIRED", "Yêu cầu chưa sẵn sàng thực thi.");
        const [clock] = await m.query("SELECT clock_timestamp() AS now");
        if (r.expires_at < clock.now)
          return this.release(m, r, "EXPIRED", actor.id);
        const x = await this.inspect(
          m,
          { id: r.owner_id, role: "CUSTOMER" },
          r.payload,
          r.id,
        );
        if (
          JSON.stringify(x.quote) !== JSON.stringify(r.quote) &&
          Object.keys(x.quote).some((k) => (x.quote as any)[k] !== r.quote[k])
        )
          fail("QUOTE_CHANGED", "Giá đã thay đổi; hủy và tạo báo giá mới.");
        if (r.kind === "EXCHANGE") await this.prepareExchange(m, r, x);
        if (x.quote.refundable)
          await this.reserveRefunds(m, r, x.quote.refundable);
        // Resource locks may have waited across the cutoff; inspect again before committing.
        await this.inspect(
          m,
          { id: r.owner_id, role: "CUSTOMER" },
          r.payload,
          r.id,
        );
        if (r.kind === "EXCHANGE" && !x.quote.payable)
          await this.commitExchange(m, r, x);
        else if (r.kind === "REFUND" && !x.quote.refundable) {
          await m.query(
            "UPDATE tickets SET status='REFUNDED' WHERE id=ANY($1::uuid[])",
            [r.payload.ticketIds],
          );
          await m.query(
            "UPDATE showtime_seats SET ticket_id=NULL WHERE ticket_id=ANY($1::uuid[])",
            [r.payload.ticketIds],
          );
          await m.query(
            "UPDATE order_product_items SET status='REFUNDED' WHERE id=ANY($1::uuid[])",
            [r.payload.productItemIds],
          );
          await this.release(m, r, "COMPLETED", actor.id);
        } else
          await m.query(
            "UPDATE change_requests SET status='PROCESSING' WHERE id=$1",
            [id],
          );
        if (x.quote.payable) {
          const [p] = await m.query(
            "INSERT INTO payments(booking_id,amount,status,provider,change_request_id) VALUES($1,$2,'CREATED',$3,$4) RETURNING id",
            [r.new_booking_id, x.quote.payable, this.gateway.name, r.id],
          );
          await audit(m, actor.id, "change.payment_requested", id, r.cinema_id);
          return { id, paymentId: p.id };
        }
        await audit(m, actor.id, "change.executed", id, r.cinema_id);
        return { id };
      },
    );
    if (result.paymentId) {
      const r = await this.get(actor, id);
      await this.bookings.createPayment(
        r.owner_id,
        r.new_booking_id,
        `change-${id}`,
      );
    }
    await this.dispatchRefunds(id);
    return {
      ...(await this.get(actor, id)),
      payments: await this.db.query(
        "SELECT id,status,amount,checkout_url FROM payments WHERE change_request_id=$1",
        [id],
      ),
      refunds: await this.db.query(
        "SELECT id,status,amount FROM refunds WHERE request_id=$1",
        [id],
      ),
    };
  }
  async dispatchRefunds(requestId: string) {
    const ids = await this.db.query(
      "SELECT id FROM refunds WHERE request_id=$1 AND status='CREATED'",
      [requestId],
    );
    if (!ids.length) return;
    this.gateway.assertConfigured();
    for (const { id } of ids) {
      const claimed = await this.db.transaction(async (m) => {
        const [owner] = await m.query(
          "SELECT owner_id FROM change_requests WHERE id=$1",
          [requestId],
        );
        const r = await this.get(
          { id: owner.owner_id, role: "CUSTOMER" },
          requestId,
          m,
          true,
        );
        const [clock] = await m.query("SELECT clock_timestamp() AS now");
        const sent = (
          await m.query(
            "SELECT 1 FROM refunds WHERE request_id=$1 AND status IN ('PENDING','UNKNOWN','SUCCEEDED') LIMIT 1",
            [requestId],
          )
        ).length;
        if (!r.exchange_committed && !sent && r.expires_at < clock.now) {
          await m.query(
            "UPDATE refunds SET status='FAILED' WHERE request_id=$1 AND status='CREATED'",
            [requestId],
          );
          await this.release(m, r, "EXPIRED", r.created_by);
          return null;
        }
        return (
          await m.query(
            "WITH u AS (UPDATE refunds SET status='UNKNOWN' WHERE id=$1 AND status='CREATED' RETURNING *) SELECT u.*,p.provider_reference FROM u JOIN payments p ON p.id=u.payment_id",
            [id],
          )
        )[0];
      });
      if (!claimed) continue;
      try {
        const r = await this.gateway.refund(
          id,
          claimed.payment_id,
          claimed.amount,
        );
        if (r.status === "PENDING")
          await this.db.query(
            "UPDATE refunds SET status='PENDING',provider_reference=$2 WHERE id=$1 AND status='UNKNOWN'",
            [id, r.reference || null],
          );
        if (r.status === "FAILED")
          await this.refundEvent({
            eventId: `submission:${id}`,
            id,
            amount: claimed.amount,
            currency: "VND",
            status: "FAILED",
          });
      } catch {
        /* Keep UNKNOWN and the reservation until verified reconciliation. */
      }
    }
  }
  async paymentEvent(event: {
    eventId: string;
    paymentId: string;
    amount: number;
    currency: "VND";
    status: "SUCCEEDED" | "FAILED";
  }) {
    return this.db.transaction(async (m) => {
      const [ref] = await m.query(
        "SELECT change_request_id FROM payments WHERE id=$1",
        [event.paymentId],
      );
      const [request] = await m.query(
        "SELECT owner_id FROM change_requests WHERE id=$1",
        [ref?.change_request_id],
      );
      if (!request) fail("NOT_FOUND", "Không tìm thấy yêu cầu.", 404);
      const r = await this.get(
        { id: request.owner_id, role: "CUSTOMER" },
        ref.change_request_id,
        m,
        true,
      );
      await m.query("SELECT id FROM bookings WHERE id=$1 FOR UPDATE", [
        r.new_booking_id,
      ]);
      const [p] = await m.query(
        "SELECT * FROM payments WHERE id=$1 FOR UPDATE",
        [event.paymentId],
      );
      if (p.amount !== event.amount || event.currency !== "VND")
        fail("AMOUNT_MISMATCH", "Số tiền không khớp.", 422);
      if (await this.deduplicate(m, event.eventId, event))
        return { accepted: true, duplicate: true };
      if (p.status === "SUCCEEDED") return { accepted: true, duplicate: true };
      await m.query("UPDATE payments SET status=$2 WHERE id=$1", [
        p.id,
        event.status,
      ]);
      if (event.status === "FAILED") {
        if (!r.exchange_committed)
          await this.release(
            m,
            r,
            "CANCELLED",
            r.created_by,
            "Thanh toán chênh lệch thất bại.",
          );
        return { accepted: true };
      }
      const [h] = await m.query(
        "SELECT *,clock_timestamp() AS now FROM holds WHERE id=$1 FOR UPDATE",
        [r.hold_id],
      );
      const seats = await m.query(
        "SELECT * FROM showtime_seats WHERE hold_id=$1 ORDER BY seat_id FOR UPDATE",
        [r.hold_id],
      );
      if (
        r.status !== "PROCESSING" ||
        !h ||
        h.status !== "ACTIVE" ||
        h.expires_at <= h.now ||
        r.expires_at < h.now ||
        seats.length !== r.payload.ticketIds.length
      ) {
        await m.query(
          "UPDATE payments SET reconciliation_required=true WHERE id=$1",
          [p.id],
        );
        await m.query(
          "INSERT INTO reconciliation_cases(payment_id,reason) VALUES($1,'Thanh toán chênh lệch muộn; cần duyệt hoàn.') ON CONFLICT DO NOTHING",
          [p.id],
        );
        if (!r.exchange_committed)
          await this.release(m, r, "RECONCILIATION_REQUIRED", r.created_by);
        return { accepted: true, reconciliationRequired: true };
      }
      const x = await this.inspect(
        m,
        { id: r.owner_id, role: "CUSTOMER" },
        r.payload,
        r.id,
      );
      await this.commitExchange(m, r, x, { id: p.id, amount: p.amount });
      return { accepted: true };
    });
  }
  private async deduplicate(
    m: EntityManager,
    eventId: string,
    payload: unknown,
  ) {
    await m.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `money:${eventId}`,
    ]);
    const [old] = await m.query(
      "SELECT payload FROM financial_events WHERE event_id=$1",
      [eventId],
    );
    if (old) {
      if (
        hash(JSON.stringify(Object.entries(old.payload).sort())) !==
        hash(JSON.stringify(Object.entries(payload as object).sort()))
      )
        fail("EVENT_CONFLICT", "Sự kiện trùng khác nội dung.");
      return true;
    }
    await m.query(
      "INSERT INTO financial_events(event_id,payload) VALUES($1,$2)",
      [eventId, JSON.stringify(payload)],
    );
    return false;
  }
  async refundEvent(event: VerifiedMoneyEvent) {
    this.gateway.assertConfigured();
    return this.db.transaction(async (m) => {
      const [ref] = await m.query(
        "SELECT request_id,payment_id FROM refunds WHERE id=$1",
        [event.id],
      );
      if (!ref) fail("NOT_FOUND", "Không tìm thấy khoản hoàn.", 404);
      let r: any;
      if (ref.request_id) {
        const [x] = await m.query(
          "SELECT owner_id FROM change_requests WHERE id=$1",
          [ref.request_id],
        );
        r = await this.get(
          { id: x.owner_id, role: "CUSTOMER" },
          ref.request_id,
          m,
          true,
        );
      }
      await m.query("SELECT id FROM payments WHERE id=$1 FOR UPDATE", [
        ref.payment_id,
      ]);
      const [refund] = await m.query(
        "SELECT * FROM refunds WHERE id=$1 FOR UPDATE",
        [event.id],
      );
      if (refund.amount !== event.amount || event.currency !== "VND")
        fail("AMOUNT_MISMATCH", "Số tiền hoàn không khớp.", 422);
      if (await this.deduplicate(m, event.eventId, event))
        return { accepted: true, duplicate: true };
      if (refund.status === "SUCCEEDED")
        return { accepted: true, duplicate: true };
      if (refund.status === "FAILED" && event.status === "SUCCEEDED")
        fail(
          "EVENT_CONFLICT",
          "Nhà cung cấp mâu thuẫn kết quả; cần điều tra, không tự ghi đè.",
        );
      await m.query("UPDATE refunds SET status=$2 WHERE id=$1", [
        event.id,
        event.status,
      ]);
      if (!r) {
        await m.query("UPDATE reconciliation_cases SET status=$2 WHERE id=$1", [
          refund.reconciliation_id,
          event.status === "SUCCEEDED"
            ? "COMPLETED"
            : "RECONCILIATION_REQUIRED",
        ]);
        return { accepted: true };
      }
      const all = await m.query(
        "SELECT status FROM refunds WHERE request_id=$1",
        [r.id],
      );
      if (all.every((x: any) => x.status === "SUCCEEDED")) {
        if (r.kind === "REFUND") {
          await m.query(
            "UPDATE tickets SET status='REFUNDED' WHERE id=ANY($1::uuid[])",
            [r.payload.ticketIds],
          );
          await m.query(
            "UPDATE showtime_seats SET ticket_id=NULL WHERE ticket_id=ANY($1::uuid[])",
            [r.payload.ticketIds],
          );
          await m.query(
            "UPDATE order_product_items SET status='REFUNDED' WHERE id=ANY($1::uuid[])",
            [r.payload.productItemIds],
          );
          await m.query(
            "DELETE FROM ticket_operation_locks WHERE request_id=$1",
            [r.id],
          );
          await m.query(
            "DELETE FROM product_operation_locks WHERE request_id=$1",
            [r.id],
          );
        }
        await m.query(
          "UPDATE change_requests SET status='COMPLETED' WHERE id=$1",
          [r.id],
        );
        await audit(
          m,
          r.approved_by || r.created_by,
          "refund.completed",
          r.id,
          r.cinema_id,
        );
      } else if (
        all.every((x: any) => x.status === "FAILED") &&
        !r.exchange_committed
      )
        await this.release(
          m,
          r,
          "CANCELLED",
          r.created_by,
          "Hoàn thất bại dứt khoát.",
        );
      else if (all.some((x: any) => x.status === "FAILED"))
        await m.query(
          "UPDATE change_requests SET status='RECONCILIATION_REQUIRED' WHERE id=$1",
          [r.id],
        );
      return { accepted: true };
    });
  }
  async expire() {
    const rows = await this.db.query(
      "SELECT id,owner_id FROM change_requests WHERE NOT exchange_committed AND status IN ('PENDING_APPROVAL','APPROVED','PROCESSING') AND (expires_at<clock_timestamp() OR hold_id IN (SELECT id FROM holds WHERE expires_at<=clock_timestamp()))",
    );
    for (const x of rows)
      await this.db.transaction(async (m) => {
        const r = await this.get(
          { id: x.owner_id, role: "CUSTOMER" },
          x.id,
          m,
          true,
        );
        if (
          !["PENDING_APPROVAL", "APPROVED", "PROCESSING"].includes(r.status) ||
          r.exchange_committed
        )
          return;
        if (
          (
            await m.query(
              "SELECT 1 FROM refunds WHERE request_id=$1 AND status IN ('PENDING','UNKNOWN','SUCCEEDED')",
              [r.id],
            )
          ).length
        )
          return;
        // No refund was dispatched, so releasing original ticket locks is safe.
        await m.query(
          "UPDATE refunds SET status='FAILED' WHERE request_id=$1 AND status='CREATED'",
          [r.id],
        );
        await this.release(m, r, "EXPIRED", r.created_by);
      });
  }
}

@Controller()
@UseGuards(JwtGuard, RoleGuard)
export class ChangesController {
  constructor(@Inject(ChangesService) private changes: ChangesService) {}
  @Post("change-quotes") @Roles("CUSTOMER", "STAFF") quote(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.changes.quote(req.user, parse(quoteSchema, body));
  }
  @Post("change-requests") @Roles("CUSTOMER", "STAFF") create(
    @Req() req: AuthRequest,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string,
  ) {
    return this.changes.create(req.user, parse(requestSchema, body), key);
  }
  @Get("change-requests") @Roles("CUSTOMER", "STAFF", "MANAGER") list(
    @Req() req: AuthRequest,
  ) {
    return this.changes.list(req.user);
  }
  @Get("change-requests/:id") @Roles("CUSTOMER", "STAFF", "MANAGER") get(
    @Req() req: AuthRequest,
    @Param("id") id: string,
  ) {
    return this.changes.details(req.user, uuid(id));
  }
  @Post("change-requests/:id/approve") @Roles("MANAGER") approve(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string,
  ) {
    return this.decide(req, id, body, key, "approve");
  }
  @Post("change-requests/:id/reject") @Roles("MANAGER") reject(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string,
  ) {
    return this.decide(req, id, body, key, "reject");
  }
  @Post("change-requests/:id/cancel") @Roles("CUSTOMER", "STAFF") cancel(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string,
  ) {
    return this.decide(req, id, body, key, "cancel");
  }
  private decide(
    req: AuthRequest,
    id: string,
    body: unknown,
    key: string,
    action: "approve" | "reject" | "cancel",
  ) {
    const p = parse(
      z.object({ reason: z.string().trim().min(1).max(1000) }).strict(),
      body,
    );
    return this.changes.decide(req.user, uuid(id), action, p.reason, key);
  }
  @Post("change-requests/:id/execute")
  @Roles("CUSTOMER", "STAFF", "MANAGER")
  execute(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Headers("idempotency-key") key: string,
  ) {
    return this.changes.execute(req.user, uuid(id), key);
  }
}
@Module({
  imports: [AuthModule, CinemaModule],
  controllers: [ChangesController],
  providers: [ChangesService],
  exports: [ChangesService],
})
export class ChangesModule {}
