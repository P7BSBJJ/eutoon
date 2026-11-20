import { describe, expect, it } from "vitest";
import { decideLeave, reliability, hasRoom } from "./rules";
import { drawTeams, teamStrength } from "./teams";
import { formatList } from "./whatsapp";
import { crc16, staticPix } from "./pix";
import { parseSumula, matchPlayer, points } from "./sumula";

describe("desistência", () => {
  const base = { deadlineHours: 24, paid: true, kind: "diarista" as const };
  it("dentro do prazo: crédito na hora e promove espera", () => {
    const d = decideLeave({ ...base, hoursToGame: 30, waitlistHasSomeone: true });
    expect(d).toMatchObject({ outcome: "no_prazo", creditNow: true, promoteWaitlist: true, countsAsLateDropout: false });
  });
  it("fora do prazo com espera: repasse, crédito só quando substituto pagar", () => {
    const d = decideLeave({ ...base, hoursToGame: 3, waitlistHasSomeone: true });
    expect(d).toMatchObject({ outcome: "repasse", creditNow: false, creditWhenReplacementPays: true });
  });
  it("fora do prazo sem espera: perde e conta furo", () => {
    const d = decideLeave({ ...base, hoursToGame: 3, waitlistHasSomeone: false });
    expect(d).toMatchObject({ outcome: "perdeu", creditNow: false, countsAsLateDropout: true });
  });
  it("mensalista nunca gera crédito", () => {
    expect(decideLeave({ ...base, kind: "mensalista", hoursToGame: 48, waitlistHasSomeone: false }).creditNow).toBe(false);
  });
  it("quem não pagou não ganha crédito", () => {
    expect(decideLeave({ ...base, paid: false, hoursToGame: 48, waitlistHasSomeone: false }).creditNow).toBe(false);
  });
  it("índice de presença", () => {
    expect(reliability(0, 0)).toBe(100);
    expect(reliability(20, 1)).toBe(95);
  });
  it("vagas", () => {
    expect(hasRoom({ linha: 19, goleiro: 2 }, { slots: 20, gkSlots: 2 }, "linha")).toBe(true);
    expect(hasRoom({ linha: 19, goleiro: 2 }, { slots: 20, gkSlots: 2 }, "goleiro")).toBe(false);
  });
});

describe("sorteio", () => {
  const ps = Array.from({ length: 12 }, (_, i) => ({ id: String(i + 1), name: `J${i + 1}`, rating: (i % 5) + 3 }));
  const gks = [{ id: "g1", name: "G1", rating: 5 }, { id: "g2", name: "G2", rating: 5 }];
  it("ordem de chegada: ímpares no time 1, pares no time 2", () => {
    const r = drawTeams(ps, gks, "ordem");
    expect(r.team1.map((p) => p.name)).toEqual(["J1", "J3", "J5", "J7", "J9"]);
    expect(r.team2.map((p) => p.name)).toEqual(["J2", "J4", "J6", "J8", "J10"]);
    expect(r.next.map((p) => p.name)).toEqual(["J11", "J12"]);
    expect(r.gk1?.name).toBe("G1");
  });
  it("equilibrado: diferença de força pequena", () => {
    const r = drawTeams(ps, gks, "equilibrado");
    expect(r.team1).toHaveLength(5);
    expect(Math.abs(teamStrength(r.team1) - teamStrength(r.team2))).toBeLessThanOrEqual(3);
  });
});

describe("lista do WhatsApp", () => {
  it("formata como os grupos usam", () => {
    const t = formatList(
      { title: "Fut Sexta", startsAt: new Date("2026-11-27T20:00:00Z"), location: "Arena X", priceCents: 3200, slots: 3, deadlineHours: 24, link: "https://eutoon.com.br/j/1" },
      [
        { name: "Yuri", kind: "diarista", position: "linha", paid: true },
        { name: "Márcio Jr", kind: "mensalista", position: "linha", paid: false },
        { name: "Paulo", kind: "diarista", position: "goleiro", paid: false },
      ],
      [{ name: "Titio", kind: "convidado", position: "linha", paid: false }],
    );
    expect(t).toContain("1 - Yuri ✅");
    expect(t).toContain("2 - Márcio Jr Ⓜ️");
    expect(t).toContain("3 - \n");
    expect(t).toContain("G1 - Paulo ❌");
    expect(t).toContain("1 - Titio (convidado)");
    expect(t).toContain("R$ 32,00");
    expect(t).toContain("17:00"); // 20h UTC = 17h em São Paulo
  });
});

describe("pix copia e cola", () => {
  it("crc16 CCITT-FALSE", () => expect(crc16("123456789")).toBe("29B1"));
  it("gera payload válido com valor", () => {
    const p = staticPix({ key: "12345678000100", name: "João Organizador", city: "São Paulo", amountCents: 3200, txid: "JOGO1" });
    expect(p.startsWith("000201")).toBe(true);
    expect(p).toContain("br.gov.bcb.pix");
    expect(p).toContain("540532.00");
    expect(p).toContain("5916Joao Organizador");
    expect(p.slice(-4)).toBe(crc16(p.slice(0, -4)));
  });
});

describe("súmula", () => {
  it("entende os jeitos comuns de anotar", () => {
    const r = parseSumula("Yuri 2 gols 1 assist\nSilas ⚽⚽ 🅰️\nbreno 1g 2a\n4 - Joel 3\nyuri 1 gol");
    const by = Object.fromEntries(r.map((x) => [x.raw.toLowerCase(), x]));
    expect(by["yuri"]).toMatchObject({ goals: 3, assists: 1 });
    expect(by["silas"]).toMatchObject({ goals: 2, assists: 1 });
    expect(by["breno"]).toMatchObject({ goals: 1, assists: 2 });
    expect(by["joel"]).toMatchObject({ goals: 3, assists: 0 });
  });
  it("casa nomes com erro e acento, e não chuta em empate", () => {
    const players = [
      { id: "1", name: "Márcio Júnior" },
      { id: "2", name: "Guilherme Souza" },
      { id: "3", name: "Bruno Carvalho" },
      { id: "4", name: "Bruno Lima" },
    ];
    expect(matchPlayer("marcio", players)?.id).toBe("1");
    expect(matchPlayer("Guilerme", players)?.id).toBe("2");
    expect(matchPlayer("bruno", players)).toBeNull();
    expect(matchPlayer("bruno carvalho", players)?.id).toBe("3");
    expect(matchPlayer("Fulano", players)).toBeNull();
  });
  it("pontos", () => expect(points(2, 1)).toBe(5));
});
