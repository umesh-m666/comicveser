import type { Metadata, Viewport } from "next";
import "./globals.css";
import Analytics from "@/components/Analytics";
import { Header, Footer } from "@/components/Nav";
import BottomNav from "@/components/BottomNav";
import ChromeGate from "@/components/ChromeGate";
import AuthProvider from "@/components/AuthProvider";
import LibraryProvider from "@/components/LibraryProvider";

export const metadata: Metadata = {
  title: { default: "ComicVerse - Read manga, manhwa, manhua and webtoons", template: "%s | ComicVerse" },
  description: "Discover and read manga, manhwa, manhua, and webtoons on ComicVerse.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: ["/favicon.ico"],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};
export const viewport: Viewport = { themeColor: "#2F2250", viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="site font-sans antialiased">
        <AuthProvider>
          <LibraryProvider>
            <ChromeGate header={<Header />} footer={<Footer />} bottomNav={<BottomNav />}>
              {children}
            </ChromeGate>
          </LibraryProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
