-- =============================================================
-- Relevés bancaires CIC · IT TECH · Déc 2025 – Juin 2026
-- Compte N° 00020370701 · SIRET 89357112500028
-- =============================================================
BEGIN;

-- Nettoyage préalable (idempotent)
DELETE FROM bank_statements WHERE account_number = '00020370701';

DO $$
DECLARE s1 INT; s2 INT; s3 INT; s4 INT; s5 INT; s6 INT; s7 INT;
BEGIN

-- ─────────────────── DÉCEMBRE 2025 ───────────────────
INSERT INTO bank_statements(bank_name,account_number,period_start,period_end,balance_start,balance_end,total_credit,total_debit,notes)
VALUES('CIC','00020370701','2025-12-01','2025-12-31',4574.74,1919.19,10921.82,13577.37,'Décembre 2025') RETURNING id INTO s1;

INSERT INTO bank_transactions(statement_id,transaction_date,label,debit,credit,category) VALUES
(s1,'2025-12-31','REMCB REMISES CB TPE 604836901 (total mois)',0,10921.82,'Recettes TPE (REMCB)'),
(s1,'2025-12-10','PRLV SEPA URSSAF ILE DE FRANCE',1030.00,0,'Charges sociales (URSSAF)'),
(s1,'2025-12-10','PRLV MALAKOFF HUMANIS RETRAITE',216.80,0,'Retraite (Malakoff)'),
(s1,'2025-12-05','PRLV SOLUPAIE SARL GESTION PAIE',240.00,0,'Gestion paie (Solupaie)'),
(s1,'2025-12-01','PRLV ACM IARD PLAN SANTE ENTREPRISE',173.96,0,'Mutuelle / Prévoyance'),
(s1,'2025-12-01','PRLV MULTI PRO ACM IARD I83004801',46.46,0,'Assurance pro'),
(s1,'2025-12-15','PRLV EPS ASSURANCE',51.48,0,'Assurance pro'),
(s1,'2025-12-01','PRLV SEPA ENGIE SA (1er prélèvement)',89.35,0,'Énergie (ENGIE)'),
(s1,'2025-12-31','PRLV SEPA ENGIE SA (2e prélèvement)',89.35,0,'Énergie (ENGIE)'),
(s1,'2025-12-01','PRLV SEPA SFR SA (1er)',7.98,0,'Télécom (SFR/FREE)'),
(s1,'2025-12-31','PRLV SEPA SFR SA (2e)',7.98,0,'Télécom (SFR/FREE)'),
(s1,'2025-12-15','PRLV LYCAMOBILE TELEPHONIE',225.02,0,'Télécom (SFR/FREE)'),
(s1,'2025-12-01','PRLV ORANGE SA ABONNEMENT FIBRE',54.44,0,'Télécom (SFR/FREE)'),
(s1,'2025-12-20','PRLV INFOMANIAK HEBERGEMENT WEB',69.00,0,'Informatique / Hébergement'),
(s1,'2025-12-20','VIR INST DGFIP TVA T4 2025',2500.00,0,'Impôts / TVA (DGFIP)'),
(s1,'2025-12-20','VIR INST DGFIP CFE EXERCICE 2025',477.00,0,'Impôts / TVA (DGFIP)'),
(s1,'2025-12-15','VIR INST LOYER + AVOCAT RENOUVELLEMENT BAIL 2/2',890.00,0,'Loyers'),
(s1,'2025-12-20','VIR INST SALAIRES NOVEMBRE 2025 (4 virements groupés)',3400.00,0,'Salaires'),
(s1,'2025-12-28','FACT SGT FRAIS BANCAIRES DECEMBRE',17.33,0,'Frais bancaires CIC'),
(s1,'2025-12-10','VIR MONDIAL RELAY EXPEDITIONS',112.32,0,'Transport / Livraison'),
(s1,'2025-12-31','ACHATS FOURNISSEURS CB (SMART GADGET / UTOPIA / ALIEXPRESS)',3878.90,0,'Fournisseurs (achats CB)');

-- ─────────────────── JANVIER 2026 ───────────────────
INSERT INTO bank_statements(bank_name,account_number,period_start,period_end,balance_start,balance_end,total_credit,total_debit,notes)
VALUES('CIC','00020370701','2026-01-01','2026-02-02',1919.19,853.82,8513.68,9579.05,'Janvier 2026') RETURNING id INTO s2;

