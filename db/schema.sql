-- Schéma PostgreSQL multi-établissements pour SchoolManager Pro
-- Compatible Neon (aucune extension propriétaire utilisée)

CREATE TABLE IF NOT EXISTS etablissements (
  id SERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  slug TEXT UNIQUE, -- réservé pour un usage futur (sous-domaine, lien direct...)
  type TEXT NOT NULL DEFAULT 'Prive', -- 'Prive' | 'Public'
  ministere TEXT DEFAULT 'MINISTÈRE DES ENSEIGNEMENTS PRIMAIRE ET SECONDAIRE',
  direction_regionale TEXT DEFAULT '',
  iesg TEXT DEFAULT '',
  adresse TEXT DEFAULT '',
  telephone TEXT DEFAULT '',
  bp TEXT DEFAULT '',
  logo BYTEA,
  logo_mimetype TEXT,
  niveaux_actifs TEXT[] NOT NULL DEFAULT ARRAY['Primaire','College','Lycee'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Les identifiants de connexion sont uniques sur toute la plateforme (pas de sélection
-- d'établissement au login : le compte détermine lui-même l'établissement).
-- etablissement_id = NULL uniquement pour le rôle SuperAdmin (gère la liste des écoles).
CREATE TABLE IF NOT EXISTS utilisateurs (
  id SERIAL PRIMARY KEY,
  etablissement_id INTEGER REFERENCES etablissements(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  identifiant TEXT NOT NULL UNIQUE,
  mot_de_passe_hash TEXT NOT NULL,
  mot_de_passe_sel TEXT NOT NULL,
  role TEXT NOT NULL, -- 'SuperAdmin' | 'Administrateur' | 'Enseignant'
  id_enseignant INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enseignants (
  id SERIAL PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  telephone TEXT DEFAULT '',
  email TEXT DEFAULT ''
);

DO $$ BEGIN
  ALTER TABLE utilisateurs
    ADD CONSTRAINT fk_utilisateurs_enseignant
    FOREIGN KEY (id_enseignant) REFERENCES enseignants(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS affectations (
  id SERIAL PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  id_enseignant INTEGER NOT NULL REFERENCES enseignants(id) ON DELETE CASCADE,
  niveau TEXT NOT NULL,
  classe TEXT NOT NULL,
  serie TEXT DEFAULT '',
  matiere TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS eleves (
  id SERIAL PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  niveau TEXT NOT NULL,
  classe TEXT NOT NULL,
  serie TEXT DEFAULT '',
  annee TEXT DEFAULT '',
  trimestre TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  id_eleve INTEGER NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  matiere TEXT NOT NULL,
  interro NUMERIC DEFAULT 0,
  devoir NUMERIC DEFAULT 0,
  composition NUMERIC DEFAULT 0,
  coefficient NUMERIC DEFAULT 1,
  note_generale NUMERIC DEFAULT 0,
  note_finale NUMERIC DEFAULT 0,
  professeur TEXT DEFAULT '',
  absences INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS presences (
  id SERIAL PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  id_eleve INTEGER NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  heure TEXT DEFAULT '',
  statut TEXT NOT NULL -- 'Présent' | 'Absent' | 'Retard'
);

CREATE TABLE IF NOT EXISTS emploi_du_temps (
  id SERIAL PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  niveau TEXT NOT NULL,
  classe TEXT NOT NULL,
  serie TEXT DEFAULT '',
  jour TEXT NOT NULL,
  heure_debut TEXT NOT NULL,
  heure_fin TEXT NOT NULL,
  matiere TEXT NOT NULL,
  id_enseignant INTEGER REFERENCES enseignants(id) ON DELETE SET NULL,
  salle TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS examens (
  id SERIAL PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  type TEXT DEFAULT 'Composition',
  date_debut DATE NOT NULL,
  date_fin DATE,
  niveau TEXT DEFAULT '',
  classe TEXT DEFAULT '',
  serie TEXT DEFAULT '',
  statut TEXT DEFAULT 'Planifié'
);

CREATE TABLE IF NOT EXISTS matieres (
  id SERIAL PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  niveau TEXT NOT NULL,
  classe TEXT DEFAULT '', -- vide = s'applique à toutes les classes du niveau (ex : Lycée par série)
  serie TEXT DEFAULT '',  -- vide = s'applique à toutes les séries
  categorie TEXT NOT NULL,
  nom TEXT NOT NULL,
  coefficient NUMERIC NOT NULL DEFAULT 1
);

-- Index de performance : toutes les requêtes filtrent quasi systématiquement par établissement
CREATE INDEX IF NOT EXISTS idx_utilisateurs_etab ON utilisateurs(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_enseignants_etab ON enseignants(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_affectations_etab ON affectations(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_eleves_etab ON eleves(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_notes_etab ON notes(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_notes_eleve ON notes(id_eleve);
CREATE INDEX IF NOT EXISTS idx_presences_etab ON presences(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_presences_eleve ON presences(id_eleve);
CREATE INDEX IF NOT EXISTS idx_edt_etab ON emploi_du_temps(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_examens_etab ON examens(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_matieres_etab ON matieres(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_matieres_lookup ON matieres(etablissement_id, niveau, classe, serie);

-- ============================================================================
-- MIGRATION : périodes (trimestre/semestre), comptes élèves, portail élève
-- Ce bloc est idempotent (peut être ré-exécuté sans risque sur une base existante).
-- ============================================================================

-- Une note appartient désormais à une période précise (1er Trimestre, 2e Semestre, ...)
-- au lieu d'être une valeur unique et permanente par matière.
ALTER TABLE notes ADD COLUMN IF NOT EXISTS periode TEXT NOT NULL DEFAULT '1er Trimestre';
DROP INDEX IF EXISTS idx_notes_eleve_matiere_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_notes_eleve_matiere_periode
  ON notes(etablissement_id, id_eleve, matiere, periode);

-- Période actuellement active pour une école (sert de valeur par défaut à la saisie)
ALTER TABLE etablissements ADD COLUMN IF NOT EXISTS periode_actuelle TEXT NOT NULL DEFAULT '1er Trimestre';

-- Un compte utilisateur peut désormais être un élève (auto-créé à son inscription)
-- ou, plus tard, un parent.
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS id_eleve INTEGER;
DO $$ BEGIN
  ALTER TABLE utilisateurs ADD CONSTRAINT fk_utilisateurs_eleve
    FOREIGN KEY (id_eleve) REFERENCES eleves(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_utilisateurs_eleve ON utilisateurs(id_eleve);

-- Permet au Super Administrateur de suspendre temporairement l'accès à une école
-- (ex : problème à régler) sans supprimer ses données.
ALTER TABLE etablissements ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

-- ============================================================================
-- MIGRATION : écolage, parents, messagerie, cartes scolaires, modèles de bulletin
-- ============================================================================

-- Modèle de bulletin choisi par l'école
ALTER TABLE etablissements ADD COLUMN IF NOT EXISTS modele_bulletin TEXT NOT NULL DEFAULT 'Prive';
ALTER TABLE etablissements ADD COLUMN IF NOT EXISTS devise TEXT NOT NULL DEFAULT 'FCFA';

-- Barème d'écolage : par niveau, ou plus précisément par classe/série.
-- La ligne la plus spécifique qui correspond à l'élève l'emporte.
CREATE TABLE IF NOT EXISTS baremes_ecolage (
  id SERIAL PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  niveau TEXT NOT NULL,
  classe TEXT DEFAULT '',
  serie TEXT DEFAULT '',
  annee TEXT DEFAULT '',
  montant_total NUMERIC NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS paiements (
  id SERIAL PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  id_eleve INTEGER NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  montant NUMERIC NOT NULL,
  mode TEXT DEFAULT 'Espèces',
  motif TEXT DEFAULT 'Écolage',
  numero_recu TEXT NOT NULL,
  encaisse_par TEXT DEFAULT '',
  date_paiement TIMESTAMPTZ NOT NULL DEFAULT now(),
  annee TEXT DEFAULT ''
);

-- Un compte parent peut suivre plusieurs élèves
CREATE TABLE IF NOT EXISTS parents_eleves (
  id SERIAL PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  id_utilisateur INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  id_eleve INTEGER NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  lien TEXT DEFAULT 'Parent'
);

-- Messagerie interne : parents <-> enseignants / administration, et notifications système
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  expediteur_id INTEGER REFERENCES utilisateurs(id) ON DELETE SET NULL,
  destinataire_id INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  id_eleve INTEGER REFERENCES eleves(id) ON DELETE SET NULL,
  sujet TEXT DEFAULT '',
  corps TEXT NOT NULL,
  lu BOOLEAN NOT NULL DEFAULT false,
  type TEXT DEFAULT 'Message',
  envoye_le TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cartes_scolaires (
  id SERIAL PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  id_eleve INTEGER NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  annee TEXT DEFAULT '',
  emise_le TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_baremes_etab ON baremes_ecolage(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_paiements_etab ON paiements(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_paiements_eleve ON paiements(id_eleve);
CREATE INDEX IF NOT EXISTS idx_parents_user ON parents_eleves(id_utilisateur);
CREATE INDEX IF NOT EXISTS idx_parents_eleve ON parents_eleves(id_eleve);
CREATE INDEX IF NOT EXISTS idx_messages_dest ON messages(destinataire_id, lu);
CREATE INDEX IF NOT EXISTS idx_cartes_eleve ON cartes_scolaires(id_eleve);



-- ============================================================================
-- MIGRATION : notifications (cloche de l'application) + index pour les nouveaux écrans
-- Idempotent : peut être ré-exécuté sans risque (npm run db:init).
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  id_utilisateur INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info', -- 'info' | 'success' | 'warning' | 'danger'
  titre TEXT NOT NULL,
  message TEXT DEFAULT '',
  lien TEXT DEFAULT '',              -- chemin interne vers lequel mène la notification (ex : /presences)
  lu BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(id_utilisateur, lu, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_presences_date ON presences(etablissement_id, date);
CREATE INDEX IF NOT EXISTS idx_paiements_date ON paiements(etablissement_id, date_paiement);


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


-- ============================================================================
-- MIGRATION v5 — Gestion des mots de passe
-- À exécuter UNE FOIS dans l'éditeur SQL de Neon (idempotente : peut être relancée sans risque).
--   - Réglage par école : les enseignants peuvent-ils changer eux-mêmes leur mot de passe ? (non par défaut)
--   - Date du dernier changement de mot de passe : les sessions ouvertes AVANT ce changement sont coupées.
-- ============================================================================
ALTER TABLE etablissements ADD COLUMN IF NOT EXISTS profs_changent_mdp BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS mdp_modifie_le TIMESTAMPTZ;
