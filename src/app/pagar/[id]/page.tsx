import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { currentUser } from "@/lib/auth";
import * as P from "@/lib/pelada";
import { brl } from "@/lib/url";
import { Flash } from "@/components/flash";
import { CopyButton, Submit } from "@/components/client";
import { informPaidAction } from "@/app/actions";
import { ArrowLeft, Check, CheckCircle2, Hourglass } from "@/components/icons";

export default async function Pagar({ params, searchParams }: PageProps<"/pagar/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await currentUser();
  if (!user) redirect(`/entrar?next=/pagar/${id}`);
  const data = await P.getPayment(id);
  if (!data || data.payment.userId !== user.id) notFound();
  const { payment, group, backTo } = data;
  const qr = await QRCode.toDataURL(payment.pixCode, { margin: 1, width: 560 });
  const auto = payment.provider === "asaas";

  return (
    <div className="space-y-4">
      <Flash sp={sp} />
      <Link href={backTo} className="back"><ArrowLeft size={16} /> voltar</Link>
      <div className="card space-y-4 text-center">
        <div className="muted">Pix para {group.pixName || group.name}</div>
        <div className="font-display text-5xl">{brl(payment.amountCents)}</div>

        {payment.status === "pago" ? (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-lima/15 p-4 text-lg font-bold text-lima"><CheckCircle2 size={22} /> Pagamento confirmado</div>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR Code Pix" className="mx-auto w-56 rounded-xl bg-white p-2" />
            <CopyButton text={payment.pixCode} label="Copiar Pix copia e cola" className="btn w-full py-3" />
            <p className="muted">Abra o app do seu banco, entre em Pix, escolha “Pix copia e cola” e cole o código.</p>
            {auto ? (
              <p className="text-sm text-lima">A confirmação é automática. Pode voltar pra lista depois de pagar.</p>
            ) : payment.status === "informado" ? (
              <div className="flex items-center gap-2 rounded-xl bg-amarelo/15 p-3 text-left text-sm text-amarelo">
                <Hourglass size={18} className="shrink-0" /> Você avisou que pagou. O organizador vai conferir e confirmar.
              </div>
            ) : (
              <form action={informPaidAction}>
                <input type="hidden" name="paymentId" value={payment.id} />
                <Submit className="btn-sec w-full py-3"><Check size={18} /> Já paguei</Submit>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
