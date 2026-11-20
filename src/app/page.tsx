import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { myGroups } from "@/lib/pelada";
import { logoutAction } from "./actions";
import { BallIcon, ChevronRight, PiggyBank, Plus, ShieldBan, Shuffle, Trophy, Wallet } from "@/components/icons";

const FEATURES = [
  [Wallet, "Confirmou, pagou", "Pix na hora, com baixa automática de quem pagou."],
  [ShieldBan, "Chega de furo", "Prazo de desistência, lista de espera e repasse de vaga."],
  [Shuffle, "Times na hora", "Por ordem de chegada, equilibrado ou aleatório."],
  [Trophy, "Gols e craque", "Artilheiro, garçom e craque da semana e do mês."],
  [PiggyBank, "Vaquinhas", "Churrasco, coletes e confraternização com prestação de contas."],
] as const;

export default async function Home() {
  const user = await currentUser();

  if (!user) {
    return (
      <div className="space-y-8 pt-6">
        <section className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Eu Tô On!" className="mx-auto mb-6 h-24 w-auto" />
          <h1 className="text-5xl">
            Sua pelada <span className="text-lima">organizada</span> num link só
          </h1>
          <p className="mt-4 text-white/70">
            Lista, Pix, lista de espera, times sorteados, gols e craque do mês. Sem bagunça no grupo.
          </p>
          <Link href="/entrar" className="btn mt-6 px-8 py-3 text-lg">
            Entrar com celular
          </Link>
        </section>
        <section className="grid gap-3">
          {FEATURES.map(([Icon, t, d]) => (
            <div key={t} className="card flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-lima/10 text-lima">
                <Icon size={22} />
              </span>
              <div>
                <div className="font-bold">{t}</div>
                <div className="muted">{d}</div>
              </div>
            </div>
          ))}
        </section>
      </div>
    );
  }

  const groups = await myGroups(user.id);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl">E aí, {user.name.split(" ")[0]}!</h1>
        <form action={logoutAction}>
          <button className="text-sm text-white/50 underline">sair</button>
        </form>
      </div>
      <Link href="/g/nova" className="btn w-full py-3">
        <Plus size={20} /> Criar uma pelada
      </Link>
      <h2 className="h2 mt-6">
        <BallIcon size={20} /> Minhas peladas
      </h2>
      {groups.length === 0 && (
        <p className="muted">Você ainda não está em nenhuma pelada. Peça o link pro organizador do seu grupo ou crie a sua.</p>
      )}
      <div className="grid gap-3">
        {groups.map(({ group, role }) => (
          <Link key={group.id} href={`/g/${group.slug}`} className="card flex items-center justify-between hover:ring-lima/40">
            <div>
              <div className="font-bold">{group.name}</div>
              <div className="muted">{group.location || "—"}</div>
            </div>
            <div className="flex items-center gap-2">
              {role === "admin" && <span className="tag bg-lima/15 text-lima">organizador</span>}
              <ChevronRight size={18} className="text-white/40" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
