-- ═══════════════════════════════════════════════════════
-- SYNCHRONISATION PROD → IMAGE DU DEV
-- The SMARTPHONE POS — 21/05/2026
-- À exécuter sur la PROD UNIQUEMENT
-- ═══════════════════════════════════════════════════════

-- 1. Corriger encodage quantite_reçue dans commande_items
DO $$
BEGIN
  -- Essayer le nom mal encodé
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='commande_items' 
    AND column_name LIKE 'quantite_re%ue'
    AND column_name != 'quantite_reçue'
  ) THEN
    EXECUTE 'ALTER TABLE commande_items RENAME COLUMN "' || 
      (SELECT column_name FROM information_schema.columns 
       WHERE table_name='commande_items' AND column_name LIKE 'quantite_re%ue'
       AND column_name != 'quantite_reçue' LIMIT 1) || 
      '" TO "quantite_reçue"';
    RAISE NOTICE 'quantite_reçue renommée ✅';
  ELSE
    RAISE NOTICE 'quantite_reçue déjà OK ✅';
  END IF;
END $$;

-- 2. Colonnes expenses HT/TTC/TVA
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS amount_ht  NUMERIC(10,2) DEFAULT 0;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS amount_ttc NUMERIC(10,2) DEFAULT 0;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS taux_tva   NUMERIC(5,2)  DEFAULT 20;

-- 3. Colonnes commandes
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS date_facture          DATE;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS date_livraison_prevue DATE;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS transporteur          VARCHAR(100);

-- 4. Table todos (tâches partagées accueil)
CREATE TABLE IF NOT EXISTS todos (
  id          SERIAL PRIMARY KEY,
  text        VARCHAR(300) NOT NULL,
  priority    VARCHAR(5)   DEFAULT 'P1',
  done        BOOLEAN      DEFAULT FALSE,
  created_by  VARCHAR(100) DEFAULT '',
  created_at  TIMESTAMP    DEFAULT NOW(),
  updated_at  TIMESTAMP    DEFAULT NOW()
);

-- 5. Vérification finale
SELECT 
  'expenses.amount_ht'          AS check, EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='amount_ht') AS ok
UNION ALL SELECT 
  'commandes.transporteur',      EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='commandes' AND column_name='transporteur')
UNION ALL SELECT 
  'commande_items.quantite_reçue', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='commande_items' AND column_name='quantite_reçue')
UNION ALL SELECT 
  'todos table',                 EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='todos');

SELECT 'Synchronisation terminée ✅' AS status;
