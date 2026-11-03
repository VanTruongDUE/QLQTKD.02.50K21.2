import { MigrationInterface, QueryRunner } from "typeorm";

export class PaymentProviderReference1793754000001 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_transaction_id text");
    await q.query("CREATE INDEX IF NOT EXISTS payments_provider_transaction_idx ON payments(provider_transaction_id) WHERE provider_transaction_id IS NOT NULL");
  }

  async down() {
    throw new Error("Use a reviewed forward migration.");
  }
}
