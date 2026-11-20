import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import * as P from "@/lib/pelada";
import { baseUrl, brl, fmtDate, nowMs } from "@/lib/url";
import { Flash } from "@/components/flash";
import { CopyButton, Submit } from "@/components/client";
import { BallIcon, BootIcon, Banknote, CalendarDays, ChevronRight, Crown, History, Megaphone, PiggyBank, Plus, Settings, Target, Trophy, Vote } from "@/components/icons";
import { confirmPaymentAction, contributeAction, createGameAction, createVaquinhaAction, joinGroupAction } from "../../actions";

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
          <Submit className="btn w-full py-3">Tô on! Entrar no grupo</Submit>
        </form>
      </div>
    );
  }

  const admin = me.role === "admin";
  const period = typeof sp.periodo === "string" && PERIODS[sp.periodo] ? sp.periodo : "mes";
  const [games, ranking, vaqs, pending, credit, url] = await Promise.all([
    P.listGames(group.id),
    P.rankings(group.id, PERIODS[period][0]),
    P.listVaquinhas(group.id),
    admin ? P.pendingConfirmations(group.id) : Promise.resolve([]),
    P.creditBalance(group.id, user.id),
    baseUrl(),
  ]);
  const now = nowMs();
  const upcoming = games.filter((g) => g.startsAt.getTime() >= now - 3 * 36e5).reverse();
  const past = games.filter((g) => g.startsAt.getTime() < now - 3 * 36e5);
  const top = (k: "points" | "goals" | "assists") => [...ranking].sort((a, b) => b[k] - a[k])[0];

  return (
    <div className="space-y-5">
      <Flash sp={sp} />
      <div>
        <h1 className="text-3xl">{group.name}</h1>
        <p className="muted">
          {group.location} · {brl(group.priceCents)}
          {credit > 0 && <span className="ml-2 tag bg-lima/15 text-lima">seu crédito: {brl(credit)}</span>}
        </p>
      </div>

      {admin && pending.length > 0 && (
        <section className="card ring-amarelo/40">
          <h2 className="h2"><Banknote size={20} /> Confirme os Pix recebidos</h2>
          <p className="muted mb-3">Eles disseram que pagaram. Confira no seu banco e confirme.</p>
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

      <section>
        <h2 className="h2"><CalendarDays size={20} /> Próximos jogos</h2>
        {upcoming.length === 0 && <p className="muted">Nenhum jogo marcado.</p>}
        <div className="grid gap-2">
          {upcoming.map((g) => (
            <Link key={g.id} href={`/g/${slug}/jogo/${g.id}`} className="card flex items-center justify-between hover:ring-lima/50">
              <div>
                <div className="font-bold">{g.title}</div>
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
              <p className="muted">Mensalistas entram confirmados automaticamente.</p>
              <Submit className="btn w-full">Marcar jogo</Submit>
            </form>
          </details>
        )}
      </section>

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="h2 mb-0"><Trophy size={20} /> Ranking {PERIODS[period][1]}</h2>
        </div>
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
              {[
                [Crown, "Craque", top("points")],
                [BallIcon, "Artilheiro", top("goals")],
                [Target, "Garçom", top("assists")],
              ].map(([Icon, t, r]) => {
                const row = r as (typeof ranking)[number];
                const I = Icon as typeof Crown;
                return (
                  <div key={t as string} className="rounded-xl bg-noite p-2">
                    <I size={18} className="mx-auto mb-0.5 text-lima" />
                    <div className="text-xs text-white/50">{t as string}</div>
                    <div className="font-bold">{row.name.split(" ")[0]}</div>
                  </div>
                );
              })}
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
              <div className="flex justify-between">
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
                <input name="amount" className="input" inputMode="decimal" placeholder="R$ 20,00" required />
                <Submit className="btn shrink-0">Contribuir</Submit>
              </form>
            </div>
          );
        })}
        {admin && (
          <form action={createVaquinhaAction} className="mt-3 flex gap-2 border-t border-white/5 pt-3">
            <input type="hidden" name="slug" value={slug} />
            <input name="title" className="input" placeholder="Ex.: Churrasco de fim de ano" required />
            <input name="goal" className="input w-28" inputMode="decimal" placeholder="Meta R$" required />
            <Submit className="btn-sec shrink-0">Criar</Submit>
          </form>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="h2"><Megaphone size={20} /> Convide a galera</h2>
        <p className="muted">Mande este link no grupo do WhatsApp. Quem entrar já pode confirmar nos jogos.</p>
        <CopyButton text={`${url}/g/${slug}`} label="Copiar link do grupo" className="btn-sec w-full" />
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
                <span>{g.title}</span>
                <span className="text-white/50">{fmtDate(g.startsAt, { day: "2-digit", month: "2-digit" })}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