INSERT INTO bank_transactions(statement_id,transaction_date,label,debit,credit,category) VALUES
(s2,'2026-02-02','REMCB REMISES CB TPE 604836901 (total mois)',0,8513.68,'Recettes TPE (REMCB)'),
(s2,'2026-01-10','PRLV SEPA URSSAF ILE DE FRANCE',1030.00,0,'Charges sociales (URSSAF)'),
(s2,'2026-01-10','PRLV MALAKOFF HUMANIS RETRAITE',216.82,0,'Retraite (Malakoff)'),
(s2,'2026-01-05','PRLV SOLUPAIE SARL GESTION PAIE',260.00,0,'Gestion paie (Solupaie)'),
(s2,'2026-01-01','PRLV ACM IARD PLAN SANTE ENTREPRISE',173.96,0,'Mutuelle / Prévoyance'),
(s2,'2026-01-01','PRLV MULTI PRO ACM IARD I83004801',46.46,0,'Assurance pro'),
(s2,'2026-01-15','PRLV EPS ASSURANCE',51.48,0,'Assurance pro'),
(s2,'2026-01-15','PRLV FREE PRO ABONNEMENT',94.45,0,'Télécom (SFR/FREE)'),
(s2,'2026-01-15','PRLV LYCAMOBILE TELEPHONIE',100.00,0,'Télécom (SFR/FREE)'),
(s2,'2026-01-15','PRLV EURO-INFORMATION SAS LOCATION TPE',79.20,0,'Location TPE'),
(s2,'2026-01-31','FACT SGT FRAIS BANCAIRES + INTERETS CIC',65.92,0,'Frais bancaires CIC'),
(s2,'2026-01-20','VIR INST FS*CHIMERATOOL DEBLOCAGE',159.30,0,'Informatique / Hébergement'),
(s2,'2026-01-10','VIR MONDIAL RELAY EXPEDITIONS',34.08,0,'Transport / Livraison'),
(s2,'2026-01-15','VIR INST LOYER (vir. 1 : 1 500 + vir. 2 : 1 000)',2500.00,0,'Loyers'),
(s2,'2026-01-20','VIR INST SALAIRES DECEMBRE 2025 (1 400 + 900 + 500)',2800.00,0,'Salaires'),
(s2,'2026-02-02','ACHATS FOURNISSEURS CB (SMART GADGET / UTOPIA / ALIEXPRESS)',1967.38,0,'Fournisseurs (achats CB)');

-- ─────────────────── FÉVRIER 2026 ───────────────────
INSERT INTO bank_statements(bank_name,account_number,period_start,period_end,balance_start,balance_end,total_credit,total_debit,notes)
VALUES('CIC','00020370701','2026-02-03','2026-03-02',853.82,729.03,9039.35,9164.14,'Février 2026') RETURNING id INTO s3;

INSERT INTO bank_transactions(statement_id,transaction_date,label,debit,credit,category) VALUES
(s3,'2026-03-02','REMCB REMISES CB TPE 604836901 (total mois)',0,9039.35,'Recettes TPE (REMCB)'),
(s3,'2026-02-10','PRLV SEPA URSSAF ILE DE FRANCE (régularisation annuelle)',2117.00,0,'Charges sociales (URSSAF)'),
(s3,'2026-02-10','PRLV MALAKOFF HUMANIS RETRAITE (régularisation)',418.79,0,'Retraite (Malakoff)'),
(s3,'2026-02-04','PRLV SOLUPAIE SARL GESTION PAIE',260.00,0,'Gestion paie (Solupaie)'),
(s3,'2026-02-16','PRLV SOLUPAIE SARL REGULARISATION COTISATIONS',600.00,0,'Gestion paie (Solupaie)'),
(s3,'2026-02-01','PRLV ACM IARD PLAN SANTE ENTREPRISE',173.96,0,'Mutuelle / Prévoyance'),
(s3,'2026-02-01','PRLV MULTI PRO ACM IARD I83004801',46.46,0,'Assurance pro'),
(s3,'2026-02-15','PRLV EPS ASSURANCE',51.48,0,'Assurance pro'),
(s3,'2026-02-15','PRLV FREE PRO ABONNEMENT',47.99,0,'Télécom (SFR/FREE)'),
(s3,'2026-02-15','PRLV LYCAMOBILE TELEPHONIE',100.00,0,'Télécom (SFR/FREE)'),
(s3,'2026-02-10','PRLV SEPA ENGIE SA',89.35,0,'Énergie (ENGIE)'),
(s3,'2026-02-28','FACT SGT FRAIS BANCAIRES',16.70,0,'Frais bancaires CIC'),
(s3,'2026-02-20','VIR INST ORALIAFR PRESTATION',800.00,0,'Autre'),
(s3,'2026-02-15','VIR INST LOYER (partiel)',400.00,0,'Loyers'),
(s3,'2026-02-20','VIR INST SALAIRES JANVIER 2026 (900 + 500)',1400.00,0,'Salaires'),
(s3,'2026-03-02','ACHATS FOURNISSEURS CB (SMART GADGET / UTOPIA / ALIEXPRESS)',2642.41,0,'Fournisseurs (achats CB)');

