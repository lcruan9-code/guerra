# WYD Guilds SaaS — White-Label & Multi-Tenant Architecture Plan

> **Domínio Alvo:** `https://guilds-wyd.vercel.app`  
> **Repositório Base:** `c:\PROJETOS\guerra`  
> **Data:** 20/10/2026  
> **Status:** Planejamento Estratégico & Arquitetura

---

## 1. Visão Geral do Produto

Transformação da aplicação de presença tática de guerra em uma plataforma **SaaS Multi-tenant White-Label** para guildas do MMORPG **With Your Destiny (WYD)**. 

Cada guilda cliente terá seu espaço exclusivo acessível por rota dedicada:
```
https://guilds-wyd.vercel.app/[guild_slug]
```

### Principais Pilares do SaaS:
1. **Presença Tática em Guerras:** Confirmação em Torre (Seg-Sex), Kefra (Terça) e Noatum (Domingo), com bloqueio automático no horário, roster de classes em tempo real, controle de KS e ranking semanal com premiações.
2. **Montador de SET & Gear Score (0-48):** Grade visual fiel à janela de equipamento do WYD com os ícones reais dos itens, níveis de refino (+13 a +15), adicionais (Sux/Semi/Full), anéis/brincos (T1/T2) e ranking de poder dos personagens.
3. **Banco de Contas & Empréstimo Seguro (Coleta):** Módulo herdado do *Imperium* com senhas cifradas em AES-256-GCM, organização por Tiers (1, 2 e 3), empréstimo de 1 conta por pessoa com trava de concorrência (`FOR UPDATE`) e histórico com carimbo de devolução.
4. **Modelo de Chaves de Licença (SaaS Keys):** Cada guilda ativa ou renova seu acesso via chave de licença (mensal, trimestral ou anual) gerenciada por um painel SuperAdmin (`/master`).

---

## 2. Arquitetura de Rotas (Next.js App Router)

```
app/
├── page.tsx                     # Landing Page do SaaS (apresentação, planos, ativação de chave)
├── master/                      # Painel SuperAdmin (gerar chaves, métricas globais, lista de guilds)
│   └── page.tsx
├── [guild]/                     # Tenancy isolado por guilda (ex: /imperium, /reddragon)
│   ├── page.tsx                 # Hub da guilda (branding, avisos rápidos, atalhos)
│   ├── guerra/
│   │   └── page.tsx             # Presença em guerras, contagem regressiva e roster tático
│   ├── set/
│   │   └── page.tsx             # Montador de SET visual e Gear Score do personagem
│   ├── coletar/
│   │   └── page.tsx             # Portal público de empréstimo de contas da guilda
│   └── admin/
│       └── page.tsx             # Painel de controle do líder da guilda
└── api/
    ├── master/                  # Rotas do SuperAdmin (geração de chaves)
    ├── guilds/                  # Criação/ativação de guilda via chave
    └── [guild]/                 # APIs com escopo restrito à guilda
        ├── auth/
        ├── characters/
        ├── war/
        ├── gear/
        ├── accounts/
        ├── coletas/
        └── leader/
```

---

## 3. Modelo de Dados Relacional (Multi-tenancy)

### Novas Tabelas:
* **`guilds`**:
  * `id`: UUID (PK)
  * `slug`: TEXT UNIQUE (ex: `imperium`, `reddragon`)
  * `nome`: TEXT (Nome legível da guilda)
  * `reino`: TEXT (`RED` ou `BLUE`)
  * `servidor`: TEXT (`INFINITY`, `ROGUE`, etc.)
  * `logo_url`: TEXT
  * `cor_tema`: TEXT
  * `leader_hash`: TEXT (Senha mestra do líder da guilda com bcrypt)
  * `coletar_hash`: TEXT (Senha de acesso ao /coletar da guilda)
  * `created_at`: TIMESTAMPTZ

* **`licenses`**:
  * `id`: UUID (PK)
  * `key`: TEXT UNIQUE (ex: `WYD-IMP-9842-X7K1`)
  * `guild_id`: UUID REFERENCES `guilds(id)` (NULL se não utilizada)
  * `plano`: TEXT (`MENSAL`, `TRIMESTRAL`, `VITALICIO`)
  * `status`: TEXT (`DISPONIVEL`, `ATIVA`, `EXPIRADA`, `REVOGADA`)
  * `valida_ate`: TIMESTAMPTZ
  * `created_at`: TIMESTAMPTZ

