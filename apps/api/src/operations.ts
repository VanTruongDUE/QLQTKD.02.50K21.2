import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Module,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { z } from "zod";
import { AuthModule, AuthRequest, JwtGuard, RoleGuard, Roles } from "./auth";
import { CinemaModule } from "./cinema";
import { BookingService } from "./booking.service";
import { audit, cinemaScope, scopedBooking } from "./access";
import { fail, parse, uuid } from "./http";
import { hashPassword, verifyPassword } from "./security";
import { decrypt } from "./security";
import QRCode from "qrcode";

const ids = z
  .array(z.uuid())
  .min(1)
  .max(50)
  .refine((x) => new Set(x).size === x.length);
const password = z.string().min(12).max(128);
const profile = z
  .object({
    displayName: z.string().trim().max(120),
    phone: z.string().trim().max(30),
  })
  .strict();
@Controller()
@UseGuards(JwtGuard, RoleGuard)
export class OperationsController {
  constructor(
    @Inject(DataSource) private db: DataSource,
    @Inject(BookingService) private bookings: BookingService,
  ) {}
  @Get("me/profile") @Roles("CUSTOMER", "STAFF", "MANAGER") async profile(
    @Req() req: AuthRequest,
  ) {
    return (
      await this.db.query(
        "SELECT id,email,role,display_name,phone FROM users WHERE id=$1",
        [req.user.id],
      )
    )[0];
  }
  @Patch("me/profile")
  @Roles("CUSTOMER", "STAFF", "MANAGER")
  async updateProfile(@Req() req: AuthRequest, @Body() body: unknown) {
    const p = parse(profile, body);
    await this.db.query(
      "UPDATE users SET display_name=$2,phone=$3 WHERE id=$1",
      [req.user.id, p.displayName, p.phone],
    );
    return this.profile(req);
  }
  @Post("me/password") @Roles("CUSTOMER", "STAFF", "MANAGER") async password(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    const p = parse(
      z.object({ currentPassword: password, newPassword: password }).strict(),
      body,
    );
    return this.db.transaction(async (m) => {
      const [u] = await m.query("SELECT * FROM users WHERE id=$1 FOR UPDATE", [
        req.user.id,
      ]);
      if (!verifyPassword(p.currentPassword, u.password_hash))
        fail("INVALID_CREDENTIALS", "Mật khẩu hiện tại không đúng.", 401);
      await m.query("UPDATE users SET password_hash=$2 WHERE id=$1", [
        u.id,
        hashPassword(p.newPassword),
      ]);
      await m.query(
        "UPDATE refresh_sessions SET revoked=true WHERE user_id=$1",
        [u.id],
      );
      return { ok: true };
    });
  }
  @Get("bookings/:id") @Roles("CUSTOMER", "STAFF", "MANAGER") async booking(
    @Req() req: AuthRequest,
    @Param("id") id: string,
  ) {
    const b = await scopedBooking(this.db.manager, req.user, uuid(id));
    return {
      ...b,
      items: await this.db.query(
        "SELECT id,showtime_id,seat_id,amount,movie_title,seat_label FROM booking_items WHERE booking_id=$1",
        [id],
      ),
      products: await this.db.query(
        "SELECT * FROM order_product_items WHERE booking_id=$1",
        [id],
      ),
      payments: await this.db.query(
        "SELECT id,amount,status,checkout_url,reconciliation_required FROM payments WHERE booking_id=$1",
        [id],
      ),
    };
  }
  @Get("staff/bookings") @Roles("STAFF") async lookup(
    @Req() req: AuthRequest,
    @Query("email") email: string,
  ) {
    const value = parse(z.email().max(200), email);
    return this.db.query(
      `SELECT b.id,b.status,b.total,b.created_at FROM bookings b JOIN users u ON u.id=b.owner_id JOIN holds h ON h.id=b.hold_id JOIN showtimes s ON s.id=h.showtime_id JOIN auditoriums a ON a.id=s.auditorium_id JOIN staff_cinema_assignments sa ON sa.cinema_id=a.cinema_id WHERE sa.user_id=$1 AND u.email=$2 ORDER BY b.created_at DESC LIMIT 100`,
      [req.user.id, value.toLowerCase()],
    );
  }
  @Get("tickets/:id") @Roles("CUSTOMER", "STAFF", "MANAGER") async ticket(
    @Req() req: AuthRequest,
    @Param("id") id: string,
  ) {
    uuid(id);
    const [t] = await this.db.query(
      "SELECT t.*,i.booking_id,i.movie_title,i.seat_label,i.showtime_id FROM tickets t JOIN booking_items i ON i.id=t.item_id WHERE t.id=$1",
      [id],
    );
    if (!t) fail("NOT_FOUND", "Không tìm thấy vé.", 404);
    await scopedBooking(this.db.manager, req.user, t.booking_id);
    const { qr_hash, qr_encrypted, ...safe } = t;
    void qr_hash;
    return req.user.role === "CUSTOMER"
      ? {
          ...safe,
          qrToken: decrypt(qr_encrypted),
          qrImage: await QRCode.toDataURL(decrypt(qr_encrypted)),
        }
      : safe;
  }
  @Post("staff/products/:id/redeem") @Roles("STAFF") async redeem(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Headers("idempotency-key") key: string,
  ) {
    uuid(id);
    const [ref] = await this.db.query(
      "SELECT booking_id FROM order_product_items WHERE id=$1",
      [id],
    );
    if (!ref) fail("NOT_FOUND", "Không tìm thấy combo.", 404);
    await scopedBooking(this.db.manager, req.user, ref.booking_id);
    return this.bookings.idempotent(
      req.user.id,
      "combo.redeem",
      key,
      { id },
      async (m) => {
        const b = await scopedBooking(m, req.user, ref.booking_id, true);
        if (b.status !== "CONFIRMED" || b.provenance !== "OPERATIONAL")
          fail("BOOKING_CLOSED", "Đơn không hợp lệ.");
        const [p] = await m.query(
          "SELECT * FROM order_product_items WHERE id=$1 FOR UPDATE",
          [id],
        );
        if (p.status !== "UNREDEEMED")
          fail("PRODUCT_UNAVAILABLE", "Combo đã nhận hoặc đã hoàn.");
        if (
          (
            await m.query(
              "SELECT 1 FROM product_operation_locks WHERE item_id=$1",
              [id],
            )
          ).length
        )
          fail("REQUEST_CONFLICT", "Combo đang có yêu cầu hoàn.");
        await m.query(
          "UPDATE order_product_items SET status='REDEEMED' WHERE id=$1",
          [id],
        );
        await m.query(
          "INSERT INTO combo_redemptions(item_id,staff_id) VALUES($1,$2)",
          [id, req.user.id],
        );
        await audit(m, req.user.id, "combo.redeemed", id, b.cinema_id);
        return { id, status: "REDEEMED" };
      },
    );
  }
  @Get("admin/staff") @Roles("MANAGER") staff(@Req() req: AuthRequest) {
    return this.db.query(
      `SELECT u.id,u.email,u.role,u.locked,u.display_name,u.phone,
       array_agg(DISTINCT sa.cinema_id) AS "cinemaIds"
       FROM users u
       JOIN staff_cinema_assignments sa ON sa.user_id=u.id
       JOIN staff_cinema_assignments mine ON mine.cinema_id=sa.cinema_id
       WHERE mine.user_id=$1 AND u.role='STAFF'
       GROUP BY u.id,u.email,u.role,u.locked,u.display_name,u.phone
       ORDER BY u.email`,
      [req.user.id],
    );
  }
  @Post("admin/staff") @Roles("MANAGER") async createStaff(
    @Req() req: AuthRequest,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string,
  ) {
    const p = parse(
      z
        .object({ email: z.email().max(200), password, cinemaIds: ids })
        .strict(),
      body,
    );
    for (const c of p.cinemaIds)
      await cinemaScope(this.db.manager, req.user, c);
    // Do not persist plaintext credentials inside idempotency records or audit.
    return this.bookings.idempotent(
      req.user.id,
      "staff.create",
      key,
      p,
      async (m) => {
        for (const c of p.cinemaIds) await cinemaScope(m, req.user, c);
        const [u] = await m.query(
          "INSERT INTO users(email,password_hash,role) VALUES($1,$2,'STAFF') ON CONFLICT(email) DO NOTHING RETURNING id,email,role,locked",
          [p.email.toLowerCase(), hashPassword(p.password)],
        );
        if (!u) fail("EMAIL_EXISTS", "Email đã được sử dụng.");
        for (const c of p.cinemaIds) {
          await m.query("INSERT INTO staff_cinema_assignments VALUES($1,$2)", [
            u.id,
            c,
          ]);
          await audit(m, req.user.id, "staff.created", u.id, c);
        }
        return u;
      },
    );
  }
  @Patch("admin/staff/:id") @Roles("MANAGER") async updateStaff(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    uuid(id);
    const p = parse(
      z
        .object({
          locked: z.boolean(),
          cinemaIds: ids,
          displayName: z.string().trim().max(120).optional(),
          password: password.optional(),
        })
        .strict(),
      body,
    );
    return this.db.transaction(async (m) => {
      const [u] = await m.query(
        "SELECT id FROM users WHERE id=$1 AND role='STAFF' FOR UPDATE",
        [id],
      );
      if (!u) fail("NOT_FOUND", "Không tìm thấy nhân viên.", 404);
      const old = await m.query(
        "SELECT cinema_id FROM staff_cinema_assignments WHERE user_id=$1",
        [id],
      );
      if (!old.length)
        fail("NOT_FOUND", "Nhân viên không thuộc phạm vi quản lý.", 404);
      for (const c of [
        ...old.map((x: { cinema_id: string }) => x.cinema_id),
        ...p.cinemaIds,
      ])
        await cinemaScope(m, req.user, c);
      await m.query("UPDATE users SET locked=$2 WHERE id=$1", [id, p.locked]);
      if (p.displayName !== undefined)
        await m.query("UPDATE users SET display_name=$2 WHERE id=$1", [
          id,
          p.displayName,
        ]);
      if (p.password)
        await m.query("UPDATE users SET password_hash=$2 WHERE id=$1", [
          id,
          hashPassword(p.password),
        ]);
      await m.query("DELETE FROM staff_cinema_assignments WHERE user_id=$1", [
        id,
      ]);
      for (const c of p.cinemaIds)
        await m.query("INSERT INTO staff_cinema_assignments VALUES($1,$2)", [
          id,
          c,
        ]);
      if (p.locked || p.password)
        await m.query(
          "UPDATE refresh_sessions SET revoked=true WHERE user_id=$1",
          [id],
        );
      const { password: removed, ...safe } = p;
      void removed;
      for (const c of new Set([
        ...old.map((x: { cinema_id: string }) => x.cinema_id),
        ...p.cinemaIds,
      ]))
        await audit(m, req.user.id, "staff.updated", id, c as string, {
          ...safe,
          passwordChanged: !!p.password,
        });
      return { id, ...safe };
    });
  }
  @Get("admin/bookings") @Roles("MANAGER") bookingsList(
    @Req() req: AuthRequest,
  ) {
    return this.db.query(
      `SELECT b.* FROM bookings b JOIN holds h ON h.id=b.hold_id JOIN showtimes s ON s.id=h.showtime_id JOIN auditoriums a ON a.id=s.auditorium_id JOIN staff_cinema_assignments sa ON sa.cinema_id=a.cinema_id WHERE sa.user_id=$1 ORDER BY b.created_at DESC LIMIT 100`,
      [req.user.id],
    );
  }
  @Get("admin/audit") @Roles("MANAGER") logs(@Req() req: AuthRequest) {
    return this.db.query(
      "SELECT al.* FROM audit_logs al JOIN staff_cinema_assignments sa ON sa.cinema_id=al.cinema_id WHERE sa.user_id=$1 ORDER BY al.created_at DESC LIMIT 200",
      [req.user.id],
    );
  }
  @Get("admin/reports") @Roles("MANAGER") reports(@Req() req: AuthRequest) {
    return this.db.query(
      `SELECT a.cinema_id,COALESCE(sum(p.amount),0)::bigint AS received,
    COALESCE(sum((SELECT COALESCE(sum(r.amount),0) FROM refunds r WHERE r.payment_id=p.id AND r.status='SUCCEEDED')),0)::bigint AS refunded
    FROM payments p JOIN bookings b ON b.id=p.booking_id JOIN holds h ON h.id=b.hold_id JOIN showtimes s ON s.id=h.showtime_id JOIN auditoriums a ON a.id=s.auditorium_id JOIN staff_cinema_assignments sa ON sa.cinema_id=a.cinema_id
    WHERE sa.user_id=$1 AND b.provenance='OPERATIONAL' AND p.status='SUCCEEDED' GROUP BY a.cinema_id`,
      [req.user.id],
    );
  }
}

