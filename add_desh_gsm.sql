SET search_path TO public;

-- Ajouter DESH GSM comme fournisseur
INSERT INTO suppliers_catalog (name, website, search_url, specialty, delivery, rating, notes, query_encoding)
VALUES (
  'DESH GSM',
  'https://deshgsm.com',
  'https://deshgsm.com/search?q={query}',
  'Pieces detachees Apple Samsung, ecrans, batteries',
  '24-48h',
  4,
  'Tel: +33 1 40 18 01 82 / +33 7 65 15 30 58. URL speciale par tag pour Apple.',
  'plus'
)
ON CONFLICT DO NOTHING;

-- Verifier
SELECT name, website, delivery FROM suppliers_catalog WHERE name='DESH GSM';
