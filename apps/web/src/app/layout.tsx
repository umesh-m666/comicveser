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
};
export const viewport: Viewport = { themeColor: "#100e16", viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <AuthProvider>
          <LibraryProvider>
            <ChromeGate header={<Header />} footer={<Footer />} bottomNav={<BottomNav />}>{children}</ChromeGate>
          </LibraryProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
