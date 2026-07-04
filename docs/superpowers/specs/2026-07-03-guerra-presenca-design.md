# Guerra — Sistema de Presença Tática de Guild (WYD)

**Data:** 2026-07-03
**Status:** Aprovado pelo Ruan (design verbal); pendente revisão da spec escrita.
**Origem:** "Documento de Escopo e Master Prompt — Sistema de Gestão Tática e Presença de Guild (WYD)" (PDF).

## 1. Objetivo

Substituir as enquetes de presença no WhatsApp: jogadores confirmam presença nas guerras em no máximo 2 toques, e o líder vê a composição tática da guild (contagem por classe/especialização + alertas) antes da batalha. Foco: velocidade, clareza, mobile-first.

## 2. Decisões de escopo (com o Ruan)

| Decisão | Escolha |
|---|---|
| Projeto | **App novo e independente ("guerra")** — repo, deploy e banco próprios; nada compartilhado com o imperium-app |
| Stack | **Next.js 16 fullstack (App Router + TS) na Vercel + Neon Postgres** — padrão já comprovado; substitui o "Express + Render" sugerido no PDF |
| Autenticação | **Somente Google OAuth 2.0** (nenhuma senha no sistema) |
| Papel de líder | **`users.role = 'ADMIN'`**; todo login nasce MEMBRO; script `npm run promote -- <email>` promove |
| Tempo real | **Polling 8s** (WebSocket não roda bem na Vercel serverless) |
| Eventos automáticos | **Geração lazy idempotente** no request (sem CRON) |
| Horário padrão das guerras | **21:00 (ambas)**, editável pelo líder via `settings` |
| Pontos | **Derivados por query** (não coluna) — desvio proposital do PDF |

Fora de escopo (PDF, seção 12): montagem automática de PT, TeamSpeak, sistema complexo de cargos, integração com API do jogo.

## 3. Arquitetura

App único `guerra` (Next.js 16 App Router, TypeScript, Tailwind CSS; deps: `pg`, `jose`):

- **Página `/`** — tela única do jogador, mobile-first (a raiz do app É o sistema; sem página institucional).
- **Rotas API:** `/api/auth/google`, `/api/auth/google/callback`, `/api/auth/me`, `/api/auth/logout`, `/api/characters`, `/api/war/current`, `/api/war/[id]/confirm`, `/api/war/[id]/list`, `/api/war/[id]/summary`, `/api/war/[id]/participation`.
- **Módulos em `lib/`:** `db.ts` (pool pg), `auth.ts` (sessão JWT em cookie httpOnly), `google-auth.ts` (fluxo OAuth), `wyd.ts` (classes/especializações válidas), `events.ts` (geração lazy + fuso), `war.ts` (confirmações, agregação, alertas, pontos), `settings.ts`, `types.ts`.
- **Infra:** repo GitHub próprio → Vercel (auto-deploy); banco novo no Neon (região sa-east-1). Env vars: `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- Backend fornece dados **já agregados** (requisito do PDF): o frontend não calcula composição.

## 4. Autenticação Google

- `GET /api/auth/google`: gera `state` aleatório, grava em cookie httpOnly curto, redireciona para o consent do Google (`scope=openid email profile`).
- `GET /api/auth/google/callback`: confere `state`, troca `code` por tokens, valida o `id_token` contra o JWKS do Google com `jose` (iss, aud, exp), faz **upsert** do usuário por `google_sub` (fallback por `email`), emite cookie JWT de sessão e redireciona para `/`.
- **Sessão: 30 dias** ("sem fricção após primeiro acesso"). JWT carrega `pv` = fingerprint de `google_sub`; se o `google_sub` do usuário for limpo/trocado no banco, todas as sessões dele caem (revogação forçada).
- Nome exibido: `name` do perfil Google (editável depois? fora do MVP — usa o do Google); colisão de nome não é problema (unicidade fica em email/google_sub).
- Credencial OAuth no Google Cloud Console com redirects: produção (URL Vercel) + `http://localhost:3000/api/auth/google/callback` para dev.

