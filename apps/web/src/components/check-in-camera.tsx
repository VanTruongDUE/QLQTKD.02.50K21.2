"use client";
import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { Camera } from "lucide-react";
import { Button } from "./ui/button";

export function CheckInCamera({
  onDecoded,
  onStart,
  disabled,
}: {
  onDecoded: (token: string) => void;
  onStart: () => void;
  disabled: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const controls = useRef<IScannerControls | null>(null);
  const generation = useRef(0);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");

  function release() {
    generation.current++;
    controls.current?.stop();
    controls.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }
  useEffect(() => () => release(), []);
  function stop() {
    release();
    setActive(false);
  }

  async function start() {
    release();
    onStart();
    setError("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("Camera cần HTTPS hoặc localhost. Bạn vẫn có thể nhập mã vé.");
      return;
    }
    const attempt = generation.current;
    setActive(true);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      if (attempt !== generation.current) return;
      const media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: { ideal: "environment" } },
      });
      if (attempt !== generation.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      setDevices(
        (await navigator.mediaDevices.enumerateDevices()).filter(
          (d) => d.kind === "videoinput",
        ),
      );
      if (attempt !== generation.current || !video.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      const reader = new BrowserQRCodeReader();
      const scanner = await reader.decodeFromStream(
        media,
        video.current,
        (result, _error, scannerControls) => {
          if (!result || attempt !== generation.current) return;
          scannerControls.stop();
          stop();
          onDecoded(result.getText());
        },
      );
      if (attempt !== generation.current) scanner.stop();
      else controls.current = scanner;
    } catch (cause) {
      if (attempt !== generation.current) return;
      stop();
      const name = (cause as Error).name;
      setError(
        name === "NotAllowedError"
          ? "Quyền camera bị từ chối. Hãy cấp quyền trong trình duyệt hoặc nhập mã vé."
          : name === "NotFoundError"
            ? "Không tìm thấy camera. Hãy kết nối camera hoặc nhập mã vé."
            : "Không mở được camera. Camera có thể đang được ứng dụng khác sử dụng; bạn có thể thử lại hoặc nhập mã vé.",
      );
    }
  }
  return (
    <div className="gate-camera">
      <video
        ref={video}
        autoPlay
        muted
        playsInline
        aria-label="Hình ảnh camera quét QR"
        hidden={!active}
      />
      {!active && (
        <p>
          Đưa QR trên vé vào trước camera. Hệ thống chỉ kiểm tra vé, chưa xác
          nhận vào phòng.
        </p>
      )}
      {devices.length > 1 && (
        <label>
          Camera
          <select
            value={deviceId}
            disabled={active}
            onChange={(e) => setDeviceId(e.target.value)}
          >
            <option value="">Tự chọn camera sau</option>
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        </label>
      )}
      {active ? (
        <Button variant="secondary" onClick={stop}>
          Dừng camera
        </Button>
      ) : (
        <Button variant="secondary" disabled={disabled} onClick={start}>
          <Camera size={18} />
          Bật camera quét QR
        </Button>
      )}
      {active && <p role="status">Đang chờ QR…</p>}
      {error && (
        <p role="alert" className="gate-error">
          {error}
        </p>
      )}
    </div>
  );
}
