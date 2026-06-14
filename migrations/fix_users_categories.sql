SET search_path TO public;

-- Supprimer l utilisateur Gerant generique
DELETE FROM app_users WHERE id = 14;

-- Supprimer categories mal encodees
DELETE FROM expense_categories_config WHERE category LIKE 'Caf%';
DELETE FROM expense_categories_config WHERE category LIKE 'Comptabilit%';

-- Reinserer proprement sans accents
INSERT INTO expense_categories_config (category, allowed_roles) VALUES
('Cafe / Repas',  'gerant,vendeur'),
('Comptabilite',  'gerant')
ON CONFLICT DO NOTHING;

-- Verification
SELECT id, name, role FROM app_users ORDER BY name;
SELECT category, allowed_roles FROM expense_categories_config ORDER BY category;
