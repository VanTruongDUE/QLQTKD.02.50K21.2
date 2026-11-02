import { MigrationInterface, QueryRunner } from "typeorm";
export class CheckInLocks1793581200000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`CREATE TABLE ticket_operation_locks (
      ticket_id uuid PRIMARY KEY REFERENCES tickets,
      request_id uuid UNIQUE NOT NULL,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp()
    ); CREATE INDEX check_ins_created_at_idx ON check_ins(created_at DESC);`);
  }
  async down() {
    throw new Error("Use a reviewed forward migration.");
  }
}
