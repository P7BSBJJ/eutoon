import { LoginForm } from "./form";

export default async function Entrar({ searchParams }: PageProps<"/entrar">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  return (
    <div className="pt-6">
      <h1 className="mb-1 text-3xl font-black italic">Bora entrar ⚽</h1>
      <p className="muted mb-6">Só o celular. Sem senha.</p>
      <LoginForm next={next} />
    </div>
  );
}
