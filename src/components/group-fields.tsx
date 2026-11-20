type G = {
  name?: string;
  location?: string;
  priceCents?: number;
  slots?: number;
  gkSlots?: number;
  perTeam?: number;
  deadlineHours?: number;
  pixKey?: string;
  pixName?: string;
  pixCity?: string;
};

export function GroupFields({ g = {} }: { g?: G }) {
  return (
    <>
      <div>
        <label className="label">Nome da pelada</label>
        <input name="name" className="input" defaultValue={g.name} placeholder="Ex.: Fut de Sexta – Clube do Real" required />
      </div>
      <div>
        <label className="label">Local padrão</label>
        <input name="location" className="input" defaultValue={g.location} placeholder="Ex.: Arena Mauá – quadra 2" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Valor diarista (R$)</label>
          <input name="price" className="input" inputMode="decimal" defaultValue={g.priceCents !== undefined ? (g.priceCents / 100).toFixed(2).replace(".", ",") : "20,00"} />
        </div>
        <div>
          <label className="label">Prazo p/ desistir (h)</label>
          <input name="deadlineHours" type="number" className="input" defaultValue={g.deadlineHours ?? 24} min={0} max={168} />
        </div>
        <div>
          <label className="label">Vagas de linha</label>
          <input name="slots" type="number" className="input" defaultValue={g.slots ?? 20} min={2} max={60} />
        </div>
        <div>
          <label className="label">Vagas de goleiro</label>
          <input name="gkSlots" type="number" className="input" defaultValue={g.gkSlots ?? 2} min={0} max={6} />
        </div>
        <div>
          <label className="label">Jogadores de linha por time</label>
          <input name="perTeam" type="number" className="input" defaultValue={g.perTeam ?? 5} min={2} max={11} />
        </div>
      </div>
      <fieldset className="space-y-3 rounded-xl border border-white/10 p-3">
        <legend className="px-1 text-sm font-bold">💸 Onde o dinheiro cai</legend>
        <p className="muted">O Pix vai direto pra sua chave. O app gera o “copia e cola” já com o valor certo.</p>
        <div>
          <label className="label">Chave Pix</label>
          <input name="pixKey" className="input" defaultValue={g.pixKey} placeholder="CPF/CNPJ, e-mail, celular ou chave aleatória" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Nome do recebedor</label>
            <input name="pixName" className="input" defaultValue={g.pixName} placeholder="Como aparece no banco" />
          </div>
          <div>
            <label className="label">Cidade</label>
            <input name="pixCity" className="input" defaultValue={g.pixCity} placeholder="Ex.: Brasília" />
          </div>
        </div>
      </fieldset>
    </>
  );
}
