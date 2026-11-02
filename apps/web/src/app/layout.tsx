import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Starlight Cinema — Hệ thống Rạp chiếu phim & Giải trí đỉnh cao",
  description:
    "Trải nghiệm đặt vé xem phim trực tuyến, đổi trả vé tự động và check-in không chạm thông minh tại Hệ thống rạp Starlight Cinema.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>✨</text></svg>",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#0B0C10] text-[#F8FAFC] min-h-screen selection:bg-[#EC4899] selection:text-white antialiased">
        {children}
      </body>
    </html>
  );
}
