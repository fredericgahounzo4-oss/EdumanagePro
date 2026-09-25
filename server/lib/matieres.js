const { query } = require("../db/pool");

// Renvoie les matières applicables à un niveau/classe/série donnés, pour un établissement.
// Une ligne dont Classe (ou Série) est vide s'applique à toutes les classes (ou séries)
// de ce niveau — utilisé pour le Lycée où les matières d'une série sont les mêmes
// en Première et en Terminale.
async function getMatieresFor({ etablissementId, niveau, classe, serie }) {
  const res = await query(
    `SELECT id AS "ID", niveau AS "Niveau", classe AS "Classe", serie AS "Serie",
            categorie AS "Categorie", nom AS "Nom", coefficient AS "Coefficient"
     FROM matieres
     WHERE etablissement_id = $1
       AND niveau = $2
       AND (classe = '' OR classe = $3)
       AND (serie = '' OR serie = $4)
     ORDER BY categorie, nom`,
    [etablissementId, niveau, classe || "", serie || ""]
  );
  return res.rows;
}

module.exports = { getMatieresFor };
