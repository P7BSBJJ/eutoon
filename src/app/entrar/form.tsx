"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "../actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { step: "phone" });

  return (
    <form action={action} className="card space-y-4" data-nobar>
      <input type="hidden" name="next" value={next} />
      {state.step === "phone" ? (
        <div>
          <label className="label" htmlFor="phone">Celular com DDD</label>
          <input id="phone" name="phone" className="input text-lg" inputMode="tel" autoComplete="tel" placeholder="(11) 99999-8888" required />
        </div>
      ) : (
        <>
          {state.devCode && (
            <div className="rounded-xl bg-amarelo/15 p-3 text-sm text-amarelo">
              Modo teste: seu código é <b className="text-lg tracking-widest">{state.devCode}</b>
              <br />
              (no app publicado ele chega por WhatsApp/SMS)
            </div>
          )}
          {state.isNew && (
            <div>
              <label className="label" htmlFor="name">Seu nome e sobrenome</label>
              <input id="name" name="name" className="input" placeholder="Ex.: Bruno Carvalho" required minLength={2} />
            </div>
          )}
          <div>
            <label className="label" htmlFor="code">Código de 6 dígitos</label>
            <input id="code" name="code" className="input text-center text-2xl tracking-[0.5em]" inputMode="numeric" maxLength={6} required autoFocus />
          </div>
        </>
      )}
      {state.error && <p className="text-sm font-semibold text-red-300">{state.error}</p>}
      <button className="btn w-full py-3" disabled={pending}>
        {pending ? "..." : state.step === "phone" ? "Receber código" : "Tô on! Entrar"}
      </button>
      {state.step === "code" && (
        <button name="restart" value="1" className="w-full text-sm text-white/50 underline" formNoValidate>
          trocar número
        </button>
      )}
    </form>
  );
}
