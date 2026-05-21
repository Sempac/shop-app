ALTER TABLE commandes ADD COLUMN IF NOT EXISTS date_facture         DATE;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS date_livraison_prevue DATE;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS transporteur          VARCHAR(100);
SELECT 'commandes fields ajoutés ✅' AS status;
