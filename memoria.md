# 🧠 MEMÓRIA DO PROJETO: GUILDS WYD SAAS

> **Arquivo de Continuidade Técnica para IA e Desenvolvedores**  
> **Local do Projeto:** `c:\PROJETOS\guerra`  
> **Domínio de Produção (real, no ar):** `https://guerra-imperium.vercel.app`  
> **Domínio pretendido (ainda NÃO existe — responde `DEPLOYMENT_NOT_FOUND`):** `https://guilds-wyd.vercel.app`  
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

Os Passos 1 a 4 do plano original estão concluídos (20/10/2026). O que falta está em
**"Pendências abertas"**, no fim desta seção.

### ~~Passo 1: Route Handlers de Contas & Coletas~~ — ✅ CONCLUÍDO (20/10/2026)

As 7 rotas foram criadas e estão listadas na seção 2.C acima. Padrão seguido em todas:
`resolveTenantFromRequest(req)` → `requireLeader(guild.id)` (só nas do líder) → função de domínio → `toResponse(e)`.

### ~~Passo 2: Landing Page Comercial~~ — ✅ CONCLUÍDO (20/10/2026)

`app/page.tsx` → [`components/LandingPage.tsx`](file:///c:/PROJETOS/guerra/components/LandingPage.tsx).
Hero, os 3 pilares, os 4 planos (Semestral marcado como "mais escolhido") e dois modais:
**Ativar minha guilda** (chave → valida no blur via `/api/licenses/validate`, nome, slug gerado
automático do nome, reino e servidor; ao ativar, redireciona para `/[slug]`) e
**Acessar guilda existente** (digita o slug e entra).

### ~~Passo 3: Painel do SuperAdmin~~ — ✅ CONCLUÍDO (20/10/2026)

`app/master/page.tsx` → [`components/MasterPanel.tsx`](file:///c:/PROJETOS/guerra/components/MasterPanel.tsx).
Login pela Master Key (enviada como `Authorization: Bearer`, mantida **só em memória** — nunca em
localStorage), gerador de chave por plano, tabela de licenças com botão de copiar e tabela de
guildas com reino, servidor, membros, personagens e vencimento.

### ~~Passo 4: Páginas Dinâmicas por Guilda~~ — ✅ CONCLUÍDO (20/10/2026)

* `app/[guild]/layout.tsx`: resolve a guilda, devolve **404** se o slug não existe e uma tela de
  aviso se a licença está inativa; aplica o tema do reino e monta a navegação
  ([`components/GuildNav.tsx`](file:///c:/PROJETOS/guerra/components/GuildNav.tsx)).
* `app/[guild]/page.tsx`: hub com brasão (ou as iniciais), reino, servidor e 4 cards de atalho.
* `app/[guild]/guerra/page.tsx`: o `GuerraApp` de sempre.
* `app/[guild]/set/page.tsx` → [`components/SetApp.tsx`](file:///c:/PROJETOS/guerra/components/SetApp.tsx):
  lista os personagens com o Gear Score e abre o `EquipmentGrid`.
* `app/[guild]/coletar/page.tsx` → [`components/ColetarApp.tsx`](file:///c:/PROJETOS/guerra/components/ColetarApp.tsx):
  conta em posse com credenciais e botão de copiar, formulário (nome + servidor de origem),
  filtro por servidor e contas agrupadas por Tier.
* `app/[guild]/admin/page.tsx`: o `AdminPanel` de sempre.

#### Como o tenant chega até a API (decisão de arquitetura)

Os 14 componentes existentes chamam `api('/api/...')` com caminho sem o slug. Em vez de mexer em
todos, foi criado [`middleware.ts`](file:///c:/PROJETOS/guerra/middleware.ts): em toda navegação
para `/[slug]/...` ele grava o slug no cookie `wyd_guild`, que já era uma das fontes lidas por
`resolveTenantFromRequest()`. Primeiros segmentos reservados (não viram guilda): `api`, `master`,
`_next`, `favicon.ico`, `manifest.webmanifest`, `icons`.

**Limitação conhecida:** o cookie é um só por navegador. Duas abas de guildas diferentes ao mesmo
tempo → a última navegação vence. Se isso virar problema, o caminho é passar `?guild=` nas chamadas.

#### Tema por reino

`.guild-shell[data-reino="BLUE"]` troca `--accent`, `--accent2` e `--accent-bright` e pinta um
`::before` fixo por cima do fundo laranja do `body`. As ~16 regras com laranja *hardcoded* em
`globals.css` (glows e gradientes de botão) continuam quentes mesmo no reino BLUE — trocar isso
exige refatorar o CSS para variáveis.

#### PWA whitelabel

A raiz `app/manifest.ts` virou o manifesto da **plataforma** (Guilds WYD). Cada guilda ganhou o
seu em `app/[guild]/manifest.webmanifest/route.ts`: nome e `short_name` da guilda, `start_url` e
`scope` no hub dela (`/[slug]`) e cor de fundo pelo reino. O `generateMetadata` do layout aponta
para ele e usa o nome da guilda no `appleWebApp.title`. Os ícones ainda são os genéricos do
projeto — usar `logo_url` como icone exigiria garantir tamanho/formato do PNG enviado.

#### Rotas removidas

`app/admin/page.tsx` saiu: o painel do líder agora é `/[slug]/admin`. A URL antiga `/admin` cai no
404 de guilda inexistente.

---

### Pendências abertas

1. **Nenhuma rota de API tem teste automatizado.** A suite cobre só lógica pura em `lib/`
   (inclusive `lib/crypto.ts` desde 20/10/2026). O fluxo de coleta foi validado **à mão**
   no navegador (ver abaixo), não por teste.
2. **`MASTER_KEY` e `CREDS_KEY` precisam ser setadas na Vercel.** Os fallbacks literais
   (`'wyd-saas-master-2026'` e `'wyd-guilds-default-secret-key-32bytes'`) foram **removidos**
   em 20/10/2026: sem `MASTER_KEY` o `/api/master/licenses` responde `503` e o painel Master
   fica indisponível; sem `CREDS_KEY` **nem** `JWT_SECRET` o `lib/crypto.ts` lança em vez de
   cifrar. O fallback para `JWT_SECRET` continua (com `console.warn`), então a produção atual
   não quebra — mas é justamente ele que deixa local e produção divergirem.
   **Nenhuma das duas existe ainda:** o `.env.local` tem só `DATABASE_URL`, `JWT_SECRET`,
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `APP_URL`. Como **local e produção compartilham
   o mesmo banco Neon**, a `CREDS_KEY` tem de ser idêntica nos dois — conta cadastrada com uma
   chave não decifra com outra. **Janela boa:** a tabela `accounts` está vazia, então definir
   agora não quebra nada; depois do primeiro cadastro, trocar a chave exige re-cifrar.
3. **A raiz `/` virou a landing comercial.** Os membros que usam `guerra-imperium.vercel.app` no celular
   caem na página de vendas; o app deles agora é `/[slug]/guerra`. Precisa avisar a guilda (ou
   redirecionar a raiz para a guilda quando o cookie `wyd_guild` existir).
4. **Cookie de tenant não valida a guilda.** O middleware grava qualquer primeiro segmento no
   cookie `wyd_guild` (ele roda no edge, sem banco). Slug inexistente cai no fallback `imperium`
   do `resolveTenantFromRequest`.

### O que já foi validado de ponta a ponta (20/10/2026)

Schema aplicado no Neon com `npm run db:init`: a guilda `imperium` nasceu e o backfill associou a
ela os 4 usuários, 4 personagens e 7 eventos que já existiam — nada perdido. Com uma conta de
teste inserida à mão (e removida depois), no navegador:

* `/imperium` → hub com brasão, reino e os 4 atalhos.
* `/imperium/coletar` → pegar sem nome é barrado; com nome, a conta foi coletada, as credenciais
  vieram **decifradas corretas** (prova do AES-256-GCM de ponta a ponta), a lista marcou
  "com Ruan (teste)", e a devolução soltou a conta.
* `coletas` registrou nome, servidor de origem e login, e fechou a linha com `data_entrega`
  (`ativo = false`) na devolução.
* `/imperium/guerra` → tela de login pelo nome do personagem.
* `/naoexiste` → 404.
* `/master` → tela da Master Key, sem ser capturada pela rota `[guild]`.

Em **produção** (após o push de 20/10): a landing responde na raiz, `/imperium` monta o hub e
`/imperium/guerra` responde 200.
* `/imperium/manifest.webmanifest` → manifesto com o nome da guilda e `start_url` no hub dela.


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
# Sem ela o painel Master responde 503. Gerar com: openssl rand -hex 32
MASTER_KEY=gerar-com-openssl-rand-hex-32
```

---
*Este arquivo deve ser consultado e atualizado a cada nova etapa concluída.*
