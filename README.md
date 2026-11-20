# Eu Tô On! ⚽

App web (abre pelo link no WhatsApp, sem instalar) para organizar pelada: lista, Pix, lista de espera,
regra de desistência, sorteio de times, gols/assistências, rankings e vaquinhas.

## Rodar no computador

```bash
npm install
npm run dev
```

Abra http://localhost:3000. Em desenvolvimento o código de login aparece na tela e o banco é um
Postgres embutido salvo em `.data/` (apague a pasta para zerar).

Testes das regras (desistência, sorteio, lista do WhatsApp, Pix, súmula):

```bash
npx vitest run
```

## Como funciona

| Regra | Comportamento |
|---|---|
| Confirmar | "Tô on!" entra na lista; se lotou, vai pra lista de espera |
| Mensalista | Entra confirmado automaticamente em todo jogo novo, já como pago (Ⓜ️) |
| Pagar | Pix copia-e-cola gerado na chave do organizador, já com o valor. Jogador toca "Já paguei" e o organizador confirma com 1 toque. Com Asaas configurado, a confirmação é automática |
| Crédito | Se o jogador tem crédito no grupo, o pagamento usa o crédito primeiro |
| Sair no prazo | Valor pago vira crédito; 1º da espera sobe |
| Sair fora do prazo com espera | Vaga repassada; quem saiu ganha crédito quando o substituto pagar |
| Sair fora do prazo sem espera | Perde o valor e conta como furo no índice de presença |
| Sorteio | Ordem de chegada (check-in "📍 Chegou"; ímpares × pares), equilibrado (nota 1–10) ou aleatório |
| Súmula | Organizador cola o que foi anotado ("Yuri 2 gols 1 assist", "Silas ⚽⚽ 🅰️") e confere a tabela |
| Ranking | gol = 2, assistência = 1, voto de craque = 3; semana / mês / ano / geral |

## Publicar (produção)

1. Banco Postgres: crie um projeto no [Neon](https://neon.tech) ou [Supabase](https://supabase.com) e copie a connection string para `DATABASE_URL`. As tabelas são criadas sozinhas na primeira execução (`drizzle/`).
2. Hospedagem: importe o repositório na [Vercel](https://vercel.com), configure as variáveis do `.env.example` e aponte o domínio `eutoon.com.br`.
3. **Login por SMS/WhatsApp é obrigatório antes de abrir ao público** (ver Pendências). Para um piloto fechado com amigos, `ALLOW_SCREEN_OTP=1` permite usar o código na tela.

## Pendências antes de abrir ao público

- [ ] Envio do código de login por WhatsApp (Cloud API) ou SMS (Twilio/Zenvia) — `src/lib/auth.ts`, função `deliverOtp`
- [ ] Testar o Pix automático no sandbox do Asaas (código pronto em `src/lib/payments.ts`, não testado contra a API real) e cadastrar a carteira (walletId) de cada organizador
- [ ] Avisos automáticos (lembrete 48h/3h, "abriu vaga pra você") por WhatsApp/push
- [ ] Leitura da súmula por foto com IA de visão
- [ ] Política de privacidade e termos de uso (LGPD: o app guarda nome, celular e CPF quando usa Asaas)
- [ ] Rate limit no pedido de código de login

## Estrutura

- `src/lib/domain/` — regras puras + testes (`domain.test.ts`)
- `src/lib/pelada.ts` — operações (grupos, jogos, lista, pagamentos, créditos, estatísticas)
- `src/lib/payments.ts` — Pix estático (BR Code) e Asaas
- `src/app/` — telas (Next.js App Router + Server Actions)
- `src/db/schema.ts` — tabelas (Drizzle ORM)