const money = z.number().int().min(0).max(100000000);
const catalog = {
  movies: {
    table: "movies",
    schema: z
      .object({
        cinema_id: z.uuid(),
        title: z.string().min(1).max(200),
        description: z.string().max(5000),
        duration_minutes: z.number().int().min(1).max(600),
        rating: z.enum(["P", "K", "T13", "T16", "T18"]),
        poster: z.string().max(1000),
        active: z.boolean(),
      })
      .strict(),
  },
  products: {
    table: "products",
    schema: z
      .object({
        cinema_id: z.uuid(),
        name: z.string().min(1).max(200),
        price: money,
        active: z.boolean(),
      })
      .strict(),
  },
  auditoriums: {
    table: "auditoriums",
    schema: z
      .object({
        cinema_id: z.uuid(),
        name: z.string().min(1).max(200),
        active: z.boolean(),
      })
      .strict(),
  },
  seats: {
    table: "seats",
    schema: z
      .object({ auditorium_id: z.uuid(), label: z.string().min(1).max(20) })
      .strict(),
  },
  showtimes: {
    table: "showtimes",
    schema: z
      .object({
        movie_id: z.uuid(),
        auditorium_id: z.uuid(),
        starts_at: z.iso.datetime({ offset: true }),
        price: money,
        status: z.enum(["SCHEDULED", "CANCELLED"]),
      })
      .strict(),
  },
};
@Controller("admin/catalog")
@UseGuards(JwtGuard, RoleGuard)
@Roles("MANAGER")
export class CatalogAdminController {
  constructor(
    @Inject(DataSource) private db: DataSource,
    @Inject(BookingService) private bookings: BookingService,
  ) {}
  private kind(value: string) {
    if (!Object.hasOwn(catalog, value))
      fail("NOT_FOUND", "Danh mục không tồn tại.", 404);
    return catalog[value as keyof typeof catalog];
  }
  @Get(":kind") async list(
    @Req() req: AuthRequest,
    @Param("kind") kind: string,
  ) {
    const { table } = this.kind(kind);
    const join = ["seats", "showtimes"].includes(kind)
      ? "JOIN auditoriums a ON a.id=x.auditorium_id"
      : "";
    const scope = join ? "a.cinema_id" : "x.cinema_id";
    return this.db.query(
      `SELECT x.* FROM ${table} x ${join} JOIN staff_cinema_assignments sa ON sa.cinema_id=${scope} WHERE sa.user_id=$1 ORDER BY x.id LIMIT 500`,
      [req.user.id],
    );
  }
  @Post(":kind") create(
    @Req() req: AuthRequest,
    @Param("kind") kind: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string,
  ) {
    return this.save(req, kind, body, key);
  }
  @Patch(":kind/:id") update(
    @Req() req: AuthRequest,
    @Param("kind") kind: string,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string,
  ) {
    return this.save(req, kind, body, key, uuid(id));
  }
  private async save(
    req: AuthRequest,
    kind: string,
    body: unknown,
    key: string,
    id?: string,
  ) {
    const { table, schema } = this.kind(kind);
    const p = parse(schema as z.ZodType<Record<string, unknown>>, body);
    const [scopeRef] = p.cinema_id
      ? [{ cinema_id: p.cinema_id }]
      : await this.db.query("SELECT cinema_id FROM auditoriums WHERE id=$1", [
          p.auditorium_id,
        ]);
    if (!scopeRef) fail("NOT_FOUND", "Không tìm thấy phòng.", 404);
    await cinemaScope(this.db.manager, req.user, scopeRef.cinema_id);
    if(!(await this.db.query("SELECT 1 FROM cinemas WHERE id=$1 AND provenance='OPERATIONAL'",[scopeRef.cinema_id])).length)fail('LEGACY_CATALOG','Danh mục cũ cần rà soát/chuyển đổi riêng; không dùng như dữ liệu vận hành.');
    return this.bookings.idempotent(
      req.user.id,
      `catalog.${kind}.${id || "create"}`,
      key,
      p,
      async (m) => {
        async function scope(row: Record<string, unknown>) {
          if (row.cinema_id) return String(row.cinema_id);
          const [room] = await m.query(
            "SELECT cinema_id,active FROM auditoriums WHERE id=$1 FOR UPDATE",
            [row.auditorium_id],
          );
          if (!room || !room.active)
            fail("NOT_FOUND", "Phòng không còn hoạt động.", 404);
          return room.cinema_id as string;
        }
        const cinema = await scope(p);
        await cinemaScope(m, req.user, cinema);
        if (id) {
          const [old] = await m.query(
            `SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`,
            [id],
          );
          if (!old) fail("NOT_FOUND", "Không tìm thấy dữ liệu.", 404);
          const oldCinema = await scope(old);
          await cinemaScope(m, req.user, oldCinema);
          if (oldCinema !== cinema)
            fail("IMMUTABLE_SCOPE", "Không chuyển danh mục sang rạp khác.");
          if (kind === "showtimes" && old.auditorium_id !== p.auditorium_id)
            fail(
              "IMMUTABLE_ROOM",
              "Không chuyển suất sang phòng khác bằng CRUD.",
            );
          if (
            kind === "showtimes" &&
            (
              await m.query(
                "SELECT 1 FROM holds WHERE showtime_id=$1 LIMIT 1",
                [id],
              )
            ).length
          )
            fail(
              "SHOWTIME_IN_USE",
              "Suất đã có giữ ghế/đơn; không sửa bằng CRUD.",
            );
          if (
            kind === "seats" &&
            (
              await m.query(
                "SELECT 1 FROM showtime_seats WHERE seat_id=$1 LIMIT 1",
                [id],
              )
            ).length
          )
            fail("SEAT_IN_USE", "Ghế đã có lịch chiếu; không sửa sơ đồ cũ.");
          if (
            kind === "auditoriums" &&
            (
              await m.query(
                "SELECT 1 FROM showtimes WHERE auditorium_id=$1 AND starts_at>clock_timestamp() LIMIT 1",
                [id],
              )
            ).length &&
            !p.active
          )
            fail("ROOM_IN_USE", "Phòng còn lịch chiếu.");
        }
        if (
          kind === "seats" &&
          (
            await m.query(
              "SELECT 1 FROM showtimes WHERE auditorium_id=$1 LIMIT 1",
              [p.auditorium_id],
            )
          ).length
        )
          fail("SEAT_MAP_IN_USE", "Tạo sơ đồ ghế trước khi lập lịch.");
        if (kind === "showtimes") {
          const [movie] = await m.query(
            "SELECT * FROM movies WHERE id=$1 AND active AND provenance='OPERATIONAL'",
            [p.movie_id],
          );
          if (!movie || (movie.cinema_id && movie.cinema_id !== cinema))
            fail("INVALID_MOVIE", "Phim không thuộc rạp.");
          if (new Date(String(p.starts_at)).getTime() <= Date.now())
            fail("INVALID_TIME", "Giờ chiếu phải ở tương lai.", 422);
          p.ends_at = new Date(
            new Date(String(p.starts_at)).getTime() +
              (movie.duration_minutes + 15) * 60000,
          ).toISOString();
        }
        const fields = Object.keys(p);
        const values = Object.values(p);
        const [row] = id
          ? await m.query(
              `UPDATE ${table} SET ${fields.map((f, i) => `${f}=$${i + 2}`).join(",")} WHERE id=$1 RETURNING *`,
              [id, ...values],
            )
          : await m.query(
              `INSERT INTO ${table}(${fields.join(",")}) VALUES(${fields.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`,
              values,
            );
        // TypeORM returns [rows,count] for UPDATE; SELECT avoids leaking driver shapes.
        const saved = id
          ? (await m.query(`SELECT * FROM ${table} WHERE id=$1`, [id]))[0]
          : row;
        if (kind === "showtimes" && !id)
          await m.query(
            "INSERT INTO showtime_seats(showtime_id,auditorium_id,seat_id) SELECT $1,auditorium_id,id FROM seats WHERE auditorium_id=$2",
            [saved.id, p.auditorium_id],
          );
        await audit(
          m,
          req.user.id,
          `${kind}.${id ? "updated" : "created"}`,
          saved.id,
          cinema,
          p,
        );
        return saved;
      },
    );
  }
}
@Module({
  imports: [AuthModule, CinemaModule],
  controllers: [OperationsController, CatalogAdminController],
})
export class OperationsModule {}
