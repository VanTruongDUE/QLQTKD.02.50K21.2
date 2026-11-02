import { MigrationInterface, QueryRunner } from "typeorm";
export class Operations1793667600000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
ALTER TABLE users DROP CONSTRAINT users_role_check;
UPDATE users SET role='STAFF' WHERE role IN ('COUNTER','GATE');
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK(role IN ('CUSTOMER','STAFF','MANAGER'));
ALTER TABLE users ADD COLUMN locked boolean NOT NULL DEFAULT false, ADD COLUMN display_name text NOT NULL DEFAULT '', ADD COLUMN phone text NOT NULL DEFAULT '';
UPDATE users SET locked=true WHERE email LIKE '%@starlight.demo';
UPDATE refresh_sessions SET revoked=true WHERE user_id IN (SELECT id FROM users WHERE locked);
ALTER TABLE bookings ADD COLUMN provenance text NOT NULL DEFAULT 'LEGACY_DEMO';
ALTER TABLE bookings ALTER COLUMN provenance SET DEFAULT 'OPERATIONAL';
ALTER TABLE bookings ALTER COLUMN policy_version SET DEFAULT 'MODEL-1.0';
ALTER TABLE movies ADD COLUMN cinema_id uuid REFERENCES cinemas;
ALTER TABLE products ADD COLUMN cinema_id uuid REFERENCES cinemas;
ALTER TABLE auditoriums ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE payments ADD COLUMN checkout_url text, ADD COLUMN provider text NOT NULL DEFAULT 'UNCONFIGURED';
ALTER TABLE tickets ADD COLUMN predecessor_ticket_id uuid REFERENCES tickets;
ALTER TABLE audit_logs ADD COLUMN cinema_id uuid REFERENCES cinemas, ADD COLUMN details jsonb NOT NULL DEFAULT '{}';
ALTER TABLE ticket_operation_locks DROP CONSTRAINT ticket_operation_locks_request_id_key;
CREATE TABLE change_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users, created_by uuid NOT NULL REFERENCES users,
 cinema_id uuid NOT NULL REFERENCES cinemas, booking_id uuid NOT NULL REFERENCES bookings,
 kind text NOT NULL CHECK(kind IN ('EXCHANGE','REFUND')), status text NOT NULL,
 payload jsonb NOT NULL, quote jsonb NOT NULL, policy_version text NOT NULL DEFAULT 'MODEL-1.0',
 approved_by uuid REFERENCES users, reason text, expires_at timestamptz NOT NULL,
 hold_id uuid REFERENCES holds, new_booking_id uuid REFERENCES bookings,
 exchange_committed boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE change_request_items(request_id uuid REFERENCES change_requests, old_ticket_id uuid REFERENCES tickets, new_ticket_id uuid REFERENCES tickets, PRIMARY KEY(request_id,old_ticket_id));
CREATE TABLE product_operation_locks(item_id uuid PRIMARY KEY REFERENCES order_product_items, request_id uuid NOT NULL REFERENCES change_requests);
ALTER TABLE payments ADD COLUMN change_request_id uuid REFERENCES change_requests;
CREATE TABLE money_allocations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payment_id uuid NOT NULL REFERENCES payments,
 active boolean NOT NULL DEFAULT true,
 ticket_id uuid REFERENCES tickets, product_item_id uuid REFERENCES order_product_items, amount integer NOT NULL CHECK(amount>0),
 CHECK((ticket_id IS NULL) <> (product_item_id IS NULL)));
CREATE TABLE refunds(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid REFERENCES change_requests, reconciliation_id uuid UNIQUE REFERENCES reconciliation_cases,
 payment_id uuid NOT NULL REFERENCES payments, amount integer NOT NULL CHECK(amount>0),
 status text NOT NULL DEFAULT 'CREATED' CHECK(status IN ('CREATED','PENDING','SUCCEEDED','FAILED','UNKNOWN')),
 provider_reference text, created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE refund_allocations(refund_id uuid REFERENCES refunds, allocation_id uuid REFERENCES money_allocations, amount integer NOT NULL CHECK(amount>0), PRIMARY KEY(refund_id,allocation_id));
CREATE TABLE financial_events(event_id text PRIMARY KEY, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE INDEX ON change_requests(cinema_id,status);
CREATE INDEX ON change_requests(expires_at);
CREATE TABLE combo_redemptions(item_id uuid PRIMARY KEY REFERENCES order_product_items, staff_id uuid NOT NULL REFERENCES users, created_at timestamptz NOT NULL DEFAULT clock_timestamp());
`);
  }
  async down() {
    throw new Error("Use a reviewed forward migration.");
  }
}
