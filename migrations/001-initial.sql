-- migrations/001-initial.sql
-- Schéma initial de Splitto

CREATE TYPE currency_enum AS ENUM ('EUR', 'USD', 'GBP', 'CHF');
CREATE TYPE split_mode_enum AS ENUM ('equal', 'weighted', 'percentage');

CREATE TABLE groups (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  currency    currency_enum NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE members (
  id          TEXT PRIMARY KEY,
  group_id    TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE expenses (
  id            TEXT PRIMARY KEY,
  group_id      TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  amount        NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  currency      currency_enum NOT NULL,
  paid_by       TEXT NOT NULL REFERENCES members(id),
  paid_at       TIMESTAMPTZ NOT NULL,
  split_mode    split_mode_enum NOT NULL,
  split_data    JSONB NOT NULL,            -- beneficiaries / weights / percentages
  category      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Empêche un doublon parfait (même groupe, même date, même montant, même payeur)
  CONSTRAINT expenses_no_duplicate
    UNIQUE (group_id, paid_at, amount, paid_by)
);

CREATE INDEX idx_expenses_group_paid_at
  ON expenses (group_id, paid_at DESC);
