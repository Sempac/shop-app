-- Suppliers catalog
CREATE TABLE IF NOT EXISTS suppliers_catalog (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  website        VARCHAR(200),
  search_url     VARCHAR(300),
  logo_emoji     VARCHAR(10)  DEFAULT '',
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
INSERT INTO suppliers_catalog (name, website, search_url, specialty, delivery, rating, notes, query_encoding) VALUES
('UTOPYA',        'https://www.utopya.fr',         'https://www.utopya.fr/catalogsearch/result/?q={query}',          'Pieces OEM/OLED, batteries, accessoires', '24h',    5, 'Reference pro depuis 2009.',   'plus'),
('LCD-Phone',     'https://lcd-phone.com/fr',      'https://lcd-phone.com/fr/recherche?controller=search&s={query}', 'Smartphones, PC, pieces detachees B2B',   '24-48h', 4, 'Partenaire B2B.',              'plus'),
('DA-Pieces',     'https://da-pieces.com',         'https://da-pieces.com/search?q={query}&options%5Bprefix%5D=last','Pieces testees et garanties, France',     '24h',    4, 'Pieces testees. Bon SAV.',     'plus'),
('Pieces2Mobile', 'https://www.pieces2mobile.com', 'https://www.pieces2mobile.com/catalogsearch/result/?q={query}',  'Pieces toutes marques, prix de gros',     '48-72h', 3, 'Bon rapport qualite/prix.',    'plus'),
('Mobilax',       'https://www.mobilax.fr',        'https://www.mobilax.fr/search/{query}/0/search-product',         'Pieces + accessoires depuis 2010',        '24-48h', 4, 'Large catalogue.',             'percent'),
('Brico-Phone',   'https://www.brico-phone.com',   'https://www.brico-phone.com/catalogsearch/result/?q={query}',   'Multi-gammes LCD/OLED/AMOLED',            '24-48h', 3, 'Gammes ecrans.',               'plus'),
('BackMarket',    'https://www.backmarket.fr',     'https://www.backmarket.fr/fr-fr/search?q={query}',               'Prix marche - reconditionnes',            '3-5j',   4, 'Utile pour prix de revente.', 'plus'),
('LeBonCoin',     'https://www.leboncoin.fr',      'https://www.leboncoin.fr/recherche?text={query}&category=2',     'Prix marche occasion',                    'Variable',3,'Prix bas du marche.',         'plus')
ON CONFLICT DO NOTHING;

SELECT name, delivery, rating FROM suppliers_catalog ORDER BY rating DESC;
