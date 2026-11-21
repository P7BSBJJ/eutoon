import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { PendingBar } from "@/components/pending-bar";
import { currentUser } from "@/lib/auth";
import { unreadCount } from "@/lib/pelada";
import { Bell } from "@/components/icons";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow/700.css";
import "@fontsource/barlow-condensed/700-italic.css";
import "@fontsource/barlow-condensed/800-italic.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eu Tô On! – sua pelada organizada",
  description: "Lista, Pix, times e estatísticas da sua pelada num link só.",
  icons: { icon: [{ url: "/icon-32.png", sizes: "32x32" }, { url: "/icon.svg" }], apple: "/icon-180.png" },
};

export const viewport: Viewport = { themeColor: "#0b1530" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await currentUser().catch(() => null);
  const unread = user ? await unreadCount(user.id).catch(() => 0) : 0;
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full">
        <PendingBar />
        <header className="sticky top-0 z-10 border-b border-white/5 bg-noite/90 backdrop-blur">
          <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-2">
            <Link href="/" aria-label="Início">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="Eu Tô On!" className="h-10 w-auto" />
            </Link>
            {user && (
              <Link href="/notificacoes" className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-white/10" aria-label={`Notificações${unread ? ` (${unread} novas)` : ""}`}>
                <Bell size={22} />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-lima px-1 text-[11px] font-bold text-noite">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-xl px-4 pb-16 pt-4">{children}</main>
      </body>
    </html>
  );
}
