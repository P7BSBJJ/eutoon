// Texto da lista no formato que os grupos de pelada já usam no WhatsApp

export interface ListEntry {
  name: string;
  kind: "mensalista" | "diarista" | "convidado";
  position: "linha" | "goleiro";
  paid: boolean;
}

export interface ListGame {
  title: string;
  startsAt: Date;
  location: string;
  priceCents: number;
  slots: number;
  deadlineHours: number;
  link: string;
}

export const brl = (cents: number) =>
  "R$ " + (cents / 100).toFixed(2).replace(".", ",");

function status(e: ListEntry) {
  if (e.kind === "mensalista") return " Ⓜ️";
  return e.paid ? " ✅" : " ❌";
}

function label(e: ListEntry) {
  return e.kind === "convidado" ? `${e.name} (convidado)` : e.name;
}

export function formatList(
  game: ListGame,
  confirmed: ListEntry[],
  waitlist: ListEntry[],
  timeZone = "America/Sao_Paulo",
): string {
  const day = game.startsAt.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    timeZone,
  });
  const hour = game.startsAt.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
  const line = confirmed.filter((e) => e.position === "linha");
  const gk = confirmed.filter((e) => e.position === "goleiro");

  const out: string[] = [];
  out.push(`*${game.title.toUpperCase()}*`);
  out.push(`${day[0].toUpperCase()}${day.slice(1)} às ${hour}`);
  out.push(`${game.location} · ${brl(game.priceCents)}`);
  out.push("");
  out.push("Mensalista Ⓜ️ | Pago ✅ | A pagar ❌");
  out.push(`Confirme e pague aqui: ${game.link}`);
  out.push(`Desistência sem custo até ${game.deadlineHours}h antes`);
  out.push("");
  for (let i = 0; i < game.slots; i++) {
    const e = line[i];
    out.push(e ? `${i + 1} - ${label(e)}${status(e)}` : `${i + 1} - `);
  }
  out.push("");
  out.push("*GOLEIROS*");
  if (gk.length === 0) out.push("G1 - ");
  gk.forEach((e, i) => out.push(`G${i + 1} - ${label(e)}${status(e)}`));
  if (waitlist.length) {
    out.push("");
    out.push("*LISTA DE ESPERA*");
    waitlist.forEach((e, i) => out.push(`${i + 1} - ${label(e)}`));
  }
  out.push("");
  out.push("_Eu Tô On!_");
  return out.join("\n");
}
