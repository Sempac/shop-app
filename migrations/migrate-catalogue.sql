ALTER TABLE products ADD COLUMN IF NOT EXISTS catalogue_visible BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS catalogue_price NUMERIC(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS catalogue_description TEXT;

CREATE TABLE IF NOT EXISTS catalogue_services (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  name_en VARCHAR(200),
  name_ar VARCHAR(200),
  name_zh VARCHAR(200),
  name_de VARCHAR(200),
  name_es VARCHAR(200),
  name_it VARCHAR(200),
  price NUMERIC(10,2),
  price_market NUMERIC(10,2),
  delay VARCHAR(50),
  visible BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS catalogue_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT
);

INSERT INTO catalogue_settings (key, value) VALUES
  ('shop_name', 'The SMARTPHONE'),
  ('shop_address', '1 Avenue d''Italie, 75013 Paris'),
  ('shop_phone', ''),
  ('shop_tagline_fr', 'Reparation . Vente . Impression'),
  ('shop_tagline_en', 'Repair . Sales . Printing'),
  ('shop_tagline_ar', 'اصلاح . بيع . طباعة'),
  ('shop_tagline_zh', 'Weixiu . Xiaoshou . Dayin'),
  ('shop_tagline_de', 'Reparatur . Verkauf . Druck'),
  ('shop_tagline_es', 'Reparacion . Venta . Impresion'),
  ('shop_tagline_it', 'Riparazione . Vendita . Stampa'),
  ('catalogue_url', 'http://localhost:3000/catalogue'),
  ('google_rating', '4.8'),
  ('google_reviews', '485')
ON CONFLICT (key) DO NOTHING;

-- Reparations exemples pre-remplies
INSERT INTO catalogue_services (category, name, name_en, price, price_market, delay, sort_order) VALUES
  ('reparation', 'Remplacement ecran iPhone 12', 'iPhone 12 screen replacement', 130, 160, '1h', 1),
  ('reparation', 'Remplacement ecran Samsung', 'Samsung screen replacement', 89, 120, '1h', 2),
  ('reparation', 'Changement batterie iPhone', 'iPhone battery replacement', 59, 80, '30min', 3),
  ('reparation', 'Changement batterie Samsung', 'Samsung battery replacement', 49, 70, '30min', 4),
  ('reparation', 'Diagnostic gratuit', 'Free diagnostic', 0, 0, '15min', 5),
  ('impression', 'Impression A4 N&B', 'A4 B&W printing', 0.10, NULL, NULL, 10),
  ('impression', 'Impression A4 couleur', 'A4 color printing', 0.50, NULL, NULL, 11),
  ('impression', 'Photocopie A4', 'A4 photocopy', 0.10, NULL, NULL, 12),
  ('impression', 'Impression A3', 'A3 printing', 1.00, NULL, NULL, 13)
ON CONFLICT DO NOTHING;
