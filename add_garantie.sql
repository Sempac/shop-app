-- Ajouter colonne garantie dans orders et repairs
ALTER TABLE orders  ADD COLUMN IF NOT EXISTS garantie INT; -- en mois
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS garantie INT; -- en mois

-- Verification
SELECT column_name FROM information_schema.columns
WHERE table_name IN ('orders','repairs') AND column_name='garantie';
