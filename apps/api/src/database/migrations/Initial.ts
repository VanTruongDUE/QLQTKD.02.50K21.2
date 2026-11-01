import { MigrationInterface, QueryRunner } from "typeorm";
export class Initial1793494800000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE NOT NULL, password_hash text NOT NULL, role text NOT NULL CHECK(role IN ('CUSTOMER','COUNTER','GATE','MANAGER')));
CREATE TABLE refresh_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES users,token_hash text UNIQUE NOT NULL,expires_at timestamptz NOT NULL,revoked boolean NOT NULL DEFAULT false);
CREATE TABLE cinemas(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL);
CREATE TABLE staff_cinema_assignments(user_id uuid REFERENCES users,cinema_id uuid REFERENCES cinemas,PRIMARY KEY(user_id,cinema_id));
CREATE TABLE movies(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL,description text NOT NULL,duration_minutes integer NOT NULL CHECK(duration_minutes>0),rating text NOT NULL,poster text NOT NULL,active boolean NOT NULL DEFAULT true);
CREATE TABLE auditoriums(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),cinema_id uuid NOT NULL REFERENCES cinemas,name text NOT NULL);
CREATE TABLE seats(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),auditorium_id uuid NOT NULL REFERENCES auditoriums,label text NOT NULL,UNIQUE(auditorium_id,label),UNIQUE(id,auditorium_id));
CREATE TABLE showtimes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),movie_id uuid NOT NULL REFERENCES movies,auditorium_id uuid NOT NULL REFERENCES auditoriums,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,price integer NOT NULL CHECK(price>=0),status text NOT NULL DEFAULT 'SCHEDULED',CHECK(ends_at>starts_at),UNIQUE(id,auditorium_id),EXCLUDE USING gist(auditorium_id WITH =,tstzrange(starts_at,ends_at,'[)') WITH &&));
CREATE TABLE holds(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid NOT NULL REFERENCES users,showtime_id uuid NOT NULL REFERENCES showtimes,expires_at timestamptz NOT NULL,status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','CONSUMED','EXPIRED','RELEASED')),created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE bookings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid NOT NULL REFERENCES users,hold_id uuid UNIQUE NOT NULL REFERENCES holds,status text NOT NULL DEFAULT 'PENDING_PAYMENT' CHECK(status IN ('PENDING_PAYMENT','CONFIRMED','EXPIRED','CANCELLED')),total integer NOT NULL CHECK(total>=0),policy_version text NOT NULL DEFAULT 'DEMO-1.0',created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE booking_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),booking_id uuid NOT NULL REFERENCES bookings,showtime_id uuid NOT NULL REFERENCES showtimes,seat_id uuid NOT NULL REFERENCES seats,amount integer NOT NULL CHECK(amount>=0),movie_title text NOT NULL,seat_label text NOT NULL,UNIQUE(booking_id,seat_id));
CREATE TABLE tickets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),item_id uuid UNIQUE NOT NULL REFERENCES booking_items,status text NOT NULL DEFAULT 'ISSUED' CHECK(status IN ('ISSUED','REPLACED','REFUNDED','CHECKED_IN','VOIDED')),value_vnd integer NOT NULL CHECK(value_vnd>=0),qr_hash text UNIQUE NOT NULL,qr_encrypted text NOT NULL);
CREATE TABLE showtime_seats(showtime_id uuid NOT NULL,auditorium_id uuid NOT NULL,seat_id uuid NOT NULL,hold_id uuid REFERENCES holds,ticket_id uuid UNIQUE REFERENCES tickets,PRIMARY KEY(showtime_id,seat_id),FOREIGN KEY(showtime_id,auditorium_id) REFERENCES showtimes(id,auditorium_id),FOREIGN KEY(seat_id,auditorium_id) REFERENCES seats(id,auditorium_id),CHECK(hold_id IS NULL OR ticket_id IS NULL));
CREATE INDEX ON showtime_seats(hold_id);
CREATE TABLE products(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,price integer NOT NULL CHECK(price>=0),active boolean NOT NULL DEFAULT true);
CREATE TABLE order_product_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),booking_id uuid NOT NULL REFERENCES bookings,product_id uuid NOT NULL REFERENCES products,name text NOT NULL,quantity integer NOT NULL CHECK(quantity>0),unit_price integer NOT NULL CHECK(unit_price>=0),status text NOT NULL DEFAULT 'UNREDEEMED',UNIQUE(booking_id,product_id));
CREATE TABLE payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),booking_id uuid NOT NULL REFERENCES bookings,provider_reference uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),amount integer NOT NULL CHECK(amount>=0),status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('CREATED','PENDING','SUCCEEDED','FAILED','UNKNOWN')),reconciliation_required boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE provider_events(event_id uuid PRIMARY KEY,payment_id uuid NOT NULL REFERENCES payments,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE reconciliation_cases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),payment_id uuid UNIQUE NOT NULL REFERENCES payments,reason text NOT NULL,status text NOT NULL DEFAULT 'PENDING_APPROVAL',created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE idempotency_records(owner_id uuid NOT NULL REFERENCES users,operation text NOT NULL,key text NOT NULL,payload_hash text NOT NULL,result jsonb NOT NULL,PRIMARY KEY(owner_id,operation,key));
CREATE TABLE audit_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid REFERENCES users,action text NOT NULL,entity_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE check_ins(ticket_id uuid PRIMARY KEY REFERENCES tickets,staff_id uuid NOT NULL REFERENCES users,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE outbox_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),booking_id uuid UNIQUE NOT NULL REFERENCES bookings,status text NOT NULL DEFAULT 'PENDING',attempts integer NOT NULL DEFAULT 0,next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),last_error text);
`);
  }
  async down() {
    throw new Error(
      "Destructive rollback disabled; use a reviewed forward migration.",
    );
  }
}
