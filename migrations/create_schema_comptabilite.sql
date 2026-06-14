-- ============================================================
-- Schéma comptabilite (v1 - test)
-- Miroir du schéma public avec règles de gestion comptables
-- ============================================================

CREATE SCHEMA IF NOT EXISTS comptabilite;

-- ── repairs : réparations validées comptablement ────────────
-- Contient les réparations dont le cumul espèces du jour ≤ 200 €
CREATE TABLE IF NOT EXISTS comptabilite.repairs (LIKE public.repairs INCLUDING ALL);

-- ── repairs_cash_excess : dépassement plafond espèces ───────
-- Contient les réparations cash qui font dépasser 200 €/jour
CREATE TABLE IF NOT EXISTS comptabilite.repairs_cash_excess (
  LIKE public.repairs INCLUDING ALL,
  cumul_avant   numeric,   -- cumul espèces du jour AVANT cette réparation
  cumul_apres   numeric,   -- cumul espèces du jour APRÈS (aurait dépassé)
  raison        text,      -- explication lisible
  synced_at     timestamp  DEFAULT now()
);

-- ── sync_log : journal des synchronisations ─────────────────
CREATE TABLE IF NOT EXISTS comptabilite.sync_log (
  id          serial PRIMARY KEY,
  synced_at   timestamp DEFAULT now(),
  nb_repairs  integer,
  nb_excess   integer,
  details     text
);
