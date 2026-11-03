import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { DataSource, QueryRunner } from "typeorm";

config({ path: "../../.env", quiet: true });
const testUrl = process.env.TEST_DATABASE_URL!;
if (!testUrl || !new URL(testUrl).pathname.endsWith("/starlight_test"))
  throw new Error("TEST_DATABASE_URL must point to starlight_test");
process.env.DATABASE_URL = testUrl;

let db: DataSource;
let runner: QueryRunner;
let controller: import("../src/cinema").CatalogController;
let cinemaId: string;
let visibleMovieId: string;

async function movie(title: string, active = true) {
  return (
    await runner.query(
      `INSERT INTO movies(cinema_id,title,description,duration_minutes,rating,poster,active,provenance)
       VALUES($1,$2,'Catalog test',90,'P','/test.jpg',$3,'OPERATIONAL') RETURNING id`,
      [cinemaId, title, active],
    )
  )[0].id as string;
}

async function showtime(
  movieId: string,
  offset: string,
  status = "SCHEDULED",
) {
  const roomId = (
    await runner.query(
      `INSERT INTO auditoriums(cinema_id,name,active,provenance)
       VALUES($1,$2,true,'OPERATIONAL') RETURNING id`,
      [cinemaId, `Catalog room ${randomUUID()}`],
    )
  )[0].id;
  await runner.query(
    `INSERT INTO showtimes(movie_id,auditorium_id,starts_at,ends_at,price,status,provenance)
     VALUES($1,$2,clock_timestamp()+$3::interval,clock_timestamp()+$3::interval+interval '90 minutes',60000,$4,'OPERATIONAL')`,
    [movieId, roomId, offset, status],
  );
}

beforeAll(async () => {
  const { databaseOptions } = await import("../src/database/source");
  db = new DataSource({ ...databaseOptions, url: testUrl });
  await db.initialize();
  await db.runMigrations();
  runner = db.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();

  cinemaId = (
    await runner.query(
      `INSERT INTO cinemas(name,provenance) VALUES($1,'OPERATIONAL') RETURNING id`,
      [`Catalog cinema ${randomUUID()}`],
    )
  )[0].id;

  visibleMovieId = await movie(`Visible ${randomUUID()}`);
  const outsideMovieId = await movie(`Outside ${randomUUID()}`);
  const closedMovieId = await movie(`Closed ${randomUUID()}`);
  const inactiveMovieId = await movie(`Inactive ${randomUUID()}`, false);
  await showtime(visibleMovieId, "15 minutes");
  await showtime(outsideMovieId, "6 days");
  await showtime(closedMovieId, "2 hours", "CANCELLED");
  await showtime(inactiveMovieId, "3 hours");

  const { CatalogController } = await import("../src/cinema");
  controller = new CatalogController({
    query: (sql: string, params?: unknown[]) => runner.query(sql, params),
  } as DataSource);
});

afterAll(async () => {
  await runner.rollbackTransaction();
  await runner.release();
  await db.destroy();
});

describe("public catalog availability window", () => {
  it("returns only future scheduled showtimes from today through four days later", async () => {
    const rows = await controller.showtimes(cinemaId);
    expect(rows.map((row: { movie_id: string }) => row.movie_id)).toEqual([
      visibleMovieId,
    ]);
  });

  it("hides movies without a viewable showtime in the window", async () => {
    const rows = await controller.movies(cinemaId);
    expect(rows.map((row: { id: string }) => row.id)).toEqual([
      visibleMovieId,
    ]);
  });
});
