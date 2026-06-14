-- ============================================================
--  Migration : dates + numérotation
-- ============================================================
SET search_path TO public;

-- ── updated_at sur toutes les tables ──
ALTER TABLE products    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE orders      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE expenses    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE lot_costs   ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE print_queue ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE returns_store     ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE returns_supplier  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE stock_damaged     ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE supplier_prices   ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- ── Numérotation réparations REP-YYYYMMDD-NNN ──
-- Ajouter colonne numero_rep
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS numero_rep VARCHAR(20) UNIQUE;

-- Générer les numéros pour les réparations existantes
DO $$
DECLARE
  r RECORD;
  day_str TEXT;
  day_count INT;
  new_num VARCHAR(20);
BEGIN
  FOR r IN SELECT id, created_at FROM repairs ORDER BY created_at ASC, id ASC LOOP
    day_str := TO_CHAR(r.created_at, 'YYYYMMDD');
    SELECT COUNT(*) + 1 INTO day_count
      FROM repairs
      WHERE TO_CHAR(created_at, 'YYYYMMDD') = day_str
        AND id < r.id
        AND numero_rep IS NOT NULL;
    new_num := 'REP-' || day_str || '-' || LPAD(day_count::TEXT, 3, '0');
    UPDATE repairs SET numero_rep = new_num WHERE id = r.id;
  END LOOP;
END $$;

-- ── Table devis ──
CREATE TABLE IF NOT EXISTS devis (
  id           SERIAL PRIMARY KEY,
  numero_dev   VARCHAR(20) UNIQUE,
  customer_name VARCHAR(100),
  phone        VARCHAR(30),
  email        VARCHAR(100),
  validite     INT DEFAULT 30,         -- en jours
  status       VARCHAR(20) DEFAULT 'EN_ATTENTE', -- EN_ATTENTE, ACCEPTE, REFUSE, EXPIRE, CONVERTI
  notes        TEXT,
  converted_to VARCHAR(20),            -- 'order' ou 'repair'
  converted_id INT,
  total        NUMERIC(10,2) DEFAULT 0,
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devis_items (
  id          SERIAL PRIMARY KEY,
  devis_id    INT REFERENCES devis(id) ON DELETE CASCADE,
  description VARCHAR(200) NOT NULL,
  quantity    INT DEFAULT 1,
  price       NUMERIC(10,2) DEFAULT 0,
  discount    NUMERIC(10,2) DEFAULT 0,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ── Table factures (numérotation) ──
CREATE TABLE IF NOT EXISTS factures (
  id          SERIAL PRIMARY KEY,
  numero_fac  VARCHAR(20) UNIQUE,
  order_id    INT REFERENCES orders(id) ON DELETE SET NULL,
  repair_id   INT REFERENCES repairs(id) ON DELETE SET NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ── Séquences journalières (function helper) ──
CREATE OR REPLACE FUNCTION next_numero(prefix TEXT, date_str TEXT, table_name TEXT, col_name TEXT)
RETURNS TEXT AS $$
DECLARE
  cnt INT;
  pattern TEXT;
BEGIN
  pattern := prefix || '-' || date_str || '-%';
  EXECUTE format('SELECT COUNT(*) FROM %I WHERE %I LIKE $1', table_name, col_name)
    INTO cnt USING pattern;
  RETURN prefix || '-' || date_str || '-' || LPAD((cnt + 1)::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Vérification
SELECT 'repairs' AS table_name, COUNT(*) AS avec_numero FROM repairs WHERE numero_rep IS NOT NULL
UNION ALL
SELECT 'devis', COUNT(*) FROM devis
UNION ALL
SELECT 'factures', COUNT(*) FROM factures;
