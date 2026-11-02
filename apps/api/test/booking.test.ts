import { TestGateway } from "./gateway";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID, createHmac } from "node:crypto";
import { DataSource } from "typeorm";
import { config } from "dotenv";
config({ path: "../../.env", quiet: true });
// Only the dedicated test database is eligible. Never reset the user's database.
const testUrl = process.env.TEST_DATABASE_URL!;
if (!testUrl || !new URL(testUrl).pathname.endsWith("/starlight_test"))
  throw new Error("TEST_DATABASE_URL must point to starlight_test");
process.env.DATABASE_URL = testUrl;
let db: DataSource;
let service: import("../src/booking.service").BookingService;
let app: import("@nestjs/common").INestApplication;
let base: string;
let owner: string;
let other: string;
let customerToken: string;
let gateToken: string;
let counterToken: string;
let showId: string;
let seats: string[];
const key = () => randomUUID();
const event = (
  payment: { id: string; amount: number },
  status: "SUCCEEDED" | "FAILED" = "SUCCEEDED",
) => ({
  eventId: key(),
  paymentId: payment.id,
  amount: payment.amount,
  currency: "VND" as const,
  status,
});
async function purchase(seatIds: string[], who = owner) {
  const h = (await service.hold(
    who,
    { showtimeId: showId, seatIds },
    key(),
  )) as any;
  const b = (await service.book(
    who,
    { holdId: h.id, products: [] },
    key(),
  )) as any;
  const p = (await service.createPayment(who, b.id, key())) as any;
  return { h, b, p };
}
async function http(
  path: string,
  body?: unknown,
  token?: string,
  extra: Record<string, string> = {},
) {
  return fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: process.env.WEB_ORIGIN!,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
beforeAll(async () => {
  const { databaseOptions } = await import("../src/database/source");
  db = new DataSource({ ...databaseOptions, url: testUrl });
  await db.initialize();
  await db.runMigrations();
  const { seed } = await import("./fixtures/seed");
  await seed(db);
  const { BookingService } = await import("../src/booking.service");
  service = new BookingService(db, new TestGateway());
  const users = await db.query("SELECT id,email FROM users");
  owner = users.find((u: any) => u.email === "khach@starlight.demo").id;
  other = users.find((u: any) => u.email === "khach2@starlight.demo").id;
  // Each run adds an isolated auditorium/showtime; prior evidence remains intact.
  const [cinema] = (await db.query(
    "SELECT c.id FROM cinemas c JOIN staff_cinema_assignments sa ON sa.cinema_id=c.id JOIN users u ON u.id=sa.user_id WHERE u.email='soatve@starlight.demo' LIMIT 1",
  )) || (await db.query("SELECT id FROM cinemas LIMIT 1"));
  const [movie] = await db.query("SELECT id FROM movies LIMIT 1");
  const [room] = await db.query(
    "INSERT INTO auditoriums(cinema_id,name) VALUES($1,$2) RETURNING id",
    [cinema.id, `Test ${key()}`],
  );
  const [show] = await db.query(
    `INSERT INTO showtimes(movie_id,auditorium_id,starts_at,ends_at,price) VALUES($1,$2,clock_timestamp()+interval '10 minutes',clock_timestamp()+interval '3 hours',85000) RETURNING id`,
    [movie.id, room.id],
  );
  showId = show.id;
  seats = [];
  for (let n = 1; n <= 40; n++) {
    const [seat] = await db.query(
      "INSERT INTO seats(auditorium_id,label) VALUES($1,$2) RETURNING id",
      [room.id, `T${n}`],
    );
    seats.push(seat.id);
    await db.query(
      "INSERT INTO showtime_seats(showtime_id,auditorium_id,seat_id) VALUES($1,$2,$3)",
      [showId, room.id, seat.id],
    );
  }
  const { bootstrap } = await import("../src/main");
  app = await bootstrap(0);
  base = (await app.getUrl()).replace("0.0.0.0", "127.0.0.1") + "/api/v1";
  for (const email of [
    "khach@starlight.demo",
    "soatve@starlight.demo",
    "quay@starlight.demo",
  ]) {
    const response = await http("/auth/login", {
      email,
      password: process.env.DEMO_PASSWORD,
    });
    expect(response.status).toBe(201);
    const data = await response.json();
    if (email.startsWith("khach")) customerToken = data.accessToken;
    else if (email.startsWith("soatve")) gateToken = data.accessToken;
    else counterToken = data.accessToken;
  }
});
afterAll(async () => {
  await app?.close();
  await db?.destroy();
});
describe("PostgreSQL transactions and invariants", () => {
  it("AC01: only one of two concurrent customers gets the same seat", async () => {
    const results = await Promise.allSettled([
      service.hold(owner, { showtimeId: showId, seatIds: [seats[0]] }, key()),
      service.hold(other, { showtimeId: showId, seatIds: [seats[0]] }, key()),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
  it("AC02: overlapping baskets are all-or-nothing", async () => {
    const results = await Promise.allSettled([
      service.hold(
        owner,
        { showtimeId: showId, seatIds: [seats[1], seats[2]] },
        key(),
      ),
      service.hold(
        other,
        { showtimeId: showId, seatIds: [seats[2], seats[3]] },
        key(),
      ),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rows = await db.query(
      "SELECT * FROM showtime_seats WHERE showtime_id=$1 AND seat_id=ANY($2::uuid[]) AND hold_id IS NOT NULL",
      [showId, seats.slice(1, 4)],
    );
    expect(rows).toHaveLength(2);
  });
  it("idempotent hold returns same result; different payload is rejected", async () => {
    const k = key();
    const input = { showtimeId: showId, seatIds: [seats[4]] };
    const [a, b] = await Promise.all([
      service.hold(owner, input, k),
      service.hold(owner, input, k),
    ]);
    expect((a as any).id).toBe((b as any).id);
    await expect(
      service.hold(owner, { ...input, seatIds: [seats[5]] }, k),
    ).rejects.toThrow();
  });
  it("AC03: expired hold is replaced even without cleanup; stale cleanup preserves new owner", async () => {
    const h = (await service.hold(
      owner,
      { showtimeId: showId, seatIds: [seats[5]] },
      key(),
    )) as any;
    await db.query(
      "UPDATE holds SET expires_at=clock_timestamp() WHERE id=$1",
      [h.id],
    );
    const next = (await service.hold(
      other,
      { showtimeId: showId, seatIds: [seats[5]] },
      key(),
    )) as any;
    await service.expire();
    const [seat] = await db.query(
      "SELECT hold_id FROM showtime_seats WHERE showtime_id=$1 AND seat_id=$2",
      [showId, seats[5]],
    );
    expect(seat.hold_id).toBe(next.id);
    await expect(
      service.book(owner, { holdId: h.id, products: [] }, key()),
    ).rejects.toThrow();
  });
  it("AC05: concurrent duplicate callbacks issue exactly one ticket and outbox event", async () => {
    const { b, p } = await purchase([seats[6]]);
    const e = event(p);
    await Promise.all(Array.from({ length: 8 }, () => service.callback(e)));
    await service.callback({ ...e, eventId: key() });
    const [{ count }] = await db.query(
      "SELECT count(*)::int AS count FROM tickets t JOIN booking_items i ON i.id=t.item_id WHERE i.booking_id=$1",
      [b.id],
    );
    expect(count).toBe(1);
    expect(
      await db.query("SELECT * FROM outbox_events WHERE booking_id=$1", [b.id]),
    ).toHaveLength(1);
    const [booking] = await db.query(
      "SELECT status FROM bookings WHERE id=$1",
      [b.id],
    );
    expect(booking.status).toBe("CONFIRMED");
  });
  it("AC04: failure issues no ticket, retry does not extend expiry", async () => {
    const { h, b, p } = await purchase([seats[7]]);
    await service.callback(event(p, "FAILED"));
    expect(
      await db.query(
        "SELECT t.id FROM tickets t JOIN booking_items i ON i.id=t.item_id WHERE i.booking_id=$1",
        [b.id],
      ),
    ).toHaveLength(0);
    const retry = (await service.createPayment(owner, b.id, key())) as any;
    expect(retry.id).not.toBe(p.id);
    const [hold] = await db.query("SELECT expires_at FROM holds WHERE id=$1", [
      h.id,
    ]);
    expect(hold.expires_at.toISOString()).toBe(
      new Date(h.expiresAt).toISOString(),
    );
  });
  it("AC06: late success records reconciliation and never steals reassigned seat", async () => {
    const { h, b, p } = await purchase([seats[8]]);
    await db.query(
      "UPDATE holds SET expires_at=clock_timestamp() WHERE id=$1",
      [h.id],
    );
    const newer = (await service.hold(
      other,
      { showtimeId: showId, seatIds: [seats[8]] },
      key(),
    )) as any;
    const result = await service.callback(event(p));
    expect(result).toHaveProperty("reconciliationRequired", true);
    const [seat] = await db.query(
      "SELECT * FROM showtime_seats WHERE showtime_id=$1 AND seat_id=$2",
      [showId, seats[8]],
    );
    expect(seat.hold_id).toBe(newer.id);
    expect(seat.ticket_id).toBeNull();
    expect(
      await db.query("SELECT * FROM reconciliation_cases WHERE payment_id=$1", [
        p.id,
      ]),
    ).toHaveLength(1);
    expect(
      (await db.query("SELECT status FROM bookings WHERE id=$1", [b.id]))[0]
        .status,
    ).toBe("EXPIRED");
  });
  it("success at expiry boundary cannot issue ticket", async () => {
    const { h, p } = await purchase([seats[9]]);
    await db.query(
      "UPDATE holds SET expires_at=clock_timestamp() WHERE id=$1",
      [h.id],
    );
    expect(await service.callback(event(p))).toHaveProperty(
      "reconciliationRequired",
      true,
    );
  });
  it("AC16: unknown payment prevents a second charge", async () => {
    const { b, p } = await purchase([seats[10]]);
    await db.query("UPDATE payments SET status='UNKNOWN' WHERE id=$1", [p.id]);
    const next = (await service.createPayment(owner, b.id, key())) as any;
    expect(next.id).toBe(p.id);
    expect(next.status).toBe("UNKNOWN");
  });
  it("provider rejects mismatched amounts and reused event with altered payload", async () => {
    const { p } = await purchase([seats[11]]);
    const e = event(p);
    await expect(service.callback({ ...e, amount: 1 })).rejects.toThrow();
    await service.callback(e);
    await expect(
      service.callback({ ...e, status: "FAILED" }),
    ).rejects.toThrow();
  });
  it("late failure does not overwrite confirmed success", async () => {
    const { p } = await purchase([seats[12]]);
    await service.callback(event(p));
    await service.callback(event(p, "FAILED"));
    expect(
      (await db.query("SELECT status FROM payments WHERE id=$1", [p.id]))[0]
        .status,
    ).toBe("SUCCEEDED");
  });
  it("database rejects a seat from another auditorium and overlapping showtime", async () => {
    const [otherSeat] = await db.query(
      "SELECT id,auditorium_id FROM seats WHERE id<>$1 AND auditorium_id<>(SELECT auditorium_id FROM showtimes WHERE id=$2) LIMIT 1",
      [seats[0], showId],
    );
    const [show] = await db.query("SELECT * FROM showtimes WHERE id=$1", [
      showId,
    ]);
    await expect(
      db.query("INSERT INTO showtime_seats VALUES($1,$2,$3,NULL,NULL)", [
        showId,
        show.auditorium_id,
        otherSeat.id,
      ]),
    ).rejects.toThrow();
    await expect(
      db.query(
        "INSERT INTO showtimes(movie_id,auditorium_id,starts_at,ends_at,price) VALUES($1,$2,$3,$4,1)",
        [show.movie_id, show.auditorium_id, show.starts_at, show.ends_at],
      ),
    ).rejects.toThrow();
  });
});
describe("HTTP security and check-in", () => {
  it("worker delivers queued email to Mailpit and does not resend completed events", async () => {
    const { b, p } = await purchase([seats[20]]);
    await service.callback(event(p));
    const { source } = await import("../src/database/source");
    const { tick } = await import("../src/worker");
    await source.initialize();
    try {
      let sent = false;
      for (let n = 0; n < 20; n++) {
        await tick();
        const [row] = await db.query(
          "SELECT status FROM outbox_events WHERE booking_id=$1",
          [b.id],
        );
        if (row.status === "SENT") {
          sent = true;
          break;
        }
      }
      expect(sent).toBe(true);
      const [before] = await db.query(
        "SELECT attempts FROM outbox_events WHERE booking_id=$1",
        [b.id],
      );
      await tick();
      const [after] = await db.query(
        "SELECT attempts FROM outbox_events WHERE booking_id=$1",
        [b.id],
      );
      expect(after.attempts).toBe(before.attempts);
      const inbox = await (
        await fetch("http://localhost:8025/api/v1/messages")
      ).json();
      expect(inbox.total).toBeGreaterThan(0);
    } finally {
      await source.destroy();
    }
  });

  it("AC12/AC18: enforces login, customer role and ownership", async () => {
    expect(
      (await http("/holds", { showtimeId: showId, seatIds: [seats[13]] }))
        .status,
    ).toBe(401);
    expect(
      (
        await http(
          "/holds",
          { showtimeId: showId, seatIds: [seats[13]] },
          counterToken,
          { "Idempotency-Key": key() },
        )
      ).status,
    ).toBe(403);
    const { b, p } = await purchase([seats[14]], other);
    expect(
      (
        await http(`/bookings/${b.id}/payments`, {}, customerToken, {
          "Idempotency-Key": key(),
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await http(
          `/payments/${p.id}/simulate`,
          { outcome: "success" },
          customerToken,
          { "Idempotency-Key": key() },
        )
      ).status,
    ).toBe(404);
    expect(
      (await http("/admin/reconciliation", undefined, customerToken)).status,
    ).toBe(403);
  });
  it("demo webhook is removed even with a HMAC header", async () => {
    const { p } = await purchase([seats[15]]);
    const e = event(p);
    expect((await http("/webhooks/payments/demo", e)).status).toBe(404);
    const signature = createHmac("sha256", key())
      .update(JSON.stringify(e))
      .digest("hex");
    expect(
      (
        await http("/webhooks/payments/demo", e, undefined, {
          "x-payment-signature": signature,
        })
      ).status,
    ).toBe(404);
  });
  it("AC11: inspect is read-only; concurrent gate confirms consume ticket only once", async () => {
    const { b, p } = await purchase([seats[16]]);
    await service.callback(event(p));
    const list = await (
      await http("/me/tickets", undefined, customerToken)
    ).json();
    const ticket = list.find((t: any) => t.booking_id === b.id);
    expect(ticket.qrImage).toMatch(/^data:image\/png/);
    expect(ticket.qr_hash).toBeUndefined();
    expect(
      (
        await http(
          "/check-in/inspect",
          { token: ticket.qrToken, showtimeId: showId },
          gateToken,
        )
      ).status,
    ).toBe(201);
    expect(
      (await db.query("SELECT status FROM tickets WHERE id=$1", [ticket.id]))[0]
        .status,
    ).toBe("ISSUED");
    const results = await Promise.all([
      http(
        "/check-in/confirm",
        { token: ticket.qrToken, showtimeId: showId, ageVerified: true },
        gateToken,
        { "Idempotency-Key": key() },
      ),
      http(
        "/check-in/confirm",
        { token: ticket.qrToken, showtimeId: showId, ageVerified: true },
        gateToken,
        { "Idempotency-Key": key() },
      ),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(
      await db.query("SELECT * FROM check_ins WHERE ticket_id=$1", [ticket.id]),
    ).toHaveLength(1);
  });
  it("validation rejects duplicate and malformed seats", async () => {
    expect(
      (
        await http(
          "/holds",
          { showtimeId: showId, seatIds: [seats[17], seats[17]] },
          customerToken,
          { "Idempotency-Key": key() },
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await http(
          "/holds",
          { showtimeId: "bad", seatIds: [] },
          customerToken,
          { "Idempotency-Key": key() },
        )
      ).status,
    ).toBe(422);
  });
  it("refresh rotates cookie, rejects old token and logout revokes access", async () => {
    const login = await http("/auth/login", {
      email: "khach2@starlight.demo",
      password: process.env.DEMO_PASSWORD,
    });
    const cookie = login.headers.get("set-cookie")!.split(";")[0];
    expect(login.headers.get("set-cookie")).toContain("HttpOnly");
    const refresh = await http("/auth/refresh", {}, undefined, {
      Cookie: cookie,
    });
    expect(refresh.status).toBe(201);
    const rotated = refresh.headers.get("set-cookie")!.split(";")[0];
    expect(rotated).not.toBe(cookie);
    expect(
      (await http("/auth/refresh", {}, undefined, { Cookie: cookie })).status,
    ).toBe(401);
    const access = (await refresh.json()).accessToken;
    expect(
      (await http("/auth/logout", {}, undefined, { Cookie: rotated })).status,
    ).toBe(201);
    expect((await http("/me/tickets", undefined, access)).status).toBe(401);
    expect(
      (
        await http("/auth/refresh", {}, undefined, {
          Cookie: rotated,
          Origin: "https://untrusted.example",
        })
      ).status,
    ).toBe(403);
  });
});
