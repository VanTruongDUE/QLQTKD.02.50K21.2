import { MigrationInterface, QueryRunner } from "typeorm";
export class ProviderEvents1793667600001 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(
      "ALTER TABLE provider_events ALTER COLUMN event_id TYPE text USING event_id::text",
    );
  }
  async down() {
    throw new Error("Use a reviewed forward migration.");
  }
}
