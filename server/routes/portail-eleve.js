const express = require("express");
const { query } = require("../db/pool");
const { requireAuth, requireRole } = require("../lib/auth");
const { moyenneEleve } = require("../lib/calculs");
const { getMention } = require("../lib/reference");

const router = express.Router();
router.use(requireAuth, requireRole("Eleve"));

// Toutes les routes de ce module se limitent strictement au propre dossier de l'élève connecté.
router.get("/", async (req, res) => {
  if (!req.user.idEleve) return res.status(403).json({ error: "Ce compte n'est lié à aucun élève" });

  const eleveRes = await query(
    `SELECT id AS "ID", nom AS "Nom", prenom AS "Prenom", niveau AS "Niveau", classe AS "Classe", serie AS "Serie", annee AS "Annee"
     FROM eleves WHERE id = $1 AND etablissement_id = $2`,
    [req.user.idEleve, req.user.etablissementId]
  );
  const eleve = eleveRes.rows[0];
  if (!eleve) return res.status(404).json({ error: "Dossier élève introuvable" });

  const etabRes = await query("SELECT nom, periode_actuelle FROM etablissements WHERE id = $1", [req.user.etablissementId]);
  const periode = etabRes.rows[0].periode_actuelle;

  const notesRes = await query(
    `SELECT matiere AS "Matiere", interro AS "Interro", devoir AS "Devoir", composition AS "Composition",
            coefficient AS "Coefficient", note_generale AS "NoteGenerale", note_finale AS "NoteFinale", professeur AS "Professeur"
     FROM notes WHERE id_eleve = $1 AND etablissement_id = $2 AND periode = $3 ORDER BY matiere`,
    [eleve.ID, req.user.etablissementId, periode]
  );

  const moyenne = Math.round((await moyenneEleve(eleve.ID, eleve.Niveau, req.user.etablissementId, periode)) * 100) / 100;

  const examensRes = await query(
    `SELECT nom AS "Nom", type AS "Type", date_debut AS "DateDebut", date_fin AS "DateFin", statut AS "Statut"
     FROM examens
     WHERE etablissement_id = $1
       AND (niveau = '' OR niveau = $2) AND (classe = '' OR classe = $3) AND (serie = '' OR serie = $4)
       AND statut != 'Terminé'
     ORDER BY date_debut`,
    [req.user.etablissementId, eleve.Niveau, eleve.Classe, eleve.Serie || ""]
  );

  const presencesRes = await query(
    `SELECT statut FROM presences WHERE id_eleve = $1 AND etablissement_id = $2`,
    [eleve.ID, req.user.etablissementId]
  );
  const totalPresences = presencesRes.rows.length;
  const absences = presencesRes.rows.filter((p) => p.statut === "Absent").length;
  const tauxPresence = totalPresences > 0
    ? Math.round(((totalPresences - absences) / totalPresences) * 1000) / 10
    : 100;

  res.json({
    eleve, etablissementNom: etabRes.rows[0].nom, periode,
    notes: notesRes.rows, moyenne, mention: getMention(moyenne),
    examensAVenir: examensRes.rows, tauxPresence,
  });
});

module.exports = router;
