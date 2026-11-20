import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import * as P from "@/lib/pelada";
import { formatList } from "@/lib/domain/whatsapp";
import { isWithinDeadline } from "@/lib/domain/rules";
import { teamStrength } from "@/lib/domain/teams";
import { baseUrl, brl, fmtDate, nowMs } from "@/lib/url";
import { Flash } from "@/components/flash";
import { CopyButton, RowMenu, ShareWhatsApp, Submit } from "@/components/client";
import {
  addGuestAction,
  checkinAction,
  confirmPaymentAction,
  drawAction,
  joinGameAction,
  leaveGameAction,
  markPaidAction,
  payEntryAction,
  voteAction,
} from "@/app/actions";
import { SumulaForm } from "./sumula-form";

export default async function GamePage({ params, searchParams }: PageProps<"/g/[slug]/jogo/[id]">) {
  const { slug, id } = await params;
  const sp = await searchParams;
  const user = await currentUser();
  if (!user) redirect(`/entrar?next=/g/${slug}/jogo/${id}`);
  const data = await P.getGame(id);
  if (!data || data.group.slug !== slug) notFound();
  const { game, group } = data;
  const me = await P.getMembership(group.id, user.id);
  const admin = me?.role === "admin";

  const [entries, rel, stats, votes, url] = await Promise.all([
    P.gameEntries(id),
    P.reliabilityMap(group.id),
    P.gameStats(id),
    P.gameVotes(id),
    baseUrl(),
  ]);
  const confirmed = entries.filter((e) => e.status === "confirmado");
  const line = confirmed.filter((e) => e.position === "linha");
  const gks = confirmed.filter((e) => e.position === "goleiro");
  const wait = entries.filter((e) => e.status === "espera");
  const mine = entries.find((e) => e.userId === user.id && e.status !== "saiu");
  const myGuests = entries.filter((e) => e.invitedBy === user.id && e.status !== "saiu");

  const hoursToGame = (game.startsAt.getTime() - nowMs()) / 36e5;
  const inDeadline = isWithinDeadline(hoursToGame, game.deadlineHours);
  const finished = hoursToGame < 0;
  const link = `${url}/g/${slug}/jogo/${id}`;
  const listText = formatList({ ...game, link }, confirmed, wait);
  const teams = P.parseTeams(game.teamsJson);

  const leaveMsg = inDeadline
    ? `Sair da lista?\n\nVocê está dentro do prazo (${game.deadlineHours}h antes). Se já pagou, o valor vira crédito pro próximo jogo.`
    : `Sair da lista FORA do prazo?\n\nSe tiver alguém na espera, a vaga é repassada e você recebe crédito quando a pessoa pagar.\nSe ninguém assumir, você perde o valor (o campo já está pago) e seu índice de presença cai.`;

  const hidden = (
    <>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="gameId" value={id} />
    </>
  );

  function Row({ e, n }: { e: P.EntryView; n: string | number }) {
    const canAct = admin || e.userId === user!.id || e.invitedBy === user!.id;
    return (
      <li className="flex flex-wrap items-center gap-2 border-t border-white/5 py-2">
        <span className="w-6 text-right text-white/40">{n}</span>
        <span className="flex-1">
          {e.name}
          {e.kind === "convidado" && <span className="text-white/50"> (convidado)</span>}
          {e.checkinAt && <span title="chegou"> 📍</span>}
          {e.userId && rel.get(e.userId) !== undefined && rel.get(e.userId)! < 100 && (
            <span className="ml-1 text-xs text-white/40">{rel.get(e.userId)}%</span>
          )}
        </span>
        {e.position === "goleiro" && <span className="tag bg-purple-500/30">GOL</span>}
        {e.kind === "mensalista" ? (
          <span className="tag bg-blue-500/30">Ⓜ️</span>
        ) : e.paid ? (
          <span className="tag bg-emerald-500/25 text-emerald-200">✅ pago</span>
        ) : e.pendingPaymentId ? (
          admin ? (
            <form action={confirmPaymentAction}>
              <input type="hidden" name="paymentId" value={e.pendingPaymentId} />
              <input type="hidden" name="back" value={`/g/${slug}/jogo/${id}`} />
              <Submit className="btn btn-sm !bg-amarelo !text-noite">Confirmar Pix</Submit>
            </form>
          ) : (
            <span className="tag bg-amarelo/25 text-amarelo">⏳ conferindo</span>
          )
        ) : (
          <span className="tag bg-red-500/25 text-red-200">❌</span>
        )}
        {canAct && (
          <RowMenu>
              {!e.paid && e.kind !== "mensalista" && (
                <form action={payEntryAction}>
                  {hidden}
                  <input type="hidden" name="entryId" value={e.id} />
                  <Submit className="btn btn-sm w-full">Pagar Pix</Submit>
                </form>
              )}
              {admin && !e.paid && e.kind !== "mensalista" && (
                <form action={markPaidAction}>
                  {hidden}
                  <input type="hidden" name="entryId" value={e.id} />
                  <Submit className="btn-sec btn-sm w-full">Marcar pago</Submit>
                </form>
              )}
              {admin && (
                <form action={checkinAction}>
                  {hidden}
                  <input type="hidden" name="entryId" value={e.id} />
                  <Submit className="btn-sec btn-sm w-full">{e.checkinAt ? "Desfazer chegada" : "📍 Chegou"}</Submit>
                </form>
              )}
              <form action={leaveGameAction}>
                {hidden}
                <input type="hidden" name="entryId" value={e.id} />
                <Submit className="btn-sec btn-sm w-full !text-red-300" confirm={leaveMsg}>
                  Tirar da lista
                </Submit>
              </form>
          </RowMenu>
        )}
      </li>
    );
  }

  return (
    <div className="space-y-5">
      <Flash sp={sp} />
      <div>
        <Link href={`/g/${slug}`} className="text-sm text-white/50">← {group.name}</Link>
        <h1 className="text-2xl font-black italic">{game.title}</h1>
        <p className="text-white/80">
          📅 {fmtDate(game.startsAt, { weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
          <br />📍 {game.location} · 💰 {brl(game.priceCents)}
        </p>
      </div>

      {!finished && (
        <div className={`rounded-xl px-4 py-3 text-sm ${inDeadline ? "bg-emerald-500/10 text-emerald-200" : "bg-amarelo/10 text-amarelo"}`}>
          {inDeadline
            ? `✅ Desistência sem custo até ${game.deadlineHours}h antes do jogo.`
            : "⚠️ Prazo de desistência encerrado: quem sair só recebe crédito se alguém da espera assumir a vaga."}
        </div>
      )}

      {/* minha situação */}
      {!finished && (
        <section className="card">
          {!mine ? (
            <form action={joinGameAction} className="space-y-3">
              {hidden}
              <div className="flex gap-2">
                <select name="position" className="input" defaultValue={me?.position ?? "linha"}>
                  <option value="linha">Linha</option>
                  <option value="goleiro">Goleiro</option>
                </select>
                <Submit className="btn shrink-0 px-6 text-lg">Tô on! ⚽</Submit>
              </div>
              <p className="muted">
                {line.length >= game.slots ? "Lista cheia: você entra na lista de espera." : `${game.slots - line.length} vagas de linha livres.`}
              </p>
            </form>
          ) : mine.status === "espera" ? (
            <div className="flex items-center justify-between">
              <span>⏳ Você é o <b>{wait.findIndex((w) => w.id === mine.id) + 1}º</b> da lista de espera.</span>
              <form action={leaveGameAction}>
                {hidden}
                <input type="hidden" name="entryId" value={mine.id} />
                <Submit className="btn-sec btn-sm">Sair</Submit>
              </form>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-lg font-bold">
                {mine.kind === "mensalista" ? "Você tá on! Ⓜ️" : mine.paid ? "Você tá on! ✅" : mine.pendingPaymentId ? "Tá on! Pix em conferência ⏳" : "Tá na lista, falta pagar ❌"}
              </span>
              <div className="flex gap-2">
                {!mine.paid && mine.kind !== "mensalista" && !mine.pendingPaymentId && (
                  <form action={payEntryAction}>
                    {hidden}
                    <input type="hidden" name="entryId" value={mine.id} />
                    <Submit className="btn">Pagar {brl(game.priceCents)}</Submit>
                  </form>
                )}
                <form action={leaveGameAction}>
                  {hidden}
                  <input type="hidden" name="entryId" value={mine.id} />
                  <Submit className="btn-sec" confirm={leaveMsg}>Sair</Submit>
                </form>
              </div>
            </div>
          )}
          {myGuests.length > 0 && <p className="muted mt-2">Seus convidados: {myGuests.map((g) => g.name).join(", ")}</p>}
        </section>
      )}

      {/* lista */}
      <section className="card">
        <h2 className="h2">
          📋 Lista <span className="text-sm font-normal not-italic text-white/50">({line.length}/{game.slots} linha · {gks.length}/{game.gkSlots} gol)</span>
        </h2>
        <ol>
          {line.map((e, i) => <Row key={e.id} e={e} n={i + 1} />)}
          {gks.map((e, i) => <Row key={e.id} e={e} n={`G${i + 1}`} />)}
        </ol>
        {confirmed.length === 0 && <p className="muted">Ninguém confirmou ainda. Seja o primeiro!</p>}
        {wait.length > 0 && (
          <>
            <h3 className="mt-4 mb-1 font-bold">⏳ Lista de espera</h3>
            <ol>{wait.map((e, i) => <Row key={e.id} e={e} n={i + 1} />)}</ol>
          </>
        )}
        {!finished && me && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-semibold text-laranja">+ Levar convidado</summary>
            <form action={addGuestAction} className="mt-2 flex gap-2">
              {hidden}
              <input name="guestName" className="input" placeholder="Nome do convidado" required />
              <select name="position" className="input w-28">
                <option value="linha">Linha</option>
                <option value="goleiro">Goleiro</option>
              </select>
              <Submit className="btn-sec shrink-0">Add</Submit>
            </form>
          </details>
        )}
      </section>

      {/* whatsapp */}
      <section className="card space-y-3">
        <h2 className="h2">💬 Lista pro WhatsApp</h2>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-noite p-3 text-xs">{listText}</pre>
        <div className="flex gap-2">
          <CopyButton text={listText} label="Copiar lista" className="btn flex-1" />
          <ShareWhatsApp text={listText} className="btn-sec flex-1" />
        </div>
      </section>

      {/* times */}
      <section id="times" className="card space-y-3">
        <h2 className="h2">⚽ Times</h2>
        {admin && (
          <form action={drawAction} className="flex gap-2">
            {hidden}
            <select name="mode" className="input" defaultValue={teams?.mode ?? "ordem"}>
              <option value="ordem">Ordem de chegada (ímpar × par)</option>
              <option value="equilibrado">Equilibrado (pela nota)</option>
              <option value="aleatorio">Aleatório</option>
            </select>
            <Submit className="btn shrink-0">Sortear</Submit>
          </form>
        )}
        {admin && <p className="muted">Ordem de chegada usa quem marcou 📍 “Chegou” primeiro; sem check-in, usa a ordem da lista.</p>}
        {teams ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Time 1", teams.team1, teams.gk1],
                ["Time 2", teams.team2, teams.gk2],
              ].map(([name, t, gk]) => (
                <div key={name as string} className="rounded-xl bg-noite p-3">
                  <div className="mb-1 flex justify-between font-bold">
                    <span>{name as string}</span>
                    {teams.mode === "equilibrado" && <span className="text-xs text-white/40">força {teamStrength(t as never)}</span>}
                  </div>
                  <ul className="space-y-0.5 text-sm">
                    {(t as { id: string; name: string }[]).map((p) => <li key={p.id}>{p.name}</li>)}
                    {gk && <li>🧤 {(gk as { name: string }).name}</li>}
                  </ul>
                </div>
              ))}
            </div>
            {teams.next.length > 0 && (
              <p className="text-sm"><b>Próximo:</b> {teams.next.map((p) => p.name).join(", ")}</p>
            )}
          </>
        ) : (
          !admin && <p className="muted">O organizador sorteia os times na hora do jogo.</p>
        )}
      </section>

      {/* estatísticas */}
      <section className="card space-y-3">
        <h2 className="h2">📊 Gols e assistências</h2>
        {stats.length > 0 ? (
          <ul className="space-y-1">
            {[...stats].sort((a, b) => b.goals * 2 + b.assists - (a.goals * 2 + a.assists)).map((s) => (
              <li key={s.userId} className="flex justify-between">
                <span>{s.name}</span>
                <span>⚽ {s.goals} · 🅰️ {s.assists}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Ainda sem súmula deste jogo.</p>
        )}
        {admin && (
          <details>
            <summary className="cursor-pointer font-semibold text-laranja">✍️ Registrar súmula</summary>
            <div className="mt-3">
              <SumulaForm
                slug={slug}
                gameId={id}
                players={confirmed
                  .filter((e) => e.userId)
                  .map((e) => {
                    const s = stats.find((x) => x.userId === e.userId);
                    return { id: e.userId!, name: e.name, goals: s?.goals ?? 0, assists: s?.assists ?? 0 };
                  })}
              />
            </div>
          </details>
        )}
        {mine?.status === "confirmado" && hoursToGame < 2 && (
          <div>
            <h3 className="mb-2 font-bold">🗳️ Quem foi o craque?</h3>
            <div className="flex flex-wrap gap-1">
              {confirmed
                .filter((e) => e.userId && e.userId !== user.id)
                .map((e) => {
                  const n = votes.find((v) => v.userId === e.userId)?.n ?? 0;
                  return (
                    <form key={e.id} action={voteAction}>
                      {hidden}
                      <input type="hidden" name="votedId" value={e.userId!} />
                      <Submit className="btn-sec btn-sm">{e.name.split(" ")[0]}{n ? ` · ${n}` : ""}</Submit>
                    </form>
                  );
                })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
