"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** Barra de progresso no topo + some com o aviso antigo assim que um formulário é enviado. */
function Bar() {
  const route = usePathname() + "?" + useSearchParams().toString();
  const routeRef = useRef(route);
  // rota em que o envio começou; ao mudar de rota, a barra some sozinha
  const [busyAt, setBusyAt] = useState<string | null>(null);
  const busy = busyAt === route;

  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  // reflete o estado no <html> (o CSS esconde o aviso antigo)
  useEffect(() => {
    if (busy) document.documentElement.setAttribute("data-busy", "");
    else document.documentElement.removeAttribute("data-busy");
  }, [busy]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      if (e.defaultPrevented || form.hasAttribute("data-nobar")) return;
      const at = routeRef.current;
      setBusyAt(at);
      clearTimeout(timer);
      const started = Date.now();
      let sawPending = false;
      // termina quando o botão que estava processando volta ao normal (ação que volta pra mesma página)
      const tick = () => {
        const pending = document.querySelector('[aria-busy="true"]') !== null;
        if (pending) sawPending = true;
        if ((sawPending && !pending) || Date.now() - started > 15000) return setBusyAt(null);
        timer = setTimeout(tick, 150);
      };
      timer = setTimeout(tick, 150);
    };
    document.addEventListener("submit", onSubmit);
    return () => {
      document.removeEventListener("submit", onSubmit);
      clearTimeout(timer);
    };
  }, []);

  if (!busy) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-lima/20" role="progressbar" aria-label="Carregando">
      <div className="h-full w-1/3 animate-[barra_1s_ease-in-out_infinite] bg-lima" />
    </div>
  );
}

export function PendingBar() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
