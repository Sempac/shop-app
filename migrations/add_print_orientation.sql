-- Migration : ajout orientation à la file d'impression
ALTER TABLE print_queue ADD COLUMN IF NOT EXISTS orientation VARCHAR(10) DEFAULT 'portrait';
