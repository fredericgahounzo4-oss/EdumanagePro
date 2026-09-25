-- ============================================================================
-- MIGRATION v3 — à exécuter UNE FOIS dans l'éditeur SQL de Neon (idempotente : peut être relancée).
--   1. Professeur titulaire d'une classe
--   2. Plusieurs interros / devoirs / compositions par matière
--   3. Sexe et statut (Nouveau/Redoublant) des élèves — affichés sur les bulletins
--   4. Réglages d'établissement pour les bulletins et reçus (ville, direction, modèle de reçu)
--   5. Données du conseil de classe (conduite, décision, observations...) par élève et par période
-- ============================================================================

-- 1. Titulaire : un seul professeur titulaire par classe (et par série au Lycée)
CREATE TABLE IF NOT EXISTS titulaires_classes (
  id SERIAL PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  niveau TEXT NOT NULL,
  classe TEXT NOT NULL,
  serie TEXT NOT NULL DEFAULT '',
  id_enseignant INTEGER NOT NULL REFERENCES enseignants(id) ON DELETE CASCADE,
  UNIQUE (etablissement_id, niveau, classe, serie)
);
CREATE INDEX IF NOT EXISTS idx_titulaires_ens ON titulaires_classes(id_enseignant);

-- 2. Évaluations multiples : listes de notes (une valeur par interro / devoir / composition).
--    Les colonnes existantes interro / devoir / composition contiennent désormais la MOYENNE de chaque liste.
ALTER TABLE notes ADD COLUMN IF NOT EXISTS interros JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS devoirs JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS compositions JSONB NOT NULL DEFAULT '[]'::jsonb;
-- Reprise des notes déjà saisies : chaque valeur existante devient la première évaluation de sa liste
UPDATE notes SET interros = jsonb_build_array(interro) WHERE interros = '[]'::jsonb AND COALESCE(interro, 0) <> 0;
UPDATE notes SET devoirs = jsonb_build_array(devoir) WHERE devoirs = '[]'::jsonb AND COALESCE(devoir, 0) <> 0;
UPDATE notes SET compositions = jsonb_build_array(composition) WHERE compositions = '[]'::jsonb AND COALESCE(composition, 0) <> 0;

-- 3. Élèves
ALTER TABLE eleves ADD COLUMN IF NOT EXISTS sexe TEXT NOT NULL DEFAULT '';    -- 'M' | 'F'
ALTER TABLE eleves ADD COLUMN IF NOT EXISTS statut TEXT NOT NULL DEFAULT '';  -- 'N' (nouveau) | 'R' (redoublant)

-- 4. Établissement
ALTER TABLE etablissements ADD COLUMN IF NOT EXISTS ville TEXT NOT NULL DEFAULT '';
ALTER TABLE etablissements ADD COLUMN IF NOT EXISTS titre_direction TEXT NOT NULL DEFAULT 'Le Directeur';
ALTER TABLE etablissements ADD COLUMN IF NOT EXISTS nom_direction TEXT NOT NULL DEFAULT '';
ALTER TABLE etablissements ADD COLUMN IF NOT EXISTS devise_ecole TEXT NOT NULL DEFAULT '';
ALTER TABLE etablissements ADD COLUMN IF NOT EXISTS modele_recu TEXT NOT NULL DEFAULT 'Standard';

-- 5. Conseil de classe
CREATE TABLE IF NOT EXISTS bulletin_infos (
  id SERIAL PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  id_eleve INTEGER NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  periode TEXT NOT NULL,
  retards INTEGER,
  absences INTEGER,
  punitions INTEGER,
  exclusion INTEGER,
  conduite TEXT NOT NULL DEFAULT '',
  appreciation TEXT NOT NULL DEFAULT '',
  distinction TEXT NOT NULL DEFAULT '',
  decision TEXT NOT NULL DEFAULT '',
  observations TEXT NOT NULL DEFAULT '',
  avertissement TEXT NOT NULL DEFAULT '',
  blame TEXT NOT NULL DEFAULT '',
  felicitations BOOLEAN NOT NULL DEFAULT false,
  encouragements BOOLEAN NOT NULL DEFAULT false,
  tableau_honneur BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (id_eleve, periode)
);
CREATE INDEX IF NOT EXISTS idx_bulletin_infos_etab ON bulletin_infos(etablissement_id, periode);
