import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { myGroups } from "@/lib/pelada";
import { logoutAction } from "./actions";

export default async function Home() {
  const user = await currentUser();

  if (!user) {
    return (
      <div className="space-y-6 pt-6">
        <section className="text-center">
          <h1 className="text-4xl font-black italic leading-tight">
            Sua pelada <span className="text-lima">organizada</span>
            <br />
            num link só.
          </h1>
          <p className="mt-3 text-white/70">
            Lista, Pix, lista de espera, times sorteados, gols e craque do mês. Sem bagunça no grupo.
          </p>
          <Link href="/entrar" className="btn mt-6 px-8 py-3 text-lg">
            Entrar com celular
          </Link>
        </section>
        <section className="grid gap-3">
          {[
            ["✅", "Confirmou, pagou", "Pix na hora, com baixa automática de quem pagou."],
            ["🚫", "Chega de furo", "Prazo de desistência, lista de espera e repasse de vaga."],
            ["⚽", "Times na hora", "Por ordem de chegada, equilibrado ou aleatório."],
            ["📊", "Gols e craque", "Artilheiro, garçom e craque da semana e do mês."],
            ["💰", "Vaquinhas", "Churrasco, coletes e confraternização com prestação de contas."],
          ].map(([i, t, d]) => (
            <div key={t} className="card flex gap-3">
              <div className="text-2xl">{i}</div>
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
        <h1 className="text-2xl font-black italic">E aí, {user.name.split(" ")[0]}! 👋</h1>
        <form action={logoutAction}>
          <button className="text-sm text-white/50 underline">sair</button>
        </form>
      </div>
      <Link href="/g/nova" className="btn w-full py-3">
        + Criar uma pelada
      </Link>
      <h2 className="h2 mt-6">Minhas peladas</h2>
      {groups.length === 0 && (
        <p className="muted">
          Você ainda não está em nenhuma pelada. Peça o link pro organizador do seu grupo ou crie a sua.
        </p>
      )}
      <div className="grid gap-3">
        {groups.map(({ group, role }) => (
          <Link key={group.id} href={`/g/${group.slug}`} className="card flex items-center justify-between hover:ring-lima/50">
            <div>
              <div className="font-bold">{group.name}</div>
              <div className="muted">{group.location || "—"}</div>
            </div>
            {role === "admin" && <span className="tag bg-amarelo text-noite">organizador</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
