import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listNotifications, markAllRead } from "@/lib/pelada";
import { fmtDate } from "@/lib/url";
import { Bell, ChevronRight } from "@/components/icons";

export default async function Notificacoes() {
  const user = await requireUser("/notificacoes");
  const items = await listNotifications(user.id);
  // ao abrir a página, tudo fica como lido (o destaque abaixo usa o estado anterior)
  if (items.some((n) => !n.readAt)) await markAllRead(user.id);

  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-3xl">
        <Bell size={26} className="text-lima" /> Notificações
      </h1>
      {items.length === 0 && <p className="muted">Nada por aqui ainda. Quando marcarem jogo, abrir vaga ou confirmarem seu pagamento, avisamos aqui.</p>}
      <ul className="space-y-2">
        {items.map((n) => (
          <li key={n.id}>
            <Link href={n.link} className={`card flex items-center gap-3 ${n.readAt ? "opacity-70" : "ring-lima/40"}`}>
              {!n.readAt && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-lima" aria-label="nova" />}
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{n.title}</span>
                {n.body && <span className="block text-sm text-white/65">{n.body}</span>}
                <span className="mt-0.5 block text-xs text-white/40">{fmtDate(n.createdAt)}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-white/40" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