## 5. Banco de dados

IDs `TEXT` (UUID gerado no app). Schema em `lib/schema.sql`, aplicado por `npm run db:init` (idempotente: `CREATE TABLE IF NOT EXISTS`).

```sql
CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email      TEXT NOT NULL UNIQUE,
  nome       TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'MEMBRO' CHECK (role IN ('ADMIN','MEMBRO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS characters (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome           TEXT NOT NULL,
  classe         TEXT NOT NULL,
  especializacao TEXT NOT NULL,
  principal      BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (classe = 'TK' AND especializacao IN ('FISICO','MAGO')) OR
    (classe = 'BM' AND especializacao IN ('FISICO','MAGO')) OR
    (classe = 'HT' AND especializacao = 'FISICO') OR
    (classe = 'FM' AND especializacao IN ('CANCEL','BLOOD','MAGO'))
  )
);

CREATE TABLE IF NOT EXISTS events (
  id   TEXT PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('TORRE','NOATUM')),
  data TIMESTAMPTZ NOT NULL,
  dia  DATE NOT NULL UNIQUE      -- idempotência da geração lazy
);

CREATE TABLE IF NOT EXISTS confirmations (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id     TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  character_id TEXT REFERENCES characters(id) ON DELETE SET NULL,
  status       TEXT NOT NULL CHECK (status IN ('VOU','NAO_VOU','TALVEZ')),
  participou   BOOLEAN,          -- NULL até o líder validar
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_confirmations_event ON confirmations(event_id);
CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id);
```

Regras aplicadas na camada de dados (transação):
- **Máx 2 personagens por usuário** (contagem dentro da transação → 409).
- Personagem usado na confirmação deve pertencer ao usuário.
- Par classe/especialização também validado no app (constantes em `lib/wyd.ts`) — o CHECK do banco é a última linha de defesa; a UI só oferece opções válidas (nada de texto livre, requisito do PDF).
- **Pontos derivados:** `pontos = 5 × (confirmações VOU) + 5 × (participou = true)`, por query agregada. Sem coluna, sem drift; ranking futuro = 1 SELECT.

**Sem tabelas `classes`/`specializations`** (o PDF as sugeria): os pares válidos são poucos e fixos — constantes + CHECK cumprem a mesma garantia com menos joins e sem seed.

## 6. Eventos automáticos (sem CRON)

`ensureNextEvent()` em `lib/events.ts`, chamado por `GET /api/war/current`:

1. Calcula "hoje" no fuso **America/Sao_Paulo** (serverless roda em UTC).
2. Regra: Seg–Sex → TORRE; Dom → NOATUM; Sáb → próxima é a NOATUM de domingo. Se a guerra de hoje já passou (hora > horário configurado), aponta para a próxima.
3. Horário vem de `settings` (`war_time_torre`, `war_time_noatum`; default `21:00`).
4. `INSERT ... ON CONFLICT (dia) DO NOTHING` — quem abrir a tela primeiro cria o evento; concorrência resolvida pelo UNIQUE.

## 7. Fluxo do usuário (tela `/`)

1. Sem sessão → tela com botão único **"Entrar com Google"**.
2. Logado sem personagem → cadastro rápido: nome + classe + especialização por botões (as opções de espec se ajustam à classe escolhida). Máx 2 personagens; gestão simples (adicionar/editar) numa seção da própria tela.
3. Tela principal (única):
   - **Próxima guerra em destaque**: tipo, dia, hora, contagem regressiva.
   - Botões grandes: ✅ **Vou** · ❌ **Não vou** · ⏳ **Talvez**.
   - "Vou" com 1 personagem → confirma direto (**1 toque**). Com 2 → bottom-sheet de seleção (**2 toques**), pré-selecionado o personagem da última confirmação (fallback: o marcado como `principal`).
   - Listas (polling 8s): **Confirmados / Talvez / Não vão**, cada linha com nome, personagem, classe + especialização.
   - Resposta editável até o horário da guerra; depois **trava** (servidor rejeita com 409).
