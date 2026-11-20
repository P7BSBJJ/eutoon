"use client";

import { useState } from "react";
import { matchPlayer, parseSumula } from "@/lib/domain/sumula";
import { Submit } from "@/components/client";
import { saveStatsAction } from "@/app/actions";

type P = { id: string; name: string; goals: number; assists: number };

export function SumulaForm({ slug, gameId, players }: { slug: string; gameId: string; players: P[] }) {
  const [vals, setVals] = useState<Record<string, { g: number; a: number }>>(
    Object.fromEntries(players.map((p) => [p.id, { g: p.goals, a: p.assists }])),
  );
  const [text, setText] = useState("");
  const [unknown, setUnknown] = useState<string[]>([]);

  function read() {
    const lines = parseSumula(text);
    const next = { ...vals };
    const miss: string[] = [];
    for (const l of lines) {
      const p = matchPlayer(l.raw, players);
      if (!p) miss.push(l.raw);
      else next[p.id] = { g: (next[p.id]?.g ?? 0) + l.goals, a: (next[p.id]?.a ?? 0) + l.assists };
    }
    setVals(next);
    setUnknown(miss);
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="label">Cole o que foi anotado (opcional)</label>
        <textarea
          className="input min-h-24"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Yuri 2 gols 1 assist\nSilas ⚽⚽ 🅰️\nbreno 1g 2a"}
        />
        <button type="button" className="btn-sec btn-sm mt-2" onClick={read}>
          🤖 Preencher a tabela
        </button>
        {unknown.length > 0 && (
          <p className="mt-2 text-sm text-amarelo">Não reconheci: {unknown.join(", ")}. Preencha esses na mão 👇</p>
        )}
      </div>
      <form action={saveStatsAction} className="space-y-1">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="gameId" value={gameId} />
        <div className="grid grid-cols-[1fr_4rem_4rem] gap-2 text-xs font-bold text-white/50">
          <span>Jogador</span>
          <span className="text-center">⚽ Gols</span>
          <span className="text-center">🅰️ Assist.</span>
        </div>
        {players.map((p) => (
          <div key={p.id} className="grid grid-cols-[1fr_4rem_4rem] items-center gap-2">
            <span className="truncate">{p.name}</span>
            <input
              name={`g_${p.id}`}
              type="number"
              min={0}
              className="input px-2 py-1.5 text-center"
              value={vals[p.id]?.g ?? 0}
              onChange={(e) => setVals({ ...vals, [p.id]: { ...vals[p.id], g: Number(e.target.value) } })}
            />
            <input
              name={`a_${p.id}`}
              type="number"
              min={0}
              className="input px-2 py-1.5 text-center"
              value={vals[p.id]?.a ?? 0}
              onChange={(e) => setVals({ ...vals, [p.id]: { ...vals[p.id], a: Number(e.target.value) } })}
            />
          </div>
        ))}
        <Submit className="btn mt-3 w-full">Salvar súmula</Submit>
      </form>
    </div>
  );
}
