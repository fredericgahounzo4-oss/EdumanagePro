-- ============================================================================
-- MIGRATION v4 — Cycle de vie des écoles : suspension -> fermeture (30 j) -> archives (1 an) -> purge
-- À exécuter UNE FOIS dans l'éditeur SQL de Neon (idempotente : peut être relancée sans risque).
--
--   actif ──(suspension par le superadmin, motif obligatoire)──> suspendu
--   suspendu ──(régularisation)──> actif
--   suspendu ──(30 jours sans régularisation : automatique)──> archive  (accès fermé, données conservées)
--   archive ──(restauration par le superadmin)──> actif
--   archive ──(1 an : automatique)──> supprimée définitivement
--
-- Une école ne peut JAMAIS être supprimée directement, même par le superadmin.
-- ============================================================================

ALTER TABLE etablissements ADD COLUMN IF NOT EXISTS statut TEXT NOT NULL DEFAULT 'actif';
ALTER TABLE etablissements ADD COLUMN IF NOT EXISTS suspendu_le TIMESTAMPTZ;
ALTER TABLE etablissements ADD COLUMN IF NOT EXISTS motif_suspension TEXT NOT NULL DEFAULT '';
ALTER TABLE etablissements ADD COLUMN IF NOT EXISTS suppression_prevue_le TIMESTAMPTZ;  -- fin du délai de 30 jours
ALTER TABLE etablissements ADD COLUMN IF NOT EXISTS archive_le TIMESTAMPTZ;
ALTER TABLE etablissements ADD COLUMN IF NOT EXISTS purge_prevue_le TIMESTAMPTZ;         -- fin de la conservation d'1 an

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'etablissements_statut_check') THEN
    ALTER TABLE etablissements ADD CONSTRAINT etablissements_statut_check CHECK (statut IN ('actif', 'suspendu', 'archive'));
  END IF;
END $$;

-- Reprise : les écoles déjà suspendues avec l'ancien interrupteur "active" entrent dans le nouveau cycle.
-- Le délai de 30 jours démarre à la date de cette migration.
UPDATE etablissements
   SET statut = 'suspendu', suspendu_le = now(), suppression_prevue_le = now() + interval '30 days',
       motif_suspension = 'Suspension antérieure (motif non renseigné)'
 WHERE active = false AND statut = 'actif';

-- Journal permanent : conservé même après la suppression définitive d'une école (aucune clé étrangère volontairement)
CREATE TABLE IF NOT EXISTS journal_ecoles (
  id SERIAL PRIMARY KEY,
  etablissement_id INTEGER NOT NULL,
  nom_ecole TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,            -- suspension | reactivation | archivage_auto | restauration | purge
  motif TEXT NOT NULL DEFAULT '',
  auteur TEXT NOT NULL DEFAULT 'système',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  date TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_journal_ecoles_date ON journal_ecoles(date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_ecoles_etab ON journal_ecoles(etablissement_id);
