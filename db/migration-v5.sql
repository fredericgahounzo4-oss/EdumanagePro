-- ============================================================================
-- MIGRATION v5 — Gestion des mots de passe
-- À exécuter UNE FOIS dans l'éditeur SQL de Neon (idempotente : peut être relancée sans risque).
--   - Réglage par école : les enseignants peuvent-ils changer eux-mêmes leur mot de passe ? (non par défaut)
--   - Date du dernier changement de mot de passe : les sessions ouvertes AVANT ce changement sont coupées.
-- ============================================================================
ALTER TABLE etablissements ADD COLUMN IF NOT EXISTS profs_changent_mdp BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS mdp_modifie_le TIMESTAMPTZ;
