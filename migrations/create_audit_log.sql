CREATE TABLE IF NOT EXISTS audit_log (
  id          SERIAL PRIMARY KEY,
  action      VARCHAR(20)  NOT NULL,          -- 'SUPPRESSION' | 'MODIFICATION'
  module      VARCHAR(30)  NOT NULL,          -- 'VENTE' | 'REPARATION' | 'DEPENSE'
  record_id   INTEGER      NOT NULL,
  record_date DATE,                           -- date de la transaction originale
  user_name   VARCHAR(100) DEFAULT 'Inconnu',
  details     JSONB,                          -- { avant:{...}, apres:{...} }
  created_at  TIMESTAMP    DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_module     ON audit_log(module);
