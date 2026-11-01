import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Starlight Cinema — Đặt vé",
  description: "Ứng dụng đặt vé rạp phim thử nghiệm Starlight Cinema.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
