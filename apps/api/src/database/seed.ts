import { source } from "./source";
import { hashPassword } from "../security";
import { required } from "../config";
export async function seed(db = source) {
  if (process.env.NODE_ENV === "production")
    throw new Error("Demo seed is disabled in production");
  const password = required("DEMO_PASSWORD");
  if (password.length < 12)
    throw new Error("Demo password must have at least 12 characters");
  await db.transaction(async (m) => {
    await m.query(`SELECT pg_advisory_xact_lock(726301)`);
    if ((await m.query("SELECT id FROM movies LIMIT 1")).length) {
      console.log("Seed already exists; no existing data changed");
      return;
    }
    const [cinema] = await m.query(
      `INSERT INTO cinemas(name) VALUES ('Starlight Đà Nẵng • Demo') RETURNING id`,
    );
    for (const [email, role] of [
      ["khach@starlight.demo", "CUSTOMER"],
      ["khach2@starlight.demo", "CUSTOMER"],
      ["quay@starlight.demo", "COUNTER"],
      ["soatve@starlight.demo", "GATE"],
      ["quanly@starlight.demo", "MANAGER"],
    ]) {
      const [u] = await m.query(
        "INSERT INTO users(email,password_hash,role) VALUES($1,$2,$3) RETURNING id",
        [email, hashPassword(password), role],
      );
      if (role !== "CUSTOMER")
        await m.query("INSERT INTO staff_cinema_assignments VALUES($1,$2)", [
          u.id,
          cinema.id,
        ]);
    }
    const films = [
      [
        "Chuyến tàu bình minh",
        "Một chuyến đi qua miền ký ức, nơi những cuộc gặp gỡ mở ra khởi đầu mới.",
        110,
        "T13",
        "dawn",
      ],
      [
        "Quỹ đạo cuối cùng",
        "Phi hành đoàn nhỏ tìm đường trở về từ vùng không gian chưa được khám phá.",
        125,
        "T16",
        "orbit",
      ],
      [
        "Mùa hè bên biển",
        "Hai người bạn và lời hẹn trước khi mùa hè khép lại.",
        100,
        "P",
        "sea",
      ],
    ];
    for (const [index, film] of films.entries()) {
      const [movie] = await m.query(
        "INSERT INTO movies(title,description,duration_minutes,rating,poster) VALUES($1,$2,$3,$4,$5) RETURNING id",
        film,
      );
      const [room] = await m.query(
        "INSERT INTO auditoriums(cinema_id,name) VALUES($1,$2) RETURNING id",
        [cinema.id, `Phòng ${index + 1}`],
      );
      for (const row of ["A", "B", "C", "D"])
        for (let col = 1; col <= 8; col++)
          await m.query(
            "INSERT INTO seats(auditorium_id,label) VALUES($1,$2)",
            [room.id, `${row}${col}`],
          );
      for (let day = 0; day < 5; day++) {
        const [show] = await m.query(
          `INSERT INTO showtimes(movie_id,auditorium_id,starts_at,ends_at,price) VALUES($1,$2,clock_timestamp()+($3*interval '1 day')+interval '2 hours',clock_timestamp()+($3*interval '1 day')+($4*interval '1 minute'),$5) RETURNING id`,
          [
            movie.id,
            room.id,
            day,
            120 + Number(film[2]) + 15,
            85000 + index * 10000,
          ],
        );
        await m.query(
          "INSERT INTO showtime_seats(showtime_id,auditorium_id,seat_id) SELECT $1,auditorium_id,id FROM seats WHERE auditorium_id=$2",
          [show.id, room.id],
        );
      }
    }
    await m.query(
      `INSERT INTO products(name,price) VALUES ('Bắp rang & nước',65000),('Hai nước & bắp lớn',95000)`,
    );
  });
}
if (require.main === module)
  source
    .initialize()
    .then(() => seed())
    .then(() => source.destroy())
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    });
