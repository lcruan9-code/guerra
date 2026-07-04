# Guerra — Presença Tática da Guild (WYD)

App mobile-first para confirmar presença nas guerras da guild e dar ao líder
visão tática da composição (classes/especializações) antes da batalha.

## Stack

Next.js 16 (App Router, TS) · Tailwind v4 · PostgreSQL (Neon) · Google OAuth · Vercel

## Rodando local

1. `cp .env.example .env.local` e preencher:
   - `DATABASE_URL` — Postgres (Neon)
   - `JWT_SECRET` — `openssl rand -hex 32`
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — credencial OAuth (Web) no Google Cloud Console
     com redirect `http://localhost:3000/api/auth/google/callback`
   - `APP_URL=http://localhost:3000`
2. `npm install`
3. `npm run db:init` — aplica o schema (idempotente)
4. `npm run dev`

## Comandos

| Comando | Função |
|---|---|
| `npm run db:init` | Aplica `lib/schema.sql` |
| `npm run promote -- <email>` | Promove usuário a líder (ADMIN) |
| `npm test` | Testes de domínio (vitest) |

## Regras do domínio

- Classes: TK, BM, HT, FM. Especializações: TK/BM → Físico, Mago · HT → Físico · FM → Cancel, Blood, Mago.
- Máx. 2 personagens por usuário.
- Guerras: Seg–Sex Torre, Dom Noatum (21:00 padrão; `settings.war_time_torre` / `war_time_noatum`).
- Pontos: +5 confirmou (Vou), +5 participou (validado pelo líder). Derivados, sem coluna.
- Confirmações travam no horário da guerra.
