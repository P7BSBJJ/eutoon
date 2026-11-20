import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth";
import * as P from "@/lib/pelada";
import { getDb, schema } from "@/db";
import { fmtDate } from "@/lib/url";
import { ArrowLeft, BallIcon, BootIcon } from "@/components/icons";

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
      <Link href={`/g/${slug}`} className="back"><ArrowLeft size={16} /> {group.name}</Link>
      <div className="card text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-lima/10 font-display text-3xl text-lima">{player.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}</span>
        <h1 className="mt-3 text-3xl">{player.name}</h1>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            [goals, "gols"],
            [assists, "assist."],
            [hist.length, "jogos"],
            [`${rel.get(userId) ?? 100}%`, "presença"],
          ].map(([v, l]) => (
            <div key={l as string} className="rounded-xl bg-noite p-2">
              <div className="font-display text-3xl text-lima">{v}</div>
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
              <span className="flex items-center gap-3"><span className="inline-flex items-center gap-1"><BallIcon size={15} />{h.goals}</span><span className="inline-flex items-center gap-1"><BootIcon size={15} />{h.assists}</span></span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
