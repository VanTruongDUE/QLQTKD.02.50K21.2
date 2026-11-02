import { EntityManager } from "typeorm";
import { Principal } from "@starlight/contracts";
import { fail } from "./http";
export async function cinemaScope(
  m: EntityManager,
  actor: Pick<Principal, "id" | "role">,
  cinemaId: string,
) {
  const [row] = await m.query(
    "SELECT 1 FROM staff_cinema_assignments WHERE user_id=$1 AND cinema_id=$2",
    [actor.id, cinemaId],
  );
  if (!row)
    fail(
      "NOT_FOUND",
      "Không tìm thấy dữ liệu trong phạm vi được phân công.",
      404,
    );
}
export async function scopedBooking(
  m: EntityManager,
  actor: Pick<Principal, "id" | "role">,
  id: string,
  lock = false,
) {
  const [b] = await m.query(
    `SELECT b.*,a.cinema_id FROM bookings b JOIN holds h ON h.id=b.hold_id JOIN showtimes s ON s.id=h.showtime_id JOIN auditoriums a ON a.id=s.auditorium_id WHERE b.id=$1 ${lock ? "FOR UPDATE OF b" : ""}`,
    [id],
  );
  if (!b || (actor.role === "CUSTOMER" && b.owner_id !== actor.id))
    fail("NOT_FOUND", "Không tìm thấy đơn.", 404);
  if (actor.role !== "CUSTOMER") await cinemaScope(m, actor, b.cinema_id);
  return b;
}
export async function audit(
  m: EntityManager,
  actorId: string,
  action: string,
  entityId: string,
  cinemaId?: string,
  details: unknown = {},
) {
  await m.query(
    "INSERT INTO audit_logs(actor_id,action,entity_id,cinema_id,details) VALUES($1,$2,$3,$4,$5)",
    [actorId, action, entityId, cinemaId || null, JSON.stringify(details)],
  );
}
