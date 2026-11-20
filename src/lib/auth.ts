import "server-only";
import { cookies } from "next/headers";
import { randomBytes, randomInt } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";

const COOKIE = "eutoon_session";
const SESSION_DAYS = 60;

export function normalizePhone(raw: string) {
  let d = raw.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return d;
}

export function isValidPhone(p: string) {
  return /^55\d{10,11}$/.test(p);
}

/** Envio do código. Sem provedor configurado, o código aparece na tela (modo teste). */
async function deliverOtp(phone: string, code: string): Promise<{ shownOnScreen: boolean }> {
  // TODO produção: enviar via WhatsApp Cloud API / SMS (Twilio, Zenvia) usando OTP_PROVIDER
  if (process.env.OTP_PROVIDER) {
    throw new Error("Provedor de OTP ainda não implementado");
  }
  // Mostrar o código na tela permite entrar com o celular de outra pessoa:
  // só em desenvolvimento ou num piloto fechado com ALLOW_SCREEN_OTP=1.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SCREEN_OTP !== "1") {
    throw new Error("Configure um provedor de OTP (WhatsApp/SMS) antes de ir para produção");
  }
  void phone;
  void code;
  return { shownOnScreen: true };
}

export async function requestOtp(rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  if (!isValidPhone(phone)) return { ok: false as const, error: "Celular inválido. Use DDD + número." };
  const db = await getDb();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + 10 * 60_000);
  await db
    .insert(schema.otpCodes)
    .values({ phone, code, expiresAt, attempts: 0 })
    .onConflictDoUpdate({ target: schema.otpCodes.phone, set: { code, expiresAt, attempts: 0 } });
  const { shownOnScreen } = await deliverOtp(phone, code);
  const existing = await db.query.users.findFirst({ where: eq(schema.users.phone, phone) });
  return { ok: true as const, phone, devCode: shownOnScreen ? code : undefined, isNew: !existing };
}

export async function verifyOtp(phone: string, code: string, name?: string) {
  const db = await getDb();
  const row = await db.query.otpCodes.findFirst({
    where: and(eq(schema.otpCodes.phone, phone), gt(schema.otpCodes.expiresAt, new Date())),
  });
  if (!row || row.attempts >= 5) return { ok: false as const, error: "Código expirado. Peça outro." };
  if (row.code !== code.trim()) {
    await db
      .update(schema.otpCodes)
      .set({ attempts: row.attempts + 1 })
      .where(eq(schema.otpCodes.phone, phone));
    return { ok: false as const, error: "Código incorreto." };
  }
  await db.delete(schema.otpCodes).where(eq(schema.otpCodes.phone, phone));

  let user = await db.query.users.findFirst({ where: eq(schema.users.phone, phone) });
  if (!user) {
    const clean = (name ?? "").trim().replace(/\s+/g, " ");
    if (clean.length < 2) return { ok: false as const, error: "Informe seu nome." };
    [user] = await db.insert(schema.users).values({ phone, name: clean }).returning();
  }
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.insert(schema.sessions).values({ token, userId: user.id, expiresAt });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return { ok: true as const, user };
}

export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const s = await db.query.sessions.findFirst({
    where: and(eq(schema.sessions.token, token), gt(schema.sessions.expiresAt, new Date())),
  });
  if (!s) return null;
  return (await db.query.users.findFirst({ where: eq(schema.users.id, s.userId) })) ?? null;
}

export async function requireUser(next = "/") {
  const u = await currentUser();
  if (!u) redirect(`/entrar?next=${encodeURIComponent(next)}`);
  return u;
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(schema.sessions).where(eq(schema.sessions.token, token));
  }
  jar.delete(COOKIE);
}
