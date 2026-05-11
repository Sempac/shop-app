-- ============================================================
--  THE SMARTPHONE — Table contacts
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
  id           SERIAL PRIMARY KEY,
  category     VARCHAR(30) NOT NULL DEFAULT 'Autre',
  -- Equipe | Fournisseur | Reparateur | Transporteur | Banque | Comptable | Juridique | Client VIP | Autre
  name         VARCHAR(100) NOT NULL,
  company      VARCHAR(100),
  phone        VARCHAR(30),
  phone2       VARCHAR(30),
  email        VARCHAR(100),
  whatsapp     VARCHAR(30),   -- si différent du téléphone
  address      TEXT,
  notes        TEXT,
  is_favorite  BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

-- Ajouter téléphone fournisseur sur les lots
ALTER TABLE lots ADD COLUMN IF NOT EXISTS supplier_phone VARCHAR(30);

-- Vérification
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name='contacts';
