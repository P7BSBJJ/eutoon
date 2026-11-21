import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import * as P from "@/lib/pelada";
import { baseUrl, brl, fmtDate, nowMs } from "@/lib/url";
import { Flash } from "@/components/flash";
import { CopyButton, OnSwitch, ShareWhatsApp, Submit } from "@/components/client";
import {
  BallIcon,
  Ban,
  Banknote,
  BootIcon,
  CalendarDays,
  ChevronRight,
  Crown,
  History,
  LeaveIcon,
  MapPin,
  Megaphone,
  MessageCircle,
  Pin,
  PinOff,
  PiggyBank,
  Plus,
  Send,
  Settings,
  Target,
  Trash2,
  Trophy,
  Vote,
  Wallet,
} from "@/components/icons";
import {
  confirmPaymentAction,
  contributeAction,
  createGameAction,
  createPostAction,
  createVaquinhaAction,
  deletePostAction,
  joinGameAction,
  joinGroupAction,
  leaveGroupAction,
  payEntryAction,
  togglePinAction,
} from "../../actions";

const PERIODS: Record<string, [number, string]> = {
  semana: [7, "da semana"],
  mes: [30, "do mês"],
  ano: [365, "do ano"],
  geral: [36500, "geral"],
};

export default async function GroupPage({ params, searchParams }: PageProps<"/g/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const user = await currentUser();
  if (!user) redirect(`/entrar?next=/g/${slug}`);
  const group = await P.getGroupBySlug(slug);
  if (!group) notFound();
  const me = await P.getMembership(group.id, user.id);

  if (!me) {
    return (
      <div className="card mt-6 space-y-4 text-center">
        <BallIcon size={44} className="mx-auto text-lima" />
        <h1 className="text-3xl">{group.name}</h1>
        <p className="muted">{group.location}</p>
        <form action={joinGroupAction}>
          <input type="hidden" name="slug" value={slug} />
          <Submit className="btn w-full py-3">Tô on! Entrar na pelada</Submit>
        </form>
      </div>
    );
  }

  const admin = me.role === "admin";
  const period = typeof sp.periodo === "string" && PERIODS[sp.periodo] ? sp.periodo : "mes";
  const [games, ranking, vaqs, pending, credit, posts, url] = await Promise.all([
    P.listGames(group.id),
    P.rankings(group.id, PERIODS[period][0]),
    P.listVaquinhas(group.id),
    admin ? P.pendingConfirmations(group.id) : Promise.resolve([]),
    P.creditBalance(group.id, user.id),
    P.listPosts(group.id),
    baseUrl(),
  ]);
  const now = nowMs();
  const upcoming = games.filter((g) => g.startsAt.getTime() >= now - 3 * 36e5).reverse();
  const past = games.filter((g) => g.startsAt.getTime() < now - 3 * 36e5);
  const next = upcoming.find((g) => !g.canceledAt && g.startsAt.getTime() > now);
  const nextEntries = next ? await P.gameEntries(next.id) : [];
  const mine = nextEntries.find((e) => e.userId === user.id && e.status !== "saiu");
  const nextLine = nextEntries.filter((e) => e.status === "confirmado" && e.position === "linha").length;
  const top = (k: "points" | "goals" | "assists") => [...ranking].sort((a, b) => b[k] - a[k])[0];
  const groupLink = `${url}/g/${slug}`;

  return (
    <div className="space-y-5">
      <Flash sp={sp} />
      <div>
        <h1 className="text-4xl">{group.name}</h1>
        <p className="muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          {group.location && <span className="inline-flex items-center gap-1"><MapPin size={14} /> {group.location}</span>}
          <span className="inline-flex items-center gap-1"><Wallet size={14} /> {brl(group.priceCents)}</span>
          {credit > 0 && <span className="tag bg-lima/15 text-lima">seu crédito: {brl(credit)}</span>}
        </p>
      </div>

      {/* próximo jogo: confirmar aqui mesmo */}
      {next ? (
        <section className="card space-y-4 ring-lima/30">
          <Link href={`/g/${slug}/jogo/${next.id}`} className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-lima">Próximo jogo</div>
              <div className="font-display text-2xl uppercase">{next.title}</div>
              <div className="muted flex items-center gap-1">
                <CalendarDays size={14} /> {fmtDate(next.startsAt)} · {nextLine}/{next.slots} confirmados
              </div>
            </div>
            <ChevronRight size={22} className="mt-6 shrink-0 text-lima" />
          </Link>
          {!mine ? (
            <form action={joinGameAction}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="gameId" value={next.id} />
              <input type="hidden" name="position" value={me.position} />
              <OnSwitch on={false} label="Tô on!" sub={nextLine >= next.slots ? "Lista cheia: entra na espera" : "Toque para confirmar"} />
            </form>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link href={`/g/${slug}/jogo/${next.id}`} className="font-display text-xl uppercase text-lima">
                {mine.status === "espera" ? "Você está na espera" : "Você tá on!"}
              </Link>
              {mine.status === "confirmado" && !mine.paid && mine.kind !== "mensalista" && !mine.pendingPaymentId && (
                <form action={payEntryAction}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="gameId" value={next.id} />
                  <input type="hidden" name="entryId" value={mine.id} />
                  <Submit className="btn"><Wallet size={18} /> Pagar {brl(next.priceCents)}</Submit>
                </form>
              )}
            </div>
          )}
        </section>
      ) : (
        <section className="card text-center">
          <p className="muted">Nenhum jogo marcado no momento.{admin ? " Marque o próximo abaixo." : " Você será avisado quando marcarem."}</p>
        </section>
      )}

      {admin && pending.length > 0 && (
        <section className="card ring-amarelo/40">
          <h2 className="h2"><Banknote size={20} /> Confirme os Pix recebidos</h2>
          <p className="muted mb-3">Eles avisaram que pagaram. Confira no seu banco e confirme.</p>
          {pending.map((p) => (
            <form key={p.id} action={confirmPaymentAction} className="flex items-center justify-between border-t border-white/5 py-2">
              <input type="hidden" name="paymentId" value={p.id} />
              <input type="hidden" name="back" value={`/g/${slug}`} />
              <span>
                {p.payerName} · <b>{brl(p.amountCents)}</b>
              </span>
              <Submit className="btn btn-sm">Confirmar</Submit>
            </form>
          ))}
        </section>
      )}

      {/* mural */}
      <section id="mural" className="card space-y-3">
        <h2 className="h2"><MessageCircle size={20} /> Mural</h2>
        <form action={createPostAction} className="space-y-2">
          <input type="hidden" name="slug" value={slug} />
          <textarea name="body" className="input min-h-20" maxLength={1000} placeholder={admin ? "Recado para a galera (todos são avisados no app)" : "Escreva um recado para a pelada"} required />
          <div className="flex justify-end">
            <Submit className="btn btn-sm"><Send size={15} /> Publicar</Submit>
          </div>
        </form>
        {posts.length === 0 && <p className="muted">Nenhum recado ainda.</p>}
        <ul className="space-y-2">
          {posts.map((p) => (
            <li key={p.id} className={`rounded-xl bg-noite p-3 ${p.pinned ? "ring-1 ring-lima/40" : ""}`}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs text-white/50">
                <span className="inline-flex items-center gap-1">
                  {p.pinned && <Pin size={12} className="text-lima" />}
                  <b className="text-white/80">{p.author}</b> · {fmtDate(p.createdAt)}
                </span>
                <span className="flex gap-1">
                  {admin && (
                    <form action={togglePinAction}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="postId" value={p.id} />
                      <button className="rounded p-1 hover:bg-white/10" aria-label={p.pinned ? "Desafixar" : "Fixar no topo"}>
                        {p.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                      </button>
                    </form>
                  )}
                  {(admin || p.authorId === user.id) && (
                    <form action={deletePostAction}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="postId" value={p.id} />
                      <Submit className="rounded p-1 hover:bg-white/10" confirm="Apagar este recado?"><Trash2 size={14} /></Submit>
                    </form>
                  )}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{p.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="h2"><CalendarDays size={20} /> Jogos marcados</h2>
        {upcoming.length === 0 && <p className="muted">Nenhum jogo marcado.</p>}
        <div className="grid gap-2">
          {upcoming.map((g) => (
            <Link key={g.id} href={`/g/${slug}/jogo/${g.id}`} className={`card flex items-center justify-between hover:ring-lima/40 ${g.canceledAt ? "opacity-60" : ""}`}>
              <div>
                <div className="font-bold">
                  {g.title}
                  {g.canceledAt && <span className="tag ml-2 bg-red-500/20 text-red-200"><Ban size={12} /> cancelado</span>}
                </div>
                <div className="muted">{fmtDate(g.startsAt)} · {g.location}</div>
              </div>
              <ChevronRight size={20} className="text-lima" />
            </Link>
          ))}
        </div>
        {admin && (
          <details className="card mt-3">
            <summary className="flex cursor-pointer items-center gap-2 font-bold"><Plus size={18} className="text-lima" /> Marcar jogo</summary>
            <form action={createGameAction} className="mt-3 space-y-3">
              <input type="hidden" name="slug" value={slug} />
              <div>
                <label className="label">Título</label>
                <input name="title" className="input" defaultValue={group.name} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Dia e hora (Brasília)</label>
                  <input name="startsAt" type="datetime-local" className="input" required />
                </div>
                <div className="col-span-2">
                  <label className="label">Local</label>
                  <input name="location" className="input" defaultValue={group.location} />
                </div>
                <div>
                  <label className="label">Valor (R$)</label>
                  <input name="price" className="input" inputMode="decimal" defaultValue={(group.priceCents / 100).toFixed(2).replace(".", ",")} />
                </div>
                <div>
                  <label className="label">Prazo desistência (h)</label>
                  <input name="deadlineHours" type="number" className="input" defaultValue={group.deadlineHours} />
                </div>
                <div>
                  <label className="label">Vagas linha</label>
                  <input name="slots" type="number" className="input" defaultValue={group.slots} />
                </div>
                <div>
                  <label className="label">Vagas goleiro</label>
                  <input name="gkSlots" type="number" className="input" defaultValue={group.gkSlots} />
                </div>
              </div>
              <p className="muted">Mensalistas entram confirmados automaticamente e todos da pelada são avisados no app.</p>
              <Submit className="btn w-full">Marcar jogo</Submit>
            </form>
          </details>
        )}
      </section>

      <section className="card">
        <h2 className="h2 mb-3"><Trophy size={20} /> Ranking {PERIODS[period][1]}</h2>
        <div className="mb-3 flex gap-1">
          {Object.keys(PERIODS).map((k) => (
            <Link key={k} href={`/g/${slug}?periodo=${k}`} className={`btn-sec btn-sm ${k === period ? "!bg-lima !text-noite" : ""}`}>
              {k === "mes" ? "mês" : k}
            </Link>
          ))}
        </div>
        {ranking.length === 0 ? (
          <p className="muted">Sem súmulas no período. Depois do jogo, o organizador registra os gols na página do jogo.</p>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-3 gap-2 text-center text-sm">
              {(
                [
                  [Crown, "Craque", top("points")],
                  [BallIcon, "Artilheiro", top("goals")],
                  [Target, "Garçom", top("assists")],
                ] as const
              ).map(([Icon, t, row]) => (
                <div key={t} className="rounded-xl bg-noite p-2">
                  <Icon size={18} className="mx-auto mb-0.5 text-lima" />
                  <div className="text-xs text-white/50">{t}</div>
                  <div className="font-bold">{row.name.split(" ")[0]}</div>
                </div>
              ))}
            </div>
            <ol className="divide-y divide-white/5">
              {ranking.map((r, i) => (
                <li key={r.userId}>
                  <Link href={`/g/${slug}/jogador/${r.userId}`} className="flex items-center gap-2 py-2">
                    <span className="w-6 text-right text-white/40">{i + 1}º</span>
                    <span className="flex-1">{r.name}</span>
                    <span className="flex items-center gap-2 text-sm text-white/60">
                      <span className="inline-flex items-center gap-0.5"><BallIcon size={14} />{r.goals}</span>
                      <span className="inline-flex items-center gap-0.5"><BootIcon size={14} />{r.assists}</span>
                      {r.votes > 0 && <span className="inline-flex items-center gap-0.5"><Vote size={14} />{r.votes}</span>}
                    </span>
                    <b className="w-12 text-right">{r.points}</b>
                  </Link>
                </li>
              ))}
            </ol>
            <p className="muted mt-2">Pontos: gol = 2 · assistência = 1 · voto de craque = 3</p>
          </>
        )}
      </section>

      <section className="card">
        <h2 className="h2"><PiggyBank size={20} /> Vaquinhas</h2>
        {vaqs.length === 0 && <p className="muted">Nenhuma vaquinha aberta.</p>}
        {vaqs.map((v) => {
          const pct = Math.min(100, Math.round((v.raisedCents / v.goalCents) * 100));
          return (
            <div key={v.id} className="border-t border-white/5 py-3">
              <div className="flex justify-between gap-2">
                <b>{v.title}</b>
                <span className="text-sm">{brl(v.raisedCents)} de {brl(v.goalCents)}</span>
              </div>
              <div className="my-2 h-2.5 overflow-hidden rounded-full bg-noite">
                <div className="h-full bg-lima" style={{ width: `${pct}%` }} />
              </div>
              {v.contributors.length > 0 && (
                <p className="muted mb-2">{v.contributors.map((c) => `${c.name.split(" ")[0]} ${brl(c.cents)}`).join(" · ")}</p>
              )}
              <form action={contributeAction} className="flex gap-2">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="vaquinhaId" value={v.id} />
                <input name="amount" className="input" inputMode="decimal" placeholder="Valor, ex.: 20,00" required />
                <Submit className="btn shrink-0">Contribuir</Submit>
              </form>
            </div>
          );
        })}
        {admin && (
          <form action={createVaquinhaAction} className="mt-3 space-y-2 border-t border-white/5 pt-3">
            <input type="hidden" name="slug" value={slug} />
            <label className="label">Nova vaquinha</label>
            <div className="flex gap-2">
              <input name="title" className="input" placeholder="Ex.: Churrasco de fim de ano" required />
              <input name="goal" className="input w-28" inputMode="decimal" placeholder="Meta R$" required />
            </div>
            <Submit className="btn-sec w-full">Criar vaquinha</Submit>
          </form>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="h2"><Megaphone size={20} /> Chame a galera para o app</h2>
        <p className="muted">Mande o link uma vez no grupo. Depois, tudo acontece aqui: lista, pagamento, avisos e times.</p>
        <div className="flex gap-2">
          <CopyButton text={groupLink} label="Copiar link" className="btn-sec flex-1" />
          <ShareWhatsApp text={`Entra na pelada ${group.name} no Eu Tô On! Lista, Pix e times pelo app: ${groupLink}`} className="btn-sec flex-1" />
        </div>
        {admin && (
          <Link href={`/g/${slug}/config`} className="btn-sec w-full">
            <Settings size={18} /> Configurações e jogadores
          </Link>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="h2"><History size={20} /> Jogos anteriores</h2>
          <div className="grid gap-2">
            {past.slice(0, 10).map((g) => (
              <Link key={g.id} href={`/g/${slug}/jogo/${g.id}`} className="card flex justify-between py-3 text-sm">
                <span>{g.title}{g.canceledAt ? " (cancelado)" : ""}</span>
                <span className="text-white/50">{fmtDate(g.startsAt, { day: "2-digit", month: "2-digit" })}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <form action={leaveGroupAction} className="pt-4 text-center">
        <input type="hidden" name="slug" value={slug} />
        <Submit
          className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-red-300"
          confirm="Sair desta pelada? Você sai das listas dos próximos jogos (valem as regras de desistência)."
        >
          <LeaveIcon size={15} /> Sair da pelada
        </Submit>
      </form>
    </div>
  );
}
