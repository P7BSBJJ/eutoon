"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Copy, MessageCircle, MoreHorizontal } from "lucide-react";

export function CopyButton({ text, label = "Copiar", className = "btn" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
    >
      {done ? <Check size={18} /> : <Copy size={18} />}
      {done ? "Copiado" : label}
    </button>
  );
}

export function ShareWhatsApp({ text, className = "btn" }: { text: string; className?: string }) {
  return (
    <a className={className} href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
      <MessageCircle size={18} /> Enviar no WhatsApp
    </a>
  );
}

/** botão de envio com confirmação e estado de carregando */
export function Submit({
  children,
  confirm,
  className = "btn",
  name,
  value,
}: {
  children: React.ReactNode;
  confirm?: string;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-busy={pending}
      className={className}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" /> : children}
    </button>
  );
}

/**
 * O interruptor da marca: confirmar presença = ligar.
 * on=false: toque liga (entra na lista). on=true: toque desliga (sai da lista, com confirmação).
 */
export function OnSwitch({ on, label, sub, confirm }: { on: boolean; label: string; sub?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  const lit = pending ? !on : on;
  return (
    <button
      type="submit"
      disabled={pending}
      aria-pressed={on}
      className="group flex w-full items-center gap-4 text-left"
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      <span
        className={`relative h-12 w-[5.5rem] shrink-0 rounded-full shadow-inner transition-colors duration-300 ${lit ? "bg-lima" : "bg-noite-3"}`}
      >
        <span
          className={`absolute left-3 top-1/2 -translate-y-1/2 font-display text-lg leading-none text-noite transition-opacity duration-300 ${lit ? "opacity-100" : "opacity-0"}`}
        >
          ON
        </span>
        <span
          className={`absolute left-1 top-1 h-10 w-10 transition-transform duration-300 ease-out ${lit ? "translate-x-[2.5rem] rotate-[200deg]" : ""}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ball.svg" alt="" className="h-10 w-10 drop-shadow-md" />
        </span>
      </span>
      <span>
        <span className="block font-display text-2xl uppercase leading-none">{label}</span>
        {sub && <span className="mt-1 block text-sm text-white/60">{sub}</span>}
      </span>
    </button>
  );
}

/** menu "mais opções" que fecha ao tocar fora ou ao executar uma ação */
export function RowMenu({ children }: { children: React.ReactNode }) {
  return (
    <details
      className="relative"
      ref={(el) => {
        if (!el) return;
        const close = (ev: PointerEvent) => {
          if (el.open && !el.contains(ev.target as Node)) el.open = false;
        };
        document.addEventListener("pointerdown", close);
        return () => document.removeEventListener("pointerdown", close);
      }}
      onSubmit={(ev) => {
        const el = ev.currentTarget;
        setTimeout(() => (el.open = false), 0);
      }}
    >
      <summary className="btn-sec btn-sm list-none" aria-label="Mais opções">
        <MoreHorizontal size={18} />
      </summary>
      <div className="absolute right-0 z-10 mt-1 flex w-48 flex-col gap-1 rounded-xl bg-noite-3 p-2 shadow-xl ring-1 ring-white/10">{children}</div>
    </details>
  );
}
