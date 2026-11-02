# Product catalog and transfer confirmation

The operational catalog is seeded with `pnpm --filter @starlight/api seed:catalog`.
The command is idempotent and only inserts missing products; historical order
snapshots are not changed.

Products currently configured:

- Combo Mini Starlight — 75,000 VND
- Combo Đôi Starlight — 135,000 VND
- Combo Gia Đình Vui Vẻ — 195,000 VND
- Khoai Tây Chiên Giòn / Snack Xúc Xích — 45,000 VND
- Nâng Cấp Nước Đổi Vị — 15,000 VND
- Vé Khu Game / Bowling Starlight — 35,000 VND

`GET /api/v1/products` returns `category`, `description`, and `original_price`
in addition to the existing fields.

Bank transfer is not marked successful without provider evidence. A real bank
or virtual-account adapter must verify a signed callback/query, order reference,
amount, currency, and idempotency before issuing tickets. Until provider
credentials and callback details are configured, the payment remains pending;
there is no runtime auto-success or fake webhook.