-- ─────────────────── MARS 2026 ───────────────────
INSERT INTO bank_statements(bank_name,account_number,period_start,period_end,balance_start,balance_end,total_credit,total_debit,notes)
VALUES('CIC','00020370701','2026-03-03','2026-03-31',729.03,545.73,9764.60,9947.90,'Mars 2026') RETURNING id INTO s4;

INSERT INTO bank_transactions(statement_id,transaction_date,label,debit,credit,category) VALUES
(s4,'2026-03-31','REMCB REMISES CB TPE 604836901 (total mois)',0,9764.60,'Recettes TPE (REMCB)'),
(s4,'2026-03-10','PRLV SEPA URSSAF ILE DE FRANCE',694.00,0,'Charges sociales (URSSAF)'),
(s4,'2026-03-10','PRLV MALAKOFF HUMANIS RETRAITE',146.22,0,'Retraite (Malakoff)'),
(s4,'2026-03-05','PRLV SOLUPAIE SARL GESTION PAIE',260.00,0,'Gestion paie (Solupaie)'),
(s4,'2026-03-01','PRLV ACM IARD PLAN SANTE ENTREPRISE',177.50,0,'Mutuelle / Prévoyance'),
(s4,'2026-03-01','PRLV MULTI PRO ACM IARD I83004801',46.46,0,'Assurance pro'),
(s4,'2026-03-15','PRLV EPS ASSURANCE',51.48,0,'Assurance pro'),
(s4,'2026-03-15','PRLV FREE PRO ABONNEMENT',47.99,0,'Télécom (SFR/FREE)'),
(s4,'2026-03-01','PRLV SEPA SFR SA (1er)',7.98,0,'Télécom (SFR/FREE)'),
(s4,'2026-03-31','PRLV SEPA SFR SA (2e)',7.98,0,'Télécom (SFR/FREE)'),
(s4,'2026-03-01','PRLV SEPA ENGIE SA (1er)',89.35,0,'Énergie (ENGIE)'),
(s4,'2026-03-31','PRLV SEPA ENGIE SA (2e)',89.35,0,'Énergie (ENGIE)'),
(s4,'2026-03-15','PRLV LYCAMOBILE TELEPHONIE',100.00,0,'Télécom (SFR/FREE)'),
(s4,'2026-03-31','FACT SGT FRAIS BANCAIRES + AGIOS',45.19,0,'Frais bancaires CIC'),
(s4,'2026-03-15','VIR INST LOYER (800 + 500 + 1 900 — rattrapages)',3200.00,0,'Loyers'),
(s4,'2026-03-20','VIR INST SALAIRES FEVRIER 2026',2500.00,0,'Salaires'),
(s4,'2026-03-31','ACHATS FOURNISSEURS CB (SMART GADGET / UTOPIA / ALIEXPRESS)',2484.40,0,'Fournisseurs (achats CB)');

-- ─────────────────── AVRIL 2026 ───────────────────
INSERT INTO bank_statements(bank_name,account_number,period_start,period_end,balance_start,balance_end,total_credit,total_debit,notes)
VALUES('CIC','00020370701','2026-04-01','2026-04-30',545.73,1349.27,8350.01,7546.47,'Avril 2026') RETURNING id INTO s5;

