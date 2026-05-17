SET search_path TO public;

-- Nouveaux champs dans products
ALTER TABLE products ADD COLUMN IF NOT EXISTS imei VARCHAR(20);
ALTER TABLE products ADD COLUMN IF NOT EXISTS numero_serie VARCHAR(50);
ALTER TABLE products ADD COLUMN IF NOT EXISTS statut_produit VARCHAR(20) DEFAULT 'DISPONIBLE';
ALTER TABLE products ADD COLUMN IF NOT EXISTS type_entree VARCHAR(20) DEFAULT 'COMMANDE';
ALTER TABLE products ADD COLUMN IF NOT EXISTS lot_id INT REFERENCES lots(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS commande_id INT REFERENCES commandes(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS client_rachat_nom VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS client_rachat_tel VARCHAR(20);
ALTER TABLE products ADD COLUMN IF NOT EXISTS notes TEXT;

-- Table codes barres multiples
CREATE TABLE IF NOT EXISTS product_barcodes (
  id          SERIAL PRIMARY KEY,
  product_id  INT REFERENCES products(id) ON DELETE CASCADE,
  barcode     VARCHAR(100) NOT NULL,
  fournisseur VARCHAR(100),
  notes       TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Migrer les barcodes existants
INSERT INTO product_barcodes (product_id, barcode)
SELECT id, barcode FROM products
WHERE barcode IS NOT NULL AND barcode != ''
ON CONFLICT DO NOTHING;

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_product_barcodes_barcode ON product_barcodes(barcode);
CREATE INDEX IF NOT EXISTS idx_products_imei ON products(imei);
CREATE INDEX IF NOT EXISTS idx_products_statut ON products(statut_produit);
CREATE INDEX IF NOT EXISTS idx_products_type_entree ON products(type_entree);

-- Vérification
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'products' AND table_schema = 'public'
ORDER BY ordinal_position;
