-- ============================================================
--  Module Comparateur Fournisseurs
-- ============================================================

-- Table fournisseurs avec URLs de recherche
CREATE TABLE IF NOT EXISTS suppliers_catalog (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  website      VARCHAR(200),
  search_url   VARCHAR(300),  -- URL avec {query} remplacé par le terme
  logo_emoji   VARCHAR(10) DEFAULT '🏭',
  specialty    VARCHAR(200),  -- Ex: "Pièces OEM, OLED, batteries"
  delivery     VARCHAR(50),   -- Ex: "24h"
  rating       INT DEFAULT 5, -- Note globale /5
  notes        TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- Table prix fournisseurs par produit
CREATE TABLE IF NOT EXISTS supplier_prices (
  id              SERIAL PRIMARY KEY,
  product_name    VARCHAR(200) NOT NULL,  -- Ex: "Écran iPhone 12"
  product_id      INT REFERENCES products(id) ON DELETE SET NULL,
  supplier_id     INT REFERENCES suppliers_catalog(id) ON DELETE CASCADE,
  price           NUMERIC(10,2),
  quality_type    VARCHAR(50),  -- OEM, OLED, INCELL, LCD, Original, Compatible
  quality_rating  INT DEFAULT 3, -- Note qualité /5
  in_stock        BOOLEAN DEFAULT TRUE,
  url             VARCHAR(300), -- Lien direct vers le produit
  notes           TEXT,
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- Insérer les fournisseurs par défaut
INSERT INTO suppliers_catalog (name, website, search_url, logo_emoji, specialty, delivery, rating, notes) VALUES
('UTOPYA',        'https://www.utopya.fr',           'https://www.utopya.fr/recherche?search={query}',                   '🟣', 'Pièces OEM/OLED, batteries, accessoires, smartphones', '24h',    5, 'Référence pro depuis 2009. Large gamme OEM.'),
('LCD-Phone',     'https://lcd-phone.com/fr',        'https://lcd-phone.com/fr/recherche?q={query}',                     '🔵', 'Smartphones, PC, pièces détachées, accessoires B2B',   '24-48h', 4, 'Partenaire B2B. Bonne gamme smartphones reconditionnés.'),
('DA-Pièces',     'https://da-pieces.com',           'https://da-pieces.com/?s={query}',                                 '🟢', 'Pièces testées et garanties, stock France, OLED/OEM',  '24h',    4, 'Pièces testées en France. Bon SAV. Service microsoudure.'),
('Pieces2Mobile', 'https://www.pieces2mobile.com',   'https://www.pieces2mobile.com/catalogsearch/result/?q={query}',    '🟡', 'Pièces toutes marques, prix de gros pro',              '48-72h', 3, 'Bon rapport qualité/prix sur les gammes LCD.'),
('Mobilax',       'https://www.mobilax.fr',          'https://www.mobilax.fr/recherche?q={query}',                       '🟠', 'Pièces + accessoires + objets connectés depuis 2010',  '24-48h', 4, 'Large catalogue. Bon pour accessoires.'),
('Brico-Phone',   'https://www.brico-phone.com',     'https://www.brico-phone.com/catalogsearch/result/?q={query}',      '🔴', 'Multi-gammes LCD/OLED/AMOLED, batteries',             '24-48h', 3, 'Bon pour comparer les gammes écrans.')
ON CONFLICT DO NOTHING;

-- Vérification
SELECT name, specialty, delivery, rating FROM suppliers_catalog ORDER BY rating DESC;
