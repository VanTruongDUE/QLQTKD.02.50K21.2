import { source } from "./database/source";
import { BookingService } from "./booking.service";
import nodemailer from "nodemailer";
import { ChangesService } from "./changes";
import { required } from "./config";
import { N8nWebhookService, NotificationService } from "./notification";
export async function tick() {
  const service = new BookingService(source);
  await service.expire();
  await new ChangesService(source).expire();

  if (process.env.N8N_WEBHOOK_URL) {
    const webhookService = new N8nWebhookService();
    const notificationService = new NotificationService(source, webhookService);
    try {
      await notificationService.dispatchPending(10);
    } catch (e) {
      console.error("n8n notification dispatch error:", e);
    }
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) return;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    requireTLS:
      process.env.NODE_ENV === "production" &&
      process.env.SMTP_SECURE !== "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: required("SMTP_PASSWORD") }
      : undefined,
    connectionTimeout: 5000,
    socketTimeout: 5000,
  });
  const rows = await source.query(
    `WITH claimed AS (UPDATE outbox_events SET status='PROCESSING',next_attempt_at=clock_timestamp()+interval '1 minute' WHERE id IN (SELECT o.id FROM outbox_events o JOIN bookings b ON b.id=o.booking_id WHERE b.provenance='OPERATIONAL' AND o.status IN ('PENDING','PROCESSING') AND o.next_attempt_at<=clock_timestamp() ORDER BY o.next_attempt_at FOR UPDATE OF o SKIP LOCKED LIMIT 10) RETURNING *) SELECT * FROM claimed`,
  );
  for (const row of rows) {
    try {
      const [booking] = await source.query(
        "SELECT u.email,b.total FROM bookings b JOIN users u ON u.id=b.owner_id WHERE b.id=$1",
        [row.booking_id],
      );
      await transport.sendMail({
        from: required("SMTP_FROM"),
        to: booking.email,
        subject: "Vé Starlight của bạn đã sẵn sàng",
        text: `Đơn ${row.booking_id} đã xác nhận. Khoản thanh toán của đơn: ${booking.total} VND. Xem vé hiện hành trong mục Vé của tôi tại ${required("WEB_ORIGIN")}.`,
        messageId: `<${row.id}@${new URL(required("WEB_ORIGIN")).hostname}>`,
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
