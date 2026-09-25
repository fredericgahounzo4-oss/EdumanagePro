const { query } = require("../db/pool");

// PORTÉE D'UN ENSEIGNANT
// Un enseignant n'interagit qu'avec les classes qui lui sont attribuées :
//   - affectation (classe + matière)   -> seulement SA matière dans cette classe
//   - titulaire d'une classe           -> TOUTES les matières de cette classe, et tout ce qui la concerne
// L'administrateur (et le super-admin) n'ont aucune restriction : la fonction renvoie alors null.

// Renvoie les entrées de portée { Niveau, Classe, Serie, Matiere, Titulaire } d'un enseignant connecté.
// Matiere "" = toutes les matières (titulaire, ou enseignant du primaire).
async function getAffectationsForUser(user) {
  if (!user || user.role !== "Enseignant") return null;
  const res = await query(
    `SELECT a.niveau AS "Niveau", a.classe AS "Classe", a.serie AS "Serie", a.matiere AS "Matiere"
     FROM utilisateurs u
     JOIN affectations a ON a.id_enseignant = u.id_enseignant AND a.etablissement_id = u.etablissement_id
     WHERE u.id = $1 AND u.id_enseignant IS NOT NULL`,
    [user.id]
  );
  let titulaires = [];
  try {
    const t = await query(
      `SELECT t.niveau AS "Niveau", t.classe AS "Classe", t.serie AS "Serie"
       FROM utilisateurs u
       JOIN titulaires_classes t ON t.id_enseignant = u.id_enseignant AND t.etablissement_id = u.etablissement_id
       WHERE u.id = $1 AND u.id_enseignant IS NOT NULL`,
      [user.id]
    );
    titulaires = t.rows.map((r) => ({ ...r, Matiere: "", Titulaire: true }));
  } catch (err) {
    // Table absente tant que la migration v3 n'est pas exécutée : on continue sans titulaires
    console.error("[scope] titulaires indisponibles :", err.message);
  }
  return [...res.rows, ...titulaires]; // [] si le compte n'est lié à aucune fiche enseignant
}

const memeClasse = (a, x) => a.Niveau === x.Niveau && a.Classe === x.Classe && (!a.Serie || a.Serie === (x.Serie || ""));

function studentInScope(eleve, affectations) {
  if (affectations === null) return true;
  return affectations.some((a) => memeClasse(a, eleve));
}

function filterStudentsForScope(eleves, affectations) {
  if (affectations === null) return eleves;
  return eleves.filter((e) => studentInScope(e, affectations));
}

// L'utilisateur est-il titulaire de cette classe ? (l'administrateur l'est toujours : accès total)
function estTitulaire(affectations, { Niveau, Classe, Serie }) {
  if (affectations === null) return true;
  return affectations.some((a) => a.Titulaire && memeClasse(a, { Niveau, Classe, Serie }));
}

// Un enseignant peut-il saisir des notes dans cette matière de cette classe ?
function peutNoter(affectations, { Niveau, Classe, Serie, Matiere }) {
  if (affectations === null) return true;
  return affectations.some((a) => memeClasse(a, { Niveau, Classe, Serie }) && (!a.Matiere || a.Matiere === Matiere));
}

// Un créneau, examen... visé par (niveau, classe, série) — champs vides = "tous" — concerne-t-il l'enseignant ?
function cibleConcerne(cible, affectations) {
  if (affectations === null) return true;
  if (!cible.Niveau) return true; // visant tout l'établissement
  return affectations.some(
    (a) => a.Niveau === cible.Niveau && (!cible.Classe || a.Classe === cible.Classe) && (!cible.Serie || !a.Serie || a.Serie === cible.Serie)
  );
}

module.exports = { getAffectationsForUser, studentInScope, filterStudentsForScope, estTitulaire, peutNoter, cibleConcerne, memeClasse };
