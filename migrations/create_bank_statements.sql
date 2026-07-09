-- ============================================================
--  THE SMARTPHONE — Tables relevés bancaires
-- ============================================================

CREATE TABLE IF NOT EXISTS bank_statements (
  id             SERIAL PRIMARY KEY,
  bank_name      VARCHAR(50)   NOT NULL DEFAULT 'CIC',
  account_number VARCHAR(30)   NOT NULL,
  period_start   DATE          NOT NULL,
  period_end     DATE          NOT NULL,
  balance_start  NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance_end    NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_credit   NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_debit    NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMP     DEFAULT NOW(),
  updated_at     TIMESTAMP     DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id               SERIAL PRIMARY KEY,
  statement_id     INTEGER       NOT NULL REFERENCES bank_statements(id) ON DELETE CASCADE,
  transaction_date DATE          NOT NULL,
  label            TEXT          NOT NULL,
  debit            NUMERIC(12,2) NOT NULL DEFAULT 0,
  credit           NUMERIC(12,2) NOT NULL DEFAULT 0,
  category         VARCHAR(80),
  notes            TEXT,
  created_at       TIMESTAMP     DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_tx_stmt ON bank_transactions(statement_id);
CREATE INDEX IF NOT EXISTS idx_bank_tx_date ON bank_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_bank_stmt_period ON bank_statements(period_end DESC);
