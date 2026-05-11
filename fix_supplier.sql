-- Ajouter colonne fournisseur texte libre sur products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(100);

-- Vérification
SELECT id, name, category, supplier_name, stock_quantity FROM products LIMIT 10;
