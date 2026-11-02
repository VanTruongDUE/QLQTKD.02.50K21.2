"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

type Dashboard = {
  filters: { dateFrom: string; dateTo: string; cinemaId: string | null };
  cinemas: Array<{ id: string; name: string }>;
  metrics: { confirmedOrders: number; issuedTickets: number; eligibleTickets: number; checkedInTickets: number; received: number; refunded: number; net: number; reconciliationCases: number };
  daily: Array<{ day: string; received: number; refunded: number; tickets: number }>;
  movies: Array<{ movieId: string; title: string; tickets: number; checkedInTickets: number }>;
  occupancy: Array<{ showtimeId: string; title: string; room: string; startsAt: string; totalSeats: number; soldSeats: number; occupancyPercent: number }>;
  pendingRefunds: Array<{ id: string; kind: string; status: string; createdAt: string; bookingId: string; customer: string; title: string }>;
};

const money = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;
const dayLabel = (value: string) => new Date(`${value}T00:00:00+07:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });

export function ManagerDashboard({ request }: { request: <T>(path: string, init?: RequestInit) => Promise<T> }) {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(today);
  const [cinemaId, setCinemaId] = useState("");
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ dateFrom, dateTo });
      if (cinemaId) query.set("cinemaId", cinemaId);
      setData(await request<Dashboard>(`/admin/dashboard?${query.toString()}`));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được dashboard."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [dateFrom, dateTo, cinemaId]);
  const maxDaily = useMemo(() => Math.max(1, ...(data?.daily || []).map((item) => Number(item.received))), [data]);
  return <section className="manager-dashboard" data-ui>
    <header className="manager-dashboard-header">
      <div><p className="manager-kicker">Starlight Cinema · Quản lý vận hành</p><h1>Dashboard kinh doanh</h1><p className="manager-muted">Số liệu lấy trực tiếp từ đơn, vé, thanh toán và hoàn tiền trong phạm vi được phân công.</p></div>
      <button type="button" className="manager-refresh" onClick={() => void load()} disabled={loading}><RefreshCw size={15} /> Cập nhật</button>
    </header>
    <div className="manager-filters">
      <label>Từ ngày<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
      <label>Đến ngày<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
      <label>Rạp<select value={cinemaId} onChange={(event) => setCinemaId(event.target.value)}><option value="">Tất cả rạp được phân công</option>{data?.cinemas.map((cinema) => <option key={cinema.id} value={cinema.id}>{cinema.name}</option>)}</select></label>
    </div>
    {error && <div className="manager-error" role="alert">{error} <button type="button" onClick={() => void load()}>Thử lại</button></div>}
    {loading && <div className="manager-loading">Đang tải số liệu dashboard…</div>}
    {!loading && data && <>
      <div className="manager-kpis">
        <div><span>Đơn đã xác nhận</span><strong>{data.metrics.confirmedOrders}</strong><small>trong khoảng lọc</small></div>
        <div><span>Vé đã phát hành</span><strong>{data.metrics.issuedTickets}</strong><small>{data.metrics.checkedInTickets} đã check-in</small></div>
        <div><span>Đã thu thành công</span><strong>{money(data.metrics.received)}</strong><small>payment SUCCEEDED</small></div>
        <div><span>Tiền thu ròng</span><strong>{money(data.metrics.net)}</strong><small>đã thu − đã hoàn</small></div>
        <div><span>Yêu cầu đối soát</span><strong>{data.metrics.reconciliationCases}</strong><small>cần quản lý xử lý</small></div>
      </div>
      <div className="manager-dashboard-grid">
        <section className="manager-panel manager-chart-panel"><div className="manager-panel-title"><div><h2>Tiền thu theo ngày</h2><p>Chỉ tính payment đã xác nhận và hoàn đã thành công.</p></div><span>{money(data.metrics.refunded)} đã hoàn</span></div>{data.daily.length === 0 ? <div className="manager-empty">Chưa có dữ liệu trong khoảng ngày này.</div> : <div className="manager-bars">{data.daily.map((item) => <div className="manager-bar-row" key={item.day}><span>{dayLabel(item.day)}</span><div><i style={{ width: `${Math.max(2, Number(item.received) / maxDaily * 100)}%` }} /><small>{money(Number(item.received))} · {item.tickets} vé</small></div></div>)}</div>}</section>
        <section className="manager-panel"><div className="manager-panel-title"><div><h2>Phim có nhiều vé nhất</h2><p>Trong phạm vi bộ lọc hiện tại.</p></div></div>{data.movies.length === 0 ? <div className="manager-empty">Chưa có vé phát hành.</div> : <div className="manager-table">{data.movies.slice(0, 6).map((movie) => <div className="manager-row" key={movie.movieId}><span>{movie.title}</span><strong>{movie.tickets} vé</strong><small>{movie.checkedInTickets} check-in</small></div>)}</div>}</section>
      </div>
      <section className="manager-panel manager-queue"><div className="manager-panel-title"><div><h2>Lấp đầy theo suất chiếu</h2><p>Tỷ lệ ghế đã bán trên tổng số ghế của suất.</p></div></div>{data.occupancy.length === 0 ? <div className="manager-empty">Chưa có suất chiếu trong khoảng lọc.</div> : <div className="manager-table">{data.occupancy.slice(0, 10).map((item) => <div className="manager-row" key={item.showtimeId}><span><b>{item.title}</b><small>{item.room} · {new Date(item.startsAt).toLocaleString("vi-VN")}</small></span><strong>{item.occupancyPercent}%</strong><small>{item.soldSeats}/{item.totalSeats} ghế</small></div>)}</div>}</section>
      <section className="manager-panel manager-queue"><div className="manager-panel-title"><div><h2>Yêu cầu đổi / hoàn đang chờ</h2><p>Không tự động chuyển trạng thái thành hoàn tiền.</p></div><strong>{data.pendingRefunds.length}</strong></div>{data.pendingRefunds.length === 0 ? <div className="manager-empty">Không có yêu cầu chờ trong khoảng lọc.</div> : <div className="manager-table">{data.pendingRefunds.map((item) => <div className="manager-row" key={item.id}><span><b>{item.kind === "REFUND" ? "Hoàn vé" : "Đổi vé"}</b> · {item.title}<small>{item.customer} · Đơn {item.bookingId.slice(0, 8)}</small></span><strong>{item.status}</strong><small>{new Date(item.createdAt).toLocaleString("vi-VN")}</small></div>)}</div>}</section>
    </>}
  </section>;
}
