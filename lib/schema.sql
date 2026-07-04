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
  dia  DATE NOT NULL UNIQUE
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

CREATE INDEX IF NOT EXISTS idx_confirmations_event ON confirmations(event_id);
CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id);
