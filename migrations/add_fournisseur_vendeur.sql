SET search_path TO public;

-- Ajouter Fournisseur comme categorie accessible aux vendeurs
UPDATE expense_categories_config 
SET allowed_roles = 'gerant,vendeur'
WHERE category IN ('Fournisseur', 'Fournisseurs');

-- Si la catégorie n'existe pas encore avec ce nom exact
INSERT INTO expense_categories_config (category, allowed_roles)
SELECT 'Fournisseur', 'gerant,vendeur'
WHERE NOT EXISTS (
  SELECT 1 FROM expense_categories_config WHERE category = 'Fournisseur'
);

-- Vérification
SELECT category, allowed_roles FROM expense_categories_config ORDER BY category;
