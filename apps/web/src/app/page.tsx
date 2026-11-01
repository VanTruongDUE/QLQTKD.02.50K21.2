"use client";
import { useEffect, useState, useRef } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
  useMutation,
} from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { credentialsSchema } from "@starlight/contracts";
import {
  Ticket,
  Armchair,
  ArrowLeft,
  LogOut,
  Film,
  Clock3,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type User = { id: string; email: string; role: string };
type Movie = {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  rating: string;
  poster: string;
};
type Showtime = {
  id: string;
  movie_id: string;
  starts_at: string;
  price: number;
  room: string;
  cinema: string;
};
type Seat = { id: string; label: string; status: string };
type Product = { id: string; name: string; price: number };
type Hold = { id: string; expiresAt: string; serverTime: string };
type Booking = {
  id: string;
  total: number;
  status: string;
  expiresAt?: string;
  expires_at?: string;
  payments?: { id: string; status: string; reconciliationRequired: boolean }[];
};
type TicketData = {
  id: string;
  booking_id: string;
  movie_title: string;
  seat_label: string;
  starts_at: string;
  room: string;
  cinema: string;
  status: string;
  qrImage: string;
  qrToken: string;
};
let accessToken = "";
let refreshPromise: Promise<boolean> | null = null;
async function request<T>(
  path: string,
  body?: unknown,
  key?: string,
  retry = true,
): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 401 && retry && !path.startsWith("/auth/")) {
    refreshPromise ??= request<{ accessToken: string }>(
      "/auth/refresh",
      {},
      undefined,
      false,
    )
      .then((r) => {
        accessToken = r.accessToken;
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
    if (await refreshPromise) return request(path, body, key, false);
  }
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.message || "Không thể kết nối dịch vụ.");
  return data;
}
const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    value,
  );
