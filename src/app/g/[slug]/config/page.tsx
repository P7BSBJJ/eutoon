import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import * as P from "@/lib/pelada";
import { Flash } from "@/components/flash";
import { GroupFields } from "@/components/group-fields";
import { Submit } from "@/components/client";
import { updateGroupAction, updateMemberAction } from "@/app/actions";
import { ArrowLeft, Settings, Users } from "@/components/icons";

export default async function Config({ params, searchParams }: PageProps<"/g/[slug]/config">) {
  const { slug } = await params;
  const sp = await searchParams;
  const user = await currentUser();
  if (!user) redirect(`/entrar?next=/g/${slug}/config`);
  const group = await P.getGroupBySlug(slug);
  if (!group) notFound();
  const me = await P.getMembership(group.id, user.id);
  if (me?.role !== "admin") redirect(`/g/${slug}`);
  const [members, rel] = await Promise.all([P.listMembers(group.id), P.reliabilityMap(group.id)]);

  return (
    <div className="space-y-5">
      <Flash sp={sp} />
      <Link href={`/g/${slug}`} className="back"><ArrowLeft size={16} /> {group.name}</Link>
      <h1 className="text-3xl">Configurações</h1>

      <section className="card">
        <h2 className="h2"><Users size={20} /> Jogadores ({members.length})</h2>
        <p className="muted mb-3">
          Mensalista entra confirmado automaticamente em todo jogo novo. A nota (1–10) é usada no sorteio equilibrado e só você vê.
        </p>
        <div className="space-y-3">
          {members.map((m) => (
            <form key={m.userId} action={updateMemberAction} className="rounded-xl bg-noite p-3">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="userId" value={m.userId} />
              <div className="mb-2 flex justify-between">
                <b>{m.name}</b>
                <span className="text-xs text-white/40">presença {rel.get(m.userId) ?? 100}%</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <select name="kind" defaultValue={m.kind} className="input px-2 py-1.5 text-sm">
                  <option value="diarista">Diarista</option>
                  <option value="mensalista">Mensalista</option>
                </select>
                <select name="position" defaultValue={m.position} className="input px-2 py-1.5 text-sm">
                  <option value="linha">Linha</option>
                  <option value="goleiro">Goleiro</option>
                </select>
                <input name="rating" type="number" min={1} max={10} defaultValue={m.rating} className="input px-2 py-1.5 text-sm" title="nota" />
                <select name="role" defaultValue={m.role} className="input px-2 py-1.5 text-sm" disabled={m.userId === user.id}>
                  <option value="membro">Membro</option>
                  <option value="admin">Admin</option>
                </select>
                {m.userId === user.id && <input type="hidden" name="role" value="admin" />}
              </div>
              <Submit className="btn-sec btn-sm mt-2">Salvar</Submit>
            </form>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="h2"><Settings size={20} /> Pelada</h2>
        <form action={updateGroupAction} className="space-y-4">
          <input type="hidden" name="slug" value={slug} />
          <GroupFields g={group} />
          <Submit className="btn w-full">Salvar configurações</Submit>
        </form>
      </section>
    </div>
  );
}
