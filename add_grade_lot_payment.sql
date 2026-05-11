-- ============================================================
--  THE SMARTPHONE — Grade produit + Paiement lot
-- ============================================================

-- 1. Colonne grade sur products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS grade VARCHAR(20) DEFAULT NULL;
-- Valeurs : 'NEUF' | 'Grade A+' | 'Grade A' | 'Grade B' | 'Grade C' | 'Grade D' | 'Pour pièces'

-- 2. Colonnes paiement sur lots (comme les ventes)
ALTER TABLE lots
  ADD COLUMN IF NOT EXISTS amount_cb     NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_cash   NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_credit NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expense_id    INT;  -- Lien vers la dépense créée automatiquement

-- 3. Vérification
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'products' AND column_name IN ('grade','color','supplier_name','location_zone')
ORDER BY column_name;

SELECT column_name FROM information_schema.columns
WHERE table_name = 'lots'
ORDER BY column_name;
