import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import * as P from "@/lib/pelada";
import { formatList } from "@/lib/domain/whatsapp";
import { isWithinDeadline } from "@/lib/domain/rules";
import { teamStrength } from "@/lib/domain/teams";
import { baseUrl, brl, fmtDate, nowMs } from "@/lib/url";
import { Flash } from "@/components/flash";
import { CopyButton, OnSwitch, RowMenu, ShareWhatsApp, Submit } from "@/components/client";
import {
  ArrowLeft,
  BallIcon,
  BootIcon,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardList,
  GloveIcon,
  Hourglass,
  MapPin,
  MessageCircle,
  PenLine,
  Shuffle,
  TriangleAlert,
  UserPlus,
  Vote,
  Wallet,
  WhistleIcon,
  X,
} from "@/components/icons";
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

  function Status({ e }: { e: P.EntryView }) {
    if (e.kind === "mensalista") return <span className="tag bg-blue-400/20 text-blue-200" title="Mensalista">M</span>;
    if (e.paid) return <span className="tag bg-lima/15 text-lima"><Check size={13} strokeWidth={3} /> pago</span>;
    if (e.pendingPaymentId) {
      if (admin)
        return (
          <form action={confirmPaymentAction}>
            <input type="hidden" name="paymentId" value={e.pendingPaymentId} />
            <input type="hidden" name="back" value={`/g/${slug}/jogo/${id}`} />
            <Submit className="btn btn-sm !bg-amarelo">Confirmar Pix</Submit>
          </form>
        );
      return <span className="tag bg-amarelo/20 text-amarelo"><Hourglass size={13} /> conferindo</span>;
    }
    return <span className="tag bg-red-500/20 text-red-200"><X size={13} strokeWidth={3} /> a pagar</span>;
  }

  function Row({ e, n }: { e: P.EntryView; n: string | number }) {
    const canAct = admin || e.userId === user!.id || e.invitedBy === user!.id;
    const r = e.userId ? rel.get(e.userId) : undefined;
    return (
      <li className="flex items-center gap-2 border-t border-white/5 py-2">
        <span className="w-7 text-right font-display text-lg text-white/35">{n}</span>
        <span className="min-w-0 flex-1 truncate">
          {e.name}
          {e.kind === "convidado" && <span className="text-white/50"> (convidado)</span>}
          {e.checkinAt && <MapPin size={14} className="ml-1 inline text-lima" aria-label="chegou" />}
          {r !== undefined && r < 100 && <span className="ml-1.5 text-xs text-white/40">{r}%</span>}
        </span>
        {e.position === "goleiro" && (
          <span className="tag bg-purple-400/20 text-purple-200"><GloveIcon size={13} /> gol</span>
        )}
        <Status e={e} />
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
                <Submit className="btn-sec btn-sm w-full">{e.checkinAt ? "Desfazer chegada" : "Chegou"}</Submit>
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

  const defaultPos = me?.position ?? "linha";

  return (
    <div className="space-y-5">
      <Flash sp={sp} />
      <div>
        <Link href={`/g/${slug}`} className="back"><ArrowLeft size={16} /> {group.name}</Link>
        <h1 className="mt-1 text-4xl">{game.title}</h1>
        <div className="mt-2 space-y-1 text-white/80">
          <p className="flex items-center gap-2">
            <CalendarDays size={17} className="text-lima" />
            {fmtDate(game.startsAt, { weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="flex items-center gap-2"><MapPin size={17} className="text-lima" /> {game.location}</p>
          <p className="flex items-center gap-2"><Wallet size={17} className="text-lima" /> {brl(game.priceCents)}</p>
        </div>
      </div>

      {!finished && (
        <div className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${inDeadline ? "bg-lima/10 text-lima" : "bg-amarelo/10 text-amarelo"}`}>
          {inDeadline ? <CheckCircle2 size={18} className="shrink-0" /> : <TriangleAlert size={18} className="shrink-0" />}
          <span>
            {inDeadline
              ? `Desistência sem custo até ${game.deadlineHours}h antes do jogo.`
              : "Prazo de desistência encerrado: quem sair só recebe crédito se alguém da espera assumir a vaga."}
          </span>
        </div>
      )}

      {/* minha situação: o interruptor da marca */}
      {!finished && (
        <section className="card space-y-4">
          {!mine ? (
            <form action={joinGameAction} className="space-y-4">
              {hidden}
              <OnSwitch
                on={false}
                label="Tô on!"
                sub={line.length >= game.slots ? "Lista cheia: você entra na lista de espera." : `${game.slots - line.length} vagas de linha livres`}
              />
              <fieldset className="flex gap-2">
                <legend className="sr-only">Posição</legend>
                {(["linha", "goleiro"] as const).map((pos) => (
                  <label key={pos} className="flex-1 cursor-pointer">
                    <input type="radio" name="position" value={pos} defaultChecked={pos === defaultPos} className="peer sr-only" />
                    <span className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 py-2 text-sm font-semibold text-white/60 peer-checked:border-lima peer-checked:text-lima">
                      {pos === "linha" ? <BallIcon size={16} /> : <GloveIcon size={16} />}
                      {pos === "linha" ? "Linha" : "Goleiro"}
                    </span>
                  </label>
                ))}
              </fieldset>
            </form>
          ) : (
            <form action={leaveGameAction}>
              {hidden}
              <input type="hidden" name="entryId" value={mine.id} />
              <OnSwitch
                on
                label={mine.status === "espera" ? "Na espera" : "Você tá on!"}
                sub={
                  mine.status === "espera"
                    ? `Você é o ${wait.findIndex((w) => w.id === mine.id) + 1}º da lista de espera. Toque para sair.`
                    : mine.kind === "mensalista"
                      ? "Mensalista. Toque para sair desta partida."
                      : mine.paid
                        ? "Pago. Toque para sair."
                        : mine.pendingPaymentId
                          ? "Pix em conferência pelo organizador."
                          : "Falta pagar para garantir a vaga."
                }
                confirm={mine.status === "espera" ? "Sair da lista de espera?" : leaveMsg}
              />
            </form>
          )}
          {mine?.status === "confirmado" && !mine.paid && mine.kind !== "mensalista" && !mine.pendingPaymentId && (
            <form action={payEntryAction}>
              {hidden}
              <input type="hidden" name="entryId" value={mine.id} />
              <Submit className="btn w-full py-3"><Wallet size={18} /> Pagar {brl(game.priceCents)} no Pix</Submit>
            </form>
          )}
          {myGuests.length > 0 && <p className="muted">Seus convidados: {myGuests.map((g) => g.name).join(", ")}</p>}
        </section>
      )}

      {/* lista */}
      <section className="card">
        <h2 className="h2">
          <ClipboardList size={20} /> Lista
          <span className="font-sans text-sm font-normal not-italic normal-case text-white/50">
            {line.length}/{game.slots} linha · {gks.length}/{game.gkSlots} gol
          </span>
        </h2>
        <ol>
          {line.map((e, i) => <Row key={e.id} e={e} n={i + 1} />)}
          {gks.map((e, i) => <Row key={e.id} e={e} n={`G${i + 1}`} />)}
        </ol>
        {confirmed.length === 0 && <p className="muted">Ninguém confirmou ainda. Seja o primeiro.</p>}
        {wait.length > 0 && (
          <>
            <h3 className="mt-5 mb-1 flex items-center gap-2 text-lg"><Hourglass size={17} className="text-amarelo" /> Lista de espera</h3>
            <ol>{wait.map((e, i) => <Row key={e.id} e={e} n={i + 1} />)}</ol>
          </>
        )}
        {!finished && me && (
          <details className="mt-3">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-lima"><UserPlus size={16} /> Levar convidado</summary>
            <form action={addGuestAction} className="mt-2 flex gap-2">
              {hidden}
              <input name="guestName" className="input" placeholder="Nome do convidado" required />
              <select name="position" className="input w-28">
                <option value="linha">Linha</option>
                <option value="goleiro">Goleiro</option>
              </select>
              <Submit className="btn-sec shrink-0">Adicionar</Submit>
            </form>
          </details>
        )}
      </section>

      {/* whatsapp */}
      <section className="card space-y-3">
        <h2 className="h2"><MessageCircle size={20} /> Lista para o WhatsApp</h2>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-noite p-3 text-xs">{listText}</pre>
        <div className="flex gap-2">
          <CopyButton text={listText} label="Copiar lista" className="btn flex-1" />
          <ShareWhatsApp text={listText} className="btn-sec flex-1" />
        </div>
      </section>

      {/* times */}
      <section id="times" className="card space-y-3">
        <h2 className="h2"><Shuffle size={20} /> Times</h2>
        {admin && (
          <form action={drawAction} className="flex gap-2">
            {hidden}
            <select name="mode" className="input" defaultValue={teams?.mode ?? "ordem"}>
              <option value="ordem">Ordem de chegada (ímpar × par)</option>
              <option value="equilibrado">Equilibrado (pela nota)</option>
              <option value="aleatorio">Aleatório</option>
            </select>
            <Submit className="btn shrink-0"><WhistleIcon size={18} /> Sortear</Submit>
          </form>
        )}
        {admin && <p className="muted">Ordem de chegada usa quem foi marcado como “Chegou” primeiro; sem isso, usa a ordem da lista.</p>}
        {teams ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Time 1", teams.team1, teams.gk1],
                ["Time 2", teams.team2, teams.gk2],
              ].map(([name, t, gk]) => (
                <div key={name as string} className="rounded-xl bg-noite p-3">
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="font-display text-xl uppercase">{name as string}</span>
                    {teams.mode === "equilibrado" && <span className="text-xs text-white/40">força {teamStrength(t as never)}</span>}
                  </div>
                  <ul className="space-y-0.5 text-sm">
                    {(t as { id: string; name: string }[]).map((p) => <li key={p.id}>{p.name}</li>)}
                    {gk && (
                      <li className="flex items-center gap-1 text-purple-200"><GloveIcon size={14} /> {(gk as { name: string }).name}</li>
                    )}
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
        <h2 className="h2"><BallIcon size={20} /> Gols e assistências</h2>
        {stats.length > 0 ? (
          <ul className="space-y-1">
            {[...stats].sort((a, b) => b.goals * 2 + b.assists - (a.goals * 2 + a.assists)).map((s) => (
              <li key={s.userId} className="flex items-center justify-between">
                <span>{s.name}</span>
                <span className="flex items-center gap-3 text-white/80">
                  <span className="inline-flex items-center gap-1"><BallIcon size={15} /> {s.goals}</span>
                  <span className="inline-flex items-center gap-1"><BootIcon size={15} /> {s.assists}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Ainda sem súmula deste jogo.</p>
        )}
        {admin && (
          <details>
            <summary className="flex cursor-pointer items-center gap-2 font-semibold text-lima"><PenLine size={16} /> Registrar súmula</summary>
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
            <h3 className="mb-2 flex items-center gap-2 text-lg"><Vote size={17} className="text-lima" /> Quem foi o craque?</h3>
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
