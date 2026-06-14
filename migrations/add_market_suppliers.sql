-- Ajouter BackMarket et LeBonCoin comme référence prix marché
INSERT INTO suppliers_catalog (name, website, search_url, logo_emoji, specialty, delivery, rating, notes, query_encoding)
VALUES
(
  'BackMarket',
  'https://www.backmarket.fr',
  'https://www.backmarket.fr/fr-fr/search?q={query}',
  '🟤',
  'Prix marché — smartphones & PC reconditionnés (référence revente)',
  '3-5j',
  4,
  'Marketplace reconditionnés. Utile pour connaître les prix de revente au grand public.',
  'plus'
),
(
  'LeBonCoin',
  'https://www.leboncoin.fr',
  'https://www.leboncoin.fr/recherche?text={query}&category=2',
  '🟠',
  'Prix marché occasion — smartphones & accessoires (référence revente)',
  'Variable',
  3,
  'Occasion entre particuliers. Utile pour voir les prix bas du marché.',
  'plus'
)
ON CONFLICT DO NOTHING;

-- Vérification
SELECT name, specialty, logo_emoji FROM suppliers_catalog ORDER BY name;
