export function Flash({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const ok = typeof sp.ok === "string" ? sp.ok : null;
  const erro = typeof sp.erro === "string" ? sp.erro : null;
  if (!ok && !erro) return null;
  return (
    <div
      role="status"
      className={`mb-4 rounded-xl px-4 py-3 text-sm font-semibold ${erro ? "bg-red-500/15 text-red-200" : "bg-emerald-500/15 text-emerald-200"}`}
    >
      {erro ?? ok}
    </div>
  );
}
