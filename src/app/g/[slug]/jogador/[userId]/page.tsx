import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth";
import * as P from "@/lib/pelada";
import { getDb, schema } from "@/db";
import { fmtDate } from "@/lib/url";

export default async function Jogador({ params }: PageProps<"/g/[slug]/jogador/[userId]">) {
  const { slug, userId } = await params;
  const user = await currentUser();
  if (!user) redirect(`/entrar?next=/g/${slug}/jogador/${userId}`);
  const group = await P.getGroupBySlug(slug);
  if (!group || !(await P.getMembership(group.id, user.id))) notFound();
  const db = await getDb();
  const player = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!player) notFound();
  const [hist, rel] = await Promise.all([P.playerHistory(group.id, userId), P.reliabilityMap(group.id)]);
  const goals = hist.reduce((s, h) => s + h.goals, 0);
  const assists = hist.reduce((s, h) => s + h.assists, 0);

  return (
    <div className="space-y-4">
      <Link href={`/g/${slug}`} className="text-sm text-white/50">← {group.name}</Link>
      <div className="card text-center">
        <div className="text-5xl">⚽</div>
        <h1 className="mt-2 text-2xl font-black italic">{player.name}</h1>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            [goals, "gols"],
            [assists, "assist."],
            [hist.length, "jogos"],
            [`${rel.get(userId) ?? 100}%`, "presença"],
          ].map(([v, l]) => (
            <div key={l as string} className="rounded-xl bg-noite p-2">
              <div className="text-2xl font-black text-laranja">{v}</div>
              <div className="text-xs text-white/50">{l}</div>
            </div>
          ))}
        </div>
      </div>
      <section className="card">
        <h2 className="h2">Histórico</h2>
        {hist.length === 0 && <p className="muted">Ainda sem gols ou assistências registrados.</p>}
        <ul className="divide-y divide-white/5">
          {hist.map((h, i) => (
            <li key={i} className="flex justify-between py-2">
              <span>{fmtDate(h.date, { day: "2-digit", month: "2-digit", year: "2-digit" })} · {h.title}</span>
              <span>⚽ {h.goals} · 🅰️ {h.assists}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
