-- ============================================================
--  THE SMARTPHONE — Gestion utilisateurs
-- ============================================================

CREATE TABLE IF NOT EXISTS app_users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(50) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'vendeur', -- gerant | vendeur
  auth_type     VARCHAR(10) NOT NULL DEFAULT 'pin',     -- pin | password
  pin           VARCHAR(4),
  password_hash VARCHAR(100),
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- Catégories dépenses autorisées par rôle
CREATE TABLE IF NOT EXISTS expense_categories_config (
  id          SERIAL PRIMARY KEY,
  category    VARCHAR(50) NOT NULL UNIQUE,
  allowed_roles VARCHAR(50) DEFAULT 'gerant,vendeur', -- 'gerant' ou 'gerant,vendeur'
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Catégories par défaut
INSERT INTO expense_categories_config (category, allowed_roles) VALUES
('Fournisseur',   'gerant'),
('Salaires',      'gerant'),
('Loyer',         'gerant'),
('Abonnements',   'gerant'),
('Banque',        'gerant'),
('Comptabilité',  'gerant'),
('Entretien',     'gerant,vendeur'),
('Fournitures',   'gerant,vendeur'),
('Transport',     'gerant,vendeur'),
('Café / Repas',  'gerant,vendeur'),
('Autre',         'gerant,vendeur')
ON CONFLICT (category) DO NOTHING;

-- Créer le gérant par défaut (PIN: 1234 — à changer !)
INSERT INTO app_users (name, role, auth_type, pin) VALUES
('Gérant', 'gerant', 'pin', '1234')
ON CONFLICT DO NOTHING;

-- Créer un vendeur par défaut (PIN: 0000)
INSERT INTO app_users (name, role, auth_type, pin) VALUES
('Vendeur', 'vendeur', 'pin', '0000')
ON CONFLICT DO NOTHING;

SELECT id, name, role, auth_type FROM app_users;
SELECT category, allowed_roles FROM expense_categories_config ORDER BY category;
