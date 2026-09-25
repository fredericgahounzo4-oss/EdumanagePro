// Agrégats partagés par les écrans Classes, Statistiques et Tableau de bord.
// Ils évitent le motif "une requête par élève" en calculant tout en une seule passe SQL.
const { query } = require("../db/pool");

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function periodeActuelle(etablissementId) {
  const r = await query("SELECT periode_actuelle FROM etablissements WHERE id = $1", [etablissementId]);
  return r.rows[0]?.periode_actuelle || "1er Trimestre";
}

// Moyenne générale de chaque élève ayant des notes pour la période : Map<idEleve, moyenne>.
// MÊME RÈGLE que calculs.moyenneEleve : Primaire = moyenne des notes générales ;
// Collège/Lycée = somme des notes finales / somme des coefficients.
async function moyennesParEleve(etablissementId, periode) {
  const r = await query(
    `SELECT n.id_eleve, e.niveau, n.note_generale, n.note_finale, n.coefficient
     FROM notes n JOIN eleves e ON e.id = n.id_eleve
     WHERE n.etablissement_id = $1 AND n.periode = $2`,
    [etablissementId, periode]
  );
  const acc = new Map();
  for (const row of r.rows) {
    let a = acc.get(row.id_eleve);
    if (!a) { a = { niveau: row.niveau, n: 0, sg: 0, sf: 0, sc: 0 }; acc.set(row.id_eleve, a); }
    a.n += 1;
    a.sg += num(row.note_generale);
    a.sf += num(row.note_finale);
    a.sc += num(row.coefficient);
  }
  const out = new Map();
  for (const [id, a] of acc) {
    const m = a.niveau === "Primaire" ? a.sg / a.n : (a.sc > 0 ? a.sf / a.sc : 0);
    out.set(Number(id), Math.round(m * 100) / 100);
  }
  return out;
}

// Décomptes de présence sur les N derniers jours : Map<idEleve, {presents, absents, retards}>
async function presencesParEleve(etablissementId, jours = 30) {
  const r = await query(
    `SELECT id_eleve, statut, COUNT(*)::int AS nb FROM presences
     WHERE etablissement_id = $1 AND date >= CURRENT_DATE - $2::int
     GROUP BY id_eleve, statut`,
    [etablissementId, jours]
  );
  const out = new Map();
  for (const row of r.rows) {
    const k = Number(row.id_eleve);
    if (!out.has(k)) out.set(k, { presents: 0, absents: 0, retards: 0 });
    const o = out.get(k);
    if (row.statut === "Absent") o.absents += row.nb;
    else if (row.statut === "Retard") o.retards += row.nb;
    else o.presents += row.nb;
  }
  return out;
}

// Taux de présence (%) à partir de décomptes ; null s'il n'y a aucune donnée.
// MÊME définition que la fiche élève (/attendance/stats) : présents / total des appels.
function tauxPresence(d) {
  if (!d) return null;
  const total = d.presents + d.absents + d.retards;
  return total > 0 ? Math.round((d.presents / total) * 1000) / 10 : null;
}

const NIVEAU_ORDRE = ["Primaire", "College", "Lycee"];
const { NIVEAUX } = require("./reference");

// Tri naturel : niveau, puis ordre officiel des classes, puis série
function comparerClasses(a, b) {
  const na = NIVEAU_ORDRE.indexOf(a.Niveau), nb = NIVEAU_ORDRE.indexOf(b.Niveau);
  if (na !== nb) return na - nb;
  const ca = (NIVEAUX[a.Niveau] || []).indexOf(a.Classe), cb = (NIVEAUX[b.Niveau] || []).indexOf(b.Classe);
  if (ca !== cb) return ca - cb;
  return String(a.Serie || "").localeCompare(String(b.Serie || ""));
}

module.exports = { num, periodeActuelle, moyennesParEleve, presencesParEleve, tauxPresence, comparerClasses };
