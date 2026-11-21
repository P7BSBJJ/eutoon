"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseMoney } from "@/lib/domain/money";
import { currentUser, logout, requestOtp, verifyOtp } from "@/lib/auth";
import * as P from "@/lib/pelada";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const cents = parseMoney;

async function me() {
  const u = await currentUser();
  if (!u) redirect("/entrar");
  return u;
}

/** executa e volta pra página, mostrando o erro amigável se houver */
async function run(back: string, fn: () => Promise<unknown>, okMsg?: string | (() => string)) {
  let target = back;
  try {
    await fn();
    const m = typeof okMsg === "function" ? okMsg() : okMsg;
    if (m) target = withParam(back, "ok", m);
  } catch (e) {
    if (e instanceof P.AppError) target = withParam(back, "erro", e.message);
    else throw e;
  }
  revalidatePath(back.split(/[?#]/)[0]);
  redirect(target);
}
function withParam(url: string, k: string, v: string) {
  const [path, hash] = url.split("#");
  const q = `${path}${path.includes("?") ? "&" : "?"}${k}=${encodeURIComponent(v)}`;
  return hash ? `${q}#${hash}` : q;
}

// ---------- login ----------
export type LoginState = { step: "phone" | "code"; phone?: string; isNew?: boolean; devCode?: string; error?: string };

export async function loginAction(prev: LoginState, f: FormData): Promise<LoginState> {
  const next = str(f, "next") || "/";
  if (prev.step === "phone" || str(f, "restart")) {
    if (str(f, "restart")) return { step: "phone" };
    let r: Awaited<ReturnType<typeof requestOtp>>;
    try {
      r = await requestOtp(str(f, "phone"));
    } catch (e) {
      console.error("login: falha ao pedir código", e);
      return { step: "phone", error: "O login ainda não está configurado no servidor. Avise o administrador do app." };
    }
    if (!r.ok) return { step: "phone", error: r.error };
    return { step: "code", phone: r.phone, isNew: r.isNew, devCode: r.devCode };
  }
  const r = await verifyOtp(prev.phone!, str(f, "code"), str(f, "name"));
  if (!r.ok) return { ...prev, error: r.error };
  redirect(next.startsWith("/") ? next : "/");
}

export async function logoutAction() {
  await logout();
  redirect("/");
}

// ---------- grupo ----------
const groupSchema = z.object({
  name: z.string().min(2, "Nome do grupo muito curto"),
  location: z.string(),
  priceCents: z.number().int().min(0),
  slots: z.number().int().min(2).max(60),
  gkSlots: z.number().int().min(0).max(6),
  perTeam: z.number().int().min(2).max(11),
  deadlineHours: z.number().int().min(0).max(168),
  pixKey: z.string(),
  pixName: z.string(),
  pixCity: z.string(),
});

function readGroup(f: FormData) {
  return groupSchema.safeParse({
    name: str(f, "name"),
    location: str(f, "location"),
    priceCents: cents(str(f, "price")),
    slots: Number(str(f, "slots")),
    gkSlots: Number(str(f, "gkSlots")),
    perTeam: Number(str(f, "perTeam")),
    deadlineHours: Number(str(f, "deadlineHours")),
    pixKey: str(f, "pixKey"),
    pixName: str(f, "pixName"),
    pixCity: str(f, "pixCity"),
  });
}

export async function createGroupAction(f: FormData) {
  const u = await me();
  const p = readGroup(f);
  if (!p.success) redirect(withParam("/g/nova", "erro", p.error.issues[0].message));
  const g = await P.createGroup(u, p.data);
  redirect(`/g/${g.slug}?ok=${encodeURIComponent("Grupo criado! Agora crie o primeiro jogo.")}`);
}

export async function updateGroupAction(f: FormData) {
  const u = await me();
  const slug = str(f, "slug");
  const back = `/g/${slug}/config`;
  await run(back, async () => {
    const p = readGroup(f);
    if (!p.success) throw new P.AppError(p.error.issues[0].message);
    const g = await P.getGroupBySlug(slug);
    await P.updateGroup(g!.id, u, p.data);
  }, "Configurações salvas");
}

export async function joinGroupAction(f: FormData) {
  const u = await me();
  const g = await P.getGroupBySlug(str(f, "slug"));
  if (g) await P.joinGroup(g.id, u.id);
  redirect(`/g/${str(f, "slug")}`);
}

export async function updateMemberAction(f: FormData) {
  if (str(f, "remover")) return removeMemberAction(f);
  const u = await me();
  const slug = str(f, "slug");
  await run(`/g/${slug}/config`, async () => {
    const g = await P.getGroupBySlug(slug);
    await P.updateMember(g!.id, u, str(f, "userId"), {
      kind: str(f, "kind") as "mensalista" | "diarista",
      position: str(f, "position") as "linha" | "goleiro",
      rating: Number(str(f, "rating")),
      role: str(f, "role") as "admin" | "membro",
    });
  }, "Jogador atualizado");
}

// ---------- jogo ----------
export async function createGameAction(f: FormData) {
  const u = await me();
  const slug = str(f, "slug");
  const g = await P.getGroupBySlug(slug);
  if (!g) redirect("/");
  // datetime-local vem sem fuso: tratamos como horário de Brasília
  const startsAt = new Date(`${str(f, "startsAt")}:00-03:00`);
  let id = "";
  await runNoRedirect(`/g/${slug}`, async () => {
    if (isNaN(startsAt.getTime())) throw new P.AppError("Data inválida");
    const game = await P.createGame(g.id, u, {
      title: str(f, "title") || g.name,
      startsAt,
      location: str(f, "location") || g.location,
      priceCents: cents(str(f, "price")),
      slots: Number(str(f, "slots")) || g.slots,
      gkSlots: Number(str(f, "gkSlots")) || 0,
      perTeam: g.perTeam,
      deadlineHours: Number(str(f, "deadlineHours")) || 0,
    });
    id = game.id;
  });
  redirect(`/g/${slug}/jogo/${id}?ok=${encodeURIComponent("Jogo criado! Copie a lista e mande no grupo.")}`);
}

const gamePath = (f: FormData) => `/g/${str(f, "slug")}/jogo/${str(f, "gameId")}`;

export async function joinGameAction(f: FormData) {
  const u = await me();
  await run(gamePath(f), () => P.joinGame(str(f, "gameId"), u, (str(f, "position") || undefined) as "linha" | "goleiro" | undefined), "Você tá on!");
}

export async function addGuestAction(f: FormData) {
  const u = await me();
  await run(gamePath(f), () => P.addGuest(str(f, "gameId"), u, str(f, "guestName"), str(f, "position") as "linha" | "goleiro"), "Convidado adicionado");
}

export async function leaveGameAction(f: FormData) {
  const u = await me();
  const msgs: Record<string, string> = {
    no_prazo: "Você saiu dentro do prazo. Se tinha pago, virou crédito.",
    repasse: "Vaga repassada pra lista de espera. Você recebe crédito quando o substituto pagar.",
    perdeu: "Você saiu fora do prazo e ninguém assumiu a vaga.",
    espera: "Você saiu da lista de espera.",
  };
  let outcome = "";
  await run(gamePath(f), async () => {
    outcome = (await P.leaveGame(str(f, "entryId"), u)).outcome;
  }, () => msgs[outcome]);
}

export async function payEntryAction(f: FormData) {
  const u = await me();
  let res: Awaited<ReturnType<typeof P.payEntry>> | null = null;
  await runNoRedirect(gamePath(f), async () => {
    res = await P.payEntry(str(f, "entryId"), u);
  });
  const r = res as Awaited<ReturnType<typeof P.payEntry>> | null;
  if (r?.kind === "pix") redirect(`/pagar/${r.paymentId}`);
  redirect(withParam(gamePath(f), "ok", r?.kind === "credito" ? "Pago com seu crédito." : "Já está pago."));
}

/** como run(), mas só redireciona em caso de erro */
async function runNoRedirect(back: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    if (e instanceof P.AppError) redirect(withParam(back, "erro", e.message));
    throw e;
  }
  revalidatePath(back);
}

export async function informPaidAction(f: FormData) {
  const u = await me();
  await run(`/pagar/${str(f, "paymentId")}`, () => P.informPaid(str(f, "paymentId"), u), "Avisamos o organizador.");
}

export async function confirmPaymentAction(f: FormData) {
  const u = await me();
  await run(str(f, "back") || "/", () => P.confirmPayment(str(f, "paymentId"), u), "Pagamento confirmado.");
}

export async function markPaidAction(f: FormData) {
  const u = await me();
  await run(gamePath(f), () => P.markPaidManually(str(f, "entryId"), u), "Marcado como pago.");
}

export async function checkinAction(f: FormData) {
  const u = await me();
  await run(gamePath(f), () => P.checkin(str(f, "entryId"), u));
}

export async function drawAction(f: FormData) {
  const u = await me();
  await run(gamePath(f) + "#times", () => P.drawAndSave(str(f, "gameId"), u, str(f, "mode") as "ordem" | "equilibrado" | "aleatorio"), "Times sorteados.");
}

export async function saveStatsAction(f: FormData) {
  const u = await me();
  const rows: { userId: string; goals: number; assists: number }[] = [];
  for (const [k, v] of f.entries()) {
    const m = k.match(/^g_(.+)$/);
    if (m) rows.push({ userId: m[1], goals: Number(v) || 0, assists: Number(f.get(`a_${m[1]}`)) || 0 });
  }
  await run(gamePath(f), () => P.saveStats(str(f, "gameId"), u, rows), "Súmula salva! Rankings atualizados.");
}

export async function voteAction(f: FormData) {
  const u = await me();
  await run(gamePath(f), () => P.vote(str(f, "gameId"), u, str(f, "votedId")), "Voto registrado.");
}

// ---------- vaquinha ----------
export async function createVaquinhaAction(f: FormData) {
  const u = await me();
  const slug = str(f, "slug");
  await run(`/g/${slug}`, async () => {
    const g = await P.getGroupBySlug(slug);
    await P.createVaquinha(g!.id, u, str(f, "title"), cents(str(f, "goal")));
  }, "Vaquinha criada.");
}

export async function contributeAction(f: FormData) {
  const u = await me();
  let id = "";
  await runNoRedirect(`/g/${str(f, "slug")}`, async () => {
    id = await P.contribute(str(f, "vaquinhaId"), u, cents(str(f, "amount")));
  });
  redirect(`/pagar/${id}`);
}

// ---------- perfil ----------
export async function saveCpfAction(f: FormData) {
  const u = await me();
  const cpf = str(f, "cpf").replace(/\D/g, "");
  const back = str(f, "back") || "/";
  if (cpf.length !== 11) redirect(withParam(back, "erro", "CPF inválido"));
  const db = await getDb();
  await db.update(schema.users).set({ cpf }).where(eq(schema.users.id, u.id));
  redirect(withParam(back, "ok", "CPF salvo"));
}

// ---------- gestão de jogo ----------
export async function updateGameAction(f: FormData) {
  const u = await me();
  const startsAt = new Date(`${str(f, "startsAt")}:00-03:00`);
  await run(gamePath(f), async () => {
    if (isNaN(startsAt.getTime())) throw new P.AppError("Data inválida");
    await P.updateGame(str(f, "gameId"), u, {
      title: str(f, "title"),
      startsAt,
      location: str(f, "location"),
      priceCents: cents(str(f, "price")),
      slots: Math.max(2, Number(str(f, "slots")) || 2),
      gkSlots: Math.max(0, Number(str(f, "gkSlots")) || 0),
      deadlineHours: Math.max(0, Number(str(f, "deadlineHours")) || 0),
    });
  }, "Jogo atualizado. Quem está na lista foi avisado.");
}

export async function cancelGameAction(f: FormData) {
  const u = await me();
  await run(gamePath(f), () => P.cancelGame(str(f, "gameId"), u), "Jogo cancelado. Quem pagou recebeu crédito.");
}

// ---------- gestão de pessoas e pelada ----------
export async function removeMemberAction(f: FormData) {
  const u = await me();
  const slug = str(f, "slug");
  await run(`/g/${slug}/config`, async () => {
    const g = await P.getGroupBySlug(slug);
    await P.removeMember(g!.id, u, str(f, "userId"));
  }, "Jogador removido da pelada.");
}

export async function leaveGroupAction(f: FormData) {
  const u = await me();
  const slug = str(f, "slug");
  await runNoRedirect(`/g/${slug}`, async () => {
    const g = await P.getGroupBySlug(slug);
    await P.removeMember(g!.id, u, u.id);
  });
  redirect(`/?ok=${encodeURIComponent("Você saiu da pelada.")}`);
}

export async function deleteGroupAction(f: FormData) {
  const u = await me();
  const slug = str(f, "slug");
  await runNoRedirect(`/g/${slug}/config`, async () => {
    const g = await P.getGroupBySlug(slug);
    await P.deleteGroup(g!.id, u, str(f, "confirmName"));
  });
  redirect(`/?ok=${encodeURIComponent("Pelada excluída.")}`);
}

// ---------- mural ----------
export async function createPostAction(f: FormData) {
  const u = await me();
  const slug = str(f, "slug");
  await run(`/g/${slug}#mural`, async () => {
    const g = await P.getGroupBySlug(slug);
    await P.createPost(g!.id, u, str(f, "body"));
  }, "Recado publicado. A galera foi avisada.");
}

export async function deletePostAction(f: FormData) {
  const u = await me();
  await run(`/g/${str(f, "slug")}#mural`, () => P.deletePost(str(f, "postId"), u));
}

export async function togglePinAction(f: FormData) {
  const u = await me();
  await run(`/g/${str(f, "slug")}#mural`, () => P.togglePin(str(f, "postId"), u));
}
