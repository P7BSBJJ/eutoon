import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb, schema as t } from "@/db";
import { decideLeave, hasRoom, reliability } from "@/lib/domain/rules";
import { drawTeams, type DrawMode, type DrawResult } from "@/lib/domain/teams";
import { createCharge } from "@/lib/payments";

import { AppError } from "@/lib/errors";
export { AppError };

type User = typeof t.users.$inferSelect;

// ---------------- grupos ----------------

function slugify(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
  return `${base || "pelada"}-${randomUUID().slice(0, 4)}`;
}

export interface GroupInput {
  name: string;
  location: string;
  priceCents: number;
  slots: number;
  gkSlots: number;
  perTeam: number;
  deadlineHours: number;
  pixKey: string;
  pixName: string;
  pixCity: string;
}

export async function createGroup(owner: User, i: GroupInput) {
  const db = await getDb();
  const [g] = await db
    .insert(t.groups)
    .values({ ...i, slug: slugify(i.name), ownerId: owner.id })
    .returning();
  await db.insert(t.members).values({ groupId: g.id, userId: owner.id, role: "admin" });
  return g;
}

export async function updateGroup(groupId: string, actor: User, i: GroupInput) {
  await assertAdmin(groupId, actor.id);
  const db = await getDb();
  await db.update(t.groups).set(i).where(eq(t.groups.id, groupId));
}

export async function getGroupBySlug(slug: string) {
  const db = await getDb();
  return (await db.query.groups.findFirst({ where: eq(t.groups.slug, slug) })) ?? null;
}

export async function getMembership(groupId: string, userId: string) {
  const db = await getDb();
  return (
    (await db.query.members.findFirst({
      where: and(eq(t.members.groupId, groupId), eq(t.members.userId, userId)),
    })) ?? null
  );
}

export async function assertAdmin(groupId: string, userId: string) {
  const m = await getMembership(groupId, userId);
  if (m?.role !== "admin") throw new AppError("Só o organizador pode fazer isso.");
  return m;
}

export async function joinGroup(groupId: string, userId: string) {
  const db = await getDb();
  await db.insert(t.members).values({ groupId, userId }).onConflictDoNothing();
  return getMembership(groupId, userId);
}

export async function myGroups(userId: string) {
  const db = await getDb();
  return db
    .select({ group: t.groups, role: t.members.role })
    .from(t.members)
    .innerJoin(t.groups, eq(t.groups.id, t.members.groupId))
    .where(eq(t.members.userId, userId))
    .orderBy(desc(t.groups.createdAt));
}

export async function listMembers(groupId: string) {
  const db = await getDb();
  return db
    .select({
      userId: t.users.id,
      name: t.users.name,
      phone: t.users.phone,
      role: t.members.role,
      kind: t.members.kind,
      position: t.members.position,
      rating: t.members.rating,
    })
    .from(t.members)
    .innerJoin(t.users, eq(t.users.id, t.members.userId))
    .where(eq(t.members.groupId, groupId))
    .orderBy(asc(t.users.name));
}

export async function updateMember(
  groupId: string,
  actor: User,
  userId: string,
  patch: Partial<{ kind: "mensalista" | "diarista"; position: "linha" | "goleiro"; rating: number; role: "admin" | "membro" }>,
) {
  await assertAdmin(groupId, actor.id);
  if (patch.rating !== undefined) patch.rating = Math.min(10, Math.max(1, Math.round(patch.rating)));
  const db = await getDb();
  await db
    .update(t.members)
    .set(patch)
    .where(and(eq(t.members.groupId, groupId), eq(t.members.userId, userId)));
}

// ---------------- créditos ----------------

export async function creditBalance(groupId: string, userId: string) {
  const db = await getDb();
  const [r] = await db
    .select({ s: sql<number>`coalesce(sum(${t.credits.amountCents}), 0)::int` })
    .from(t.credits)
    .where(and(eq(t.credits.groupId, groupId), eq(t.credits.userId, userId)));
  return Number(r?.s ?? 0);
}

// ---------------- jogos ----------------

