import { source } from "./source";

const CINEMAS = [
  { name: "Starlight Đà Nẵng" },
  { name: "Starlight Buôn Ma Thuột" },
  { name: "Starlight Quy Nhơn" },
  { name: "Starlight Gia Lai" },
  { name: "Starlight Bảo Lộc" },
  { name: "Starlight Long An" },
];

const SEAT_ROWS = ["A", "B", "C", "D", "E", "F", "G", "H", "J"];

const SLOTS = [
  { startHour: 9, startMin: 30, endHour: 11, endMin: 45 },
  { startHour: 13, startMin: 0, endHour: 15, endMin: 15 },
  { startHour: 16, startMin: 0, endHour: 18, endMin: 15 },
  { startHour: 19, startMin: 15, endHour: 21, endMin: 30 },
  { startHour: 22, startMin: 0, endHour: 23, endMin: 55 },
];

const DATES = [
  "2026-11-03",
  "2026-11-04",
  "2026-11-05",
  "2026-11-06",
  "2026-11-07",
  "2026-11-08",
];

const PRODUCTS = [
  {
    name: "Combo Mini Starlight",
    category: "combo",
    price: 75000,
    originalPrice: 90000,
    description: "1 bắp rang bơ ngọt 60oz và 1 nước ngọt có ga 22oz.",
    imageUrl: "/products/combo-mini.jpg",
    recommendedMinPeople: 1,
    recommendedMaxPeople: 1,
    badge: "Tiết kiệm 15k",
    iconName: "Popcorn",
    sortOrder: 10,
  },
  {
    name: "Combo Đôi Starlight",
    category: "combo",
    price: 135000,
    originalPrice: 160000,
    description: "1 bắp lớn vị phô mai hoặc caramel và 2 nước ngọt 32oz.",
    imageUrl: "/products/combo-doi.jpg",
    recommendedMinPeople: 2,
    recommendedMaxPeople: 2,
    badge: "Bán chạy nhất",
    iconName: "Sparkles",
    sortOrder: 20,
  },
  {
    name: "Combo Gia Đình Vui Vẻ",
    category: "combo",
    price: 195000,
    originalPrice: 240000,
    description: "2 bắp lớn, 3 nước ngọt 32oz và 1 phần snack khoai tây.",
    imageUrl: "/products/combo-gia-dinh.jpg",
    recommendedMinPeople: 3,
    recommendedMaxPeople: 4,
    badge: "Gia đình yêu thích",
    iconName: "Users",
    sortOrder: 30,
  },
  {
    name: "Khoai Tây Chiên Giòn / Snack Xúc Xích",
    category: "snack",
    price: 45000,
    description: "Khoai tây chiên giòn hoặc xúc xích phô mai nướng nóng.",
    imageUrl: "/products/snack-khoai-xuc-xich.jpg",
    recommendedMinPeople: 1,
    recommendedMaxPeople: 2,
    badge: null,
    iconName: "Coffee",
    sortOrder: 40,
  },
  {
    name: "Nâng Cấp Nước Đổi Vị",
    category: "drink",
    price: 15000,
    description: "Đổi 1 nước ngọt sang trà đào cam sả hoặc trà sữa trân châu.",
    imageUrl: "/products/nang-cap-nuoc.jpg",
    recommendedMinPeople: 1,
    recommendedMaxPeople: 1,
    badge: "Tính trên 1 ly",
    iconName: "Coffee",
    sortOrder: 50,
  },
  {
    name: "Vé Khu Game / Bowling Starlight",
    category: "entertainment",
    price: 35000,
    originalPrice: 45000,
    description: "1 giờ bowling hoặc 15 xu game thùng cho 1 người.",
    imageUrl: "/products/game-bowling.jpg",
    recommendedMinPeople: 1,
    recommendedMaxPeople: 1,
    badge: "Ưu đãi kèm vé 20%",
    iconName: "Gamepad2",
    sortOrder: 60,
  },
];

