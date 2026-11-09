import type { Metadata } from "next";
import "./globals.css";
import Analytics from "@/components/Analytics";
import { Header, BottomNav, Footer } from "@/components/Nav";

export const metadata: Metadata = {
  title: { default: "ComicVerse - Read manga, manhwa, manhua and webtoons", template: "%s | ComicVerse" },
  description: "Discover and read original and licensed comics and novels.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-8 md:py-10">{children}</main>
        <Footer />
        <BottomNav />
        <Analytics />
      </body>
    </html>
  );
}