export async function createGame(
  groupId: string,
  actor: User,
  i: { title: string; startsAt: Date; location: string; priceCents: number; slots: number; gkSlots: number; perTeam: number; deadlineHours: number },
) {
  await assertAdmin(groupId, actor.id);
  const db = await getDb();
  const [g] = await db.insert(t.games).values({ groupId, ...i }).returning();
  // mensalistas já entram confirmados
  const mens = await db.query.members.findMany({
    where: and(eq(t.members.groupId, groupId), eq(t.members.kind, "mensalista")),
  });
  const counts = { linha: 0, goleiro: 0 };
  for (const m of mens) {
    const room = hasRoom(counts, { slots: g.slots, gkSlots: g.gkSlots }, m.position);
    counts[m.position]++;
    await db.insert(t.entries).values({
      gameId: g.id,
      userId: m.userId,
      kind: "mensalista",
      position: m.position,
      status: room ? "confirmado" : "espera",
      paid: true,
    });
  }
  return g;
}

export async function listGames(groupId: string) {
  const db = await getDb();
  return db.query.games.findMany({
    where: eq(t.games.groupId, groupId),
    orderBy: desc(t.games.startsAt),
    limit: 30,
  });
}

export async function getGame(gameId: string) {
  const db = await getDb();
  const game = await db.query.games.findFirst({ where: eq(t.games.id, gameId) });
  if (!game) return null;
  const group = await db.query.groups.findFirst({ where: eq(t.groups.id, game.groupId) });
  return { game, group: group! };
}

export interface EntryView {
  id: string;
  userId: string | null;
  name: string;
  kind: "mensalista" | "diarista" | "convidado";
  position: "linha" | "goleiro";
  status: "confirmado" | "espera" | "saiu";
  paid: boolean;
  checkinAt: Date | null;
  invitedBy: string | null;
  leftOutcome: string | null;
  pendingPaymentId: string | null; // jogador avisou que pagou (Pix estático)
}

export async function gameEntries(gameId: string): Promise<EntryView[]> {
  const db = await getDb();
  const rows = await db
    .select({ e: t.entries, userName: t.users.name })
    .from(t.entries)
    .leftJoin(t.users, eq(t.users.id, t.entries.userId))
    .where(eq(t.entries.gameId, gameId))
    .orderBy(asc(t.entries.joinedAt));
  const ids = rows.map((r) => r.e.id);
  const informed = ids.length
    ? await db.query.payments.findMany({
        where: and(inArray(t.payments.entryId, ids), eq(t.payments.status, "informado")),
      })
    : [];
  const informedBy = new Map(informed.map((p) => [p.entryId, p.id]));
  return rows.map(({ e, userName }) => ({
    id: e.id,
    userId: e.userId,
    name: e.guestName ?? userName ?? "?",
    kind: e.kind,
    position: e.position,
    status: e.status,
    paid: e.paid,
    checkinAt: e.checkinAt,
    invitedBy: e.invitedBy,
    leftOutcome: e.leftOutcome,
    pendingPaymentId: informedBy.get(e.id) ?? null,
  }));
}

async function counts(gameId: string) {
  const db = await getDb();
  const rows = await db
    .select({ position: t.entries.position, n: sql<number>`count(*)::int` })
    .from(t.entries)
    .where(and(eq(t.entries.gameId, gameId), eq(t.entries.status, "confirmado")))
    .groupBy(t.entries.position);
  const c = { linha: 0, goleiro: 0 };
  for (const r of rows) c[r.position] = Number(r.n);
  return c;
}

export async function joinGame(gameId: string, user: User, position?: "linha" | "goleiro") {
  const db = await getDb();
  const g = await getGame(gameId);
  if (!g) throw new AppError("Jogo não encontrado.");
  if (g.game.startsAt.getTime() < Date.now()) throw new AppError("Esse jogo já aconteceu.");
  const member = (await getMembership(g.group.id, user.id)) ?? (await joinGroup(g.group.id, user.id))!;
  const active = await db.query.entries.findFirst({
    where: and(eq(t.entries.gameId, gameId), eq(t.entries.userId, user.id), inArray(t.entries.status, ["confirmado", "espera"])),
  });
  if (active) return active;
  const pos = position ?? member.position;
  const room = hasRoom(await counts(gameId), g.game, pos);
  const [e] = await db
    .insert(t.entries)
    .values({
      gameId,
      userId: user.id,
      kind: member.kind,
      position: pos,
      status: room ? "confirmado" : "espera",
      paid: member.kind === "mensalista",
    })
    .returning();
  return e;
}

