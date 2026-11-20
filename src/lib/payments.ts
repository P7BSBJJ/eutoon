import "server-only";
import { staticPix } from "@/lib/domain/pix";
import { AppError } from "@/lib/errors";

// Provedores de pagamento:
//  - pix_estatico: Pix copia-e-cola na chave do organizador. O jogador avisa "já paguei"
//    e o organizador confirma com 1 toque (igual hoje, só que organizado).
//  - asaas: cobrança Pix dinâmica; o pagamento é confirmado sozinho via webhook e o valor
//    é repassado (split) para a carteira Asaas do organizador.

export interface ChargeInput {
  paymentId: string;
  amountCents: number;
  description: string;
  payer: { name: string; phone: string; cpf?: string | null };
  group: { pixKey: string; pixName: string; pixCity: string; asaasWalletId?: string | null };
}

export interface ChargeResult {
  provider: "pix_estatico" | "asaas";
  providerRef: string | null;
  pixCode: string;
}

export function asaasEnabled(group: { asaasWalletId?: string | null }) {
  return Boolean(process.env.ASAAS_API_KEY && group.asaasWalletId);
}

export async function createCharge(i: ChargeInput): Promise<ChargeResult> {
  if (asaasEnabled(i.group)) return asaasCharge(i);
  if (!i.group.pixKey) throw new AppError("O organizador ainda não cadastrou a chave Pix do grupo.");
  return {
    provider: "pix_estatico",
    providerRef: null,
    pixCode: staticPix({
      key: i.group.pixKey,
      name: i.group.pixName || "Organizador",
      city: i.group.pixCity || "Brasil",
      amountCents: i.amountCents,
      txid: i.paymentId.replace(/-/g, "").slice(0, 25),
      description: i.description,
    }),
  };
}

// ---------------- Asaas ----------------
// Documentação: https://docs.asaas.com — NÃO testado contra a API real neste ambiente.
const ASAAS_URL = process.env.ASAAS_URL ?? "https://api-sandbox.asaas.com/v3";

async function asaas<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(ASAAS_URL + path, {
    ...init,
    headers: {
      "content-type": "application/json",
      access_token: process.env.ASAAS_API_KEY!,
      "user-agent": "eutoon",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Asaas ${path}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function asaasCharge(i: ChargeInput): Promise<ChargeResult> {
  if (!i.payer.cpf) throw new AppError("Informe seu CPF no seu perfil para pagar pelo Pix automático.");
  const customer = await asaas<{ id: string }>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: i.payer.name,
      cpfCnpj: i.payer.cpf,
      mobilePhone: i.payer.phone.replace(/^55/, ""),
      externalReference: i.payer.phone,
    }),
  });
  const fee = Number(process.env.PLATFORM_FEE_CENTS ?? 0) / 100;
  const value = i.amountCents / 100;
  const payment = await asaas<{ id: string }>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: customer.id,
      billingType: "PIX",
      value,
      dueDate: new Date().toISOString().slice(0, 10),
      description: i.description,
      externalReference: i.paymentId,
      // repassa ao organizador tudo menos a taxa da plataforma
      split: [{ walletId: i.group.asaasWalletId, fixedValue: Math.max(0, value - fee) }],
    }),
  });
  const qr = await asaas<{ payload: string }>(`/payments/${payment.id}/pixQrCode`);
  return { provider: "asaas", providerRef: payment.id, pixCode: qr.payload };
}
