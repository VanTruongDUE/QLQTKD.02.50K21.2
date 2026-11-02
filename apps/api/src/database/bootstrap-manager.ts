import { source } from "./source";
import { required } from "../config";
import { hashPassword } from "../security";
import { z } from "zod";
export async function bootstrapManager(db = source) {
  const email = z
    .email()
    .parse(required("INITIAL_MANAGER_EMAIL"))
    .toLowerCase();
  const password = z
    .string()
    .min(16)
    .max(128)
    .parse(required("INITIAL_MANAGER_PASSWORD"));
  const cinemaIds = process.env.INITIAL_CINEMA_IDS?.split(",").map((x) =>
    z.uuid().parse(x.trim()),
  );
  const name = cinemaIds
    ? undefined
    : z.string().min(1).max(200).parse(required("INITIAL_CINEMA_NAME"));
  return db.transaction(async (m) => {
    await m.query("SELECT pg_advisory_xact_lock(726302)");
    if (
      (
        await m.query(
          "SELECT 1 FROM users WHERE role='MANAGER' AND NOT locked LIMIT 1",
        )
      ).length
    )
      throw new Error(
        "An active manager already exists; bootstrap is disabled.",
      );
    const [u] = await m.query(
      "INSERT INTO users(email,password_hash,role) VALUES($1,$2,'MANAGER') RETURNING id",
      [email, hashPassword(password)],
    );
    const cinemas = cinemaIds || [
      (
        await m.query("INSERT INTO cinemas(name) VALUES($1) RETURNING id", [
          name,
        ])
      )[0].id,
    ];
    for (const id of cinemas) {
      await m.query("INSERT INTO staff_cinema_assignments VALUES($1,$2)", [
        u.id,
        id,
      ]);
      await m.query(
        "INSERT INTO audit_logs(actor_id,action,entity_id,cinema_id) VALUES($1,'manager.bootstrapped',$1,$2)",
        [u.id, id],
      );
    }
    return { id: u.id, cinemaIds: cinemas };
  });
}
if (require.main === module) {
  source
    .initialize()
    .then(async () => {
      try {
        console.log(await bootstrapManager());
      } finally {
        await source.destroy();
      }
    })
    .catch(() => {
      console.error(
        "Bootstrap failed. Check required operator configuration, existing active manager and cinema IDs. Credentials were not logged.",
      );
      process.exitCode = 1;
    });
}
