import { MigrationInterface, QueryRunner } from "typeorm";

export class NotificationOutbox1793754000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
CREATE TABLE notification_outbox(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  booking_id uuid REFERENCES bookings(id),
  recipient_email text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PROCESSING','SENT','FAILED')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  next_retry_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX idx_notification_outbox_queue ON notification_outbox(status, next_retry_at);
CREATE INDEX idx_notification_outbox_event_type ON notification_outbox(event_type);
`);
  }

  async down() {
    throw new Error("Destructive rollback disabled; use a reviewed forward migration.");
  }
}

