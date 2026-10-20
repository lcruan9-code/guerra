# 🧠 MEMÓRIA DO PROJETO: GUILDS WYD SAAS

> **Arquivo de Continuidade Técnica para IA e Desenvolvedores**  
> **Local do Projeto:** `c:\PROJETOS\guerra`  
> **Domínio de Produção / Alvo:** `https://guilds-wyd.vercel.app`  
> **Última Atualização:** 20/10/2026

---

## 1. Contexto & Visão do Negócio

Este projeto é uma plataforma **SaaS Multi-Tenant White-Label** feita para guildas do MMORPG **With Your Destiny (WYD)**.

O objetivo do produto é ser vendido como um serviço para líderes de guildas através de **chaves de licença (SaaS Keys)** com planos (Mensal, Trimestral, Semestral ou Vitalício). Ao adquirir a chave, o líder ativa sua guilda e ganha uma URL própria:
```
https://guilds-wyd.vercel.app/[guild_slug]
```

### Unificação de Dois Projetos:
1. **`WYD Guild Imperium management system`** (projeto anterior em `imperium-app`):
   - Módulo de banco de contas de jogo com credenciais cifradas em repouso (`AES-256-GCM`).
   - Sistema de empréstimo temporário de contas para guerra (`/coletar`), com regra de 1 conta por pessoa e bloqueio de concorrência (`SELECT FOR UPDATE`).
2. **`c:\PROJETOS\guerra`** (projeto base principal mais recente):
   - Presença tática em guerras (Torre Seg-Sex, Kefra Terça, Noatum Domingo) com roster de classes em tempo real.
   - Login sem fricção para membros (apenas nome do personagem salvo em cookie de 30 dias).
   - Montador visual de SET fiel à janela de equipamentos do jogo WYD com ícones recortados.
   - Cálculo automático de **Gear Score (0 a 48)** dos personagens e ranking de força da guilda.

---

## 2. O Que Já Foi Implementado (Estado Atual)

### A. Banco de Dados Multi-Tenant & Schema (`lib/schema.sql`)
* **Tabela `guilds`**: `id`, `slug`, `nome`, `reino` (`RED`/`BLUE`), `servidor` (`INFINITY`/`ROGUE`), `logo_url`, `cor_tema`, `leader_hash`, `coletar_hash`, `ativa`, `created_at`.
* **Tabela `licenses`**: `id`, `key`, `guild_id`, `plano` (`MENSAL`, `TRIMESTRAL`, `SEMESTRAL`, `VITALICIO`), `status` (`DISPONIVEL`, `ATIVA`, `EXPIRADA`, `REVOGADA`), `valida_ate`, `created_at`.
* **Tenant Isolation (`guild_id`)**: Adicionado com foreign key para `guilds(id)` em:
  - `users`, `characters`, `events`, `confirmations`, `settings`, `awards`.
  - `accounts` (banco de contas da guilda herdado do Imperium).
  - `coletas` (histórico de empréstimos/devoluções de contas herdado do Imperium).
* **Backfill & Compatibilidade**: Seed automático da guilda padrão `imperium` (`g-imperium`) com licença ativa vitalícia `WYD-IMP-MASTER-2026`. Dados pré-existentes sem `guild_id` são automaticamente associados à guilda `imperium`.
* **Índices de Performance**: Criados para todas as buscas por `guild_id`, `slug`, `holder_id`, `status` e `key`.

