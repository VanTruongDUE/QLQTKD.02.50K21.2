import { MigrationInterface, QueryRunner } from "typeorm";

export class BookingDeliveryEmail1793844000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS delivery_email text;
      UPDATE bookings b
      SET delivery_email = lower(u.email)
      FROM users u
      WHERE u.id = b.owner_id AND b.delivery_email IS NULL;
      ALTER TABLE bookings
        ADD CONSTRAINT bookings_delivery_email_length_check
        CHECK (
          delivery_email IS NULL
          OR char_length(delivery_email) BETWEEN 3 AND 200
        );
      CREATE INDEX IF NOT EXISTS bookings_delivery_email_idx
        ON bookings(lower(delivery_email));
    `);
  }

  async down() {
    throw new Error("Use a reviewed forward migration.");
  }
}
