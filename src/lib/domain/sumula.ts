// Lê a súmula (gols e assistências) escrita do jeito que a galera anota

export interface SumulaLine {
  raw: string; // nome como estava escrito
  goals: number;
  assists: number;
}

export const normalize = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function parseSumula(text: string): SumulaLine[] {
  const acc = new Map<string, SumulaLine>();
  for (let line of text.split(/\n|;/)) {
    line = line.trim().replace(/^\d+\s*[-.)]\s*/, ""); // remove "1 - " de listas
    if (!line) continue;
    const nameMatch = line.match(/^[^\d⚽🅰:\-–=]+/u);
    const name = (nameMatch?.[0] ?? "")
      .replace(/\b(gols?|assists?|assist[eê]ncias?|ass|g|a)\b/gi, "")
      .trim();
    if (!name) continue;
    let goals = 0;
    let assists = 0;
    const g = line.match(/(\d+)\s*(gols?|g)\b/i);
    const a = line.match(/(\d+)\s*(assist\w*|ass|a)\b/i);
    if (g) goals += Number(g[1]);
    if (a) assists += Number(a[1]);
    goals += (line.match(/⚽/gu) || []).length;
    assists += (line.match(/🅰/gu) || []).length;
    if (!g && !a && !/⚽|🅰/u.test(line)) {
      const n = line.match(/(\d+)/);
      if (n) goals += Number(n[1]); // "Yuri 2" = 2 gols
    }
    const k = normalize(name);
    const prev = acc.get(k) ?? { raw: name, goals: 0, assists: 0 };
    prev.goals += goals;
    prev.assists += assists;
    acc.set(k, prev);
  }
  return [...acc.values()];
}

function lev(a: string, b: string) {
  const m = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++)
    for (let j = 1; j <= a.length; j++)
      m[i][j] = Math.min(
        m[i - 1][j] + 1,
        m[i][j - 1] + 1,
        m[i - 1][j - 1] + (b[i - 1] === a[j - 1] ? 0 : 1),
      );
  return m[b.length][a.length];
}

/** Casa um nome escrito à mão com o jogador cadastrado. Retorna null se não tiver certeza. */
export function matchPlayer<T extends { id: string; name: string }>(
  written: string,
  players: T[],
): T | null {
  const n = normalize(written);
  if (!n) return null;
  let best: T | null = null;
  let bestD = Infinity;
  let tie = false;
  for (const p of players) {
    const full = normalize(p.name);
    const first = full.split(" ")[0];
    let d = Math.min(lev(n, full), lev(n, first));
    if (n.length > 2 && full.startsWith(n)) d = 0;
    if (d < bestD) {
      bestD = d;
      best = p;
      tie = false;
    } else if (d === bestD) tie = true;
  }
  const tolerance = n.length <= 4 ? 1 : 2;
  return best && bestD <= tolerance && !tie ? best : null;
}

export const points = (goals: number, assists: number) => goals * 2 + assists;
