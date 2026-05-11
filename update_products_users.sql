-- ============================================================
--  THE SMARTPHONE — Nouvelles données
-- ============================================================

-- 1. Cartes SIM
INSERT INTO products (name, category, condition, purchase_price, sale_price, stock_quantity) VALUES
('Carte SIM Lycamobile',        'Carte SIM', 'NEUF', 1,  3,  10),
('Carte SIM Free Mobile',       'Carte SIM', 'NEUF', 1,  3,  10),
('Carte SIM Lebara',            'Carte SIM', 'NEUF', 1,  3,  10),
('Carte SIM SFR',               'Carte SIM', 'NEUF', 1,  5,  10),
('Carte SIM Orange',            'Carte SIM', 'NEUF', 1,  5,  10),
('Carte SIM Bouygues',          'Carte SIM', 'NEUF', 1,  5,  10),
('Recharge Lycamobile 10€',     'Carte SIM', 'NEUF', 8,  10, 20),
('Recharge Lycamobile 20€',     'Carte SIM', 'NEUF', 18, 20, 20),
('Recharge Free Mobile 10€',    'Carte SIM', 'NEUF', 8,  10, 20),
('Recharge Free Mobile 20€',    'Carte SIM', 'NEUF', 18, 20, 20),
('Recharge Lebara 10€',         'Carte SIM', 'NEUF', 8,  10, 20),
('Recharge Orange 10€',         'Carte SIM', 'NEUF', 8,  10, 20),
('Recharge SFR 10€',            'Carte SIM', 'NEUF', 8,  10, 20)
ON CONFLICT DO NOTHING;

-- 2. Seuil d'alerte stock sur chaque produit
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock_alert INT DEFAULT 3;
-- stock_alert = quantité en dessous de laquelle on alerte

-- Mettre un seuil par catégorie
UPDATE products SET stock_alert = 5  WHERE category = 'Smartphone';
UPDATE products SET stock_alert = 5  WHERE category = 'Tablette';
UPDATE products SET stock_alert = 5  WHERE category = 'PC Portable';
UPDATE products SET stock_alert = 10 WHERE category = 'Carte SIM';
UPDATE products SET stock_alert = 3  WHERE category IN ('Coque','Protection écran','Chargeur','Câble','Audio');
UPDATE products SET stock_alert = 2  WHERE category IN ('Pièce détachée','Accessoire Info');
UPDATE products SET stock_alert = 1  WHERE category = 'Prestation';

-- 3. Table utilisateurs avec rôles
-- (si la table users existe déjà, on ajoute juste la colonne role)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'vendeur';
  -- admin | vendeur

-- Mettre le gérant en admin
UPDATE users SET role = 'admin' WHERE username = 'gerant';

-- Vérification
SELECT id, username, role, is_active FROM users;
SELECT category, COUNT(*) as nb FROM products GROUP BY category ORDER BY category;
SELECT name, stock_quantity, stock_alert FROM products WHERE stock_quantity <= stock_alert AND category != 'Prestation' ORDER BY stock_quantity;