4. Líder (`role=ADMIN`) vê a mais, na mesma tela:
   - **Card de composição**: contagem por classe_espec + totais físico/mago.
   - **Alertas** (seção 8).
   - Após o horário da guerra: toggle **"participou"** em cada confirmado (check manual, +5 pts).

## 8. Resumo tático e alertas

`GET /api/war/[id]/summary` (só ADMIN) — agregação em SQL, retorno já pronto para exibir:

```json
{
  "BM_FISICO": 5, "BM_MAGO": 2, "TK_FISICO": 3, "FM_BLOOD": 2, "FM_CANCEL": 1,
  "TOTAL_FISICO": 10, "TOTAL_MAGO": 8,
  "alerts": ["Falta de cura (poucos FM Blood)"]
}
```

Regras de alerta (constantes em `lib/war.ts`, sobre confirmados VOU):
- `FM_BLOOD < 2` → "Falta de cura (poucos FM Blood)"
- `TK_total < 3` → "Linha de frente fraca (poucos TK)"
- físico ou mago > 65% do total → "Composição desbalanceada (excesso de X)"

Nota: MAGO conta em TOTAL_MAGO; FISICO em TOTAL_FISICO; CANCEL e BLOOD (FM) não entram em nenhum dos dois totais (são suportes) — apenas nas chaves próprias.

## 9. API (resumo)

| Rota | Auth | Função |
|---|---|---|
| `GET /api/auth/google` | — | Redireciona ao consent do Google (state anti-CSRF) |
| `GET /api/auth/google/callback` | — | Valida token, upsert user, cria sessão 30d |
| `GET /api/auth/me` | user | Dados da sessão (nome, role) |
| `POST /api/auth/logout` | user | Encerra sessão |
| `GET/POST/PATCH /api/characters` | user | CRUD dos até 2 personagens |
| `GET /api/war/current` | user | Garante evento (lazy) + evento + minha confirmação + meus chars |
| `POST /api/war/[id]/confirm` | user | Upsert `{status, character_id}`; trava após horário |
| `GET /api/war/[id]/list` | user | Listas por status (polling) |
| `GET /api/war/[id]/summary` | ADMIN | Composição agregada + alertas |
| `POST /api/war/[id]/participation` | ADMIN | Marca `participou` por confirmação |

Erros: classe `HttpError(status, message)` no servidor + `api-client` no front expondo `err.status`; mensagens amigáveis na UI, detalhe logado no servidor.

## 10. Scripts

- `npm run db:init` — aplica `lib/schema.sql` (idempotente).
- `npm run promote -- <email>` — define `role='ADMIN'` para o e-mail (bootstrap do líder; o usuário precisa ter logado ao menos 1 vez).

## 11. Testes

**vitest** cobrindo a lógica de domínio pura:
- pares classe/especialização válidos/inválidos;
- `ensureNextEvent`: cálculo do próximo evento por dia da semana e fuso (inclusive sábado e "guerra de hoje já passou");
- agregação do summary e regras de alerta;
- cálculo de pontos derivados.

Rotas e UI: smoke test manual em dev e produção.

## 12. Riscos e observações

- **Consent screen do Google**: em modo "Testing" só e-mails cadastrados como testers logam; para a guild toda, publicar o app OAuth (verificação simples para scopes básicos).
- **Fuso horário**: toda lógica de "hoje/próxima guerra" usa America/Sao_Paulo explicitamente.
- **Neon free**: escala a zero quando ocioso — cold start ~1s na primeira request. Polling 8s da guild inteira é barato (rotas leves, 1-2 queries).
- **Mobile-first**: Tailwind CSS (conforme o PDF), botões grandes, tela única, zero formulário longo.
