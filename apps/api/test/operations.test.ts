import { beforeAll, afterAll, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import { config } from "dotenv";
import type { Principal } from "@starlight/contracts";
import { TestGateway } from "./gateway";
config({ path: "../../.env", quiet: true });
const url = process.env.TEST_DATABASE_URL!;
if (!url || !new URL(url).pathname.endsWith("/starlight_test"))
  throw new Error("Dedicated test database required");
process.env.DATABASE_URL = url;
const key = () => randomUUID();
let db: DataSource,
  app: import("@nestjs/common").INestApplication,
  base: string;
let bookings: import("../src/booking.service").BookingService,
  changes: import("../src/changes").ChangesService;
let auth: import("../src/auth").AuthService;
const actors: Record<string, Principal> = {},
  tokens: Record<string, string> = {};
let cinema: string, otherCinema: string, movie: string, product: string;
async function http(
  path: string,
  body?: unknown,
  role = "customer",
  method = body === undefined ? "GET" : "POST",
) {
  const options:RequestInit={
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: process.env.WEB_ORIGIN!,
      "Idempotency-Key": key(),
      ...(tokens[role] ? { Authorization: `Bearer ${tokens[role]}` } : {}),
    },
  };
  if(body!==undefined && method!=='GET')options.body=JSON.stringify(body);
  return fetch(base+path,options);
}
beforeAll(async () => {
  const { databaseOptions } = await import("../src/database/source");
  db = new DataSource({ ...databaseOptions, url });
  await db.initialize();
  await db.runMigrations();
  const { BookingService } = await import("../src/booking.service");
  const { ChangesService } = await import("../src/changes");
  bookings = new BookingService(db, new TestGateway());
  changes = new ChangesService(db, new TestGateway());
  const { AuthService } = await import("../src/auth");
  const { hashPassword } = await import("../src/security");
  auth = new AuthService(
    db,
    new JwtService({ secret: process.env.JWT_SECRET }),
  );
  cinema = (
    await db.query(
      "INSERT INTO cinemas(name) VALUES('Operations test') RETURNING id",
    )
  )[0].id;
  otherCinema = (
    await db.query(
      "INSERT INTO cinemas(name) VALUES('Outside scope') RETURNING id",
    )
  )[0].id;
  for (const [name, role] of Object.entries({
    customer: "CUSTOMER",
    other: "CUSTOMER",
    staff: "STAFF",
    outside: "STAFF",
    manager: "MANAGER",
  })) {
    const email = `${key()}@starlight.test`;
    const [u] = await db.query(
      "INSERT INTO users(email,password_hash,role) VALUES($1,$2,$3) RETURNING id,role",
      [email, hashPassword(process.env.DEMO_PASSWORD!), role],
    );
    const session = await auth.login(email, process.env.DEMO_PASSWORD!);
    actors[name] = { ...u, sessionId: "" };
    tokens[name] = session.accessToken;
    if (role !== "CUSTOMER")
      await db.query("INSERT INTO staff_cinema_assignments VALUES($1,$2)", [
        u.id,
        name === "outside" ? otherCinema : cinema,
      ]);
  }
  movie = (
    await db.query(
      "INSERT INTO movies(title,description,duration_minutes,rating,poster,cinema_id) VALUES('Operations film','test',90,'P','', $1) RETURNING id",
      [cinema],
    )
  )[0].id;
  product = (
    await db.query(
      "INSERT INTO products(name,price,cinema_id) VALUES('Test combo',50000,$1) RETURNING id",
      [cinema],
    )
  )[0].id;
  const { bootstrap } = await import("../src/main");
  app = await bootstrap(0);
  base = (await app.getUrl()).replace("0.0.0.0", "127.0.0.1") + "/api/v1";
});
afterAll(async () => {
  await app?.close();
  await db?.destroy();
});
async function show(price = 85000, scope = cinema) {
  const [room] = await db.query(
    "INSERT INTO auditoriums(cinema_id,name) VALUES($1,'Test room') RETURNING id",
    [scope],
  );
  const [s] = await db.query(
    "INSERT INTO showtimes(movie_id,auditorium_id,starts_at,ends_at,price) VALUES($1,$2,clock_timestamp()+interval '3 hours',clock_timestamp()+interval '5 hours',$3) RETURNING *",
    [movie, room.id, price],
  );
  s.seats = [];
  for (let n = 0; n < 4; n++) {
    const [seat] = await db.query(
      "INSERT INTO seats(auditorium_id,label) VALUES($1,$2) RETURNING id",
      [room.id, `A${n}`],
    );
    s.seats.push(seat.id);
    await db.query(
      "INSERT INTO showtime_seats(showtime_id,auditorium_id,seat_id) VALUES($1,$2,$3)",
      [s.id, room.id, seat.id],
    );
  }
  return s;
}
async function purchase(combo = false, count = 1) {
  const s = await show();
  const h: any = await bookings.hold(
    actors.customer.id,
    { showtimeId: s.id, seatIds: s.seats.slice(0, count) },
    key(),
  );
  const b: any = await bookings.book(
    actors.customer.id,
    {
      holdId: h.id,
      products: combo ? [{ productId: product, quantity: 1 }] : [],
    },
    key(),
  );
  const p: any = await bookings.createPayment(actors.customer.id, b.id, key());
  await bookings.callback({
    eventId: key(),
    paymentId: p.id,
    amount: p.amount,
    currency: "VND",
    status: "SUCCEEDED",
  });
  const tickets = await db.query(
    "SELECT t.* FROM tickets t JOIN booking_items i ON i.id=t.item_id WHERE i.booking_id=$1 ORDER BY t.id",
    [b.id],
  );
  const products = await db.query(
    "SELECT * FROM order_product_items WHERE booking_id=$1",
    [b.id],
  );
  return { s, h, b, p, tickets, products };
}
async function request(
  f: Awaited<ReturnType<typeof purchase>>,
  target?: any,
  combo = false,
  actor = actors.customer,
) {
  const p = {
    kind: target ? ("EXCHANGE" as const) : ("REFUND" as const),
    ticketIds: f.tickets.map((t: any) => t.id),
    productItemIds: combo ? f.products.map((p: any) => p.id) : [],
    ...(target
      ? {
          targetShowtimeId: target.id,
          seatIds: target.seats.slice(0, f.tickets.length),
        }
      : {}),
    ...(actor.role === "STAFF" ? { ownerVerified: true } : {}),
  };
  const q = await changes.quote(actor, p);
  return changes.create(
    actor,
    { ...p, quoteHash: q.quoteHash, customerConfirmed: true },
    key(),
  ) as Promise<any>;
}
const reason = "Khách xác nhận phạm vi và số tiền.";
async function approve(r: any) {
  return changes.decide(actors.manager, r.id, "approve", reason, key());
}
async function refunds(r: any) {
  return db.query("SELECT * FROM refunds WHERE request_id=$1 ORDER BY id", [
    r.id,
  ]);
}
async function settle(r: any, status: "SUCCEEDED" | "FAILED" = "SUCCEEDED") {
  for (const x of await refunds(r))
    await changes.refundEvent({
      eventId: key(),
      id: x.id,
      amount: x.amount,
      currency: "VND",
      status,
    });
}