export async function addGuest(gameId: string, inviter: User, name: string, position: "linha" | "goleiro") {
  const clean = name.trim().replace(/\s+/g, " ");
  if (clean.length < 2) throw new AppError("Nome do convidado muito curto.");
  const g = await getGame(gameId);
  if (!g) throw new AppError("Jogo não encontrado.");
  if (!(await getMembership(g.group.id, inviter.id))) throw new AppError("Entre no grupo primeiro.");
  const db = await getDb();
  const room = hasRoom(await counts(gameId), g.game, position);
  const [e] = await db
    .insert(t.entries)
    .values({ gameId, guestName: clean, invitedBy: inviter.id, kind: "convidado", position, status: room ? "confirmado" : "espera" })
    .returning();
  return e;
}

async function canActOnEntry(entry: typeof t.entries.$inferSelect, groupId: string, actorId: string) {
  if (entry.userId === actorId || entry.invitedBy === actorId) return true;
  const m = await getMembership(groupId, actorId);
  return m?.role === "admin";
}

export async function leaveGame(entryId: string, actor: User, now = new Date()) {
  const db = await getDb();
  const entry = await db.query.entries.findFirst({ where: eq(t.entries.id, entryId) });
  if (!entry || entry.status === "saiu") throw new AppError("Inscrição não encontrada.");
  const g = (await getGame(entry.gameId))!;
  if (!(await canActOnEntry(entry, g.group.id, actor.id))) throw new AppError("Sem permissão.");

  // quem está na espera só sai, sem regra de prazo
  if (entry.status === "espera") {
    await db.update(t.entries).set({ status: "saiu", leftAt: now }).where(eq(t.entries.id, entryId));
    return { outcome: "espera" as const };
  }

  const next = await db.query.entries.findFirst({
    where: and(eq(t.entries.gameId, entry.gameId), eq(t.entries.status, "espera"), eq(t.entries.position, entry.position)),
    orderBy: asc(t.entries.joinedAt),
  });
  const hoursToGame = (g.game.startsAt.getTime() - now.getTime()) / 36e5;
  const d = decideLeave({
    hoursToGame,
    deadlineHours: g.game.deadlineHours,
    paid: entry.paid,
    kind: entry.kind,
    waitlistHasSomeone: Boolean(next),
  });

  await db
    .update(t.entries)
    .set({ status: "saiu", leftAt: now, leftOutcome: d.outcome })
    .where(eq(t.entries.id, entryId));

  const creditUser = entry.userId ?? entry.invitedBy; // crédito de convidado vai pra quem convidou
  if (d.creditNow && creditUser) {
    await db.insert(t.credits).values({
      groupId: g.group.id,
      userId: creditUser,
      amountCents: g.game.priceCents,
      reason: `Desistência no prazo – ${g.game.title}`,
      entryId: entry.id,
    });
  }
  let promoted: string | null = null;
  if (d.promoteWaitlist && next) {
    await db
      .update(t.entries)
      .set({
        status: "confirmado",
        joinedAt: now,
        replacedEntryId: d.outcome === "repasse" && d.creditWhenReplacementPays ? entry.id : null,
      })
      .where(eq(t.entries.id, next.id));
    promoted = next.id;
    // TODO notificação: avisar o promovido por WhatsApp/push
  }
  return { outcome: d.outcome, promoted };
}

/** efeitos colaterais quando uma inscrição fica paga */
async function onEntryPaid(entryId: string, via: "pix" | "credito" | "manual") {
  const db = await getDb();
  const [e] = await db
    .update(t.entries)
    .set({ paid: true, paidWith: via })
    .where(eq(t.entries.id, entryId))
    .returning();
  if (e?.replacedEntryId) {
    const left = await db.query.entries.findFirst({ where: eq(t.entries.id, e.replacedEntryId) });
    const g = (await getGame(e.gameId))!;
    const creditUser = left?.userId ?? left?.invitedBy;
    if (left?.paid && creditUser) {
      const already = await db.query.credits.findFirst({
        where: and(eq(t.credits.entryId, left.id), eq(t.credits.userId, creditUser)),
      });
      if (!already)
        await db.insert(t.credits).values({
          groupId: g.group.id,
          userId: creditUser,
          amountCents: g.game.priceCents,
          reason: `Vaga repassada – ${g.game.title}`,
          entryId: left.id,
        });
    }
  }
}

