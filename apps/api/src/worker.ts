import { source } from "./database/source";
import { BookingService } from "./booking.service";
import nodemailer from "nodemailer";
export async function tick() {
  const service = new BookingService(source);
  await service.expire();
  if (!process.env.SMTP_HOST) return;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 1025),
    secure: false,
    connectionTimeout: 5000,
    socketTimeout: 5000,
  });
  const rows = await source.query(
    `WITH claimed AS (UPDATE outbox_events SET status='PROCESSING',next_attempt_at=clock_timestamp()+interval '1 minute' WHERE id IN (SELECT id FROM outbox_events WHERE status IN ('PENDING','PROCESSING') AND next_attempt_at<=clock_timestamp() ORDER BY next_attempt_at FOR UPDATE SKIP LOCKED LIMIT 10) RETURNING *) SELECT * FROM claimed`,
  );
  for (const row of rows) {
    try {
      const [booking] = await source.query(
        "SELECT u.email,b.total FROM bookings b JOIN users u ON u.id=b.owner_id WHERE b.id=$1",
        [row.booking_id],
      );
      await transport.sendMail({
        from: "Starlight Demo <tickets@starlight.demo>",
        to: booking.email,
        subject: "Vé Starlight của bạn đã sẵn sàng",
        text: `Đơn ${row.booking_id} đã xác nhận. Tổng tiền ${booking.total} VND (thử nghiệm). Xem QR trong mục Vé của tôi tại ${process.env.WEB_ORIGIN}.`,
        messageId: `<${row.id}@starlight.demo>`,
      });
      await source.query(
        `UPDATE outbox_events SET status='SENT',attempts=attempts+1,last_error=NULL WHERE id=$1`,
        [row.id],
      );
    } catch {
      await source.query(
        `UPDATE outbox_events SET status='PENDING',attempts=attempts+1,last_error='SMTP delivery failed',next_attempt_at=clock_timestamp()+interval '1 minute' WHERE id=$1`,
        [row.id],
      );
    }
  }
}
async function run() {
  await source.initialize();
  let stopping = false;
  process.on("SIGINT", () => {
    stopping = true;
  });
  process.on("SIGTERM", () => {
    stopping = true;
  });
  while (!stopping) {
    try {
      await tick();
    } catch (e) {
      console.error("Worker tick failed", e);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  await source.destroy();
}
if (require.main === module)
  run().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
