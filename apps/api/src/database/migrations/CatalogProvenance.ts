import { MigrationInterface, QueryRunner } from "typeorm";
export class CatalogProvenance1793667600002 implements MigrationInterface {
  async up(q:QueryRunner) {
    for(const table of ['cinemas','movies','products','auditoriums','showtimes']) {
      await q.query(`ALTER TABLE ${table} ADD COLUMN provenance text NOT NULL DEFAULT 'LEGACY_DEMO'`);
      await q.query(`ALTER TABLE ${table} ALTER COLUMN provenance SET DEFAULT 'OPERATIONAL'`);
    }
  }
  async down(){throw new Error('Use a reviewed forward migration.');}
}