### B. Módulos de Domínio & Tipos (`lib/`)
* **[`lib/types.ts`](file:///c:/PROJETOS/guerra/lib/types.ts)**:
  - Tipos expandidos com `GuildDTO`, `LicenseDTO`, `AccountDTO`, `PublicAccountDTO`, `HeldAccountDTO`, `ColetaDTO`, `LicensePlan`, `LicenseStatus`, `AccountStatus`, `Tier`, `Reino`, `Servidor`.
* **[`lib/tenant.ts`](file:///c:/PROJETOS/guerra/lib/tenant.ts)**:
  - `getGuildBySlug(slug)`: Busca guilda ativa e data de vencimento da licença.
  - `getGuildById(id)`: Busca por UUID.
  - `requireGuild(slug)`: Validação rígida com erro 404/403 se inativa.
  - `resolveTenantFromRequest(req)`: Descobre a guilda dinamicamente por query (`?guild=...`), header (`x-guild`), cookie (`wyd_guild`) ou fallback seguro para `'imperium'`.
  - `listAllGuilds()`: Listagem com totalizadores de membros e personagens.
* **[`lib/licenses.ts`](file:///c:/PROJETOS/guerra/lib/licenses.ts)**:
  - `generateLicenseKey(plano)`: Cria chave formatada `WYD-XXXX-YYYY-ZZZZ`.
  - `verifyLicense(key)`: Valida status e dados da chave.
  - `activateLicense(key, guildData)`: Ativa chave, cria a guilda e configura prêmios padrão.
  - `listLicenses()`: Listagem geral para o SuperAdmin.
* **[`lib/crypto.ts`](file:///c:/PROJETOS/guerra/lib/crypto.ts)**:
  - Criptografia e decriptografia `AES-256-GCM` para as credenciais das contas em repouso no banco (chave derivada via `scryptSync` usando `CREDS_KEY` ou `JWT_SECRET`).
* **[`lib/accounts.ts`](file:///c:/PROJETOS/guerra/lib/accounts.ts)**:
  - CRUD multi-tenant de contas de jogo (`listAccounts`, `createAccount`, `updateAccount`, `deleteAccount`, `setAccountActive`).
  - Fluxo público de coleta (`listPublicAccounts`, `collectAccountPublic`, `getHeldAccount`, `releaseAccountPublic`).
  - Lock de linha via transação Postgres (`SELECT ... FOR UPDATE`) para impedir coletas simultâneas da mesma conta.
  - Regra de negócio: **1 conta por navegador** através do cookie `coletar_holder`.
* **[`lib/holder.ts`](file:///c:/PROJETOS/guerra/lib/holder.ts)**:
  - Gerenciador do cookie de portador (`coletar_holder` / UUID).
* **[`lib/leader-auth.ts`](file:///c:/PROJETOS/guerra/lib/leader-auth.ts)**:
  - Atualizado para suporte multi-tenant com senha de líder independente por guilda (`leader_hash` na tabela `guilds`) e cookies isolados por `guild_id`.
* **[`lib/auth.ts`](file:///c:/PROJETOS/guerra/lib/auth.ts)**:
  - Sessão de usuário agora preserva `guild_id`.
* **[`lib/characters.ts`](file:///c:/PROJETOS/guerra/lib/characters.ts), [`lib/events.ts`](file:///c:/PROJETOS/guerra/lib/events.ts), [`lib/admin.ts`](file:///c:/PROJETOS/guerra/lib/admin.ts)**:
  - Métodos atualizados para filtrar por guilda.
* **[`lib/db.ts`](file:///c:/PROJETOS/guerra/lib/db.ts)**:
  - `export function getPool(): Pool` exportado para suportar transações manuais do `accounts.ts`.

### C. Rotas de API Criadas
* `POST /api/licenses/activate` ([`app/api/licenses/activate/route.ts`](file:///c:/PROJETOS/guerra/app/api/licenses/activate/route.ts)): Ativação de guilda via chave.
* `GET /api/licenses/validate` ([`app/api/licenses/validate/route.ts`](file:///c:/PROJETOS/guerra/app/api/licenses/validate/route.ts)): Validação prévia de chave no formulário.
* `GET, POST /api/master/licenses` ([`app/api/master/licenses/route.ts`](file:///c:/PROJETOS/guerra/app/api/master/licenses/route.ts)): Gestão de licenças pelo SuperAdmin (autenticado por `MASTER_KEY`).
* `GET, POST /api/accounts` ([`app/api/accounts/route.ts`](file:///c:/PROJETOS/guerra/app/api/accounts/route.ts)): Listagem e criação de contas da guilda para o líder.
* `PUT, DELETE /api/accounts/[id]` ([`app/api/accounts/[id]/route.ts`](file:///c:/PROJETOS/guerra/app/api/accounts/[id]/route.ts)): Edição e exclusão de contas.
* `POST /api/accounts/[id]/release` ([`route.ts`](file:///c:/PROJETOS/guerra/app/api/accounts/%5Bid%5D/release/route.ts)): Líder força a devolução de uma conta presa em `EM_USO`.
* `POST /api/accounts/[id]/active` ([`route.ts`](file:///c:/PROJETOS/guerra/app/api/accounts/%5Bid%5D/active/route.ts)): Ativa/inativa a conta (inativa some do `/coletar`). Exige `{ "ativo": boolean }`.
* `GET /api/coletas` ([`route.ts`](file:///c:/PROJETOS/guerra/app/api/coletas/route.ts)): Histórico de empréstimos para a aba de auditoria do líder.
* `GET /api/public/accounts` ([`route.ts`](file:///c:/PROJETOS/guerra/app/api/public/accounts/route.ts)): Lista pública das contas ativas da guilda; filtro opcional `?servidor=`.
* `POST /api/public/accounts/[id]/collect` ([`route.ts`](file:///c:/PROJETOS/guerra/app/api/public/accounts/%5Bid%5D/collect/route.ts)): Portador pega a conta. Exige `{ "nome_pessoa", "servidor_origem" }`; emite o cookie `coletar_holder`.
* `POST /api/public/accounts/[id]/release` ([`route.ts`](file:///c:/PROJETOS/guerra/app/api/public/accounts/%5Bid%5D/release/route.ts)): Portador devolve a conta (403 sem cookie de portador).
* `GET /api/public/mine` ([`route.ts`](file:///c:/PROJETOS/guerra/app/api/public/mine/route.ts)): Conta que este navegador está segurando agora (`null` se nenhuma).

---

## 3. Próximos Passos (Guia Imediato de Continuação)

A próxima IA ou desenvolvedor deve focar nos Passos 2 a 4 (o Passo 1 já está concluído):

### ~~Passo 1: Finalizar os Route Handlers de Contas & Coletas~~ — ✅ CONCLUÍDO (20/10/2026)

As 7 rotas foram criadas e estão listadas na seção 2.C acima. Padrão seguido em todas:
`resolveTenantFromRequest(req)` → `requireLeader(guild.id)` (só nas do líder) → função de domínio → `toResponse(e)`.
Validado com `npx tsc --noEmit` (0 erros) e `npm test` (43 testes, 8 arquivos).

> **Pendência conhecida:** nenhuma das rotas de API do projeto tem teste automatizado
> (as 5 anteriores também não tinham) — a suite cobre só lógica pura em `lib/`.
> O fluxo de coleta ainda não foi exercitado contra o banco de verdade.

### Passo 2: Construir a Landing Page Comercial (`app/page.tsx`)
Substituir o `app/page.tsx` para ser a **Landing Page do SaaS**:
- Apresentação da plataforma: "A ferramenta definitiva para sua Guilda no WYD".
- Apresentar os 3 pilares visuais:
  1. Presença Tática e Roster de Classes (Torre, Kefra, Noatum).
  2. Grade de SET fiel ao jogo com cálculo de Gear Score (0 a 48).
  3. Banco & Empréstimo Seguro de Contas (coletas criptografadas com trava de concorrência).
- Cards com planos de assinatura (Mensal, Trimestral, Semestral, Vitalício).
- Modal / Formulário: **"Já tenho uma Chave → Ativar Minha Guilda"**:
  - Campo da chave (ex: `WYD-XXXX-YYYY-ZZZZ`).
  - Nome da guilda e Slug da URL (`/[slug]`).
  - Escolha do Reino (`RED` ou `BLUE`) e Servidor (`INFINITY` ou `ROGUE`).
  - Ao concluir com sucesso, redireciona para `/[slug]`.
- Botão "Acessar Guilda Existente" (campo de busca ou atalho direto).

### Passo 3: Construir o Painel do SuperAdmin (`app/master/page.tsx`)
- Tela acessada por senha mestre (`process.env.MASTER_KEY` ou padrão `wyd-saas-master-2026`).
- Ações:
  - Gerador de novas chaves de licença com seletor de plano (Mensal, Trimestral, etc.).
  - Tabela com todas as chaves geradas, status (`DISPONIVEL`, `ATIVA`, `EXPIRADA`) e guilda vinculada.
  - Tabela com todas as guildas cadastradas, reino, servidor, total de membros, total de personagens e data de expiração.

### Passo 4: Estruturar as Páginas Dinâmicas por Guilda (`app/[guild]/...`)
1. **`app/[guild]/layout.tsx`**:
   - Resolve os dados da guilda via `await requireGuild(params.guild)`.
   - Injeta o tema visual conforme o reino:
     - `RED`: `--accent: #ff7a2e`, tons de fogo e brasas.
     - `BLUE`: `--accent: #2e9fff`, tons de gelo e energia azul.
   - Fornece navegação superior para: **Guerras**, **Montar SET**, **Coleta de Contas** e **Painel do Líder**.
2. **`app/[guild]/page.tsx`**:
   - Hub da guilda com o brasão/logo, reino, servidor e cards de atalho rápido para os membros.
3. **`app/[guild]/guerra/page.tsx`**:
   - Renderiza o `GuerraApp` adaptado para o escopo da guilda.
4. **`app/[guild]/set/page.tsx`**:
   - Visualização e edição do SET e Gear Score dos personagens do jogador.
5. **`app/[guild]/coletar/page.tsx`**:
   - Portal de empréstimo de contas da guilda (cópia rápida de credenciais, botões por Tier 1/2/3).
6. **`app/[guild]/admin/page.tsx`**:
   - Painel do líder da guilda com abas: Roster, Horários, KS, Prêmios, Força (Gear Ranking) e Contas/Coletas.

---

## 4. Como Executar e Validar

No diretório `c:\PROJETOS\guerra`:
* **Validação de tipos TypeScript**:
  ```bash
  npx tsc --noEmit
  ```
  *(Atualmente passa 100% com 0 erros)*
* **Rodar servidor de desenvolvimento**:
  ```bash
  npm run dev
  ```
* **Aplicar migrações no banco**:
  ```bash
  npm run db:init
  ```

---

## 5. Variáveis de Ambiente Necessárias (`.env.local`)

```env
# Conexão Postgres (Neon)
DATABASE_URL=postgres://...

# Segredo JWT para assinar sessões
JWT_SECRET=super-secreto-jwt-min-32-chars

# Segredo para criptografia AES-256-GCM das senhas de contas de jogo
CREDS_KEY=segredo-aes-gcm-para-contas-wyd

# Chave mestra do SuperAdmin para gerar licenças em /master
MASTER_KEY=wyd-saas-master-2026
```

---
*Este arquivo deve ser consultado e atualizado a cada nova etapa concluída.*
