import { randomUUID } from "node:crypto";
import { source } from "./source";
import { encrypt, hash, hashPassword } from "../security";

const STAFF_EMAIL = "staff@starlight.local";
const CUSTOMER_EMAIL = "customer@starlight.local";
const CUSTOMER_PASSWORD = "CustomerDemo2026!";
const movies = [
  { title: "Thám Tử Kiên: Kỳ Án Không Đầu", duration: 118, rating: "T16", poster: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&q=80", description: "Thám tử Kiên điều tra hàng loạt vụ án bí ẩn tại một ngôi làng cổ miền Tây Nam Bộ." },
  { title: "Lật Mặt 8: Vòng Tay Người Mẹ", duration: 125, rating: "T13", poster: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=600&q=80", description: "Câu chuyện gia đình giàu cảm xúc về sự hy sinh và tình yêu của người mẹ miền Trung." },
  { title: "Quỷ Ăn Tạng 2 (Death Whisperer 2)", duration: 112, rating: "T18", poster: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80", description: "Yak bước vào khu rừng ma ám để truy tìm linh hồn ác quỷ và giải mã tiếng thì thầm kinh hoàng." },
  { title: "Địa Đạo: Mặt Trời Trong Bóng Tối", duration: 130, rating: "K", poster: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=600&q=80", description: "Thiên anh hùng ca về những chiến sĩ du kích trong hệ thống địa đạo Củ Chi." },
  { title: "Doraemon: Bản Giao Hưởng Địa Cầu", duration: 115, rating: "P", poster: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80", description: "Doraemon, Nobita và những người bạn giải cứu Trái Đất bằng sức mạnh của âm nhạc." },
  { title: "Venom: Kèo Cuối (The Last Dance)", duration: 110, rating: "T16", poster: "https://images.unsplash.com/photo-1534809027769-b00d750a6bac?auto=format&fit=crop&w=600&q=80", description: "Eddie Brock và Venom bị truy đuổi và phải đưa ra quyết định cuối cùng cho hành trình của họ." },
  { title: "Robot Hoang Dã (The Wild Robot)", duration: 102, rating: "P", poster: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=600&q=80", description: "Robot Roz học cách thích nghi với thiên nhiên và trở thành mẹ nuôi của một chú ngỗng con." },
  { title: "Cô Dâu Hào Môn", duration: 114, rating: "T16", poster: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=600&q=80", description: "Một phi vụ giả danh giới siêu giàu kéo theo hàng loạt tình huống dở khóc dở cười." },
  { title: "Võ Sĩ Giác Đấu II (Gladiator II - Suất Chiếu Sớm)", duration: 148, rating: "T18", poster: "https://images.unsplash.com/photo-1514306191717-452ec28c7814?auto=format&fit=crop&w=600&q=80", description: "Lucius bước vào đấu trường La Mã Colosseum để tìm lại danh dự và vận mệnh của thành Rome." },
];

export async function seedStaffDemo() {
  if (process.env.NODE_ENV === "production") throw new Error("Development seed is disabled in production.");
  if (!source.isInitialized) await source.initialize();
  return source.transaction(async (m) => {
    const [staff] = await m.query("SELECT id FROM users WHERE email=$1 AND role='STAFF' AND NOT locked", [STAFF_EMAIL]);
    if (!staff) throw new Error(`Active staff account ${STAFF_EMAIL} is required.`);
    let [cinema] = await m.query(`SELECT c.id,c.name FROM cinemas c JOIN staff_cinema_assignments sa ON sa.cinema_id=c.id WHERE sa.user_id=$1 AND c.provenance='OPERATIONAL' LIMIT 1`, [staff.id]);
    if (!cinema) {
      [cinema] = await m.query("INSERT INTO cinemas(name,provenance) VALUES('Starlight Đà Nẵng','OPERATIONAL') RETURNING id,name");
      await m.query("INSERT INTO staff_cinema_assignments(user_id,cinema_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [staff.id, cinema.id]);
    }
    let [owner] = await m.query("SELECT id FROM users WHERE email=$1", [CUSTOMER_EMAIL]);
    if (!owner) [owner] = await m.query("INSERT INTO users(email,password_hash,role,display_name,phone) VALUES($1,$2,'CUSTOMER','Nguyễn Minh Quân','0905123456') RETURNING id", [CUSTOMER_EMAIL, hashPassword(CUSTOMER_PASSWORD)]);

    const seeded = [];
    for (const [index, data] of movies.entries()) {
      let [movie] = await m.query("SELECT id FROM movies WHERE title=$1 AND cinema_id=$2 AND provenance='OPERATIONAL' LIMIT 1", [data.title, cinema.id]);
      if (!movie) [movie] = await m.query(`INSERT INTO movies(cinema_id,title,description,duration_minutes,rating,poster,active,provenance) VALUES($1,$2,$3,$4,$5,$6,true,'OPERATIONAL') RETURNING id`, [cinema.id, data.title, data.description, data.duration, data.rating, data.poster]);
      else await m.query("UPDATE movies SET description=$2,duration_minutes=$3,rating=$4,poster=$5,active=true WHERE id=$1", [movie.id, data.description, data.duration, data.rating, data.poster]);

      const roomName = `Phòng ${String(index + 1).padStart(2, "0")} · ${index % 2 ? "Dolby 7.1" : "Starlight VIP"}`;
      let [room] = await m.query("SELECT id FROM auditoriums WHERE cinema_id=$1 AND name=$2 AND provenance='OPERATIONAL' LIMIT 1", [cinema.id, roomName]);
      if (!room) [room] = await m.query("INSERT INTO auditoriums(cinema_id,name,active,provenance) VALUES($1,$2,true,'OPERATIONAL') RETURNING id", [cinema.id, roomName]);
      let seats = await m.query("SELECT id,label FROM seats WHERE auditorium_id=$1 ORDER BY label", [room.id]);
      if (!seats.length) {
        for (const label of ["G05", "G06", "G07", "G08", "G09", "G10", "H07", "H08"]) await m.query("INSERT INTO seats(auditorium_id,label) VALUES($1,$2)", [room.id, label]);
        seats = await m.query("SELECT id,label FROM seats WHERE auditorium_id=$1 ORDER BY label", [room.id]);
      }
      let [show] = await m.query(`SELECT id,starts_at FROM showtimes WHERE auditorium_id=$1 AND provenance='OPERATIONAL' AND starts_at>clock_timestamp()-interval '15 minutes' ORDER BY starts_at LIMIT 1`, [room.id]);
      if (!show) [show] = await m.query(`INSERT INTO showtimes(movie_id,auditorium_id,starts_at,ends_at,price,status,provenance) VALUES($1,$2,clock_timestamp()+(($3+10)*interval '1 minute'),clock_timestamp()+(($3+10+$4)*interval '1 minute'),70000,'SCHEDULED','OPERATIONAL') RETURNING id,starts_at`, [movie.id, room.id, index * 20, data.duration]);
      for (const seat of seats) await m.query("INSERT INTO showtime_seats(showtime_id,auditorium_id,seat_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [show.id, room.id, seat.id]);

      const existing = await m.query("SELECT i.seat_id FROM tickets t JOIN booking_items i ON i.id=t.item_id WHERE i.showtime_id=$1", [show.id]);
      const used = new Set(existing.map((row: { seat_id: string }) => row.seat_id));
      const ticketIds: string[] = [];
      const missingTicketCount = Math.max(0, 6 - existing.length);
      for (const seat of seats.filter((item: { id: string }) => !used.has(item.id)).slice(0, missingTicketCount)) {
        const [hold] = await m.query("INSERT INTO holds(owner_id,showtime_id,expires_at,status) VALUES($1,$2,clock_timestamp()+interval '10 minutes','CONSUMED') RETURNING id", [owner.id, show.id]);
        const [booking] = await m.query("INSERT INTO bookings(owner_id,hold_id,status,total,policy_version,provenance) VALUES($1,$2,'CONFIRMED',70000,'MODEL-1.0','OPERATIONAL') RETURNING id", [owner.id, hold.id]);
        const [item] = await m.query("INSERT INTO booking_items(booking_id,showtime_id,seat_id,amount,movie_title,seat_label) VALUES($1,$2,$3,70000,$4,$5) RETURNING id", [booking.id, show.id, seat.id, data.title, seat.label]);
        const token = `STARLIGHT:${randomUUID()}`;
        const [ticket] = await m.query("INSERT INTO tickets(item_id,status,value_vnd,qr_hash,qr_encrypted) VALUES($1,'ISSUED',70000,$2,$3) RETURNING id", [item.id, hash(token), encrypt(token)]);
        await m.query("UPDATE showtime_seats SET hold_id=NULL,ticket_id=$1 WHERE showtime_id=$2 AND seat_id=$3", [ticket.id, show.id, seat.id]);
        await m.query("INSERT INTO payments(booking_id,amount,status,provider,provider_reference) VALUES($1,70000,'SUCCEEDED','DEVELOPMENT_SEED',$2)", [booking.id, randomUUID()]);
        ticketIds.push(ticket.id);
      }
      seeded.push({ movie: data.title, room: roomName, showtimeId: show.id, startsAt: show.starts_at, ticketCount: existing.length + ticketIds.length, ticketIds });
    }
    return { staffEmail: STAFF_EMAIL, customerEmail: CUSTOMER_EMAIL, customerPassword: CUSTOMER_PASSWORD, cinema: cinema.name, shows: seeded };
  });
}

if (require.main === module) seedStaffDemo().then((result) => console.log(JSON.stringify(result, null, 2))).finally(() => source.destroy()).catch((error) => { console.error(error); process.exitCode = 1; });