### Adaptação das Tabelas Existentes com `guild_id`:
* **`users`** (`id`, `guild_id`, `nome`, `role`, `created_at`)
* **`characters`** (`id`, `guild_id`, `user_id`, `nome`, `classe`, `especializacao`, `equipment`, ...)
* **`events`** (`id`, `guild_id`, `tipo`, `data`, `dia`, `fim`, `encerrado_em`, ...)
* **`confirmations`** (`id`, `guild_id`, `user_id`, `event_id`, `character_id`, `status`, `ks`, `kefra`, ...)
* **`awards`** (`id`, `guild_id`, `key`, `label`, `ativo`, `premio`, `ordem`)
* **`settings`** (`guild_id`, `key`, `value`)

### Tabelas Integradas do Módulo de Contas:
* **`accounts`**:
  * `id`: UUID (PK)
  * `guild_id`: UUID REFERENCES `guilds(id)`
  * `personagem`: TEXT
  * `login`: TEXT
  * `senha_enc`: TEXT (AES-256-GCM)
  * `senha_interna_enc`: TEXT (AES-256-GCM)
  * `classe`: TEXT
  * `especializacao`: TEXT
  * `servidor`: TEXT
  * `tier`: SMALLINT (1, 2, 3)
  * `ativo`: BOOLEAN
  * `status`: TEXT (`DISPONIVEL`, `EM_USO`)
* **`coletas`**:
  * `id`: UUID (PK)
  * `guild_id`: UUID REFERENCES `guilds(id)`
  * `conta_id`: UUID REFERENCES `accounts(id)`
  * `nome_pessoa`: TEXT
  * `servidor_origem`: TEXT
  * `holder_id`: TEXT (Cookie único do portador)
  * `data_hora`: TIMESTAMPTZ
  * `data_entrega`: TIMESTAMPTZ
  * `ativo`: BOOLEAN

---

## 4. Fases de Implementação

### Fase 1 — Modelagem do Banco & Multi-tenancy
1. Criar novo DDL unificado em `lib/schema.sql` com as tabelas `guilds`, `licenses`, `accounts`, `coletas` e `guild_id` em todos os registros.
2. Script de migração (`scripts/migrate-multitenant.mjs`) que converte os dados atuais da guilda "imperium" no primeiro tenant oficial.

### Fase 2 — Infraestrutura de Tenancy & Licenciamento
1. Helper `lib/tenant.ts` para resolver a guilda atual pelo `params.guild` ou header.
2. Verificação de status da licença (`valida_ate`) com bloqueio amigável se expirada.
3. Tela de ativação de chave para criar nova guilda (`/ativar` ou na landing page).

### Fase 3 — Reestruturação de Rotas para `app/[guild]`
1. Mover rotas atuais para dentro de `app/[guild]/`.
2. Adaptar contexto de branding dinâmico (cores, reino e logo conforme a guilda atual).
3. Adaptação dos cookies de sessão (armazenar o `guild_id` ou separar tokens por guilda para que membros de múltiplas guilds não tenham colisão).

### Fase 4 — Integração do Banco de Contas & Coleta
1. Importar a lógica criptográfica AES-256-GCM (`lib/crypto.ts`) do `imperium-app`.
2. Implementar `app/[guild]/coletar` e aba de contas no `app/[guild]/admin`.
3. Validação de concorrência de 1 conta por pessoa com `SELECT FOR UPDATE`.

### Fase 5 — Painel SuperAdmin (`/master`) & Landing Page
1. Interface do SuperAdmin protegida por chave mestra para gerar novas chaves de licença.
2. Landing page de alta conversão para líderes de guilda no WYD.

---

## 5. Prompt de Execução para o `/plan`

Copie e cole o prompt abaixo para iniciar a execução do plano detalhado:

```markdown
/plan Executar a transformação do C:\PROJETOS\guerra em um SaaS Multi-tenant White-label de Guildas WYD (guilds-wyd.vercel.app). 

Seguir o plano documentado em `SAAS_WHITELABEL_PLAN.md`:
1. Atualizar o schema do banco adicionando as tabelas `guilds`, `licenses` e o relacionamento `guild_id` em todas as tabelas (incluindo migração das tabelas `accounts` e `coletas` do módulo Imperium).
2. Criar utilitários de tenant (`lib/tenant.ts`) e validação de licença (`lib/licenses.ts`).
3. Reestruturar as rotas do Next.js para o padrão dinâmico `app/[guild]/` mantendo Guerra, SET/Gear Score, e adicionando Coleta e Painel Admin.
4. Criar a landing page do SaaS em `app/page.tsx` com ativação de chaves e o painel `/master` para emissão de licenças.
5. Garantir que `npx tsc --noEmit` continue passando 100% sem erros a cada etapa.
```
