-- ============================================================
--  Module Commandes Fournisseurs
-- ============================================================
SET search_path TO public;

-- Table principale commandes
CREATE TABLE IF NOT EXISTS commandes (
  id              SERIAL PRIMARY KEY,
  numero          VARCHAR(30) UNIQUE,
  fournisseur     VARCHAR(100) NOT NULL,
  fournisseur_id  INT REFERENCES suppliers_catalog(id) ON DELETE SET NULL,
  statut          VARCHAR(20) DEFAULT 'EN_ATTENTE',
  -- EN_ATTENTE, PARTIELLEMENT_RECU, RECU, ANNULE
  origine         VARCHAR(20) DEFAULT 'MANUEL',
  -- MANUEL, TECHNICIEN, RUPTURE, IMPORT_PDF
  date_commande   DATE DEFAULT CURRENT_DATE,
  date_livraison  DATE,
  numero_facture  VARCHAR(50),
  fichier_pdf     VARCHAR(200),
  montant_ht      NUMERIC(10,2) DEFAULT 0,
  montant_ttc     NUMERIC(10,2) DEFAULT 0,
  paiement        VARCHAR(20) DEFAULT 'card',
  notes           TEXT,
  created_by      VARCHAR(50),
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- Lignes de commande
CREATE TABLE IF NOT EXISTS commande_items (
  id              SERIAL PRIMARY KEY,
  commande_id     INT REFERENCES commandes(id) ON DELETE CASCADE,
  reference       VARCHAR(50),
  nom             VARCHAR(200) NOT NULL,
  categorie       VARCHAR(50) DEFAULT 'Pièce détachée',
  quantite_cmd    INT DEFAULT 1,
  quantite_reçue  INT DEFAULT 0,
  prix_ht         NUMERIC(10,2) DEFAULT 0,
  prix_ttc        NUMERIC(10,2) DEFAULT 0,
  prix_vente      NUMERIC(10,2) DEFAULT 0,
  statut          VARCHAR(20) DEFAULT 'EN_ATTENTE',
  -- EN_ATTENTE, RECU, PARTIEL, MANQUANT
  produit_id      INT REFERENCES products(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Liste besoins technicien
CREATE TABLE IF NOT EXISTS besoins_technicien (
  id              SERIAL PRIMARY KEY,
  nom             VARCHAR(200) NOT NULL,
  categorie       VARCHAR(50) DEFAULT 'Pièce détachée',
  quantite        INT DEFAULT 1,
  urgence         VARCHAR(10) DEFAULT 'NORMAL',
  -- URGENT, NORMAL, FAIBLE
  notes           TEXT,
  statut          VARCHAR(20) DEFAULT 'EN_ATTENTE',
  -- EN_ATTENTE, COMMANDE, RECU
  commande_id     INT REFERENCES commandes(id) ON DELETE SET NULL,
  created_by      VARCHAR(50),
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Alertes réception
CREATE TABLE IF NOT EXISTS commande_alertes (
  id              SERIAL PRIMARY KEY,
  commande_id     INT REFERENCES commandes(id) ON DELETE CASCADE,
  type            VARCHAR(30),
  -- RELANCE_RECEPTION, RELANCE_REMBOURSEMENT
  message         TEXT,
  lu              BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Numérotation CMD-YYYYMMDD-NNN
SELECT next_numero('CMD', TO_CHAR(NOW(),'YYYYMMDD'), 'commandes', 'numero') AS exemple_numero;

-- Vérification
SELECT table_name FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN ('commandes','commande_items','besoins_technicien','commande_alertes')
ORDER BY table_name;