INSERT INTO bank_transactions(statement_id,transaction_date,label,debit,credit,category) VALUES
(s5,'2026-04-30','REMCB REMISES CB TPE 604836901 (total mois)',0,8350.01,'Recettes TPE (REMCB)'),
(s5,'2026-04-10','PRLV SEPA URSSAF ILE DE FRANCE',530.00,0,'Charges sociales (URSSAF)'),
(s5,'2026-04-10','PRLV MALAKOFF HUMANIS RETRAITE',111.70,0,'Retraite (Malakoff)'),
(s5,'2026-04-05','PRLV SOLUPAIE SARL GESTION PAIE',260.00,0,'Gestion paie (Solupaie)'),
(s5,'2026-04-01','PRLV ACM IARD PLAN SANTE ENTREPRISE',177.50,0,'Mutuelle / Prévoyance'),
(s5,'2026-04-01','PRLV MULTI PRO ACM IARD I83004801',56.55,0,'Assurance pro'),
(s5,'2026-04-01','PRLV ACM VIE SA PROTECTION HOMME CLE',53.74,0,'Mutuelle / Prévoyance'),
(s5,'2026-04-15','PRLV EPS ASSURANCE',51.48,0,'Assurance pro'),
(s5,'2026-04-15','PRLV FREE PRO ABONNEMENT',53.63,0,'Télécom (SFR/FREE)'),
(s5,'2026-04-15','PRLV SEPA SFR SA',7.98,0,'Télécom (SFR/FREE)'),
(s5,'2026-04-15','PRLV LYCAMOBILE TELEPHONIE',100.00,0,'Télécom (SFR/FREE)'),
(s5,'2026-04-15','PRLV EURO-INFORMATION SAS LOCATION TPE',79.20,0,'Location TPE'),
(s5,'2026-04-30','FACT SGT FRAIS BANCAIRES + INTERETS',71.11,0,'Frais bancaires CIC'),
(s5,'2026-04-15','VIR INST LOYER (500 + 800)',1300.00,0,'Loyers'),
(s5,'2026-04-20','VIR INST SALAIRES MARS 2026 (partiel)',500.00,0,'Salaires'),
(s5,'2026-04-20','VIR INST ORALIAFR PRESTATION',500.00,0,'Autre'),
(s5,'2026-04-30','ACHATS FOURNISSEURS CB (SMART GADGET / UTOPIA / ALIEXPRESS)',3693.58,0,'Fournisseurs (achats CB)');

-- ─────────────────── MAI 2026 ───────────────────
INSERT INTO bank_statements(bank_name,account_number,period_start,period_end,balance_start,balance_end,total_credit,total_debit,notes)
VALUES('CIC','00020370701','2026-05-01','2026-06-01',1349.27,185.21,8766.30,9930.36,'Mai 2026') RETURNING id INTO s6;

INSERT INTO bank_transactions(statement_id,transaction_date,label,debit,credit,category) VALUES
(s6,'2026-06-01','REMCB REMISES CB TPE 604836901 (total mois)',0,8766.30,'Recettes TPE (REMCB)'),
(s6,'2026-05-10','PRLV SEPA URSSAF ILE DE FRANCE',530.00,0,'Charges sociales (URSSAF)'),
(s6,'2026-05-10','PRLV MALAKOFF HUMANIS RETRAITE',111.66,0,'Retraite (Malakoff)'),
(s6,'2026-05-05','PRLV SOLUPAIE SARL GESTION PAIE',260.00,0,'Gestion paie (Solupaie)'),
(s6,'2026-05-01','PRLV ACM IARD PLAN SANTE ENTREPRISE',177.50,0,'Mutuelle / Prévoyance'),
(s6,'2026-05-01','PRLV MULTI PRO ACM IARD I83004801',50.04,0,'Assurance pro'),
(s6,'2026-05-15','PRLV EPS ASSURANCE',51.48,0,'Assurance pro'),
(s6,'2026-05-15','PRLV FREE PRO ABONNEMENT',47.99,0,'Télécom (SFR/FREE)'),
(s6,'2026-05-15','PRLV LYCAMOBILE TELEPHONIE',100.00,0,'Télécom (SFR/FREE)'),
(s6,'2026-05-20','VIR INST DGFIP TVA T1 2026',1802.00,0,'Impôts / TVA (DGFIP)'),
(s6,'2026-05-31','FACT SGT FRAIS BANCAIRES',38.33,0,'Frais bancaires CIC'),
(s6,'2026-05-20','VIR INST ORALIAFR PRESTATION',500.00,0,'Autre'),
(s6,'2026-05-10','CB MISTERPHONESTORE ACHAT PIECES',21.80,0,'Fournisseurs (achats CB)'),
(s6,'2026-05-15','VIR INST LOYER MAI 2026',1043.89,0,'Loyers'),
(s6,'2026-05-20','VIR INST SALAIRES AVRIL 2026',900.00,0,'Salaires'),
(s6,'2026-06-01','ACHATS FOURNISSEURS CB (SMART GADGET / UTOPIA / ALIEXPRESS)',4295.67,0,'Fournisseurs (achats CB)');

