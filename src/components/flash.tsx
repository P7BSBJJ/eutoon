import { CheckCircle2, CircleAlert } from "lucide-react";

export function Flash({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const ok = typeof sp.ok === "string" ? sp.ok : null;
  const erro = typeof sp.erro === "string" ? sp.erro : null;
  if (!ok && !erro) return null;
  return (
    <div
      role="status"
      className={`mb-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${erro ? "bg-red-500/15 text-red-200" : "bg-lima/15 text-lima"}`}
    >
      {erro ? <CircleAlert size={18} className="mt-px shrink-0" /> : <CheckCircle2 size={18} className="mt-px shrink-0" />}
      <span>{erro ?? ok}</span>
    </div>
  );
}