it("owns data, denies escalation and isolates staff/manager endpoints", async () => {
  const f = await purchase();
  expect((await http(`/bookings/${f.b.id}`, undefined, "other")).status).toBe(
    404,
  );
  expect((await http(`/bookings/${f.b.id}`, undefined, "outside")).status).toBe(
    404,
  );
  expect((await http(`/bookings/${f.b.id}`, undefined, "staff")).status).toBe(
    200,
  );
  for (const path of [
    "/admin/staff",
    "/admin/reports",
    "/admin/audit",
    "/staff/bookings?email=x@example.com",
  ])
    expect((await http(path)).status).toBe(403);
  expect((await http("/check-in/showtimes", undefined, "manager")).status).toBe(
    403,
  );
  expect(
    (await http("/change-requests/" + key() + "/approve", { reason }, "staff"))
      .status,
  ).toBe(403);
  expect(
    (
      await http(
        "/me/profile",
        { displayName: "X", phone: "", role: "MANAGER" },
        "customer",
        "PATCH",
      )
    ).status,
  ).toBe(422);
  expect(
    (
      await http(
        "/auth/register",
        {
          email: `${key()}@test.local`,
          password: process.env.DEMO_PASSWORD,
          role: "MANAGER",
        },
        "none",
      )
    ).status,
  ).toBe(422);
  expect((await http(`/bookings/${f.b.id}/payments`, {}, "other")).status).toBe(
    404,
  );
  const s = await show();
  const h: any = await bookings.hold(
    actors.customer.id,
    { showtimeId: s.id, seatIds: [s.seats[0]] },
    key(),
  );
  const b: any = await bookings.book(
    actors.customer.id,
    { holdId: h.id, products: [] },
    key(),
  );
  expect((await http(`/bookings/${b.id}/payments`, {})).status).toBe(503);
  expect(
    (await db.query("SELECT * FROM payments WHERE booking_id=$1", [b.id]))
      .length,
  ).toBe(0);
  expect(
    (await http(`/payments/${f.p.id}/simulate`, { outcome: "success" })).status,
  ).toBe(404);
  expect((await http("/webhooks/payments/demo", {})).status).toBe(404);
});
it("locks existing sessions and enforces assignment changes immediately", async () => {
  const email = `${key()}@test.local`,
    password = process.env.DEMO_PASSWORD!;
  const response = await http(
    "/admin/staff",
    { email, password, cinemaIds: [cinema] },
    "manager",
  );
  expect(response.status).toBe(201);
  const staff = await response.json();
  const session = await auth.login(email, password);
  tokens.temporary = session.accessToken;
  expect(
    (await http("/check-in/showtimes", undefined, "temporary")).status,
  ).toBe(200);
  await db.query("DELETE FROM staff_cinema_assignments WHERE user_id=$1", [
    staff.id,
  ]);
  const shows = await (
    await http("/check-in/showtimes", undefined, "temporary")
  ).json();
  expect(shows).toEqual([]);
  await db.query("INSERT INTO staff_cinema_assignments VALUES($1,$2)", [
    staff.id,
    cinema,
  ]);
  expect(
    (
      await http(
        `/admin/staff/${staff.id}`,
        { locked: true, cinemaIds: [cinema] },
        "manager",
        "PATCH",
      )
    ).status,
  ).toBe(200);
  expect(
    (await http("/check-in/showtimes", undefined, "temporary")).status,
  ).toBe(401);
  await expect(auth.refresh(session.refreshToken)).rejects.toThrow();
  await expect(auth.login(email, password)).rejects.toThrow();
  expect(
    (
      await http(
        "/admin/staff",
        { email: `${key()}@test.local`, password, cinemaIds: [otherCinema] },
        "manager",
      )
    ).status,
  ).toBe(404);
  await db.query("UPDATE users SET role='CUSTOMER' WHERE id=$1", [
    actors.staff.id,
  ]);
  expect((await http("/check-in/showtimes", undefined, "staff")).status).toBe(
    403,
  );
  await db.query("UPDATE users SET role='STAFF' WHERE id=$1", [
    actors.staff.id,
  ]);
});
it("scopes catalog writes and prevents overlapping schedules or editing sold shows", async () => {
  const room = await (
    await http(
      "/admin/catalog/auditoriums",
      { cinema_id: cinema, name: "Managed room", active: true },
      "manager",
    )
  ).json();
  expect(room.id).toBeTruthy();
  expect(
    (
      await http(
        "/admin/catalog/seats",
        { auditorium_id: room.id, label: "B1" },
        "manager",
      )
    ).status,
  ).toBe(201);
  const input = {
    movie_id: movie,
    auditorium_id: room.id,
    starts_at: new Date(Date.now() + 7200000).toISOString(),
    price: 85000,
    status: "SCHEDULED",
  };
  const created = await http("/admin/catalog/showtimes", input, "manager");
  expect(created.status).toBe(201);
  const s = await created.json();
  expect(
    (await http("/admin/catalog/showtimes", input, "manager")).status,
  ).toBe(409);
  expect(
    (
      await http(
        "/admin/catalog/auditoriums",
        { cinema_id: otherCinema, name: "Outside", active: true },
        "manager",
      )
    ).status,
  ).toBe(404);
  const seat = (
    await db.query("SELECT seat_id FROM showtime_seats WHERE showtime_id=$1", [
      s.id,
    ])
  )[0];
  await bookings.hold(
    actors.customer.id,
    { showtimeId: s.id, seatIds: [seat.seat_id] },
    key(),
  );
  expect(
    (
      await http(
        `/admin/catalog/showtimes/${s.id}`,
        { ...input, price: 1 },
        "manager",
        "PATCH",
      )
    ).status,
  ).toBe(409);
  expect(
    (
      await http(
        "/admin/catalog/seats",
        { auditorium_id: room.id, label: "B2" },
        "manager",
      )
    ).status,
  ).toBe(409);
});
it("equal-price multi-ticket exchange is atomic and transfers paid allocations", async () => {
  const f = await purchase(false, 2);
  const target = await show();
  const r = await request(f, target);
  expect(r.status).toBe("APPROVED");
  const result = await changes.execute(actors.customer, r.id, key());
  expect(result.status).toBe("COMPLETED");
  const old = await db.query(
    "SELECT status FROM tickets WHERE id=ANY($1::uuid[])",
    [f.tickets.map((t: any) => t.id)],
  );
  expect(old.every((t: any) => t.status === "REPLACED")).toBe(true);
  const newer = await db.query(
    "SELECT t.* FROM tickets t JOIN booking_items i ON i.id=t.item_id WHERE i.booking_id=$1",
    [result.new_booking_id],
  );
  expect(newer).toHaveLength(2);
  expect(
    (
      await db.query(
        "SELECT sum(amount)::integer AS total FROM money_allocations WHERE active AND ticket_id=ANY($1::uuid[])",
        [newer.map((t: any) => t.id)],
      )
    )[0].total,
  ).toBe(170000);
});
it("approval does not refund; duplicate verified callbacks refund once", async () => {
  const f = await purchase(true);
  const r = await request(f, undefined, true);
  expect(r.quote.refundable).toBe(135000);
  await expect(changes.execute(actors.customer, r.id, key())).rejects.toThrow();
  await approve(r);
  expect(await refunds(r)).toHaveLength(0);
  expect(
    (
      await db.query("SELECT status FROM tickets WHERE id=$1", [
        f.tickets[0].id,
      ])
    )[0].status,
  ).toBe("ISSUED");
  const state = await changes.execute(actors.customer, r.id, key());
  expect(state.status).toBe("PROCESSING");
  const [rf] = await refunds(r);
  expect(rf.status).toBe("PENDING");
  const event = {
    eventId: key(),
    id: rf.id,
    amount: rf.amount,
    currency: "VND" as const,
    status: "SUCCEEDED" as const,
  };
  await expect(changes.refundEvent({ ...event, amount: 1 })).rejects.toThrow();
  await Promise.all([changes.refundEvent(event), changes.refundEvent(event)]);
  expect((await changes.get(actors.customer, r.id)).status).toBe("COMPLETED");
  expect(
    (
      await db.query("SELECT status FROM tickets WHERE id=$1", [
        f.tickets[0].id,
      ])
    )[0].status,
  ).toBe("REFUNDED");
  expect(
    (
      await db.query("SELECT status FROM order_product_items WHERE id=$1", [
        f.products[0].id,
      ])
    )[0].status,
  ).toBe("REFUNDED");
  expect(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM financial_events WHERE event_id=$1",
        [event.eventId],
      )
    )[0].n,
  ).toBe(1);
});
it("cheaper exchange keeps new ticket when refund fails and never revives old ticket", async () => {
  const f = await purchase();
  const target = await show(70000);
  const r = await request(f, target);
  expect(r.quote.refundable).toBe(15000);
  await approve(r);
  const result = await changes.execute(actors.customer, r.id, key());
  expect(result.exchange_committed).toBe(true);
  await settle(r, "FAILED");
  expect((await changes.get(actors.customer, r.id)).status).toBe(
    "RECONCILIATION_REQUIRED",
  );
  expect(
    (
      await db.query("SELECT status FROM tickets WHERE id=$1", [
        f.tickets[0].id,
      ])
    )[0].status,
  ).toBe("REPLACED");
  expect(
    (
      await db.query(
        "SELECT t.status FROM tickets t JOIN booking_items i ON i.id=t.item_id WHERE i.booking_id=$1",
        [result.new_booking_id],
      )
    )[0].status,
  ).toBe("ISSUED");
});
it("extra payment followed by refund allocates newest charge first without exceeding either receipt", async () => {
  const f = await purchase();
  const target = await show(100000);
  const r = await request(f, target);
  const pending = await changes.execute(actors.customer, r.id, key());
  expect(pending.payments).toHaveLength(1);
  const p = pending.payments[0];
  expect(p.amount).toBe(15000);
  const event = {
    eventId: key(),
    paymentId: p.id,
    amount: p.amount,
    currency: "VND" as const,
    status: "SUCCEEDED" as const,
  };
  await Promise.all([bookings.callback(event), bookings.callback(event)]);
  const done = await changes.get(actors.customer, r.id);
  expect(done.status).toBe("COMPLETED");
  const tickets = await db.query(
    "SELECT t.* FROM tickets t JOIN booking_items i ON i.id=t.item_id WHERE i.booking_id=$1",
    [done.new_booking_id],
  );
  const rr = await request({ ...f, tickets, products: [] });
  await approve(rr);
  await changes.execute(actors.customer, rr.id, key());
  const allocations = await refunds(rr);
  expect(
    allocations.map((x: any) => x.amount).sort((a: number, b: number) => a - b),
  ).toEqual([15000, 85000]);
  await settle(rr);
  expect((await changes.get(actors.customer, rr.id)).status).toBe("COMPLETED");
});
it("failed additional charge releases original tickets and replacement seats", async () => {
  const f = await purchase();
  const r = await request(f, await show(100000));
  const result = await changes.execute(actors.customer, r.id, key());
  const p = result.payments[0];
  await bookings.callback({
    eventId: key(),
    paymentId: p.id,
    amount: p.amount,
    currency: "VND",
    status: "FAILED",
  });
  expect((await changes.get(actors.customer, r.id)).status).toBe("CANCELLED");
  expect(
    await db.query("SELECT * FROM ticket_operation_locks WHERE request_id=$1", [
      r.id,
    ]),
  ).toHaveLength(0);
  expect(
    (
      await db.query("SELECT status FROM tickets WHERE id=$1", [
        f.tickets[0].id,
      ])
    )[0].status,
  ).toBe("ISSUED");
});
it("unknown refund stays locked past deadline; completed refund is never inferred from timeout", async () => {
  const f = await purchase();
  const r = await request(f);
  await approve(r);
  await changes.execute(actors.customer, r.id, key());
  await db.query("UPDATE refunds SET status='UNKNOWN' WHERE request_id=$1", [
    r.id,
  ]);
  await db.query(
    "UPDATE change_requests SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
    [r.id],
  );
  await changes.expire();
  expect((await changes.get(actors.customer, r.id)).status).toBe("PROCESSING");
  expect(
    await db.query("SELECT 1 FROM ticket_operation_locks WHERE request_id=$1", [
      r.id,
    ]),
  ).toHaveLength(1);
  await expect(
    changes.decide(actors.customer, r.id, "cancel", reason, key()),
  ).rejects.toThrow();
});
it("pending requests expire and cancellation/rejection release only their own locks", async () => {
  const f = await purchase();
  const r = await request(f);
  await db.query(
    "UPDATE change_requests SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
    [r.id],
  );
  await changes.expire();
  expect((await changes.get(actors.customer, r.id)).status).toBe("EXPIRED");
  const next = await request(f);
  await changes.decide(actors.manager, next.id, "reject", reason, key());
  const third = await request(f);
  await changes.decide(actors.customer, third.id, "cancel", reason, key());
  expect(
    await db.query("SELECT * FROM ticket_operation_locks WHERE ticket_id=$1", [
      f.tickets[0].id,
    ]),
  ).toHaveLength(0);
});
it("combo redemption is atomic and blocks refund of received products", async () => {
  const f = await purchase(true);
  const id = f.products[0].id;
  const results = await Promise.all([
    http(`/staff/products/${id}/redeem`, {}, "staff"),
    http(`/staff/products/${id}/redeem`, {}, "staff"),
  ]);
  expect(results.map((x) => x.status).sort()).toEqual([201, 409]);
  await expect(request(f, undefined, true)).rejects.toThrow();
  const r = await request(f);
  expect(r.quote.refundable).toBe(85000);
});
it("concurrent requests conflict; locked ticket cannot check in and expired request releases it", async () => {
  const f = await purchase();
  const results = await Promise.allSettled([request(f), request(f)]);
  expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  const r = (
    results.find((x) => x.status === "fulfilled") as PromiseFulfilledResult<any>
  ).value;
  await db.query(
    "UPDATE showtimes SET starts_at=clock_timestamp()+interval '10 minutes' WHERE id=$1",
    [f.s.id],
  );
  const body = {
    showtimeId: f.s.id,
    ticketCode: f.tickets[0].id,
    ageVerified: true,
  };
  const gate = await http("/check-in/confirm", body, "staff");
  expect(gate.status).toBe(409);
  expect((await gate.json()).code).toBe("TICKET_OPERATION_PENDING");
  await db.query(
    "UPDATE change_requests SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
    [r.id],
  );
  await changes.expire();
  expect((await http("/check-in/confirm", body, "staff")).status).toBe(201);
  await expect(request(f)).rejects.toThrow();
});
it("validates exact 60-minute boundary and rejects late execution, wrong film and altered quote", async () => {
  const { changeWindow } = await import("../src/changes");
  const now = new Date();
  expect(() => changeWindow(new Date(+now + 3600000), now)).not.toThrow();
  expect(() => changeWindow(new Date(+now + 3599999), now)).toThrow();
  const f = await purchase();
  const target = await show();
  const r = await request(f, target);
  await db.query("UPDATE showtimes SET price=price+1000 WHERE id=$1", [
    target.id,
  ]);
  await expect(changes.execute(actors.customer, r.id, key())).rejects.toThrow();
  await changes.decide(actors.customer, r.id, "cancel", reason, key());
  await db.query(
    "UPDATE showtimes SET starts_at=clock_timestamp()+interval '59 minutes' WHERE id=$1",
    [f.s.id],
  );
  await expect(request(f)).rejects.toThrow();
});
it("staff acts for verified owner and cannot self-approve; legacy provenance cannot become real payment", async () => {
  const f = await purchase();
  const r = await request(f, undefined, false, actors.staff);
  expect(r.owner_id).toBe(actors.customer.id);
  expect(r.created_by).toBe(actors.staff.id);
  await expect(
    changes.decide(actors.staff, r.id, "approve", reason, key()),
  ).rejects.toThrow();
  await changes.decide(actors.customer, r.id, "cancel", reason, key());
  await db.query("UPDATE bookings SET provenance='LEGACY_DEMO' WHERE id=$1", [
    f.b.id,
  ]);
  await expect(request(f)).rejects.toThrow();
});
it("approval rechecks deadline, cannot approve own staff-created request, and scope applies on replay", async () => {
  const f = await purchase();
  const r = await request(f, undefined, false, actors.staff);
  await expect(
    changes.decide(
      { ...actors.staff, role: "MANAGER" },
      r.id,
      "approve",
      reason,
      key(),
    ),
  ).rejects.toThrow();
  await db.query(
    "UPDATE change_requests SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
    [r.id],
  );
  expect(await approve(r)).toMatchObject({ status: "EXPIRED" });
  expect(
    (await http("/change-requests/" + r.id, undefined, "outside")).status,
  ).toBe(404);
  expect(
    (await http("/tickets/" + f.tickets[0].id, undefined, "other")).status,
  ).toBe(404);
  const staffTicket = await (
    await http("/tickets/" + f.tickets[0].id, undefined, "staff")
  ).json();
  expect(staffTicket.qr_encrypted).toBeUndefined();
  expect(staffTicket.qrToken).toBeUndefined();
});
it("late additional payment is reconciled without stealing reassigned seats", async () => {
  const f = await purchase();
  const target = await show(100000);
  const r = await request(f, target);
  const state = await changes.execute(actors.customer, r.id, key());
  await db.query(
    "UPDATE holds SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
    [state.hold_id],
  );
  const next: any = await bookings.hold(
    actors.other.id,
    { showtimeId: target.id, seatIds: [target.seats[0]] },
    key(),
  );
  const p = state.payments[0];
  expect(
    await bookings.callback({
      eventId: key(),
      paymentId: p.id,
      amount: p.amount,
      currency: "VND",
      status: "SUCCEEDED",
    }),
  ).toMatchObject({ reconciliationRequired: true });
  expect(
    (
      await db.query(
        "SELECT hold_id FROM showtime_seats WHERE showtime_id=$1 AND seat_id=$2",
        [target.id, target.seats[0]],
      )
    )[0].hold_id,
  ).toBe(next.id);
  const [rec] = await db.query(
    "SELECT id FROM reconciliation_cases WHERE payment_id=$1",
    [p.id],
  );
  expect(
    (
      await http(
        `/admin/reconciliation/${rec.id}/approve-refund`,
        { reason },
        "staff",
      )
    ).status,
  ).toBe(403);
  const approved = await http(
    `/admin/reconciliation/${rec.id}/approve-refund`,
    { reason },
    "manager",
  );
  expect(approved.status).toBe(201);
  const rf = await approved.json();
  expect(rf.status).toBe("CREATED");
  expect(
    (
      await http(
        `/admin/reconciliation/refunds/${rf.id}/dispatch`,
        {},
        "manager",
      )
    ).status,
  ).toBe(503);
  expect(
    (await db.query("SELECT status FROM refunds WHERE id=$1", [rf.id]))[0]
      .status,
  ).toBe("CREATED");
});
it("partial multi-payment refund failure retains locks; no timeout can restore the ticket", async () => {
  const f = await purchase();
  const r = await request(f, await show(100000));
  const state = await changes.execute(actors.customer, r.id, key());
  const p = state.payments[0];
  await bookings.callback({
    eventId: key(),
    paymentId: p.id,
    amount: p.amount,
    currency: "VND",
    status: "SUCCEEDED",
  });
  const tickets = await db.query(
    "SELECT t.* FROM tickets t JOIN booking_items i ON i.id=t.item_id WHERE i.booking_id=$1",
    [state.new_booking_id],
  );
  const rr = await request({ ...f, tickets });
  await approve(rr);
  await changes.execute(actors.customer, rr.id, key());
  const rows = await refunds(rr);
  await changes.refundEvent({
    eventId: key(),
    id: rows[0].id,
    amount: rows[0].amount,
    currency: "VND",
    status: "SUCCEEDED",
  });
  await changes.refundEvent({
    eventId: key(),
    id: rows[1].id,
    amount: rows[1].amount,
    currency: "VND",
    status: "FAILED",
  });
  expect((await changes.get(actors.customer, rr.id)).status).toBe(
    "RECONCILIATION_REQUIRED",
  );
  expect(
    await db.query("SELECT 1 FROM ticket_operation_locks WHERE request_id=$1", [
      rr.id,
    ]),
  ).toHaveLength(1);
  await expect(
    changes.decide(actors.customer, rr.id, "cancel", reason, key()),
  ).rejects.toThrow();
});
it("staff combo redemption cannot race past an existing refund lock", async () => {
  const f = await purchase(true);
  const r = await request(f, undefined, true);
  expect(
    (await http(`/staff/products/${f.products[0].id}/redeem`, {}, "staff"))
      .status,
  ).toBe(409);
  await changes.decide(actors.customer, r.id, "cancel", reason, key());
  expect(
    (await http(`/staff/products/${f.products[0].id}/redeem`, {}, "staff"))
      .status,
  ).toBe(201);
});
it("migration preserves legacy records/assignments, locks public accounts, and first-manager bootstrap is protected", async () => {
  const schema = "migration_" + key().replaceAll("-", "");
  await db.query(`CREATE SCHEMA ${schema}`);
  const { Initial1793494800000 } =
    await import("../src/database/migrations/Initial");
  const { CheckInLocks1793581200000 } =
    await import("../src/database/migrations/CheckInLocks");
  const { databaseOptions } = await import("../src/database/source");
  const isolated = new DataSource({
    ...databaseOptions,
    schema,
    extra: { options: `-c search_path=${schema},public` },
    migrations: [Initial1793494800000, CheckInLocks1793581200000],
  });
  await isolated.initialize();
  try {
    await isolated.runMigrations();
    const [legacy] = await isolated.query(
      "INSERT INTO users(email,password_hash,role) VALUES('old@starlight.demo','legacy-hash','GATE') RETURNING id",
    );
    const [c] = await isolated.query(
      "INSERT INTO cinemas(name) VALUES('Legacy cinema') RETURNING id",
    );
    await isolated.query("INSERT INTO staff_cinema_assignments VALUES($1,$2)", [
      legacy.id,
      c.id,
    ]);
    await isolated.query(
      "INSERT INTO refresh_sessions(user_id,token_hash,expires_at) VALUES($1,'legacy-token',clock_timestamp()+interval '1 day')",
      [legacy.id],
    );
    const [historical] = await isolated.query(
      `WITH movie AS (INSERT INTO movies(title,description,duration_minutes,rating,poster) VALUES('Legacy','',100,'P','') RETURNING id),
      room AS (INSERT INTO auditoriums(cinema_id,name) VALUES($1,'Legacy') RETURNING id),
      show AS (INSERT INTO showtimes(movie_id,auditorium_id,starts_at,ends_at,price) SELECT movie.id,room.id,clock_timestamp(),clock_timestamp()+interval '2 hours',100 FROM movie,room RETURNING id),
      hold AS (INSERT INTO holds(owner_id,showtime_id,expires_at,status) SELECT $2,show.id,clock_timestamp(),'CONSUMED' FROM show RETURNING id),
      booking AS (INSERT INTO bookings(owner_id,hold_id,total,status) SELECT $2,hold.id,100,'CONFIRMED' FROM hold RETURNING id)
      INSERT INTO payments(booking_id,amount,status) SELECT booking.id,100,'SUCCEEDED' FROM booking RETURNING id,booking_id`,
      [c.id, legacy.id],
    );
    await isolated.destroy();
    const upgraded = new DataSource({
      ...databaseOptions,
      schema,
      extra: { options: `-c search_path=${schema},public` },
    });
    await upgraded.initialize();
    try {
      await upgraded.runMigrations();
      expect(
        (
          await upgraded.query("SELECT role,locked FROM users WHERE id=$1", [
            legacy.id,
          ])
        )[0],
      ).toEqual({ role: "STAFF", locked: true });
      expect(
        (
          await upgraded.query(
            "SELECT revoked FROM refresh_sessions WHERE user_id=$1",
            [legacy.id],
          )
        )[0].revoked,
      ).toBe(true);
      expect(
        await upgraded.query(
          "SELECT * FROM staff_cinema_assignments WHERE user_id=$1",
          [legacy.id],
        ),
      ).toHaveLength(1);
      expect(
        (
          await upgraded.query(
            "SELECT total,policy_version,provenance FROM bookings WHERE id=$1",
            [historical.booking_id],
          )
        )[0],
      ).toEqual({
        total: 100,
        policy_version: "DEMO-1.0",
        provenance: "LEGACY_DEMO",
      });
      expect(
        (
          await upgraded.query(
            "SELECT amount,status FROM payments WHERE id=$1",
            [historical.id],
          )
        )[0],
      ).toEqual({ amount: 100, status: "SUCCEEDED" });
      process.env.INITIAL_MANAGER_EMAIL = `${key()}@test.local`;
      process.env.INITIAL_MANAGER_PASSWORD = process.env.DEMO_PASSWORD;
      process.env.INITIAL_CINEMA_IDS = c.id;
      const { bootstrapManager } =
        await import("../src/database/bootstrap-manager");
      const first = await bootstrapManager(upgraded);
      expect(first.cinemaIds).toEqual([c.id]);
      await expect(bootstrapManager(upgraded)).rejects.toThrow(
        "active manager",
      );
    } finally {
      await upgraded.destroy();
    }
  } finally {
    if (isolated.isInitialized) await isolated.destroy();
  }
});
it('hides legacy catalog and never processes events with the unconfigured gateway',async()=>{
  const f=await purchase();
  const {BookingService}=await import('../src/booking.service');
  await expect(new BookingService(db).callback({eventId:key(),paymentId:f.p.id,amount:f.p.amount,currency:'VND',status:'SUCCEEDED'})).rejects.toThrow();
  await db.query("UPDATE showtimes SET provenance='LEGACY_DEMO' WHERE id=$1",[f.s.id]);
  const shows=await (await http('/showtimes',undefined,'none')).json();expect(shows.some((s:any)=>s.id===f.s.id)).toBe(false);
  await expect(bookings.hold(actors.customer.id,{showtimeId:f.s.id,seatIds:[f.s.seats[1]]},key())).rejects.toThrow();
  const foreign=await show(85000,otherCinema);await expect(request(f,foreign)).rejects.toThrow();
  const [otherMovie]=await db.query("INSERT INTO movies(title,description,duration_minutes,rating,poster,cinema_id) VALUES('Other movie','',100,'P','',$1) RETURNING id",[cinema]);
  const target=await show();await db.query('UPDATE showtimes SET movie_id=$2 WHERE id=$1',[target.id,otherMovie.id]);await expect(request(f,target)).rejects.toThrow();
});
