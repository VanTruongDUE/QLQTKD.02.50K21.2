# Product catalog and transfer confirmation

The operational catalog is seeded with `pnpm --filter @starlight/api seed:catalog`.
The command is idempotent and only inserts missing products; historical order
snapshots are not changed.

Products currently configured (the recommendation is a serving guide, not a purchase limit):

- Combo Mini Starlight — 75,000 VND — 1 person
- Combo Đôi Starlight — 135,000 VND — 2 people
- Combo Gia Đình Vui Vẻ — 195,000 VND — 3-4 people
- Khoai Tây Chiên Giòn / Snack Xúc Xích — 45,000 VND — 1-2 people
- Nâng Cấp Nước Đổi Vị — 15,000 VND — 1 person / upgraded cup
- Vé Khu Game / Bowling Starlight — 35,000 VND — 1 person / ticket

`GET /api/v1/products` returns `category`, `description`, and `original_price`
plus `image_url`, `recommended_min_people`, `recommended_max_people`, `badge`,
`icon_name`, and `sort_order`. Product images are served by the web application
from `apps/web/public/products/`.

Bank transfer is not marked successful without provider evidence. A real bank
or virtual-account adapter must verify a signed callback/query, order reference,
amount, currency, and idempotency before issuing tickets. Until provider
credentials and callback details are configured, the payment remains pending;
there is no runtime auto-success or fake webhook.
