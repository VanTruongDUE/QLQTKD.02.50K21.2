import { TestGateway } from "../gateway";
import { randomUUID } from "node:crypto";
import { source } from "../../src/database/source";
import { hashPassword } from "../../src/security";
import { required } from "../../src/config";
import { BookingService } from "../../src/booking.service";

export async function seedCheckIn(db = source) {
  if (
    process.env.NODE_ENV !== "test" ||
    !new URL(
      String(db.options.type === "postgres" ? db.options.url : ""),
    ).pathname.endsWith("/starlight_test")
  )
    throw new Error("Check-in demo is development/test only");
  const suffix = randomUUID();
  const [cinema] = await db.query(
    "INSERT INTO cinemas(name) VALUES($1) RETURNING id",
    [`Check-in test ${suffix}`],
  );
  const [movie] = await db.query(
    "INSERT INTO movies(title,description,duration_minutes,rating,poster,cinema_id) VALUES($1,'test fixture',120,'P','',$2) RETURNING id",
    [`Check-in test film ${suffix}`, cinema.id],
  );
  const customerEmail =
    process.env.E2E_CUSTOMER_EMAIL || `checkin-customer-${suffix}@test.local`;
  const gateEmail =
    process.env.E2E_STAFF_EMAIL || `checkin-gate-${suffix}@test.local`;
  const gate2Email = `checkin-gate2-${suffix}@test.local`;
  const counterEmail = `checkin-counter-${suffix}@test.local`;
  const managerEmail = `checkin-manager-${suffix}@test.local`;
  const passwordHash = hashPassword(required("DEMO_PASSWORD"));
  const accounts = new Map<string, { id: string; role: string }>();
  for (const [email, role] of [
    [customerEmail, "CUSTOMER"],
    [gateEmail, "STAFF"],
    [gate2Email, "STAFF"],
    [counterEmail, "STAFF"],
    [managerEmail, "MANAGER"],
  ]) {
    const [account] = await db.query(
      `INSERT INTO users(email,password_hash,role) VALUES($1,$2,$3)
       ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash,role=EXCLUDED.role,locked=false
       RETURNING id,role`,
      [email, passwordHash, role],
    );
    accounts.set(email, account);
    if (role === "STAFF")
      await db.query(
        "INSERT INTO staff_cinema_assignments(user_id,cinema_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [account.id, cinema.id],
      );
  }
  const owner = accounts.get(customerEmail)!;
  const gates = [accounts.get(gateEmail)!, accounts.get(gate2Email)!].map(
    (account, index) => ({
      ...account,
      email: index === 0 ? gateEmail : gate2Email,
    }),
  );
  const shows: {
    id: string;
    starts_at: Date;
    room: string;
    seatIds: string[];
  }[] = [];
  for (const [index, minutes] of [10, 12, 120].entries()) {
    const roomName = `Soát vé demo ${suffix} / ${index + 1}`;
    const [room] = await db.query(
      "INSERT INTO auditoriums(cinema_id,name) VALUES($1,$2) RETURNING id",
      [cinema.id, roomName],
    );
    const [show] = await db.query(
      `INSERT INTO showtimes(movie_id,auditorium_id,starts_at,ends_at,price)
      VALUES($1,$2,clock_timestamp()+($3*interval '1 minute'),clock_timestamp()+(($3+150)*interval '1 minute'),85000) RETURNING id,starts_at`,
      [movie.id, room.id, minutes],
    );
    const seatIds: string[] = [];
    for (let n = 1; n <= 12; n++) {
      const [seat] = await db.query(
        "INSERT INTO seats(auditorium_id,label) VALUES($1,$2) RETURNING id",
        [room.id, `D${n}`],
      );
      seatIds.push(seat.id);
      await db.query(
        "INSERT INTO showtime_seats(showtime_id,auditorium_id,seat_id) VALUES($1,$2,$3)",
        [show.id, room.id, seat.id],
      );
    }
    shows.push({ ...show, room: roomName, seatIds });
  }
  const service = new BookingService(db, new TestGateway());
  const tickets: Record<
    string,
    { id: string; showtimeId: string; seat: string }
  > = {};
  for (const [index, scenario] of [
    "valid",
    "camera",
    "refunded",
    "replaced",
    "voided",
    "checkedIn",
    "locked",
    "concurrent",
    "cancelledBooking",
    "valid2",
    "wrongShow",
    "tooEarly",
  ].entries()) {
    const show = shows[index === 10 ? 1 : index === 11 ? 2 : 0];
    const hold = (await service.hold(
      owner.id,
      { showtimeId: show.id, seatIds: [show.seatIds[index]] },
      randomUUID(),
    )) as { id: string };
    const booking = (await service.book(
      owner.id,
      { holdId: hold.id, products: [] },
      randomUUID(),
    )) as { id: string };
    const payment = (await service.createPayment(
      owner.id,
      booking.id,
      randomUUID(),
    )) as { id: string; amount: number };
    await service.callback({
      eventId: randomUUID(),
      paymentId: payment.id,
      amount: payment.amount,
      currency: "VND",
      status: "SUCCEEDED",
    });
    const [ticket] = await db.query(
      "SELECT t.id FROM tickets t JOIN booking_items i ON i.id=t.item_id WHERE i.booking_id=$1",
      [booking.id],
    );
    const status = (
      {
        refunded: "REFUNDED",
        replaced: "REPLACED",
        voided: "VOIDED",
        checkedIn: "CHECKED_IN",
      } as Record<string, string>
    )[scenario];
    if (status)
      await db.query("UPDATE tickets SET status=$1 WHERE id=$2", [
        status,
        ticket.id,
      ]);
    if (scenario === "checkedIn")
      await db.query(
        "INSERT INTO check_ins(ticket_id,staff_id) VALUES($1,$2)",
        [ticket.id, gates[0].id],
      );
    if (scenario === "locked")
      await db.query(
        "INSERT INTO ticket_operation_locks(ticket_id,request_id) VALUES($1,$2)",
        [ticket.id, randomUUID()],
      );
    if (scenario === "cancelledBooking")
      await db.query("UPDATE bookings SET status='CANCELLED' WHERE id=$1", [
        booking.id,
      ]);
    tickets[scenario] = {
      id: ticket.id,
      showtimeId: show.id,
      seat: `D${index + 1}`,
    };
  }
  return {
    customerEmail,
    gateEmail,
    gate2Email,
    counterEmail,
    managerEmail,
    gates,
    shows: shows.map(({ seatIds, ...show }) => {
      void seatIds;
      return show;
    }),
    tickets,
  };
}
export async function issueCheckInSessions(db = source) {
  if (
    process.env.NODE_ENV !== "test" ||
    !new URL(
      String(db.options.type === "postgres" ? db.options.url : ""),
    ).pathname.endsWith("/starlight_test")
  )
    throw new Error("Check-in sessions are test-only");
  const { AuthService } = await import("../../src/auth");
  const { JwtService } = await import("@nestjs/jwt");
  const auth = new AuthService(
    db,
    new JwtService({ secret: required("JWT_SECRET") }),
  );
  return {
    customer: await auth.login(
      required("E2E_CUSTOMER_EMAIL"),
      required("DEMO_PASSWORD"),
    ),
    staff: await auth.login(
      required("E2E_STAFF_EMAIL"),
      required("DEMO_PASSWORD"),
    ),
  };
}
if (require.main === module)
  source
    .initialize()
    .then(async () => {
      try {
        const result =
          process.env.E2E_ISSUE_SESSIONS === "true"
            ? await issueCheckInSessions()
            : await seedCheckIn();
        console.log(JSON.stringify(result, null, 2));
      } finally {
        await source.destroy();
      }
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
