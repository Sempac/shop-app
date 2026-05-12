-- Suppliers catalog
CREATE TABLE IF NOT EXISTS suppliers_catalog (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  website        VARCHAR(200),
  search_url     VARCHAR(300),
  logo_emoji     VARCHAR(10)  DEFAULT '🏭',
  specialty      VARCHAR(200),
  delivery       VARCHAR(50),
  rating         INT          DEFAULT 5,
  notes          TEXT,
  query_encoding VARCHAR(10)  DEFAULT 'plus',
  is_active      BOOLEAN      DEFAULT TRUE,
  created_at     TIMESTAMP    DEFAULT NOW()
);

-- Supplier prices
CREATE TABLE IF NOT EXISTS supplier_prices (
  id             SERIAL PRIMARY KEY,
  product_name   VARCHAR(200) NOT NULL,
  product_id     INT REFERENCES products(id) ON DELETE SET NULL,
  supplier_id    INT REFERENCES suppliers_catalog(id) ON DELETE CASCADE,
  price          NUMERIC(10,2),
  quality_type   VARCHAR(50),
  quality_rating INT          DEFAULT 3,
  in_stock       BOOLEAN      DEFAULT TRUE,
  url            VARCHAR(300),
  notes          TEXT,
  updated_at     TIMESTAMP    DEFAULT NOW()
);

-- Fournisseurs par defaut
INSERT INTO suppliers_catalog (name, website, search_url, logo_emoji, specialty, delivery, rating, notes, query_encoding) VALUES
('UTOPYA',        'https://www.utopya.fr',         'https://www.utopya.fr/catalogsearch/result/?q={query}',             '🟣', 'Pieces OEM/OLED, batteries, accessoires, smartphones', '24h',    5, 'Reference pro depuis 2009. Large gamme OEM.',       'plus'),
('LCD-Phone',     'https://lcd-phone.com/fr',      'https://lcd-phone.com/fr/recherche?controller=search&s={query}',    '🔵', 'Smartphones, PC, pieces detachees, accessoires B2B',  '24-48h', 4, 'Partenaire B2B. Bonne gamme smartphones.',          'plus'),
('DA-Pieces',     'https://da-pieces.com',         'https://da-pieces.com/search?q={query}&options%5Bprefix%5D=last',   '🟢', 'Pieces testees et garanties, stock France, OLED/OEM', '24h',    4, 'Pieces testees en France. Bon SAV.',                'plus'),
('Pieces2Mobile', 'https://www.pieces2mobile.com', 'https://www.pieces2mobile.com/catalogsearch/result/?q={query}',     '🟡', 'Pieces toutes marques, prix de gros pro',             '48-72h', 3, 'Bon rapport qualite/prix sur les gammes LCD.',      'plus'),
('Mobilax',       'https://www.mobilax.fr',        'https://www.mobilax.fr/search/{query}/0/search-product',            '🟠', 'Pieces + accessoires depuis 2010',                    '24-48h', 4, 'Large catalogue. Bon pour accessoires.',             'percent'),
('Brico-Phone',   'https://www.brico-phone.com',   'https://www.brico-phone.com/catalogsearch/result/?q={query}',       '🔴', 'Multi-gammes LCD/OLED/AMOLED, batteries',            '24-48h', 3, 'Bon pour comparer les gammes ecrans.',              'plus'),
('BackMarket',    'https://www.backmarket.fr',      'https://www.backmarket.fr/fr-fr/search?q={query}',                  '🟤', 'Prix marche - smartphones reconditionnes',            '3-5j',   4, 'Marketplace. Utile pour les prix de revente.',      'plus'),
('LeBonCoin',     'https://www.leboncoin.fr',       'https://www.leboncoin.fr/recherche?text={query}&category=2',        '🟠', 'Prix marche occasion - smartphones',                 'Variable',3,'Occasion particuliers. Prix bas du marche.',        'plus')
ON CONFLICT DO NOTHING;

SELECT name, delivery, rating FROM suppliers_catalog ORDER BY rating DESC;
