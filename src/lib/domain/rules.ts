// Regras de desistência e lista de espera — funções puras (sem banco), testadas em rules.test.ts

export type Kind = "mensalista" | "diarista" | "convidado";
export type Position = "linha" | "goleiro";

export type LeaveOutcome =
  /** Saiu dentro do prazo. Se tinha pago, o valor vira crédito. */
  | "no_prazo"
  /** Saiu fora do prazo e havia alguém na espera: a vaga foi repassada. Recebe crédito quando o substituto pagar. */
  | "repasse"
  /** Saiu fora do prazo e ninguém assumiu: o valor fica com a pelada. */
  | "perdeu";

export interface LeaveInput {
  hoursToGame: number;
  deadlineHours: number;
  paid: boolean;
  kind: Kind;
  waitlistHasSomeone: boolean;
}

export interface LeaveDecision {
  outcome: LeaveOutcome;
  /** crédito imediato (centavos-multiplicador: 1 = valor do jogo) */
  creditNow: boolean;
  /** crédito só quando o substituto pagar */
  creditWhenReplacementPays: boolean;
  promoteWaitlist: boolean;
  /** conta como furo no índice de presença */
  countsAsLateDropout: boolean;
}

export function isWithinDeadline(hoursToGame: number, deadlineHours: number) {
  return hoursToGame >= deadlineHours;
}

export function decideLeave(i: LeaveInput): LeaveDecision {
  const refundable = i.paid && i.kind !== "mensalista";
  if (isWithinDeadline(i.hoursToGame, i.deadlineHours)) {
    return {
      outcome: "no_prazo",
      creditNow: refundable,
      creditWhenReplacementPays: false,
      promoteWaitlist: i.waitlistHasSomeone,
      countsAsLateDropout: false,
    };
  }
  if (i.waitlistHasSomeone) {
    return {
      outcome: "repasse",
      creditNow: false,
      creditWhenReplacementPays: refundable,
      promoteWaitlist: true,
      countsAsLateDropout: false,
    };
  }
  return {
    outcome: "perdeu",
    creditNow: false,
    creditWhenReplacementPays: false,
    promoteWaitlist: false,
    countsAsLateDropout: true,
  };
}

/** Índice de presença: % de confirmações que não viraram furo de última hora. */
export function reliability(confirmations: number, lateDropouts: number) {
  if (confirmations <= 0) return 100;
  return Math.max(0, Math.round(((confirmations - lateDropouts) / confirmations) * 100));
}

export function hasRoom(
  current: { linha: number; goleiro: number },
  limits: { slots: number; gkSlots: number },
  position: Position,
) {
  return position === "goleiro" ? current.goleiro < limits.gkSlots : current.linha < limits.slots;
}