export async function payEntry(entryId: string, actor: User) {
  const db = await getDb();
  const entry = await db.query.entries.findFirst({ where: eq(t.entries.id, entryId) });
  if (!entry || entry.status !== "confirmado") throw new AppError("Só dá pra pagar vaga confirmada.");
  if (entry.paid) return { kind: "ja_pago" as const };
  const g = (await getGame(entry.gameId))!;
  if (!(await canActOnEntry(entry, g.group.id, actor.id))) throw new AppError("Sem permissão.");

  const payerId = actor.id;
  const balance = await creditBalance(g.group.id, payerId);
  if (balance >= g.game.priceCents) {
    await db.insert(t.credits).values({
      groupId: g.group.id,
      userId: payerId,
      amountCents: -g.game.priceCents,
      reason: `Pagamento com crédito – ${g.game.title}`,
      entryId,
    });
    await onEntryPaid(entryId, "credito");
    return { kind: "credito" as const };
  }
  const existing = await db.query.payments.findFirst({
    where: and(eq(t.payments.entryId, entryId), inArray(t.payments.status, ["aguardando", "informado"])),
  });
  if (existing) return { kind: "pix" as const, paymentId: existing.id };

  const paymentId = randomUUID();
  const charge = await createCharge({
    paymentId,
    amountCents: g.game.priceCents,
    description: g.game.title,
    payer: { name: actor.name, phone: actor.phone, cpf: actor.cpf },
    group: g.group,
  });
  await db.insert(t.payments).values({
    id: paymentId,
    groupId: g.group.id,
    userId: payerId,
    entryId,
    payerName: entry.guestName ? `${entry.guestName} (por ${actor.name})` : actor.name,
    amountCents: g.game.priceCents,
    status: "aguardando",
    ...charge,
  });
  return { kind: "pix" as const, paymentId };
}

export async function getPayment(paymentId: string) {
  const db = await getDb();
  const p = await db.query.payments.findFirst({ where: eq(t.payments.id, paymentId) });
  if (!p) return null;
  const group = await db.query.groups.findFirst({ where: eq(t.groups.id, p.groupId) });
  let backTo = `/g/${group!.slug}`;
  if (p.entryId) {
    const e = await db.query.entries.findFirst({ where: eq(t.entries.id, p.entryId) });
    if (e) backTo = `/g/${group!.slug}/jogo/${e.gameId}`;
  }
  return { payment: p, group: group!, backTo };
}

export async function informPaid(paymentId: string, actor: User) {
  const db = await getDb();
  const p = await db.query.payments.findFirst({ where: eq(t.payments.id, paymentId) });
  if (!p || p.userId !== actor.id) throw new AppError("Pagamento não encontrado.");
  if (p.status === "aguardando")
    await db.update(t.payments).set({ status: "informado" }).where(eq(t.payments.id, paymentId));
}

/** organizador confirma (Pix estático) ou webhook confirma (Asaas) */
export async function confirmPayment(paymentId: string, actor: User | "webhook") {
  const db = await getDb();
  const p = await db.query.payments.findFirst({ where: eq(t.payments.id, paymentId) });
  if (!p) throw new AppError("Pagamento não encontrado.");
  if (actor !== "webhook") await assertAdmin(p.groupId, actor.id);
  if (p.status === "pago") return;
  await db.update(t.payments).set({ status: "pago", paidAt: new Date() }).where(eq(t.payments.id, paymentId));
  if (p.entryId) await onEntryPaid(p.entryId, "pix");
}

export async function markPaidManually(entryId: string, actor: User) {
  const db = await getDb();
  const entry = await db.query.entries.findFirst({ where: eq(t.entries.id, entryId) });
  if (!entry) throw new AppError("Inscrição não encontrada.");
  const g = (await getGame(entry.gameId))!;
  await assertAdmin(g.group.id, actor.id);
  const pending = await db.query.payments.findFirst({
    where: and(eq(t.payments.entryId, entryId), inArray(t.payments.status, ["aguardando", "informado"])),
  });
  if (pending) return confirmPayment(pending.id, actor);
  await onEntryPaid(entryId, "manual");
}

export async function checkin(entryId: string, actor: User) {
  const db = await getDb();
  const entry = await db.query.entries.findFirst({ where: eq(t.entries.id, entryId) });
  if (!entry || entry.status !== "confirmado") throw new AppError("Inscrição não encontrada.");
  const g = (await getGame(entry.gameId))!;
  if (!(await canActOnEntry(entry, g.group.id, actor.id))) throw new AppError("Sem permissão.");
  await db
    .update(t.entries)
    .set({ checkinAt: entry.checkinAt ? null : new Date() })
    .where(eq(t.entries.id, entryId));
}

