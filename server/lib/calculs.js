const { query } = require("../db/pool");
const { getMention } = require("./reference");

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Liste des évaluations d'un type (interros, devoirs ou compositions). Une valeur absente est stockée `null`
// et compte pour 0 : la moyenne se fait toujours sur le NOMBRE D'ÉVALUATIONS DONNÉES à la classe.
// Anciennes lignes (non migrées) : la valeur unique de la colonne classique est reprise comme première évaluation.
function listeEvals(liste, scalaire) {
  if (Array.isArray(liste) && liste.length) return liste.map((v) => (v === null || v === undefined || v === "" ? null : Number(v)));
  const s = num(scalaire);
  return s !== 0 ? [s] : [];
}

function moyenneListe(liste) {
  if (!liste.length) return 0;
  return liste.reduce((a, v) => a + (v === null || !Number.isFinite(v) ? 0 : v), 0) / liste.length;
}

// Note d'une matière (pure, sans base de données) :
//   moyenne des interros = somme des interros / nombre d'interros
//   note de classe       = (moyenne des interros + devoir) / 2
//   note générale        = (note de classe + composition) / 2
// S'il y a plusieurs devoirs ou compositions (cas exceptionnel), on en prend la moyenne.
// Primaire : la note saisie est directement la note sur 20 (pas de devoir ni de composition).
function calculerNote({ interro, devoir, composition, interros, devoirs, compositions, coefficient, niveau }) {
  const li = listeEvals(interros, interro);
  const ld = listeEvals(devoirs, devoir);
  const lc = listeEvals(compositions, composition);
  const moyInterros = moyenneListe(li);
  const moyDevoirs = moyenneListe(ld);
  const moyCompos = moyenneListe(lc);

  let noteClasse, noteGenerale;
  if (niveau === "Primaire" && ld.length === 0 && lc.length === 0) {
    noteClasse = moyInterros;
    noteGenerale = moyInterros;
  } else {
    noteClasse = (moyInterros + moyDevoirs) / 2;
    noteGenerale = (noteClasse + moyCompos) / 2;
  }
  const noteFinale = noteGenerale * num(coefficient || 1);
  return { moyInterros, moyDevoirs, moyCompos, noteClasse, noteGenerale, noteFinale, listes: { interros: li, devoirs: ld, compositions: lc } };
}

const arrondi2 = (v) => Math.round(num(v) * 100) / 100;

// Moyenne générale d'un élève pour UNE période donnée (Module 5)
async function moyenneEleve(idEleve, niveau, etablissementId, periode) {
  const res = await query(
    `SELECT note_generale AS "NoteGenerale", note_finale AS "NoteFinale", coefficient
     FROM notes WHERE id_eleve = $1 AND etablissement_id = $2 AND periode = $3`,
    [idEleve, etablissementId, periode]
  );
  const notes = res.rows;
  if (notes.length === 0) return 0;

  if (niveau === "Primaire") {
    const somme = notes.reduce((acc, n) => acc + num(n.NoteGenerale), 0);
    return somme / notes.length;
  }
  const sommeFinales = notes.reduce((acc, n) => acc + num(n.NoteFinale), 0);
  const sommeCoeffs = notes.reduce((acc, n) => acc + num(n.coefficient), 0);
  return sommeCoeffs > 0 ? sommeFinales / sommeCoeffs : 0;
}

// Classement automatique par niveau/classe/série, pour une période, au sein d'un établissement (Module 6)
async function classement({ etablissementId, niveau, classe, serie, periode }) {
  const conditions = ["etablissement_id = $1"];
  const params = [etablissementId];
  if (niveau) { params.push(niveau); conditions.push(`niveau = $${params.length}`); }
  if (classe) { params.push(classe); conditions.push(`classe = $${params.length}`); }
  if (serie) { params.push(serie); conditions.push(`serie = $${params.length}`); }

  const res = await query(
    `SELECT id AS "ID", nom AS "Nom", prenom AS "Prenom", niveau AS "Niveau", classe AS "Classe",
            serie AS "Serie", annee AS "Annee"
     FROM eleves WHERE ${conditions.join(" AND ")}`,
    params
  );

  const avecMoyenne = await Promise.all(
    res.rows.map(async (e) => ({
      ...e,
      moyenne: Math.round((await moyenneEleve(e.ID, e.Niveau, etablissementId, periode)) * 100) / 100,
    }))
  );
  avecMoyenne.sort((a, b) => b.moyenne - a.moyenne);

  return avecMoyenne.map((e, i) => ({ ...e, rang: i + 1, mention: getMention(e.moyenne) }));
}

// Statistiques de la classe pour le bulletin (effectif, moyenne, min, max), pour une période
async function classStats({ etablissementId, niveau, classe, serie, periode }) {
  const rows = await classement({ etablissementId, niveau, classe, serie, periode });
  const moyennes = rows.map((r) => r.moyenne);
  return {
    effectif: rows.length,
    moyenneClasse: moyennes.length ? Math.round((moyennes.reduce((a, b) => a + b, 0) / moyennes.length) * 100) / 100 : 0,
    min: moyennes.length ? Math.min(...moyennes) : 0,
    max: moyennes.length ? Math.max(...moyennes) : 0,
  };
}

// Rang d'un élève dans une matière donnée, au sein de sa classe, pour une période (bulletin format "privé")
async function rangMatiere({ idEleve, matiere, niveau, classe, serie, etablissementId, periode }) {
  const conditions = ["etablissement_id = $1", "niveau = $2", "classe = $3"];
  const params = [etablissementId, niveau, classe];
  if (serie) { params.push(serie); conditions.push(`serie = $${params.length}`); }

  const eleves = await query(`SELECT id AS "ID" FROM eleves WHERE ${conditions.join(" AND ")}`, params);

  const avecNote = await Promise.all(
    eleves.rows.map(async (e) => {
      const noteRes = await query(
        `SELECT note_generale FROM notes WHERE id_eleve = $1 AND etablissement_id = $2 AND matiere = $3 AND periode = $4`,
        [e.ID, etablissementId, matiere, periode]
      );
      return { id: e.ID, note: noteRes.rows[0] ? Number(noteRes.rows[0].note_generale) || 0 : 0 };
    })
  );
  avecNote.sort((a, b) => b.note - a.note);
  const rang = avecNote.findIndex((e) => Number(e.id) === Number(idEleve)) + 1;
  return rang || null;
}

module.exports = { calculerNote, listeEvals, moyenneListe, arrondi2, num, moyenneEleve, classement, classStats, rangMatiere };
