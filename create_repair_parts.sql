SET search_path TO public;

-- Pièces utilisées dans une réparation
CREATE TABLE IF NOT EXISTS repair_parts (
  id              SERIAL PRIMARY KEY,
  repair_id       INT REFERENCES repairs(id) ON DELETE CASCADE,
  nom             VARCHAR(200) NOT NULL,
  cout            NUMERIC(10,2) DEFAULT 0,
  source          VARCHAR(20) DEFAULT 'ACHAT',
  -- ACHAT = achetée chez fournisseur, INTERNE = récupérée du stock
  inclure_depense BOOLEAN DEFAULT FALSE,
  product_id      INT REFERENCES products(id) ON DELETE SET NULL,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Lier réparation au produit stock et au lot
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS product_id INT REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS lot_id     INT REFERENCES lots(id) ON DELETE SET NULL;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS source     VARCHAR(20) DEFAULT 'CLIENT';
-- CLIENT = réparation normale client
-- INTERNE = vient d'un lot (badge visible)

-- Lier produit stock à sa réparation en cours
ALTER TABLE products ADD COLUMN IF NOT EXISTS repair_id INT REFERENCES repairs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_repair_parts_repair ON repair_parts(repair_id);
CREATE INDEX IF NOT EXISTS idx_repairs_product     ON repairs(product_id);
CREATE INDEX IF NOT EXISTS idx_repairs_lot         ON repairs(lot_id);
CREATE INDEX IF NOT EXISTS idx_products_repair     ON products(repair_id);

SELECT 'Migration repair_parts ✅' AS status;
