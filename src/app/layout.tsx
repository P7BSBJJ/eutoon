import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eu Tô On! – sua pelada organizada",
  description: "Lista, Pix, times e estatísticas da sua pelada num link só.",
  icons: { icon: "/icon.svg", apple: "/icon-180.png" },
};

export const viewport: Viewport = { themeColor: "#0b1530" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full">
        <header className="sticky top-0 z-10 border-b border-white/5 bg-noite/90 backdrop-blur">
          <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-2">
            <Link href="/" aria-label="Início">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="Eu Tô On!" className="h-11 w-auto" />
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-xl px-4 pb-16 pt-4">{children}</main>
      </body>
    </html>
  );
}