-- ─────────────────── JUIN 2026 ───────────────────
INSERT INTO bank_statements(bank_name,account_number,period_start,period_end,balance_start,balance_end,total_credit,total_debit,notes)
VALUES('CIC','00020370701','2026-06-02','2026-06-30',185.21,1363.33,10451.30,9273.18,'Juin 2026') RETURNING id INTO s7;

INSERT INTO bank_transactions(statement_id,transaction_date,label,debit,credit,category) VALUES
-- Crédits
(s7,'2026-06-30','REMCB REMISES CB TPE 604836901 (total mois)',0,7451.30,'Recettes TPE (REMCB)'),
(s7,'2026-06-20','VIR INST ABDELKADER BOUGHARI (apport dirigeant)',0,1500.00,'Apports personnels'),
(s7,'2026-06-20','VIR INST M HACENE BAALI (apport compte courant associé)',0,1500.00,'Virement reçu'),
-- Charges récurrentes
(s7,'2026-06-10','PRLV SEPA URSSAF ILE DE FRANCE',530.00,0,'Charges sociales (URSSAF)'),
(s7,'2026-06-10','PRLV MALAKOFF HUMANIS RETRAITE',111.68,0,'Retraite (Malakoff)'),
(s7,'2026-06-05','PRLV SOLUPAIE SARL GESTION PAIE',260.00,0,'Gestion paie (Solupaie)'),
(s7,'2026-06-01','PRLV ACM IARD PLAN SANTE ENTREPRISE',177.50,0,'Mutuelle / Prévoyance'),
(s7,'2026-06-01','PRLV MULTI PRO ACM IARD I83004801',50.04,0,'Assurance pro'),
(s7,'2026-06-15','PRLV EPS ASSURANCE',51.48,0,'Assurance pro'),
(s7,'2026-06-15','PRLV FREE PRO ABONNEMENT',47.99,0,'Télécom (SFR/FREE)'),
(s7,'2026-06-15','PRLV SEPA SFR SA',7.98,0,'Télécom (SFR/FREE)'),
(s7,'2026-06-10','PRLV SEPA ENGIE SA',89.35,0,'Énergie (ENGIE)'),
(s7,'2026-06-15','PRLV LYCAMOBILE TELEPHONIE',100.00,0,'Télécom (SFR/FREE)'),
(s7,'2026-06-30','FACT SGT FRAIS BANCAIRES + AGIOS (pic inhabituEl)',148.12,0,'Frais bancaires CIC'),
(s7,'2026-06-28','OVH CLOUD HEBERGEMENT',3.59,0,'Informatique / Hébergement'),
-- Loyer juin
(s7,'2026-06-15','VIR INST LOYER JUIN 2026 (1 500 + 1 622,03)',3122.03,0,'Loyers'),
-- Salaires
(s7,'2026-06-20','VIR INST SALAIRES MAI 2026 (4 x virements)',1400.00,0,'Salaires'),
(s7,'2026-06-25','VIR INST SOLDE TOUT COMPTE SALARIE',500.00,0,'Salaires'),
-- Fournisseurs reste
(s7,'2026-06-30','ACHATS FOURNISSEURS CB (SMART GADGET / UTOPIA / ALIEXPRESS)',2673.42,0,'Fournisseurs (achats CB)');

END $$;

COMMIT;

-- ─────────────────── VÉRIFICATION ───────────────────
SELECT
  notes AS mois,
  to_char(balance_start,'FM999G990D00') || ' €' AS solde_debut,
  to_char(total_credit,'FM999G990D00')  || ' €' AS credits,
  to_char(total_debit,'FM999G990D00')   || ' €' AS debits,
  to_char(balance_end,'FM999G990D00')   || ' €' AS solde_fin,
  (SELECT COUNT(*) FROM bank_transactions bt WHERE bt.statement_id = bs.id) AS nb_tx
FROM bank_statements bs
WHERE account_number = '00020370701'
ORDER BY period_start;