const date = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
const statusName: Record<string, string> = {
  CONFIRMED: "Đã xác nhận",
  PENDING_PAYMENT: "Chờ thanh toán",
  EXPIRED: "Đã hết hạn",
  ISSUED: "Vé hợp lệ",
  CHECKED_IN: "Đã check-in",
  SUCCEEDED: "Thành công",
  FAILED: "Thất bại",
  UNKNOWN: "Chờ đối soát",
  PENDING: "Đang chờ",
};
export default function Page() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <Cinema />
    </QueryClientProvider>
  );
}
function Cinema() {
  const cache = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<"booking" | "tickets" | "staff">("booking");
  const [loginOpen, setLoginOpen] = useState(false);
  const [movie, setMovie] = useState<Movie | null>(null);
  const [show, setShow] = useState<Showtime | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [hold, setHold] = useState<Hold | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [payment, setPayment] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(Date.now());
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const movies = useQuery({
    queryKey: ["movies"],
    queryFn: () => request<Movie[]>("/movies"),
  });
  const shows = useQuery({
    queryKey: ["showtimes"],
    queryFn: () => request<Showtime[]>("/showtimes"),
  });
  const products = useQuery({
    queryKey: ["products"],
    queryFn: () => request<Product[]>("/products"),
  });
  const seats = useQuery({
    queryKey: ["seats", show?.id],
    queryFn: () =>
      request<{ seats: Seat[] }>("/showtimes/" + show!.id + "/seats"),
    enabled: !!show,
    refetchInterval: 3000,
  });
  const tickets = useQuery({
    queryKey: ["tickets", user?.id],
    queryFn: () => request<TicketData[]>("/me/tickets"),
    enabled: !!user,
    refetchInterval: 5000,
  });
  const orders = useQuery({
    queryKey: ["orders", user?.id],
    queryFn: () => request<Booking[]>("/me/bookings"),
    enabled: !!user,
    refetchInterval: 5000,
  });
  useEffect(() => {
    let active = true;
    request<{ user: User; accessToken: string }>("/auth/refresh", {})
      .then((r) => {
        accessToken = r.accessToken;
        if (active) setUser(r.user);
      })
      .catch(() => {});
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  const seconds = hold
    ? Math.max(
        0,
        Math.ceil((new Date(hold.expiresAt).getTime() - now - offset) / 1000),
      )
    : 0;
  const currentOrder = orders.data?.find((b) => b.id === booking?.id);
  const confirmed = currentOrder?.status === "CONFIRMED";
  const reset = () => {
    setHold(null);
    setBooking(null);
    setPayment(null);
    setSelected([]);
    setQuantities({});
    setNotice("");
    void cache.invalidateQueries({ queryKey: ["seats"] });
  };
  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setNotice((e as Error).message);
      void cache.invalidateQueries({ queryKey: ["seats"] });
    } finally {
      setBusy(false);
    }
  };
  const reserve = () =>
    act(async () => {
      if (!user) {
        setLoginOpen(true);
        return;
      }
      const h = await request<Hold>(
        "/holds",
        { showtimeId: show!.id, seatIds: selected },
        crypto.randomUUID(),
      );
      setHold(h);
      setOffset(new Date(h.serverTime).getTime() - Date.now());
      const b = await request<Booking>(
        "/bookings",
        {
          holdId: h.id,
          products: Object.entries(quantities)
            .filter(([, q]) => q > 0)
            .map(([productId, quantity]) => ({ productId, quantity })),
        },
        crypto.randomUUID(),
      );
      setBooking(b);
      await cache.invalidateQueries({ queryKey: ["orders"] });
    });
  const pay = (outcome: "success" | "failed" | "timeout") =>
    act(async () => {
      const p =
        payment ||
        (
          await request<{ id: string }>(
            `/bookings/${booking!.id}/payments`,
            {},
            crypto.randomUUID(),
          )
        ).id;
      setPayment(p);
      const result = await request<{
        status?: string;
        reconciliationRequired?: boolean;
      }>(`/payments/${p}/simulate`, { outcome }, crypto.randomUUID());
      setNotice(
        result.reconciliationRequired
          ? "Đã nhận tiền thử nghiệm nhưng không thể cấp vé. Khoản thu đang chờ quản lý đối soát."
          : outcome === "timeout"
            ? "Chưa rõ kết quả. Không tạo khoản thu mới; dùng xác nhận đối soát để mô phỏng callback."
            : outcome === "failed"
              ? "Thanh toán thất bại. Có thể thử lại trong thời gian giữ ghế."
              : "Thanh toán thành công. Vé QR đã sẵn sàng.",
      );
      if (outcome === "failed") setPayment(null);
      await cache.invalidateQueries({ queryKey: ["orders"] });
      await cache.invalidateQueries({ queryKey: ["tickets"] });
      if (result.status === "CONFIRMED") setView("tickets");
    });
  const total =
    selected.length * (show?.price || 0) +
    (products.data || []).reduce(
      (sum, p) => sum + p.price * (quantities[p.id] || 0),
      0,
    );
  return (
    <>
      <header>
        <a className="brand" href="/" aria-label="Starlight Cinema trang chủ">
          <Film size={23} />
          Starlight <span>Cinema</span>
        </a>
        <nav aria-label="Điều hướng">
          <button
            onClick={() => setView("booking")}
            aria-current={view === "booking" ? "page" : undefined}
          >
            Đặt vé
          </button>
          <button
            onClick={() => {
              if (!user) setLoginOpen(true);
              else setView("tickets");
            }}
          >
            Vé của tôi
          </button>
          {user && user.role !== "CUSTOMER" && (
            <button onClick={() => setView("staff")}>Nhân viên</button>
          )}
        </nav>
        {user ? (
          <button
            className="account"
            aria-label="Đăng xuất"
            title={user.email}
            onClick={() =>
              act(async () => {
                await request("/auth/logout", {});
                accessToken = "";
                setUser(null);
                cache.removeQueries({ queryKey: ["tickets"] });
                cache.removeQueries({ queryKey: ["orders"] });
                reset();
                setView("booking");
              })
            }
          >
            <LogOut size={17} />
            <span>Đăng xuất</span>
          </button>
        ) : (
          <Button variant="secondary" onClick={() => setLoginOpen(true)}>
            Đăng nhập
          </Button>
        )}
      </header>
      <main>
        <div className="page-heading">
          <div>
            <h1>
              {view === "tickets"
                ? "Vé của tôi"
                : view === "staff"
                  ? "Bàn làm việc"
                  : "Hôm nay, xem gì?"}
            </h1>
            <p>
              {view === "booking"
                ? "Chọn một bộ phim. Dành một chỗ cho trải nghiệm mới."
                : user?.email}
            </p>
          </div>
          <span className="demo-label">Bản demo · Không thu tiền thật</span>
        </div>
        {notice && (
          <div role="status" className="notice">
            {notice}
          </div>
        )}
        {view === "booking" && (
          <>
            <ol className="progress" aria-label="Tiến trình đặt vé">
              <li className={!show ? "current" : ""}>Phim & suất chiếu</li>
              <li className={show && !hold ? "current" : ""}>Chọn ghế</li>
              <li className={hold ? "current" : ""}>Thanh toán & vé</li>
            </ol>
            {!show ? (
              <>
                <section aria-labelledby="movies-title">
                  <div className="section-heading">
                    <h2 id="movies-title">Đang chiếu</h2>
                    <span>Phim và lịch chiếu giả lập</span>
                  </div>
                  {movies.isPending && <p>Đang tải phim…</p>}
                  {movies.error && (
                    <p role="alert">
                      Không tải được danh sách phim.{" "}
                      <button onClick={() => movies.refetch()}>Thử lại</button>
                    </p>
                  )}
                  <div className="movie-grid">
                    {movies.data?.map((m) => (
                      <button
                        key={m.id}
                        className={`movie ${movie?.id === m.id ? "chosen" : ""}`}
                        onClick={() => setMovie(m)}
                        aria-pressed={movie?.id === m.id}
                      >
                        <div className={`poster ${m.poster}`}>
                          <span>{m.rating}</span>
                          <div className="poster-art" aria-hidden="true" />
                          <strong>{m.title}</strong>
                          <small>Phim demo Starlight</small>
                        </div>
                        <div className="movie-caption">
                          <h3>{m.title}</h3>
                          <span>
                            <Clock3 size={14} />
                            {m.duration_minutes} phút · {m.rating}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
                <section className="showtimes" aria-labelledby="show-title">
                  <h2 id="show-title">
                    {movie
                      ? "Lịch chiếu · " + movie.title
                      : "Chọn phim để xem lịch chiếu"}
                  </h2>
                  {movie && (
                    <>
                      <p>{movie.description}</p>
                      {shows.error && (
                        <p role="alert">
                          Không tải được lịch chiếu.{" "}
                          <button onClick={() => shows.refetch()}>
                            Thử lại
                          </button>
                        </p>
                      )}
                      <div className="show-list">
                        {shows.data
                          ?.filter((s) => s.movie_id === movie.id)
                          .map((s) => (
                            <Button
                              key={s.id}
                              variant="secondary"
                              onClick={() => {
                                setShow(s);
                                reset();
                              }}
                            >
                              <span>{date(s.starts_at)}</span>
                              <small>
                                {s.room} · {money(s.price)}
                              </small>
                            </Button>
                          ))}
                      </div>
                      {shows.data &&
                        !shows.data.some((s) => s.movie_id === movie.id) && (
                          <p>Chưa có suất chiếu sắp tới.</p>
                        )}
                    </>
                  )}
                </section>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShow(null);
                    reset();
                  }}
                >
                  <ArrowLeft size={16} />
                  Chọn suất khác
                </Button>
                <div className="booking-grid">
                  <section className="seat-panel">
                    <div className="section-heading">
                      <div>
                        <h2>{movie?.title}</h2>
                        <p>
                          {show.cinema} · {show.room} · {date(show.starts_at)}
                        </p>
                      </div>
                      <Armchair />
                    </div>
                    <div className="screen">Màn hình</div>
                    <div className="seat-map">
                      {seats.data?.seats.map((s) => (
                        <button
                          key={s.id}
                          aria-label={`Ghế ${s.label}`}
                          aria-pressed={selected.includes(s.id)}
                          className={`seat ${selected.includes(s.id) ? "selected" : s.status.toLowerCase()}`}
                          disabled={
                            !!hold ||
                            (!selected.includes(s.id) &&
                              s.status !== "AVAILABLE")
                          }
                          onClick={() =>
                            setSelected((old) =>
                              old.includes(s.id)
                                ? old.filter((id) => id !== s.id)
                                : old.length < 8
                                  ? [...old, s.id]
                                  : old,
                            )
                          }
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                    {seats.isPending && <p>Đang tải sơ đồ ghế…</p>}
                    {seats.error && (
                      <p role="alert">
                        Không tải được ghế.{" "}
                        <button onClick={() => seats.refetch()}>Thử lại</button>
                      </p>
                    )}
                    <div className="legend">
                      <span>
                        <i />
                        Còn trống
                      </span>
                      <span>
                        <i className="selected" />
                        Đang chọn
                      </span>
                      <span>
                        <i className="sold" />
                        Đã giữ / bán
                      </span>
                    </div>
                    <p className="muted">
                      Tối đa 8 ghế mỗi lần đặt. Giữ ghế có hiệu lực 5 phút.
                    </p>
                  </section>
                  <aside className="summary">
                    <h2>Vé của bạn</h2>
                    <p>{movie?.title}</p>
                    <p>
                      Ghế{" "}
                      {seats.data?.seats
                        .filter((s) => selected.includes(s.id))
                        .map((s) => s.label)
                        .join(", ") || "chưa chọn"}
                    </p>
                    {!hold && (
                      <div className="combos">
                        <h3>Thêm combo</h3>
                        {products.data?.map((p) => (
                          <label key={p.id}>
                            {p.name}
                            <small>{money(p.price)}</small>
                            <select
                              aria-label={p.name}
                              value={quantities[p.id] || 0}
                              onChange={(e) =>
                                setQuantities({
                                  ...quantities,
                                  [p.id]: Number(e.target.value),
                                })
                              }
                            >
                              {[0, 1, 2, 3, 4].map((q) => (
                                <option key={q}>{q}</option>
                              ))}
                            </select>
                          </label>
                        ))}
                      </div>
                    )}
                    <div className="total">
                      <span>Tổng tiền</span>
                      <strong>{money(booking?.total ?? total)}</strong>
                    </div>
                    {!hold ? (
                      <Button
                        disabled={
                          !selected.length ||
                          busy ||
                          (!!user && user.role !== "CUSTOMER")
                        }
                        onClick={reserve}
                      >
                        {busy
                          ? "Đang giữ ghế…"
                          : user
                            ? "Giữ ghế & tiếp tục"
                            : "Đăng nhập để đặt vé"}
                      </Button>
                    ) : (
                      <>
                        <p className="countdown" role="timer">
                          {confirmed
                            ? "Đặt vé thành công"
                            : `Còn ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} để thanh toán`}
                        </p>
                        {confirmed ? (
                          <Button onClick={() => setView("tickets")}>
                            Xem vé QR
                          </Button>
                        ) : booking ? (
                          <div className="payment-actions">
                            <p>Thanh toán thử nghiệm</p>
                            <Button
                              disabled={busy || seconds === 0}
                              onClick={() => pay("success")}
                            >
                              {payment
                                ? "Xác nhận đối soát thành công"
                                : "Thanh toán thành công"}
                            </Button>
                            <Button
                              variant="secondary"
                              disabled={busy || seconds === 0 || !!payment}
                              onClick={() => pay("failed")}
                            >
                              Mô phỏng thất bại
                            </Button>
                            <Button
                              variant="ghost"
                              disabled={busy || seconds === 0 || !!payment}
                              onClick={() => pay("timeout")}
                            >
                              Mô phỏng timeout
                            </Button>
                          </div>
                        ) : (
                          <p>
                            Tạo đơn chưa hoàn tất. Ghế tự giải phóng khi hết
                            hạn.
                          </p>
                        )}
                        {!seconds && !confirmed && (
                          <p role="alert">
                            Giữ ghế đã hết hạn. Vui lòng chọn lại.
                          </p>
                        )}
                        <Button variant="ghost" onClick={reset}>
                          Chọn lại ghế
                        </Button>
                      </>
                    )}
                  </aside>
                </div>
              </>
            )}
          </>
        )}
        {view === "tickets" && (
          <section>
            <h2>Vé đã phát hành</h2>
            {tickets.isPending && <p>Đang tải vé…</p>}
            {tickets.error && (
              <p role="alert">
                Không tải được vé.{" "}
                <button onClick={() => tickets.refetch()}>Thử lại</button>
              </p>
            )}
            {tickets.data?.length === 0 && (
              <p>Bạn chưa có vé. Chọn phim và thanh toán thử để nhận vé QR.</p>
            )}
            <div className="ticket-list">
              {tickets.data?.map((t) => (
                <article className="ticket" key={t.id}>
                  <div>
                    <Ticket size={24} />
                    <h3>{t.movie_title}</h3>
                    <p>
                      {date(t.starts_at)} · {t.room}
                    </p>
                    <p>{t.cinema}</p>
                    <p className="seat-name">Ghế {t.seat_label}</p>
                    <p>{statusName[t.status] || t.status}</p>
                    <small>Mã vé {t.id.slice(0, 8)}</small>
                  </div>
                  <img
                    src={t.qrImage}
                    width="180"
                    height="180"
                    alt={`QR vé ghế ${t.seat_label}`}
                  />
                </article>
              ))}
            </div>
            <h2 className="orders-title">Lịch sử đặt vé</h2>
            {orders.data?.map((b) => (
              <div className="order-row" key={b.id}>
                <div>
                  <strong>Đơn {b.id.slice(0, 8)}</strong>
                  <p>
                    {statusName[b.status] || b.status}
                    {b.payments?.some((p) => p.reconciliationRequired)
                      ? " · Đã thu tiền, chờ duyệt hoàn"
                      : b.payments?.some((p) => p.status === "UNKNOWN")
                        ? " · Thanh toán chờ đối soát"
                        : ""}
                  </p>
                </div>
                <strong>{money(b.total)}</strong>
                {b.status === "PENDING_PAYMENT" &&
                  new Date(b.expires_at || "").getTime() > now && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const p = b.payments?.find(
                          (p) =>
                            p.status === "PENDING" || p.status === "UNKNOWN",
                        );
                        setBooking(b);
                        setPayment(p?.id || null);
                        setHold({
                          id: "",
                          expiresAt: b.expires_at!,
                          serverTime: new Date().toISOString(),
                        });
                        setNotice(
                          "Đã khôi phục đơn. Chọn kết quả thanh toán thử nghiệm bên dưới.",
                        );
                      }}
                    >
                      Tiếp tục thanh toán
                    </Button>
                  )}
              </div>
            ))}
            {booking && hold && currentOrder?.status === "PENDING_PAYMENT" && (
              <div className="resume-payment">
                <Button
                  disabled={busy || seconds === 0}
                  onClick={() => pay("success")}
                >
                  Thanh toán / đối soát đơn {booking.id.slice(0, 8)}
                </Button>
              </div>
            )}
          </section>
        )}
        {view === "staff" && user && <Staff user={user} />}
      </main>
      <footer>
        <span>Starlight Cinema</span>
        <p>Dữ liệu giả lập phục vụ học phần · Chính sách DEMO-1.0</p>
      </footer>
      {loginOpen && (
        <Login
          onClose={() => setLoginOpen(false)}
          onLogin={(u) => {
            setUser(u);
            setLoginOpen(false);
            cache.clear();
          }}
        />
      )}
    </>
  );
}
function Login({
  onLogin,
  onClose,
}: {
  onLogin: (u: User) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);
  const [register, setRegister] = useState(false);
  const form = useForm<{ email: string; password: string }>({
    resolver: zodResolver(credentialsSchema),
  });
  const mutation = useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      request<{ accessToken: string; user: User }>(
        register ? "/auth/register" : "/auth/login",
        data,
      ),
    onSuccess: (r) => {
      accessToken = r.accessToken;
      onLogin(r.user);
    },
  });
  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      className="login-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-title"
    >
      <div className="section-heading">
        <h2 id="login-title">{register ? "Tạo tài khoản" : "Đăng nhập"}</h2>
        <button aria-label="Đóng đăng nhập" onClick={onClose}>
          Đóng
        </button>
      </div>
      <p>Đặt vé và lưu QR trong tài khoản của bạn.</p>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
        <label>
          Email
          <input
            autoFocus
            autoComplete="email"
            type="email"
            {...form.register("email")}
          />
        </label>
        {form.formState.errors.email && (
          <p role="alert">Nhập địa chỉ email hợp lệ.</p>
        )}
        <label>
          Mật khẩu
          <input
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            {...form.register("password")}
          />
        </label>
        <small>Tối thiểu 12 ký tự.</small>
        {form.formState.errors.password && (
          <p role="alert">Mật khẩu cần từ 12 đến 128 ký tự.</p>
        )}
        {mutation.error && <p role="alert">{mutation.error.message}</p>}
        <Button disabled={mutation.isPending}>
          {mutation.isPending
            ? "Đang xử lý…"
            : register
              ? "Tạo tài khoản"
              : "Đăng nhập"}
        </Button>
      </form>
      <Button variant="ghost" onClick={() => setRegister(!register)}>
        {register ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký"}
      </Button>
    </dialog>
  );
}
function Staff({ user }: { user: User }) {
  const [token, setToken] = useState("");
  const [age, setAge] = useState(false);
  const [result, setResult] = useState("");
  const [inspected, setInspected] = useState(false);
  const mutation = useMutation({
    mutationFn: async (confirm: boolean) =>
      request<{
        movie_title?: string;
        seat_label?: string;
        rating?: string;
        status?: string;
      }>(
        confirm ? "/check-in/confirm" : "/check-in/inspect",
        confirm ? { token, ageVerified: age } : { token },
        confirm ? crypto.randomUUID() : undefined,
      ),
    onSuccess: (r, confirm) => {
      setResult(
        confirm
          ? "Đã xác nhận vào phòng."
          : `${r.movie_title} · Ghế ${r.seat_label} · Phân loại ${r.rating}`,
      );
      setInspected(!confirm);
    },
    onError: (e) => {
      setResult(e.message);
      setInspected(false);
    },
  });
  const cases = useQuery({
    queryKey: ["reconciliation"],
    queryFn: () =>
      request<{ id: string; amount: number; reason: string; status: string }[]>(
        "/admin/reconciliation",
      ),
    enabled: user.role === "MANAGER",
  });
  return (
    <section className="staff-panel">
      <h2>
        {user.role === "GATE"
          ? "Kiểm tra vé"
          : user.role === "MANAGER"
            ? "Khoản thu cần đối soát"
            : "Nhân viên quầy"}
      </h2>
      {user.role === "GATE" ? (
        <>
          <label>
            Mã QR
            <input
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                setInspected(false);
                setAge(false);
              }}
              placeholder="Nhập token từ QR của khách"
            />
          </label>
          <Button
            disabled={mutation.isPending || !token}
            onClick={() => mutation.mutate(false)}
          >
            Kiểm tra vé
          </Button>
          {inspected && (
            <>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={age}
                  onChange={(e) => setAge(e.target.checked)}
                />
                Đã xác minh điều kiện độ tuổi
              </label>
              <Button
                disabled={!age || mutation.isPending}
                onClick={() => mutation.mutate(true)}
              >
                Xác nhận vào phòng
              </Button>
            </>
          )}
          <p role="status">{result}</p>
        </>
      ) : user.role === "MANAGER" ? (
        <>
          {cases.error && <p role="alert">{cases.error.message}</p>}
          {cases.data?.length === 0 && <p>Chưa có khoản thu cần đối soát.</p>}
          {cases.data?.map((c) => (
            <div className="order-row" key={c.id}>
              <p>{c.reason}</p>
              <strong>{money(c.amount)}</strong>
              <span>Chờ duyệt hoàn</span>
            </div>
          ))}
          <p>
            Luồng duyệt và thực thi hoàn tiền sẽ được triển khai ở lát cắt
            đổi/hoàn.
          </p>
        </>
      ) : (
        <p>
          Tài khoản quầy đã được phân quyền. Luồng tạo yêu cầu thay khách thuộc
          lát cắt đổi/hoàn tiếp theo.
        </p>
      )}
    </section>
  );
}
