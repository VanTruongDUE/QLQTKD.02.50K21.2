import { MigrationInterface, QueryRunner } from "typeorm";

export class ProductPresentation1793840400000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS image_url text NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS recommended_min_people smallint NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS recommended_max_people smallint NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS badge text,
        ADD COLUMN IF NOT EXISTS icon_name text NOT NULL DEFAULT 'Popcorn',
        ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
      ALTER TABLE products
        ADD CONSTRAINT products_recommended_people_check
        CHECK (
          recommended_min_people >= 1
          AND recommended_max_people >= recommended_min_people
          AND recommended_max_people <= 20
        );
      ALTER TABLE products
        ADD CONSTRAINT products_sort_order_check CHECK (sort_order >= 0);
      CREATE INDEX IF NOT EXISTS products_catalog_order_idx
        ON products(active, provenance, sort_order, price);
    `);
  }

  async down() {
    throw new Error("Use a reviewed forward migration.");
  }
}
