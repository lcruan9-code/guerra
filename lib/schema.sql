-- ============================================================
-- SAAS MULTI-TENANT: GUILDS & LICENSES
-- ============================================================

CREATE TABLE IF NOT EXISTS guilds (
  id           TEXT PRIMARY KEY,
  slug         TEXT UNIQUE NOT NULL,
  nome         TEXT NOT NULL,
  reino        TEXT NOT NULL DEFAULT 'RED' CHECK (reino IN ('RED','BLUE')),
  servidor     TEXT NOT NULL DEFAULT 'INFINITY' CHECK (servidor IN ('INFINITY','ROGUE')),
  logo_url     TEXT,
  cor_tema     TEXT,
  leader_hash  TEXT,
  coletar_hash TEXT,
  ativa        BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS licenses (
  id         TEXT PRIMARY KEY,
  key        TEXT UNIQUE NOT NULL,
  guild_id   TEXT REFERENCES guilds(id) ON DELETE SET NULL,
  plano      TEXT NOT NULL DEFAULT 'MENSAL' CHECK (plano IN ('MENSAL','TRIMESTRAL','SEMESTRAL','VITALICIO')),
  status     TEXT NOT NULL DEFAULT 'DISPONIVEL' CHECK (status IN ('DISPONIVEL','ATIVA','EXPIRADA','REVOGADA')),
  valida_ate TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABELAS NATIVAS COM MULTI-TENANCY (guild_id)
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  guild_id   TEXT REFERENCES guilds(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'MEMBRO' CHECK (role IN ('ADMIN','MEMBRO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Garante migração de guild_id em bancos existentes:
ALTER TABLE users ADD COLUMN IF NOT EXISTS guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE;

-- Limpeza de colunas antigas (google login obsoleto)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'google_sub') THEN
    ALTER TABLE users ALTER COLUMN google_sub DROP NOT NULL;
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_google_sub_key;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email') THEN
    ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS characters (
  id             TEXT PRIMARY KEY,
  guild_id       TEXT REFERENCES guilds(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome           TEXT NOT NULL,
  classe         TEXT NOT NULL,
  especializacao TEXT NOT NULL,
  principal      BOOLEAN NOT NULL DEFAULT false,
  equipment      JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (classe = 'TK' AND especializacao IN ('FISICO','MAGO')) OR
    (classe = 'BM' AND especializacao IN ('FISICO','MAGO')) OR
    (classe = 'HT' AND especializacao = 'FISICO') OR
    (classe = 'FM' AND especializacao IN ('CANCEL','BLOOD','MAGO'))
  )
);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS equipment JSONB;

CREATE TABLE IF NOT EXISTS events (
  id           TEXT PRIMARY KEY,
  guild_id     TEXT REFERENCES guilds(id) ON DELETE CASCADE,
  tipo         TEXT NOT NULL CHECK (tipo IN ('TORRE','KEFRA','NOATUM')),
  data         TIMESTAMPTZ NOT NULL,
  dia          DATE NOT NULL,
  cancelado    BOOLEAN NOT NULL DEFAULT false,
  ks_user_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  fim          TIMESTAMPTZ,
  encerrado_em TIMESTAMPTZ
);
ALTER TABLE events ADD COLUMN IF NOT EXISTS guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS cancelado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS ks_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS fim TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS encerrado_em TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS confirmations (
  id           TEXT PRIMARY KEY,
  guild_id     TEXT REFERENCES guilds(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id     TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  character_id TEXT REFERENCES characters(id) ON DELETE SET NULL,
  status       TEXT NOT NULL CHECK (status IN ('VOU','NAO_VOU','TALVEZ')),
  participou   BOOLEAN,
  ks           INT NOT NULL DEFAULT 0,
  kefra        INT NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);
ALTER TABLE confirmations ADD COLUMN IF NOT EXISTS guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE;
ALTER TABLE confirmations ADD COLUMN IF NOT EXISTS ks INT NOT NULL DEFAULT 0;
ALTER TABLE confirmations ADD COLUMN IF NOT EXISTS kefra INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS settings (
  guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  key      TEXT NOT NULL,
  value    TEXT NOT NULL,
  PRIMARY KEY (guild_id, key)
);

CREATE TABLE IF NOT EXISTS awards (
  guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  key      TEXT NOT NULL,
  PRIMARY KEY (guild_id, key),
  label    TEXT NOT NULL,
  ativo    BOOLEAN NOT NULL DEFAULT false,
  premio   TEXT NOT NULL DEFAULT '',
  ordem    INT NOT NULL DEFAULT 0
);
ALTER TABLE awards ADD COLUMN IF NOT EXISTS guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE;

-- ============================================================
-- MÓDULO DE BANCO DE CONTAS & COLETA (HERDADO DO IMPERIUM)
-- ============================================================

CREATE TABLE IF NOT EXISTS accounts (
  id                TEXT PRIMARY KEY,
  guild_id          TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  personagem        TEXT,
  login             TEXT NOT NULL,
  senha_enc         TEXT NOT NULL,
  senha_interna_enc TEXT NOT NULL,
  classe            TEXT NOT NULL,
  especializacao    TEXT NOT NULL,
  servidor          TEXT NOT NULL DEFAULT 'INFINITY' CHECK (servidor IN ('INFINITY','ROGUE')),
  tier              SMALLINT NOT NULL DEFAULT 3 CHECK (tier IN (1,2,3)),
  ativo             BOOLEAN NOT NULL DEFAULT true,
  status            TEXT NOT NULL DEFAULT 'DISPONIVEL' CHECK (status IN ('DISPONIVEL','EM_USO')),
  user_id           TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coletas (
  id              TEXT PRIMARY KEY,
  guild_id        TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  conta_id        TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  user_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
  nome_pessoa     TEXT NOT NULL,
  servidor_origem TEXT NOT NULL,
  data_hora       TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_entrega    TIMESTAMPTZ,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  conta_login     TEXT,
  classe          TEXT,
  especializacao  TEXT,
  holder_id       TEXT
);

-- ============================================================
-- SEED DA GUILDA PADRÃO (IMPERIUM) & BACKFILL SE GUILD_ID FOR NULL
-- ============================================================

INSERT INTO guilds (id, slug, nome, reino, servidor, ativa)
VALUES ('g-imperium', 'imperium', 'IMPERIUM', 'RED', 'ROGUE', true)
ON CONFLICT (slug) DO NOTHING;

-- Chave vitalícia para a guilda padrão
INSERT INTO licenses (id, key, guild_id, plano, status, valida_ate)
VALUES ('lic-imperium-default', 'WYD-IMP-MASTER-2026', 'g-imperium', 'VITALICIO', 'ATIVA', now() + INTERVAL '100 years')
ON CONFLICT (key) DO NOTHING;

-- Backfill de dados existentes sem tenant
UPDATE users SET guild_id = 'g-imperium' WHERE guild_id IS NULL;
UPDATE characters SET guild_id = 'g-imperium' WHERE guild_id IS NULL;
UPDATE events SET guild_id = 'g-imperium' WHERE guild_id IS NULL;
UPDATE confirmations SET guild_id = 'g-imperium' WHERE guild_id IS NULL;
UPDATE awards SET guild_id = 'g-imperium' WHERE guild_id IS NULL;

-- A tabela awards nasceu monotenant com PRIMARY KEY (key), e o CREATE TABLE
-- IF NOT EXISTS acima nunca a redefiniu. Com a chave assim, os 4 prêmios são
-- globalmente únicos e a segunda guilda não consegue ter os seus. Reancora em
-- (guild_id, key).
ALTER TABLE awards ALTER COLUMN guild_id SET NOT NULL;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'awards'::regclass AND contype = 'p'
      AND pg_get_constraintdef(oid) = 'PRIMARY KEY (key)'
  ) THEN
    ALTER TABLE awards DROP CONSTRAINT awards_pkey;
    ALTER TABLE awards ADD CONSTRAINT awards_pkey PRIMARY KEY (guild_id, key);
  END IF;
END $$;

-- ============================================================
-- ÍNDICES DE PERFORMANCE MULTI-TENANT
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_guilds_slug ON guilds(slug);
CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(key);
CREATE INDEX IF NOT EXISTS idx_licenses_guild ON licenses(guild_id);
CREATE INDEX IF NOT EXISTS idx_users_guild ON users(guild_id);
CREATE INDEX IF NOT EXISTS idx_characters_guild ON characters(guild_id);
CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id);
CREATE INDEX IF NOT EXISTS idx_events_guild ON events(guild_id);
CREATE INDEX IF NOT EXISTS idx_events_dia ON events(dia);
CREATE INDEX IF NOT EXISTS idx_confirmations_guild ON confirmations(guild_id);
CREATE INDEX IF NOT EXISTS idx_confirmations_event ON confirmations(event_id);
CREATE INDEX IF NOT EXISTS idx_accounts_guild ON accounts(guild_id);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
CREATE INDEX IF NOT EXISTS idx_coletas_guild ON coletas(guild_id);
CREATE INDEX IF NOT EXISTS idx_coletas_holder ON coletas(holder_id) WHERE ativo;
CREATE INDEX IF NOT EXISTS idx_coletas_data ON coletas(data_hora DESC);
