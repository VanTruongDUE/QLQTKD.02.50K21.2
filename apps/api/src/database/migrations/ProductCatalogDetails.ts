import { MigrationInterface, QueryRunner } from "typeorm";

export class ProductCatalogDetails1793754000002 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'combo',
        ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS original_price integer;
      ALTER TABLE products
        ADD CONSTRAINT products_original_price_check
        CHECK (original_price IS NULL OR original_price >= price)
    `);
  }
  async down() { throw new Error("Use a reviewed forward migration."); }
}
