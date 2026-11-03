import { source } from "./source";
import { seedCatalog } from "./seed-catalog";

const CINEMAS = [
  "Starlight Đà Nẵng",
  "Starlight Buôn Ma Thuột",
  "Starlight Quy Nhơn",
  "Starlight Gia Lai",
  "Starlight Bảo Lộc",
  "Starlight Long An",
];

const MOVIES = [
  {
    title: "Thám Tử Kiên: Kỳ Án Không Đầu",
    duration: 118,
    rating: "T16",
    poster:
      "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&q=80",
    description:
      "Thám tử Kiên điều tra hàng loạt vụ án bí ẩn tại một ngôi làng cổ miền Tây Nam Bộ.",
  },
  {
    title: "Lật Mặt 8: Vòng Tay Người Mẹ",
    duration: 125,
    rating: "T13",
    poster:
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=600&q=80",
    description:
      "Câu chuyện gia đình giàu cảm xúc về sự hy sinh và tình yêu của người mẹ miền Trung.",
  },
  {
    title: "Quỷ Ăn Tạng 2",
    duration: 112,
    rating: "T18",
    poster:
      "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80",
    description:
      "Yak bước vào khu rừng ma ám để truy tìm linh hồn ác quỷ và giải mã tiếng thì thầm kinh hoàng.",
  },
  {
    title: "Địa Đạo: Mặt Trời Trong Bóng Tối",
    duration: 130,
    rating: "K",
    poster:
      "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=600&q=80",
    description:
      "Thiên anh hùng ca về những chiến sĩ du kích trong hệ thống địa đạo Củ Chi.",
  },
  {
    title: "Doraemon: Bản Giao Hưởng Địa Cầu",
    duration: 115,
    rating: "P",
    poster:
      "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80",
    description:
      "Doraemon, Nobita và những người bạn giải cứu Trái Đất bằng sức mạnh của âm nhạc.",
  },
  {
    title: "Venom: Kèo Cuối",
    duration: 110,
    rating: "T16",
    poster:
      "https://images.unsplash.com/photo-1534809027769-b00d750a6bac?auto=format&fit=crop&w=600&q=80",
    description:
      "Eddie Brock và Venom bị truy đuổi và phải đưa ra quyết định cuối cùng cho hành trình của họ.",
  },
  {
    title: "Robot Hoang Dã",
    duration: 102,
    rating: "P",
    poster:
      "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=600&q=80",
    description:
      "Robot Roz học cách thích nghi với thiên nhiên và trở thành mẹ nuôi của một chú ngỗng con.",
  },
  {
    title: "Cô Dâu Hào Môn",
    duration: 114,
    rating: "T16",
    poster:
      "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=600&q=80",
    description:
      "Một phi vụ giả danh giới siêu giàu kéo theo hàng loạt tình huống dở khóc dở cười.",
  },
  {
    title: "Võ Sĩ Giác Đấu II",
    duration: 148,
    rating: "T18",
    poster:
      "https://images.unsplash.com/photo-1514306191717-452ec28c7814?auto=format&fit=crop&w=600&q=80",
    description:
      "Lucius bước vào đấu trường La Mã Colosseum để tìm lại danh dự và vận mệnh của thành Rome.",
  },
];

const SEAT_ROWS = ["A", "B", "C", "D", "E", "F", "G", "H", "J"];

export async function seedPublicDemo() {
  if (process.env.PUBLIC_DEMO_MODE !== "true") {
    throw new Error(
      "Public demo catalog seeding requires PUBLIC_DEMO_MODE=true.",
    );
  }
  if (!source.isInitialized) await source.initialize();

  await source.transaction(async (manager) => {
    for (const cinemaName of CINEMAS) {
      let [cinema] = await manager.query(
        "SELECT id FROM cinemas WHERE name=$1 AND provenance='OPERATIONAL' LIMIT 1",
        [cinemaName],
      );
      if (!cinema) {
        [cinema] = await manager.query(
          "INSERT INTO cinemas(name,provenance) VALUES($1,'OPERATIONAL') RETURNING id",
          [cinemaName],
        );
      }

      const cinemaIndex = CINEMAS.indexOf(cinemaName);
      const selectedMovies = [0, 1, 2].map(
        (offset) => MOVIES[(cinemaIndex + offset * 3) % MOVIES.length],
      );
      for (let index = 0; index < selectedMovies.length; index++) {
        const movie = selectedMovies[index];
        let [existingMovie] = await manager.query(
          "SELECT id FROM movies WHERE cinema_id=$1 AND title=$2 AND provenance='OPERATIONAL' LIMIT 1",
          [cinema.id, movie.title],
        );
        if (!existingMovie) {
          [existingMovie] = await manager.query(
            `INSERT INTO movies(cinema_id,title,description,duration_minutes,rating,poster,active,provenance)
             VALUES($1,$2,$3,$4,$5,$6,true,'OPERATIONAL') RETURNING id`,
            [
              cinema.id,
              movie.title,
              movie.description,
              movie.duration,
              movie.rating,
              movie.poster,
            ],
          );
        }

        const roomName = `Phòng ${String(index + 1).padStart(2, "0")} · Starlight VIP`;
        let [room] = await manager.query(
          "SELECT id FROM auditoriums WHERE cinema_id=$1 AND name=$2 AND provenance='OPERATIONAL' LIMIT 1",
          [cinema.id, roomName],
        );
        if (!room) {
          [room] = await manager.query(
            "INSERT INTO auditoriums(cinema_id,name,active,provenance) VALUES($1,$2,true,'OPERATIONAL') RETURNING id",
            [cinema.id, roomName],
          );
        }

        const seats = SEAT_ROWS.flatMap((row) =>
          Array.from(
            { length: 12 },
            (_, seatIndex) => `${row}${String(seatIndex + 1).padStart(2, "0")}`,
          ),
        );
        const values: string[] = [];
        const parameters: string[] = [];
        for (const label of seats) {
          parameters.push(room.id, label);
          values.push(`($${parameters.length - 1},$${parameters.length})`);
        }
        await manager.query(
          `INSERT INTO seats(auditorium_id,label) VALUES ${values.join(",")}
           ON CONFLICT(auditorium_id,label) DO NOTHING`,
          parameters,
        );
      }
    }
  });

  await seedCatalog();
  console.log("Public demo catalog is ready for all six cinemas.");
}

if (require.main === module) {
  seedPublicDemo()
    .then(() => source.destroy())
    .catch(async (error) => {
      console.error("Public demo catalog seeding failed.", error);
      if (source.isInitialized) await source.destroy();
      process.exitCode = 1;
    });
}
