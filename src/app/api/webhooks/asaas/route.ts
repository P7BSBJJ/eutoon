import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { confirmPayment } from "@/lib/pelada";

// Webhook do Asaas: configure no painel do Asaas a URL https://SEU_DOMINIO/api/webhooks/asaas
// e o mesmo token em ASAAS_WEBHOOK_TOKEN. Eventos usados: PAYMENT_RECEIVED e PAYMENT_CONFIRMED.

function sameToken(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(req: Request) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  const got = req.headers.get("asaas-access-token") ?? "";
  if (!expected || !sameToken(got, expected)) return new Response("unauthorized", { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    event?: string;
    payment?: { id?: string; externalReference?: string };
  } | null;
  if (!body?.event || !body.payment) return Response.json({ ignored: true });
  if (body.event !== "PAYMENT_RECEIVED" && body.event !== "PAYMENT_CONFIRMED") return Response.json({ ignored: true });

  const db = await getDb();
  const ref = body.payment.id ?? "";
  const p =
    (ref && (await db.query.payments.findFirst({ where: eq(schema.payments.providerRef, ref) }))) ||
    (body.payment.externalReference &&
      (await db.query.payments.findFirst({ where: eq(schema.payments.id, body.payment.externalReference) })));
  if (!p) return Response.json({ ignored: true, reason: "pagamento desconhecido" });
  await confirmPayment(p.id, "webhook");
  return Response.json({ ok: true });
}
