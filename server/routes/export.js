const express = require("express");
const XLSX = require("xlsx");
const { query } = require("../db/pool");
const { requireAuth, requireRole } = require("../lib/auth");

const router = express.Router();

// Construit le classeur Excel de toutes les données d'un établissement (utilisé aussi par le superadmin pour les archives)
async function construireClasseur(etabId) {
  const wb = XLSX.utils.book_new();

  const eleves = await query(
    `SELECT id AS "ID", nom AS "Nom", prenom AS "Prenom", niveau AS "Niveau", classe AS "Classe",
            serie AS "Serie", annee AS "Annee", trimestre AS "Trimestre" FROM eleves WHERE etablissement_id = $1`,
    [etabId]
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(eleves.rows), "Eleves");

  const notes = await query(
    `SELECT id AS "ID", id_eleve AS "IDEleve", matiere AS "Matiere", interro AS "Interro", devoir AS "Devoir",
            composition AS "Composition", coefficient AS "Coefficient", note_generale AS "NoteGenerale",
            note_finale AS "NoteFinale", professeur AS "Professeur" FROM notes WHERE etablissement_id = $1`,
    [etabId]
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(notes.rows), "Notes");

  const presences = await query(
    `SELECT id AS "ID", id_eleve AS "IDEleve", date AS "Date", heure AS "Heure", statut AS "Statut" FROM presences WHERE etablissement_id = $1`,
    [etabId]
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(presences.rows), "Presences");

  const enseignants = await query(
    `SELECT id AS "ID", nom AS "Nom", prenom AS "Prenom", telephone AS "Telephone", email AS "Email" FROM enseignants WHERE etablissement_id = $1`,
    [etabId]
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(enseignants.rows), "Enseignants");

  const matieres = await query(
    `SELECT id AS "ID", niveau AS "Niveau", classe AS "Classe", serie AS "Serie", categorie AS "Categorie",
            nom AS "Nom", coefficient AS "Coefficient" FROM matieres WHERE etablissement_id = $1`,
    [etabId]
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matieres.rows), "Matieres");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

router.get("/", requireAuth, requireRole("Administrateur"), async (req, res) => {
  const buffer = await construireClasseur(req.user.etablissementId);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=schoolmanager-export.xlsx");
  res.send(buffer);
});

module.exports = router;
module.exports.construireClasseur = construireClasseur;
