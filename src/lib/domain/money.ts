/** Converte o que a pessoa digitou ("R$ 1.234,50", "20", "20,5", "20.50", "1.200") em centavos. */
export function parseMoney(v: string): number {
  let s = v.replace(/[^\d.,]/g, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", "."); // formato brasileiro: ponto = milhar
  else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, ""); // "1.200" = mil e duzentos
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}
