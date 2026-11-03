import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import { config } from "dotenv";
config({ path: "../../.env", quiet: true });
const url = process.env.TEST_DATABASE_URL!;
if (!url || !new URL(url).pathname.endsWith("/starlight_test"))
  throw new Error("Dedicated test DB required");
process.env.DATABASE_URL = url;
let db: DataSource,
  app: import("@nestjs/common").INestApplication,
  base: string;
let fixture: Awaited<
  ReturnType<typeof import("./fixtures/seed-check-in").seedCheckIn>
>;
const tokens: Record<string, string> = {};
const key = () => randomUUID();
async function http(
  path: string,
  body?: unknown,
  role = "gate",
  idempotencyKey = key(),
) {
  return fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: process.env.WEB_ORIGIN!,
      "Idempotency-Key": idempotencyKey,
      ...(tokens[role] ? { Authorization: `Bearer ${tokens[role]}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const input = (name: string) => ({
  showtimeId: fixture.shows[0].id,
  ticketCode: fixture.tickets[name].id,
});
async function expectError(
  path: string,
  body: unknown,
  code: string,
  status = 409,
  role = "gate",
) {
  const response = await http(path, body, role);
  expect(response.status).toBe(status);
  expect(await response.json()).toMatchObject({ code });
}
beforeAll(async () => {
  const { databaseOptions } = await import("../src/database/source");
  db = new DataSource({ ...databaseOptions, url });
  await db.initialize();
  await db.runMigrations();
  const { seedCheckIn } = await import("./fixtures/seed-check-in");
  fixture = await seedCheckIn(db);
  const { bootstrap } = await import("../src/main");
  app = await bootstrap(0);
  base = (await app.getUrl()).replace("0.0.0.0", "127.0.0.1") + "/api/v1";
  for (const [role, email] of Object.entries({
    gate: fixture.gateEmail,
    gate2: fixture.gate2Email,
    customer: fixture.customerEmail,
    counter: fixture.counterEmail,
    manager: fixture.managerEmail,
  })) {
    const response = await http(
      "/auth/login",
      { email, password: process.env.DEMO_PASSWORD },
      "none",
    );
    expect(response.status).toBe(201);
    tokens[role] = (await response.json()).accessToken;
  }
});
afterAll(async () => {
  await app?.close();
  await db?.destroy();
});
describe("Check-in rules and atomic commit", () => {
  it("accepts manual code and QR, inspect does not consume the ticket", async () => {
    const tickets = await (
      await http("/me/tickets", undefined, "customer")
    ).json();
    const qr = tickets.find(
      (t: { id: string }) => t.id === fixture.tickets.valid.id,
    ).qrToken;
    for (const body of [
      input("valid"),
      { token: qr, showtimeId: fixture.shows[0].id },
    ]) {
      const response = await http("/check-in/inspect", body);
      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({
        id: fixture.tickets.valid.id,
        showtime_id: fixture.shows[0].id,
        status: "ISSUED",
      });
    }
    expect(
      await db.query("SELECT * FROM check_ins WHERE ticket_id=$1", [
        fixture.tickets.valid.id,
      ]),
    ).toHaveLength(0);
  });
  it("rejects invalid QR and nonexistent ticket code", async () => {
    await expectError(
      "/check-in/inspect",
      { showtimeId: fixture.shows[0].id, token: "QR-khong-hop-le" },
      "TICKET_NOT_FOUND",
      404,
    );
    await expectError(
      "/check-in/inspect",
      { ...input("valid"), ticketCode: key() },
      "TICKET_NOT_FOUND",
      404,
    );
  });
  it("requires selected showtime and exactly one identifier", async () => {
    expect(
      (
        await http("/check-in/inspect", {
          ticketCode: fixture.tickets.valid.id,
        })
      ).status,
    ).toBe(422);
    expect(
      (await http("/check-in/inspect", { ...input("valid"), token: "also-qr" }))
        .status,
    ).toBe(422);
  });
  it("rejects wrong showtime both on inspect and confirm", async () => {
    await expectError(
      "/check-in/inspect",
      input("wrongShow"),
      "WRONG_SHOWTIME",
    );
    await expectError(
      "/check-in/confirm",
      { ...input("wrongShow"), ageVerified: true },
      "WRONG_SHOWTIME",
    );
  });
  it.each([
    ["refunded", "TICKET_REFUNDED"],
    ["replaced", "TICKET_REPLACED"],
    ["voided", "TICKET_VOIDED"],
    ["checkedIn", "ALREADY_CHECKED_IN"],
    ["locked", "TICKET_OPERATION_PENDING"],
    ["cancelledBooking", "TICKET_NOT_VALID"],
  ])("rejects %s with a specific reason", async (name, code) => {
    await expectError("/check-in/inspect", input(name), code);
    await expectError(
      "/check-in/confirm",
      { ...input(name), ageVerified: true },
      code,
    );
  });
  it("rejects early/late/cancelled show at the API", async () => {
    const ticket = fixture.tickets.tooEarly;
    const body = { ticketCode: ticket.id, showtimeId: ticket.showtimeId };
    await expectError("/check-in/inspect", body, "CHECK_IN_TOO_EARLY");
    await db.query(
      "UPDATE showtimes SET starts_at=clock_timestamp()-interval '16 minutes' WHERE id=$1",
      [ticket.showtimeId],
    );
    await expectError(
      "/check-in/confirm",
      { ...body, ageVerified: true },
      "CHECK_IN_CLOSED",
    );
    await db.query("UPDATE showtimes SET status='CANCELLED' WHERE id=$1", [
      ticket.showtimeId,
    ]);
    await expectError("/check-in/inspect", body, "SHOWTIME_UNAVAILABLE");
  });
  it("includes both time boundaries and rejects one millisecond outside", async () => {
    const { checkInWindow } = await import("../src/check-in");
    const start = new Date("2026-11-02T10:00:00Z");
    expect(() =>
      checkInWindow(start, new Date(start.getTime() - 1800000)),
    ).not.toThrow();
    expect(() =>
      checkInWindow(start, new Date(start.getTime() + 900000)),
    ).not.toThrow();
    expect(() =>
      checkInWindow(start, new Date(start.getTime() - 1800001)),
    ).toThrow();
    expect(() =>
      checkInWindow(start, new Date(start.getTime() + 900001)),
    ).toThrow();
  });
  it("requires staff to verify age", async () => {
    expect(
      (
        await http("/check-in/confirm", {
          ...input("valid"),
          ageVerified: false,
        })
      ).status,
    ).toBe(422);
    expect((await http("/check-in/confirm", input("valid"))).status).toBe(422);
  });
  it("revalidates when ticket is voided after inspection", async () => {
    expect((await http("/check-in/inspect", input("valid2"))).status).toBe(201);
    await db.query("UPDATE tickets SET status='VOIDED' WHERE id=$1", [
      fixture.tickets.valid2.id,
    ]);
    await expectError(
      "/check-in/confirm",
      { ...input("valid2"), ageVerified: true },
      "TICKET_VOIDED",
    );
    expect(
      await db.query("SELECT * FROM check_ins WHERE ticket_id=$1", [
        fixture.tickets.valid2.id,
      ]),
    ).toHaveLength(0);
  });
  it("two staff concurrently confirm: one succeeds, one receives ALREADY_CHECKED_IN", async () => {
    const body = { ...input("concurrent"), ageVerified: true };
    const results = await Promise.all([
      http("/check-in/confirm", body, "gate"),
      http("/check-in/confirm", body, "gate2"),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await results.find((r) => r.status === 409)!.json()).toHaveProperty(
      "code",
      "ALREADY_CHECKED_IN",
    );
    const success = await results.find((r) => r.status === 201)!.json();
    const rows = await db.query("SELECT * FROM check_ins WHERE ticket_id=$1", [
      fixture.tickets.concurrent.id,
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].staff_id).toBe(success.staffId);
    expect(rows[0].created_at.toISOString()).toBe(
      new Date(success.checkedInAt).toISOString(),
    );
    expect(
      await db.query(
        "SELECT * FROM audit_logs WHERE entity_id=$1 AND action='ticket.checked_in'",
        [fixture.tickets.concurrent.id],
      ),
    ).toHaveLength(1);
  });
  it("same idempotency key replays receipt without second admission; new key is refused", async () => {
    const body = { ...input("valid"), ageVerified: true };
    const requestKey = key();
    const first = await http("/check-in/confirm", body, "gate", requestKey);
    expect(first.status).toBe(201);
    const result = await first.json();
    const retry = await http("/check-in/confirm", body, "gate", requestKey);
    expect(retry.status).toBe(201);
    expect(await retry.json()).toEqual(result);
    await expectError("/check-in/confirm", body, "ALREADY_CHECKED_IN");
    const history = await (
      await http(`/check-in/history?showtimeId=${fixture.shows[0].id}`)
    ).json();
    expect(
      history.find((h: { id: string }) => h.id === result.id),
    ).toMatchObject({
      staffId: result.staffId,
      staffEmail: fixture.gateEmail,
    });
  });
  it.each(["none", "customer", "manager"])(
    "rejects %s at all gate endpoints",
    async (role) => {
      const expected = role === "none" ? 401 : 403;
      expect((await http("/check-in/showtimes", undefined, role)).status).toBe(
        expected,
      );
      expect(
        (
          await http(
            `/check-in/history?showtimeId=${fixture.shows[0].id}`,
            undefined,
            role,
          )
        ).status,
      ).toBe(expected);
      expect(
        (await http("/check-in/inspect", input("camera"), role)).status,
      ).toBe(expected);
      expect(
        (
          await http(
            "/check-in/confirm",
            { ...input("camera"), ageVerified: true },
            role,
          )
        ).status,
      ).toBe(expected);
    },
  );
  it("lists assigned movie details and ticket progress for staff", async () => {
    const response = await http("/check-in/showtimes");
    expect(response.status).toBe(200);
    const shows = await response.json();
    const assignedShow = shows.find(
      (show: { id: string }) => show.id === fixture.shows[0].id,
    );
    expect(assignedShow).toMatchObject({
      title: expect.any(String),
      description: expect.any(String),
      duration_minutes: expect.any(Number),
      rating: expect.any(String),
      room: expect.any(String),
      cinema: expect.any(String),
      ticketCount: expect.any(Number),
      eligibleTicketCount: expect.any(Number),
      checkedInCount: expect.any(Number),
    });
    expect(assignedShow.ticketCount).toBe(
      assignedShow.eligibleTicketCount + assignedShow.checkedInCount,
    );
  });
  it("hides tickets/showtimes/history from a gate assigned to another cinema", async () => {
    const [otherCinema] = await db.query(
      "INSERT INTO cinemas(name) VALUES('Scope isolation test') RETURNING id",
    );
    const { hashPassword } = await import("../src/security");
    const [staff] = await db.query(
      "INSERT INTO users(email,password_hash,role) VALUES($1,$2,'STAFF') RETURNING id",
      [`${key()}@starlight.demo`, hashPassword(process.env.DEMO_PASSWORD!)],
    );
    await db.query("INSERT INTO staff_cinema_assignments VALUES($1,$2)", [
      staff.id,
      otherCinema.id,
    ]);
    const { AuthService } = await import("../src/auth");
    const { JwtService } = await import("@nestjs/jwt");
    const auth = new AuthService(
      db,
      new JwtService({ secret: process.env.JWT_SECRET }),
    );
    const [u] = await db.query("SELECT email FROM users WHERE id=$1", [
      staff.id,
    ]);
    tokens.outside = (
      await auth.login(u.email, process.env.DEMO_PASSWORD!)
    ).accessToken;
    expect(
      await (await http("/check-in/showtimes", undefined, "outside")).json(),
    ).toEqual([]);
    await expectError(
      "/check-in/inspect",
      input("camera"),
      "SHOWTIME_NOT_FOUND",
      404,
      "outside",
    );
    expect(
      (
        await http(
          `/check-in/history?showtimeId=${fixture.shows[0].id}`,
          undefined,
          "outside",
        )
      ).status,
    ).toBe(404);
    const [room] = await db.query(
      "INSERT INTO auditoriums(cinema_id,name) VALUES($1,$2) RETURNING id",
      [otherCinema.id, "Other room"],
    );
    const [show] = await db.query(
      `INSERT INTO showtimes(movie_id,auditorium_id,starts_at,ends_at,price) SELECT movie_id,$1,starts_at,ends_at,price FROM showtimes WHERE id=$2 RETURNING id`,
      [room.id, fixture.shows[0].id],
    );
    await expectError(
      "/check-in/inspect",
      { ...input("camera"), showtimeId: show.id },
      "TICKET_NOT_FOUND",
      404,
      "outside",
    );
  });
});
