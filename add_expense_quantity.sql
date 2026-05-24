ALTER TABLE expenses ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 1;
SELECT 'quantity ajouté à expenses ✅' AS status;
