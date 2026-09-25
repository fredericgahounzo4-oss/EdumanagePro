// Création de notifications (cloche de l'application).
//
// RÈGLE D'OR : une notification ne doit JAMAIS faire échouer l'action métier qui la déclenche
// (saisie d'une absence, encaissement, etc.). Toutes les fonctions ci-dessous avalent donc leurs
// erreurs — y compris si la table `notifications` n'existe pas encore (migration non exécutée).
const { query } = require("../db/pool");

async function notifier({ etablissementId, userIds, type = "info", titre, message = "", lien = "" }) {
  try {
    const ids = [...new Set((userIds || []).map(Number).filter(Boolean))];
    if (!etablissementId || ids.length === 0) return 0;
    await query(
      `INSERT INTO notifications (etablissement_id, id_utilisateur, type, titre, message, lien)
       SELECT $1::int, u, $3::text, $4::text, $5::text, $6::text FROM unnest($2::int[]) AS u`,
      [etablissementId, ids, type, titre, message, lien]
    );
    return ids.length;
  } catch (err) {
    console.error("[notify] échec non bloquant :", err.message);
    return 0;
  }
}

// Identifiants des comptes ayant l'un des rôles donnés dans l'établissement
async function idsParRole(etablissementId, roles) {
  try {
    const r = await query(
      "SELECT id FROM utilisateurs WHERE etablissement_id = $1 AND role = ANY($2::text[])",
      [etablissementId, roles]
    );
    return r.rows.map((x) => x.id);
  } catch (err) {
    console.error("[notify] idsParRole :", err.message);
    return [];
  }
}

// Comptes à prévenir pour un élève : ses parents rattachés + son propre compte élève
async function idsFamille(etablissementId, idEleve) {
  try {
    const r = await query(
      `SELECT id_utilisateur AS id FROM parents_eleves WHERE id_eleve = $1 AND etablissement_id = $2
       UNION
       SELECT id FROM utilisateurs WHERE id_eleve = $1 AND etablissement_id = $2`,
      [idEleve, etablissementId]
    );
    return r.rows.map((x) => x.id);
  } catch (err) {
    console.error("[notify] idsFamille :", err.message);
    return [];
  }
}

// Parents + comptes élèves de tous les élèves d'un niveau/classe/série (valeurs vides = pas de filtre)
async function idsFamillesDeClasse(etablissementId, { niveau = "", classe = "", serie = "" } = {}) {
  try {
    const filtre = "e.etablissement_id = $1 AND ($2::text = '' OR e.niveau = $2::text) AND ($3::text = '' OR e.classe = $3::text) AND ($4::text = '' OR e.serie = $4::text)";
    const r = await query(
      `SELECT pe.id_utilisateur AS id FROM parents_eleves pe JOIN eleves e ON e.id = pe.id_eleve WHERE ${filtre}
       UNION
       SELECT u.id FROM utilisateurs u JOIN eleves e ON e.id = u.id_eleve WHERE ${filtre}`,
      [etablissementId, niveau, classe, serie]
    );
    return r.rows.map((x) => x.id);
  } catch (err) {
    console.error("[notify] idsFamillesDeClasse :", err.message);
    return [];
  }
}

module.exports = { notifier, idsParRole, idsFamille, idsFamillesDeClasse };