export async function seedCatalog() {
  if (!source.isInitialized) await source.initialize();

  return source.transaction(async (m) => {
    console.log("Seeding operational catalog...");

    for (const product of PRODUCTS) {
      const [existing] = await m.query(
        "SELECT id FROM products WHERE name=$1 AND provenance='OPERATIONAL' LIMIT 1",
        [product.name],
      );
      if (!existing) {
        await m.query(
          `INSERT INTO products(
            name, price, original_price, category, description, image_url,
            recommended_min_people, recommended_max_people, badge, icon_name,
            sort_order, active, provenance
          ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,'OPERATIONAL')`,
          [
            product.name,
            product.price,
            product.originalPrice ?? null,
            product.category,
            product.description,
            product.imageUrl,
            product.recommendedMinPeople,
            product.recommendedMaxPeople,
            product.badge,
            product.iconName,
            product.sortOrder,
          ],
        );
      } else {
        await m.query(
          `UPDATE products SET
            price=$2, original_price=$3, category=$4, description=$5,
            image_url=$6, recommended_min_people=$7,
            recommended_max_people=$8, badge=$9, icon_name=$10,
            sort_order=$11, active=true
           WHERE id=$1`,
          [
            existing.id,
            product.price,
            product.originalPrice ?? null,
            product.category,
            product.description,
            product.imageUrl,
            product.recommendedMinPeople,
            product.recommendedMaxPeople,
            product.badge,
            product.iconName,
            product.sortOrder,
          ],
        );
      }
    }
    console.log(`Ensured ${PRODUCTS.length} operational add-on products.`);

    // 1. Ensure all 6 cinemas exist
    for (const c of CINEMAS) {
      const [existing] = await m.query(
        "SELECT id FROM cinemas WHERE name=$1 AND provenance='OPERATIONAL'",
        [c.name]
      );
      if (!existing) {
        await m.query(
          "INSERT INTO cinemas(name, provenance) VALUES($1, 'OPERATIONAL')",
          [c.name]
        );
      }
    }

    const [danang] = await m.query(
      "SELECT id FROM cinemas WHERE name='Starlight Đà Nẵng' AND provenance='OPERATIONAL'"
    );

    // 2. Fetch all operational movies & rooms
    const movies = await m.query(
      "SELECT id, title, duration_minutes FROM movies WHERE provenance='OPERATIONAL' AND active=true ORDER BY title"
    );
    const rooms = await m.query(
      "SELECT id, name FROM auditoriums WHERE cinema_id=$1 AND provenance='OPERATIONAL' ORDER BY name",
      [danang.id]
    );

    console.log(`Found ${movies.length} movies and ${rooms.length} rooms.`);

    // 3. Ensure full 108 seats exist in each room
    for (const room of rooms) {
      const existingSeats = await m.query(
        "SELECT label FROM seats WHERE auditorium_id=$1",
        [room.id]
      );
      const existingSet = new Set(existingSeats.map((s: any) => s.label));

      for (const row of SEAT_ROWS) {
        for (let num = 1; num <= 12; num++) {
          const label = `${row}${String(num).padStart(2, "0")}`;
          if (!existingSet.has(label)) {
            await m.query(
              "INSERT INTO seats(auditorium_id, label) VALUES($1, $2)",
              [room.id, label]
            );
          }
        }
      }
    }

    // Cache seats per room
    const seatsByRoom = new Map<string, Array<{ id: string; label: string }>>();
    for (const room of rooms) {
      const roomSeats = await m.query(
        "SELECT id, label FROM seats WHERE auditorium_id=$1 ORDER BY label",
        [room.id]
      );
      seatsByRoom.set(room.id, roomSeats);
    }

    // 4. Generate showtimes for dates 2026-11-03 to 2026-11-08
    let createdCount = 0;
    for (const dateStr of DATES) {
      for (let movieIdx = 0; movieIdx < movies.length; movieIdx++) {
        const movie = movies[movieIdx];
        // Assign 1 room per movie to guarantee no schedule collision
        const room = rooms[movieIdx % rooms.length];
        const roomSeats = seatsByRoom.get(room.id) || [];

        // Pick 3 non-overlapping slots per movie
        const slotsForMovie = [SLOTS[0], SLOTS[2], SLOTS[3]];

        for (const slot of slotsForMovie) {
          // Vietnam time is UTC+7 -> subtract 7 hours for UTC ISO
          const startUtcHour = slot.startHour - 7;
          const endUtcHour = slot.endHour - 7;
          const startIso = `${dateStr}T${String(startUtcHour).padStart(2, "0")}:${String(slot.startMin).padStart(2, "0")}:00.000Z`;
          const endIso = `${dateStr}T${String(endUtcHour).padStart(2, "0")}:${String(slot.endMin).padStart(2, "0")}:00.000Z`;

          const [existingShow] = await m.query(
            "SELECT id FROM showtimes WHERE movie_id=$1 AND auditorium_id=$2 AND starts_at=$3",
            [movie.id, room.id, startIso]
          );

          if (!existingShow) {
            const [newShow] = await m.query(
              `INSERT INTO showtimes(movie_id, auditorium_id, starts_at, ends_at, price, status, provenance)
               VALUES($1, $2, $3, $4, 60000, 'SCHEDULED', 'OPERATIONAL')
               RETURNING id`,
              [movie.id, room.id, startIso, endIso]
            );

            // Populate showtime seats in batch
            if (roomSeats.length > 0) {
              const values = roomSeats
                .map((seat) => `('${newShow.id}', '${room.id}', '${seat.id}')`)
                .join(", ");
              await m.query(
                `INSERT INTO showtime_seats(showtime_id, auditorium_id, seat_id)
                 VALUES ${values}
                 ON CONFLICT DO NOTHING`
              );
            }
            createdCount++;
          }
        }
      }
    }

    console.log(`Successfully seeded ${createdCount} weekly showtimes with full seat maps.`);
  });
}

if (require.main === module) {
  seedCatalog()
    .then(() => {
      console.log("Catalog seeding completed successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seeding error:", err);
      process.exit(1);
    });
}
