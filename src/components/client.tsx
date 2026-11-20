"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

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
      {done ? "Copiado! ✅" : label}
    </button>
  );
}

export function ShareWhatsApp({ text, className = "btn" }: { text: string; className?: string }) {
  return (
    <a className={className} href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
      Mandar no WhatsApp
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
      className={className}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? "..." : children}
    </button>
  );
}

/** menu "⋯" que fecha ao tocar fora ou ao executar uma ação */
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
      <summary className="btn-sec btn-sm list-none">⋯</summary>
      <div className="absolute right-0 z-10 mt-1 flex w-44 flex-col gap-1 rounded-xl bg-noite-3 p-2 shadow-xl">{children}</div>
    </details>
  );
}
