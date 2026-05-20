-- Vérifier si lot_items a des données importantes avant de supprimer
SELECT COUNT(*) AS nb_lot_items FROM lot_items;
SELECT COUNT(*) AS nb_lot_costs_avec_item FROM lot_costs WHERE lot_item_id IS NOT NULL;

-- Mettre lot_item_id à NULL dans lot_costs (on garde les coûts)
UPDATE lot_costs SET lot_item_id = NULL WHERE lot_item_id IS NOT NULL;

-- Supprimer la table lot_items
DROP TABLE IF EXISTS lot_items CASCADE;

-- Supprimer la colonne lot_item_id de lot_costs (devenue inutile)
ALTER TABLE lot_costs DROP COLUMN IF EXISTS lot_item_id;

SELECT 'lot_items supprimée ✅' AS status;
