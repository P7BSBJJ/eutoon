import "server-only";
import { headers } from "next/headers";

export async function baseUrl() {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export const brl = (cents: number) => "R$ " + (cents / 100).toFixed(2).replace(".", ",");

export function fmtDate(d: Date, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) {
  return d.toLocaleString("pt-BR", { ...opts, timeZone: "America/Sao_Paulo" });
}
export const nowMs = () => Date.now();
