CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  nome       TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'MEMBRO' CHECK (role IN ('ADMIN','MEMBRO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migração: bancos antigos exigiam login Google (google_sub/email). Sem login,
-- a identidade vive no cookie do navegador; solta as antigas colunas obrigatórias.
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
  tipo TEXT NOT NULL CHECK (tipo IN ('TORRE','KEFRA','NOATUM')),
  data TIMESTAMPTZ NOT NULL,
  dia  DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS confirmations (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id     TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  character_id TEXT REFERENCES characters(id) ON DELETE SET NULL,
  status       TEXT NOT NULL CHECK (status IN ('VOU','NAO_VOU','TALVEZ')),
  participou   BOOLEAN,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Prêmios da semana: 4 tipos fixos, cada um com liga/desliga + texto do prêmio.
CREATE TABLE IF NOT EXISTS awards (
  key    TEXT PRIMARY KEY,
  label  TEXT NOT NULL,
  ativo  BOOLEAN NOT NULL DEFAULT false,
  premio TEXT NOT NULL DEFAULT '',
  ordem  INT NOT NULL DEFAULT 0
);

-- Migrações idempotentes p/ bancos já existentes:
-- KS e Kefra lançados pelo admin por participação em guerra.
ALTER TABLE confirmations ADD COLUMN IF NOT EXISTS ks    INT NOT NULL DEFAULT 0;
ALTER TABLE confirmations ADD COLUMN IF NOT EXISTS kefra INT NOT NULL DEFAULT 0;
-- Cancelamento de uma guerra específica (a geração lazy pula a cancelada).
ALTER TABLE events ADD COLUMN IF NOT EXISTS cancelado BOOLEAN NOT NULL DEFAULT false;
-- Quem deu o KS da guerra (coluna órfã de uma abordagem antiga; mantida por compat).
ALTER TABLE events ADD COLUMN IF NOT EXISTS ks_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
-- Mais de uma guerra por dia (Torre + Kefra na terça): chave passa a ser (dia, tipo).
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_dia_key;
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_tipo_check;
ALTER TABLE events ADD CONSTRAINT events_tipo_check CHECK (tipo IN ('TORRE','KEFRA','NOATUM'));
CREATE UNIQUE INDEX IF NOT EXISTS uniq_events_dia_tipo ON events(dia, tipo);
-- Fim da guerra: Torre encerra no horário fixo (início + duração). Kefra é mob, então
-- encerra no botão do líder ("Kefra morto") OU no fim do timer — o que vier primeiro.
ALTER TABLE events ADD COLUMN IF NOT EXISTS fim          TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS encerrado_em TIMESTAMPTZ;
UPDATE events SET fim = data + INTERVAL '35 minutes' WHERE fim IS NULL AND tipo = 'TORRE';
UPDATE events SET fim = data + INTERVAL '20 minutes' WHERE fim IS NULL AND tipo IN ('KEFRA','NOATUM');
-- Equipamento do personagem (set inteiro num JSON). Gear score é derivado.
ALTER TABLE characters ADD COLUMN IF NOT EXISTS equipment JSONB;

CREATE INDEX IF NOT EXISTS idx_confirmations_event ON confirmations(event_id);
CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id);
CREATE INDEX IF NOT EXISTS idx_events_dia ON events(dia);

-- Seed dos 4 tipos de prêmio (idempotente; só o admin liga/edita o texto).
INSERT INTO awards (key, label, ordem) VALUES
  ('PONTOS',       'Pontuação da semana',      1),
  ('KS_TORRE',     'Top KS na Torre',          2),
  ('KEFRA',        'Top Kefra',                3),
  ('PARTICIPACAO', 'Presença nas guerras',     4)
ON CONFLICT (key) DO NOTHING;
