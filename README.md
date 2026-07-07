# Guerra — Presença Tática da Guild (WYD)

App mobile-first para confirmar presença nas guerras da guild e dar ao líder
visão tática da composição (classes/especializações) antes da batalha.

## Stack

Next.js 16 (App Router, TS) · Tailwind v4 · PostgreSQL (Neon) · Vercel

## Login

Sem senha nem e-mail: no 1º acesso o jogador cadastra o personagem (nome, classe,
especialização) e a sessão fica salva num cookie do navegador por 30 dias — ao
reabrir o site as informações dele já estão lá. Cada usuário é identificado pelo
nome do personagem. Limpar os dados do navegador ou trocar de aparelho cria uma
conta nova (não há recuperação).

O **painel do líder** é liberado por senha (padrão `wyd2026`, trocável no próprio
painel), independente da identidade do jogador.

## Rodando local

1. `cp .env.example .env.local` e preencher:
   - `DATABASE_URL` — Postgres (Neon)
   - `JWT_SECRET` — `openssl rand -hex 32`
2. `npm install`
3. `npm run db:init` — aplica o schema (idempotente)
4. `npm run dev`

## Comandos

| Comando | Função |
|---|---|
| `npm run db:init` | Aplica `lib/schema.sql` |
| `npm run seed:demo` | Popula dados fictícios para teste visual |
| `npm test` | Testes de domínio (vitest) |

## Regras do domínio

- Classes: TK, BM, HT, FM. Especializações: TK/BM → Físico, Mago · HT → Físico · FM → Cancel, Blood, Mago.
- Máx. 2 personagens por usuário.
- Guerras: Seg–Sex Torre, Dom Noatum (21:00 padrão; `settings.war_time_torre` / `war_time_noatum`).
- Pontos: +5 confirmou (Vou), +5 participou (validado pelo líder). Derivados, sem coluna.
- Confirmações travam no horário da guerra.
