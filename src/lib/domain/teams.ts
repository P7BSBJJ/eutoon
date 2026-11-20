// Sorteio de times

export interface DrawPlayer {
  id: string;
  name: string;
  rating: number; // 1..10
}

export type DrawMode = "ordem" | "equilibrado" | "aleatorio";

export interface DrawResult {
  team1: DrawPlayer[];
  team2: DrawPlayer[];
  gk1?: DrawPlayer;
  gk2?: DrawPlayer;
  next: DrawPlayer[]; // quem fica de fora / próximo time
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * @param line jogadores de linha na ordem de chegada (check-in) ou da lista
 * @param perTeam jogadores de linha por time (ex.: 5)
 */
export function drawTeams(
  line: DrawPlayer[],
  goalkeepers: DrawPlayer[],
  mode: DrawMode,
  perTeam = 5,
  rnd: () => number = Math.random,
): DrawResult {
  const playing = Math.min(line.length, perTeam * 2);
  let pool: DrawPlayer[];
  let next: DrawPlayer[];
  if (mode === "ordem") {
    pool = line.slice(0, playing);
    next = line.slice(playing);
  } else if (mode === "aleatorio") {
    const s = shuffle(line, rnd);
    pool = s.slice(0, playing);
    next = s.slice(playing);
  } else {
    // equilibrado: quem chegou primeiro joga; dentro deles, divide por nota (serpentina)
    pool = line.slice(0, playing).sort((a, b) => b.rating - a.rating);
    next = line.slice(playing);
  }

  const team1: DrawPlayer[] = [];
  const team2: DrawPlayer[] = [];
  pool.forEach((p, i) => {
    if (mode === "equilibrado") {
      // serpentina: 1,2,2,1,1,2,2,1...
      const round = Math.floor(i / 2);
      const first = i % 2 === 0;
      (round % 2 === 0 ? (first ? team1 : team2) : first ? team2 : team1).push(p);
    } else {
      // ordem de chegada: ímpares (1º,3º,5º...) no time 1, pares no time 2
      (i % 2 === 0 ? team1 : team2).push(p);
    }
  });

  const gks = mode === "ordem" ? goalkeepers : shuffle(goalkeepers, rnd);
  return { team1, team2, gk1: gks[0], gk2: gks[1], next };
}

export const teamStrength = (t: DrawPlayer[]) => t.reduce((s, p) => s + p.rating, 0);
