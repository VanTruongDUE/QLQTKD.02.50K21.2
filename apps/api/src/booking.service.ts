import { Inject, Injectable } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { randomBytes } from "node:crypto";
import { hash, encrypt } from "./security";
import { fail } from "./http";
@Injectable()
export class BookingService {
  constructor(@Inject(DataSource) readonly db: DataSource) {}
  async idempotent(
    owner: string,
    operation: string,
    key: string | undefined,
    payload: unknown,
    work: (m: EntityManager) => Promise<unknown>,
  ) {
    if (!key || key.length > 100 || !/^[\w-]+$/.test(key))
      fail("IDEMPOTENCY_KEY_REQUIRED", "Cần khóa yêu cầu hợp lệ.", 422);
    return this.db.transaction(async (m) => {
      await m.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        `${owner}:${operation}:${key}`,
      ]);
      const fingerprint = hash(JSON.stringify(payload));
      const [cached] = await m.query(
        "SELECT * FROM idempotency_records WHERE owner_id=$1 AND operation=$2 AND key=$3",
        [owner, operation, key],
      );
      if (cached) {
        if (cached.payload_hash !== fingerprint)
          fail("IDEMPOTENCY_CONFLICT", "Khóa đã dùng với dữ liệu khác.");
        return cached.result;
      }
      const result = await work(m);
      await m.query("INSERT INTO idempotency_records VALUES($1,$2,$3,$4,$5)", [
        owner,
        operation,
        key,
        fingerprint,
        JSON.stringify(result),
      ]);
      return result;
    });
  }
  async hold(
    owner: string,
    input: { showtimeId: string; seatIds: string[] },
    key?: string,
  ) {
    return this.idempotent(
      owner,
      "hold",
      key,
      { ...input, seatIds: [...input.seatIds].sort() },
      async (m) => {
        const [show] = await m.query(
          `SELECT * FROM showtimes WHERE id=$1 AND starts_at>clock_timestamp() AND status='SCHEDULED'`,
          [input.showtimeId],
        );
        if (!show) fail("SHOWTIME_UNAVAILABLE", "Suất chiếu đã đóng.", 404);
        const seats = await m.query(
          "SELECT * FROM showtime_seats WHERE showtime_id=$1 AND seat_id=ANY($2::uuid[]) ORDER BY seat_id FOR UPDATE",
          [show.id, input.seatIds],
        );
        if (seats.length !== input.seatIds.length)
          fail("INVALID_SEATS", "Ghế không thuộc suất chiếu.", 422);
        const [clock] = await m.query("SELECT clock_timestamp() AS now");
        for (const seat of seats) {
          if (seat.ticket_id)
            fail("SEAT_UNAVAILABLE", "Ghế vừa được đặt. Vui lòng chọn lại.");
          if (seat.hold_id) {
            const [hold] = await m.query("SELECT * FROM holds WHERE id=$1", [
              seat.hold_id,
            ]);
            if (hold.status === "ACTIVE" && hold.expires_at > clock.now)
              fail("SEAT_UNAVAILABLE", "Ghế đang được giữ. Vui lòng chọn lại.");
          }
        }
        const [hold] = await m.query(
          `INSERT INTO holds(owner_id,showtime_id,expires_at) VALUES($1,$2,clock_timestamp()+interval '300 seconds') RETURNING id,expires_at AS "expiresAt",clock_timestamp() AS "serverTime"`,
          [owner, show.id],
        );
        await m.query(
          "UPDATE showtime_seats SET hold_id=$1 WHERE showtime_id=$2 AND seat_id=ANY($3::uuid[])",
          [hold.id, show.id, input.seatIds],
        );
        await m.query(
          `INSERT INTO audit_logs(actor_id,action,entity_id) VALUES($1,'hold.created',$2)`,
          [owner, hold.id],
        );
        return { ...hold, showtimeId: show.id, seatIds: input.seatIds };
      },
    );
  }
  async book(
    owner: string,
    input: {
      holdId: string;
      products: { productId: string; quantity: number }[];
    },
    key?: string,
  ) {
    return this.idempotent(owner, "booking", key, input, async (m) => {
      const [hold] = await m.query(
        "SELECT * FROM holds WHERE id=$1 AND owner_id=$2 FOR UPDATE",
        [input.holdId, owner],
      );
      if (!hold) fail("NOT_FOUND", "Không tìm thấy giữ ghế.", 404);
      const seats = await m.query(
        "SELECT * FROM showtime_seats WHERE hold_id=$1 ORDER BY seat_id FOR UPDATE",
        [hold.id],
      );
      const [clock] = await m.query("SELECT clock_timestamp() AS now");
      if (
        hold.status !== "ACTIVE" ||
        hold.expires_at <= clock.now ||
        !seats.length
      )
        fail("HOLD_EXPIRED", "Giữ ghế đã hết hạn. Vui lòng chọn lại.");
      const [existing] = await m.query(
        "SELECT id FROM bookings WHERE hold_id=$1",
        [hold.id],
      );
      if (existing) fail("BOOKING_EXISTS", "Phiên giữ ghế đã có đơn.");
      const [show] = await m.query(
        "SELECT s.*,m.title FROM showtimes s JOIN movies m ON m.id=s.movie_id WHERE s.id=$1",
        [hold.showtime_id],
      );
      if (show.starts_at <= clock.now || show.status !== "SCHEDULED")
        fail("SHOWTIME_UNAVAILABLE", "Suất chiếu đã đóng.");
      if (
        new Set(input.products.map((p) => p.productId)).size !==
        input.products.length
      )
        fail("INVALID_PRODUCTS", "Combo bị lặp.", 422);
      const products = [];
      let total = seats.length * show.price;
      for (const item of input.products) {
        const [p] = await m.query(
          "SELECT * FROM products WHERE id=$1 AND active",
          [item.productId],
        );
        if (!p) fail("INVALID_PRODUCT", "Combo không còn bán.", 422);
        products.push({ ...p, quantity: item.quantity });
        total += p.price * item.quantity;
      }
      const [booking] = await m.query(
        "INSERT INTO bookings(owner_id,hold_id,total) VALUES($1,$2,$3) RETURNING *",
        [owner, hold.id, total],
      );
      for (const seat of seats) {
        const [label] = await m.query("SELECT label FROM seats WHERE id=$1", [
          seat.seat_id,
        ]);
        await m.query(
          "INSERT INTO booking_items(booking_id,showtime_id,seat_id,amount,movie_title,seat_label) VALUES($1,$2,$3,$4,$5,$6)",
          [
            booking.id,
            show.id,
            seat.seat_id,
            show.price,
            show.title,
            label.label,
          ],
        );
      }
      for (const p of products)
        await m.query(
          "INSERT INTO order_product_items(booking_id,product_id,name,quantity,unit_price) VALUES($1,$2,$3,$4,$5)",
          [booking.id, p.id, p.name, p.quantity, p.price],
        );
      return { ...booking, expiresAt: hold.expires_at, serverTime: clock.now };
    });
  }
  async createPayment(owner: string, bookingId: string, key?: string) {
    return this.idempotent(owner, "payment", key, { bookingId }, async (m) => {
      const [booking] = await m.query(
        "SELECT * FROM bookings WHERE id=$1 AND owner_id=$2 FOR UPDATE",
        [bookingId, owner],
      );
      if (!booking) fail("NOT_FOUND", "Không tìm thấy đơn.", 404);
      if (booking.status !== "PENDING_PAYMENT")
        fail("BOOKING_CLOSED", "Đơn không còn chờ thanh toán.");
      const [hold] = await m.query(
        "SELECT *,clock_timestamp() AS now FROM holds WHERE id=$1",
        [booking.hold_id],
      );
      if (hold.status !== "ACTIVE" || hold.expires_at <= hold.now)
        fail("HOLD_EXPIRED", "Giữ ghế đã hết hạn.");
      const [active] = await m.query(
        `SELECT * FROM payments WHERE booking_id=$1 AND status IN ('PENDING','UNKNOWN','SUCCEEDED') ORDER BY created_at DESC LIMIT 1`,
        [bookingId],
      );
      if (active) return active;
      const [payment] = await m.query(
        "INSERT INTO payments(booking_id,amount) VALUES($1,$2) RETURNING *",
        [bookingId, booking.total],
      );
      return payment;
    });
  }
  async callback(event: {
    eventId: string;
    paymentId: string;
    amount: number;
    currency: "VND";
    status: "SUCCEEDED" | "FAILED";
  }) {
    return this.db.transaction(async (m) => {
      await m.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        `event:${event.eventId}`,
      ]);
      const [old] = await m.query(
        "SELECT payload FROM provider_events WHERE event_id=$1",
        [event.eventId],
      );
      if (old) {
        if (
          Object.keys(event).some(
            (k) => old.payload[k] !== event[k as keyof typeof event],
          )
        )
          fail("EVENT_CONFLICT", "Sự kiện đã tồn tại với nội dung khác.");
        return { accepted: true, duplicate: true };
      }
      const [ref] = await m.query(
        "SELECT booking_id FROM payments WHERE id=$1",
        [event.paymentId],
      );
      if (!ref) fail("NOT_FOUND", "Không tìm thấy thanh toán.", 404);
      const [booking] = await m.query(
        "SELECT * FROM bookings WHERE id=$1 FOR UPDATE",
        [ref.booking_id],
      );
      const [payment] = await m.query(
        "SELECT * FROM payments WHERE id=$1 FOR UPDATE",
        [event.paymentId],
      );
      if (payment.amount !== event.amount)
        fail("AMOUNT_MISMATCH", "Số tiền không khớp.", 422);
      await m.query(
        "INSERT INTO provider_events(event_id,payment_id,payload) VALUES($1,$2,$3)",
        [event.eventId, payment.id, JSON.stringify(event)],
      );
      if (payment.status === "SUCCEEDED")
        return { accepted: true, duplicate: true };
      await m.query("UPDATE payments SET status=$1 WHERE id=$2", [
        event.status,
        payment.id,
      ]);
      if (event.status === "FAILED")
        return { accepted: true, status: "FAILED" };
      const [hold] = await m.query(
        "SELECT * FROM holds WHERE id=$1 FOR UPDATE",
        [booking.hold_id],
      );
      const items = await m.query(
        "SELECT * FROM booking_items WHERE booking_id=$1 ORDER BY seat_id",
        [booking.id],
      );
      const seats = await m.query(
        "SELECT * FROM showtime_seats WHERE showtime_id=$1 AND seat_id=ANY($2::uuid[]) ORDER BY seat_id FOR UPDATE",
        [hold.showtime_id, items.map((i: { seat_id: string }) => i.seat_id)],
      );
      const [clock] = await m.query("SELECT clock_timestamp() AS now");
      const [show] = await m.query("SELECT * FROM showtimes WHERE id=$1", [
        hold.showtime_id,
      ]);
      if (
        booking.status !== "PENDING_PAYMENT" ||
        hold.status !== "ACTIVE" ||
        hold.expires_at <= clock.now ||
        show.starts_at <= clock.now ||
        show.status !== "SCHEDULED" ||
        seats.length !== items.length ||
        seats.some(
          (s: { hold_id: string; ticket_id: string }) =>
            s.hold_id !== hold.id || s.ticket_id,
        )
      ) {
        await m.query(
          "UPDATE payments SET reconciliation_required=true WHERE id=$1",
          [payment.id],
        );
        await m.query(
          `INSERT INTO reconciliation_cases(payment_id,reason) VALUES($1,'Đã thu tiền nhưng không thể cấp vé; cần quản lý duyệt hoàn.') ON CONFLICT DO NOTHING`,
          [payment.id],
        );
        if (booking.status === "PENDING_PAYMENT")
          await m.query(`UPDATE bookings SET status='EXPIRED' WHERE id=$1`, [
            booking.id,
          ]);
        if (hold.status === "ACTIVE")
          await m.query(`UPDATE holds SET status='EXPIRED' WHERE id=$1`, [
            hold.id,
          ]);
        await m.query(
          "UPDATE showtime_seats SET hold_id=NULL WHERE hold_id=$1",
          [hold.id],
        );
        return { accepted: true, reconciliationRequired: true };
      }
      for (const item of items) {
        const qr = randomBytes(32).toString("base64url");
        const [ticket] = await m.query(
          "INSERT INTO tickets(item_id,value_vnd,qr_hash,qr_encrypted) VALUES($1,$2,$3,$4) RETURNING id",
          [item.id, item.amount, hash(qr), encrypt(qr)],
        );
        await m.query(
          "UPDATE showtime_seats SET hold_id=NULL,ticket_id=$1 WHERE showtime_id=$2 AND seat_id=$3",
          [ticket.id, item.showtime_id, item.seat_id],
        );
      }
      await m.query(`UPDATE holds SET status='CONSUMED' WHERE id=$1`, [
        hold.id,
      ]);
      await m.query(`UPDATE bookings SET status='CONFIRMED' WHERE id=$1`, [
        booking.id,
      ]);
      await m.query("INSERT INTO outbox_events(booking_id) VALUES($1)", [
        booking.id,
      ]);
      await m.query(
        `INSERT INTO audit_logs(actor_id,action,entity_id) VALUES($1,'booking.confirmed',$2)`,
        [booking.owner_id, booking.id],
      );
      return { accepted: true, status: "CONFIRMED" };
    });
  }
  async expire() {
    return this.db.transaction(async (m) => {
      // Booking -> hold -> seats matches callback lock order. Never clear by seat alone.
      const candidates = await m.query(
        `SELECT id FROM bookings WHERE status='PENDING_PAYMENT' AND hold_id IN (SELECT id FROM holds WHERE expires_at<=clock_timestamp()) ORDER BY id FOR UPDATE SKIP LOCKED`,
      );
      for (const b of candidates)
        await m.query(`UPDATE bookings SET status='EXPIRED' WHERE id=$1`, [
          b.id,
        ]);
      const holds = await m.query(
        `SELECT id FROM holds WHERE status='ACTIVE' AND expires_at<=clock_timestamp() ORDER BY id FOR UPDATE SKIP LOCKED`,
      );
      for (const h of holds) {
        await m.query(
          "SELECT seat_id FROM showtime_seats WHERE hold_id=$1 ORDER BY seat_id FOR UPDATE",
          [h.id],
        );
        await m.query(
          "UPDATE showtime_seats SET hold_id=NULL WHERE hold_id=$1",
          [h.id],
        );
        await m.query(`UPDATE holds SET status='EXPIRED' WHERE id=$1`, [h.id]);
      }
      return holds.length;
    });
  }
}
