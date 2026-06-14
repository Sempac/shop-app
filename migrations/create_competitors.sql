-- Comparateur prix reparations concurrents
CREATE TABLE IF NOT EXISTS repair_competitors (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  website     VARCHAR(200),
  search_url  VARCHAR(300),
  logo_emoji  VARCHAR(10) DEFAULT '🔧',
  zone        VARCHAR(50) DEFAULT 'National',
  notes       TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS repair_prices (
  id              SERIAL PRIMARY KEY,
  device_brand    VARCHAR(50)  NOT NULL,
  device_model    VARCHAR(100) NOT NULL,
  repair_type     VARCHAR(100) NOT NULL,
  competitor_id   INT REFERENCES repair_competitors(id) ON DELETE CASCADE,
  price           NUMERIC(10,2),
  delay           VARCHAR(50),
  quality_rating  INT DEFAULT 3,
  notes           TEXT,
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- Concurrents par defaut
INSERT INTO repair_competitors (name, website, search_url, logo_emoji, zone, notes) VALUES
('Wefix',        'https://www.wefix.fr',             'https://www.wefix.fr/reparation/{query}',                    'W',  'National',  'Present en Fnac. Rapide, garantie 1 an.'),
('iCracked',     'https://www.icracked.com',          'https://www.icracked.com/repair',                            'i',  'National',  'Specialiste Apple. Techniciens certifies.'),
('Murfy',        'https://www.murfy.fr',              'https://www.murfy.fr/reparation',                            'M',  'National',  'Reparation a domicile. Eco-responsable.'),
('Fnac Darty SAV','https://www.fnac.com/sav',         'https://www.fnac.com/reparation-smartphone',                 'F',  'National',  'SAV officiel. Prix eleves, garantie constructeur.'),
('SOS Accessoire','https://www.sosav.fr',             'https://www.sosav.fr/guides-reparation',                     'S',  'National',  'Vente pieces + tutoriels. Pas de SAV direct.'),
('Phone Repair 13','https://www.google.com/maps',    'https://www.google.com/maps/search/reparation+telephone+paris+13', 'P', 'Paris 13', 'Concurrents locaux Paris 13eme.')
ON CONFLICT DO NOTHING;

SELECT name, zone FROM repair_competitors ORDER BY zone, name;