export async function drawAndSave(gameId: string, actor: User, mode: DrawMode) {
  const g = await getGame(gameId);
  if (!g) throw new AppError("Jogo não encontrado.");
  await assertAdmin(g.group.id, actor.id);
  const list = (await gameEntries(gameId)).filter((e) => e.status === "confirmado");
  // ordem de chegada: quem fez check-in primeiro; depois quem não fez, na ordem da lista
  const ordered = [
    ...list.filter((e) => e.checkinAt).sort((a, b) => a.checkinAt!.getTime() - b.checkinAt!.getTime()),
    ...list.filter((e) => !e.checkinAt),
  ];
  const members = await listMembers(g.group.id);
  const rating = new Map(members.map((m) => [m.userId, m.rating]));
  const toP = (e: EntryView) => ({ id: e.id, name: e.name, rating: (e.userId && rating.get(e.userId)) || 5 });
  const r = drawTeams(
    ordered.filter((e) => e.position === "linha").map(toP),
    ordered.filter((e) => e.position === "goleiro").map(toP),
    mode,
    g.game.perTeam,
  );
  const db = await getDb();
  await db.update(t.games).set({ teamsJson: JSON.stringify({ mode, ...r }) }).where(eq(t.games.id, gameId));
  return r;
}

export function parseTeams(json: string | null): (DrawResult & { mode: DrawMode }) | null {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ---------------- estatísticas ----------------

export async function saveStats(gameId: string, actor: User, rows: { userId: string; goals: number; assists: number }[]) {
  const g = await getGame(gameId);
  if (!g) throw new AppError("Jogo não encontrado.");
  await assertAdmin(g.group.id, actor.id);
  const db = await getDb();
  for (const r of rows) {
    if (!r.goals && !r.assists) continue;
    await db
      .insert(t.stats)
      .values({ gameId, userId: r.userId, goals: r.goals, assists: r.assists })
      .onConflictDoUpdate({
        target: [t.stats.gameId, t.stats.userId],
        set: { goals: r.goals, assists: r.assists },
      });
  }
}

export async function gameStats(gameId: string) {
  const db = await getDb();
  return db
    .select({ userId: t.stats.userId, name: t.users.name, goals: t.stats.goals, assists: t.stats.assists })
    .from(t.stats)
    .innerJoin(t.users, eq(t.users.id, t.stats.userId))
    .where(eq(t.stats.gameId, gameId));
}

export async function vote(gameId: string, voter: User, votedId: string) {
  const g = await getGame(gameId);
  if (!g) throw new AppError("Jogo não encontrado.");
  const db = await getDb();
  const played = await db.query.entries.findFirst({
    where: and(eq(t.entries.gameId, gameId), eq(t.entries.userId, voter.id), eq(t.entries.status, "confirmado")),
  });
  if (!played) throw new AppError("Só quem jogou pode votar.");
  if (votedId === voter.id) throw new AppError("Não vale votar em si mesmo.");
  await db
    .insert(t.votes)
    .values({ gameId, voterId: voter.id, votedId })
    .onConflictDoUpdate({ target: [t.votes.gameId, t.votes.voterId], set: { votedId } });
}

export async function gameVotes(gameId: string) {
  const db = await getDb();
  return db
    .select({ userId: t.votes.votedId, n: sql<number>`count(*)::int` })
    .from(t.votes)
    .where(eq(t.votes.gameId, gameId))
    .groupBy(t.votes.votedId);
}

export async function rankings(groupId: string, days: number) {
  const db = await getDb();
  const since = new Date(Date.now() - days * 864e5);
  const rows = await db
    .select({
      userId: t.stats.userId,
      name: t.users.name,
      goals: sql<number>`sum(${t.stats.goals})::int`,
      assists: sql<number>`sum(${t.stats.assists})::int`,
      games: sql<number>`count(*)::int`,
    })
    .from(t.stats)
    .innerJoin(t.games, eq(t.games.id, t.stats.gameId))
    .innerJoin(t.users, eq(t.users.id, t.stats.userId))
    .where(and(eq(t.games.groupId, groupId), gte(t.games.startsAt, since)))
    .groupBy(t.stats.userId, t.users.name);
  const voteRows = await db
    .select({ userId: t.votes.votedId, n: sql<number>`count(*)::int` })
    .from(t.votes)
    .innerJoin(t.games, eq(t.games.id, t.votes.gameId))
    .where(and(eq(t.games.groupId, groupId), gte(t.games.startsAt, since)))
    .groupBy(t.votes.votedId);
  const votes = new Map(voteRows.map((v) => [v.userId, Number(v.n)]));
  return rows
    .map((r) => {
      const goals = Number(r.goals), assists = Number(r.assists), v = votes.get(r.userId) ?? 0;
      return { ...r, goals, assists, games: Number(r.games), votes: v, points: goals * 2 + assists + v * 3 };
    })
    .sort((a, b) => b.points - a.points);
}

export async function playerHistory(groupId: string, userId: string) {
  const db = await getDb();
  return db
    .select({ date: t.games.startsAt, title: t.games.title, goals: t.stats.goals, assists: t.stats.assists })
    .from(t.stats)
    .innerJoin(t.games, eq(t.games.id, t.stats.gameId))
    .where(and(eq(t.games.groupId, groupId), eq(t.stats.userId, userId)))
    .orderBy(desc(t.games.startsAt));
}

export async function reliabilityMap(groupId: string) {
  const db = await getDb();
  const rows = await db
    .select({
      userId: t.entries.userId,
      confirmations: sql<number>`count(*) filter (where ${t.entries.status} = 'confirmado' or ${t.entries.leftOutcome} is not null)::int`,
      late: sql<number>`count(*) filter (where ${t.entries.leftOutcome} = 'perdeu')::int`,
    })
    .from(t.entries)
    .innerJoin(t.games, eq(t.games.id, t.entries.gameId))
    .where(eq(t.games.groupId, groupId))
    .groupBy(t.entries.userId);
  return new Map(rows.filter((r) => r.userId).map((r) => [r.userId!, reliability(Number(r.confirmations), Number(r.late))]));
}

// ---------------- vaquinhas ----------------

export async function createVaquinha(groupId: string, actor: User, title: string, goalCents: number) {
  await assertAdmin(groupId, actor.id);
  if (title.trim().length < 2 || goalCents <= 0) throw new AppError("Dê um nome e uma meta.");
  const db = await getDb();
  await db.insert(t.vaquinhas).values({ groupId, title: title.trim(), goalCents });
}

export async function listVaquinhas(groupId: string) {
  const db = await getDb();
  const vs = await db.query.vaquinhas.findMany({ where: eq(t.vaquinhas.groupId, groupId), orderBy: desc(t.vaquinhas.createdAt) });
  const pays = vs.length
    ? await db.query.payments.findMany({ where: and(inArray(t.payments.vaquinhaId, vs.map((v) => v.id))) })
    : [];
  return vs.map((v) => {
    const mine = pays.filter((p) => p.vaquinhaId === v.id);
    const paid = mine.filter((p) => p.status === "pago");
    return {
      ...v,
      raisedCents: paid.reduce((s, p) => s + p.amountCents, 0),
      contributors: paid.map((p) => ({ name: p.payerName, cents: p.amountCents })),
      pending: mine.filter((p) => p.status === "informado"),
    };
  });
}

export async function contribute(vaquinhaId: string, actor: User, amountCents: number) {
  if (amountCents < 100) throw new AppError("Valor mínimo R$ 1,00.");
  const db = await getDb();
  const v = await db.query.vaquinhas.findFirst({ where: eq(t.vaquinhas.id, vaquinhaId) });
  if (!v) throw new AppError("Vaquinha não encontrada.");
  if (!(await getMembership(v.groupId, actor.id))) throw new AppError("Entre no grupo primeiro.");
  const group = (await db.query.groups.findFirst({ where: eq(t.groups.id, v.groupId) }))!;
  const paymentId = randomUUID();
  const charge = await createCharge({
    paymentId,
    amountCents,
    description: v.title,
    payer: { name: actor.name, phone: actor.phone, cpf: actor.cpf },
    group,
  });
  await db.insert(t.payments).values({
    id: paymentId,
    groupId: v.groupId,
    userId: actor.id,
    vaquinhaId,
    payerName: actor.name,
    amountCents,
    status: "aguardando",
    ...charge,
  });
  return paymentId;
}

/** pagamentos que o organizador precisa conferir (Pix estático) */
export async function pendingConfirmations(groupId: string) {
  const db = await getDb();
  return db.query.payments.findMany({
    where: and(eq(t.payments.groupId, groupId), eq(t.payments.status, "informado")),
    orderBy: asc(t.payments.createdAt),
  });
}
