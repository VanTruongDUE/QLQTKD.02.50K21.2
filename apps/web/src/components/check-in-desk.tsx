"use client";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import type {
  CheckInInput,
  CheckInTicket,
  GateShowtime,
  CheckInReceipt,
  CheckInHistory,
} from "@starlight/contracts";
import { CheckInCamera } from "./check-in-camera";
import { Button } from "./ui/button";

type Request = <T>(path: string, body?: unknown, key?: string) => Promise<T>;
const time = (value: string) =>
  new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
export function CheckInDesk({
  request,
  userId,
}: {
  request: Request;
  userId: string;
}) {
  const [showtimeId, setShowtimeId] = useState("");
  const shows = useQuery({
    queryKey: ["gate-shows", userId],
    queryFn: () => request<GateShowtime[]>("/check-in/showtimes"),
    refetchInterval: 30000,
  });
  const show = shows.data?.find((s) => s.id === showtimeId);
  return (
    <section className="gate-desk" aria-label="Soát vé">
      <div className="staff-panel gate-show-picker">
        <h2>Suất chiếu đang soát vé</h2>
        <label>
          Chọn suất chiếu
          <select
            value={showtimeId}
            onChange={(e) => setShowtimeId(e.target.value)}
          >
            <option value="">Chọn phim, phòng và giờ chiếu</option>
            {shows.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {time(s.starts_at)} · {s.title} · {s.room} · {s.cinema}
                {s.status !== "SCHEDULED" ? " · Đã hủy/thay đổi" : ""}
              </option>
            ))}
          </select>
        </label>
        {shows.isPending && <p>Đang tải suất chiếu…</p>}
        {shows.error && (
          <p role="alert">
            {shows.error.message}{" "}
            <button onClick={() => shows.refetch()}>Thử lại</button>
          </p>
        )}
        {shows.data?.length === 0 && (
          <p>Không có suất chiếu trong rạp được phân công.</p>
        )}
        {show && (
          <p>
            <strong>
              {show.title} · {show.room} · {show.cinema}
            </strong>
            <br />
            Nhận khách từ {time(show.checkInOpensAt)} đến{" "}
            {time(show.checkInClosesAt)}.
          </p>
        )}
      </div>
      {show ? (
        <GateSession
          key={show.id}
          show={show}
          request={request}
          userId={userId}
        />
      ) : (
        <p className="gate-instruction">
          Chọn suất chiếu trước khi quét QR hoặc nhập mã vé.
        </p>
      )}
    </section>
  );
}
function GateSession({
  show,
  request,
  userId,
}: {
  show: GateShowtime;
  request: Request;
  userId: string;
}) {
  const cache = useQueryClient();
  const [manual, setManual] = useState("");
  const [inspected, setInspected] = useState<{
    ticket: CheckInTicket;
    input: CheckInInput;
    key: string;
  } | null>(null);
  const [ageVerified, setAgeVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<CheckInReceipt | null>(null);
  const serial = useRef(0);
  const inFlight = useRef(false);
  const history = useQuery({
    queryKey: ["gate-history", userId, show.id],
    queryFn: () =>
      request<CheckInHistory[]>(`/check-in/history?showtimeId=${show.id}`),
    refetchInterval: 5000,
  });
  async function inspect(
    identifier: { token: string } | { ticketCode: string },
  ) {
    if (inFlight.current) return;
    const attempt = ++serial.current;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setReceipt(null);
    setInspected(null);
    setAgeVerified(false);
    const input = { showtimeId: show.id, ...identifier };
    try {
      const ticket = await request<CheckInTicket>("/check-in/inspect", input);
      if (attempt === serial.current)
        setInspected({ ticket, input, key: crypto.randomUUID() });
    } catch (cause) {
      if (attempt === serial.current) setError((cause as Error).message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function confirm() {
    if (!inspected || !ageVerified || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await request<CheckInReceipt>(
        "/check-in/confirm",
        { ...inspected.input, ageVerified: true },
        inspected.key,
      );
      setReceipt(result);
      setInspected(null);
      setManual("");
      setAgeVerified(false);
      await cache.invalidateQueries({
        queryKey: ["gate-history", userId, show.id],
      });
    } catch (cause) {
      setError((cause as Error).message);
      if ("status" in (cause as object)) {
        setInspected(null);
        setAgeVerified(false);
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <div className="gate-grid">
        <section className="staff-panel">
          <h2>Quét hoặc nhập vé</h2>
          <CheckInCamera
            disabled={busy}
            onStart={() => {
              setInspected(null);
              setReceipt(null);
              setError("");
              setAgeVerified(false);
            }}
            onDecoded={(token) => {
              setManual("");
              void inspect({ token });
            }}
          />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const result = z.uuid().safeParse(manual.trim());
              if (!result.success) {
                setError("Nhập đầy đủ mã vé gồm 36 ký tự được in dưới QR.");
                setInspected(null);
                return;
              }
              void inspect({ ticketCode: result.data });
            }}
          >
            <label>
              Mã vé
              <input
                value={manual}
                disabled={busy}
                autoComplete="off"
                spellCheck={false}
                placeholder="Mã vé đầy đủ bên dưới QR"
                onChange={(e) => {
                  setManual(e.target.value);
                  setInspected(null);
                  setReceipt(null);
                  setAgeVerified(false);
                  setError("");
                }}
              />
            </label>
            <Button disabled={busy || !manual.trim()}>
              {busy ? "Đang kiểm tra…" : "Kiểm tra mã vé"}
            </Button>
          </form>
        </section>
        <section
          className="staff-panel gate-result"
          aria-label="Kết quả kiểm tra"
        >
          <h2>Kết quả kiểm tra</h2>
          {error && (
            <p role="alert" className="gate-error">
              {error}
            </p>
          )}
          {receipt && (
            <div role="status" className="gate-success">
              <h3>Đã xác nhận vào phòng</h3>
              <p>{time(receipt.checkedInAt)}</p>
              <p className="ticket-code">Mã vé: {receipt.id}</p>
            </div>
          )}
          {inspected && (
            <>
              <p className="gate-valid">Vé đủ điều kiện kiểm tra</p>
              <h3>{inspected.ticket.movie_title}</h3>
              <p>
                {inspected.ticket.cinema} · {inspected.ticket.room}
              </p>
              <p>{time(inspected.ticket.starts_at)}</p>
              <p className="gate-seat">Ghế {inspected.ticket.seat_label}</p>
              <p>Phân loại phim: {inspected.ticket.rating}</p>
              <p className="ticket-code">Mã vé: {inspected.ticket.id}</p>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={ageVerified}
                  disabled={busy}
                  onChange={(e) => setAgeVerified(e.target.checked)}
                />
                Đã xác minh điều kiện độ tuổi
              </label>
              <Button disabled={!ageVerified || busy} onClick={confirm}>
                Xác nhận vào phòng
              </Button>
            </>
          )}
          {!inspected && !receipt && !error && (
            <p>
              Thông tin vé sẽ xuất hiện sau khi kiểm tra. Chỉ bấm xác nhận khi
              khách sẵn sàng vào phòng.
            </p>
          )}
        </section>
      </div>
      <section className="staff-panel gate-history">
        <div className="section-heading">
          <h2>Lượt vào phòng gần đây</h2>
          <Button variant="ghost" onClick={() => history.refetch()}>
            Làm mới
          </Button>
        </div>
        {history.isPending && <p>Đang tải lịch sử…</p>}
        {history.error && <p role="alert">{history.error.message}</p>}
        {history.data?.length === 0 && (
          <p>Chưa có lượt check-in cho suất này.</p>
        )}
        {history.data?.map((row) => (
          <div className="order-row" key={row.id}>
            <div>
              <strong>Ghế {row.seat_label}</strong>
              <p>{time(row.checkedInAt)}</p>
            </div>
            <div>
              <p>{row.staffEmail}</p>
              <small className="ticket-code">{row.id}</small>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
