// Données des bulletins pour les modèles "papier" (Baguida, Vogan, La Réussite...).
// Tout est calculé pour UNE CLASSE en quelques requêtes (au lieu d'une requête par élève et par matière),
// puis on en extrait le contexte de chaque élève. Mêmes règles de calcul que lib/calculs.js.
const { query } = require("../db/pool");
const { getMatieresFor } = require("./matieres");
const { getSettingsRaw } = require("../routes/settings");
const { getMention, NIVEAUX } = require("./reference");
const { num, listeEvals, moyenneListe } = require("./calculs");

const ORDRE_PERIODES = ["1er Trimestre", "2e Trimestre", "3e Trimestre", "1er Semestre", "2e Semestre"];
const ORDRE_CATEGORIES = ["Littéraires", "Scientifiques", "Sciences", "Non obligatoires", "Autres", "Complémentaires", "Fondamentales"];
// Intitulés officiels du livret scolaire togolais. "Non obligatoires" (Lycée), "Autres" (Collège) et
// "Complémentaires" (Primaire) désignent la même 3e catégorie (EPS, musique, dessin...) : même intitulé partout.
const LIBELLE_GROUPE = {
  "Littéraires": "MATIERES LITTERAIRES", "Scientifiques": "MATIERES SCIENTIFIQUES", "Sciences": "MATIERES SCIENTIFIQUES",
  "Fondamentales": "MATIERES FONDAMENTALES",
  "Non obligatoires": "MATIERES SPORTIVES, ARTISTIQUES ET COMPLEMENTAIRES",
  "Autres": "MATIERES SPORTIVES, ARTISTIQUES ET COMPLEMENTAIRES",
  "Complémentaires": "MATIERES SPORTIVES, ARTISTIQUES ET COMPLEMENTAIRES",
};
const arrondi = (v) => Math.round(num(v) * 100) / 100;

// Appréciation d'une note ou d'une moyenne (échelle des bulletins papier)
function appreciation(note) {
  if (note < 5) return "Très faible";
  if (note < 8) return "Faible";
  if (note < 10) return "Insuffisant";
  if (note < 12) return "Passable";
  if (note < 14) return "Assez bien";
  if (note < 16) return "Bien";
  if (note < 18) return "Très bien";
  return "Excellent";
}

// Classement avec ex æquo : { n, ex } pour chaque id (1, 2, 2, 4...)
function rangsAvecEgalites(entrees) {
  const tries = [...entrees].sort((a, b) => b.valeur - a.valeur);
  const out = new Map();
  const nb = new Map();
  tries.forEach((e) => nb.set(e.valeur, (nb.get(e.valeur) || 0) + 1));
  let rang = 0, prev = null;
  tries.forEach((e, i) => {
    if (prev === null || e.valeur !== prev) { rang = i + 1; prev = e.valeur; }
    out.set(e.id, { n: rang, ex: nb.get(e.valeur) > 1 });
  });
  return out;
}

// "1er", "5e", "3e ex"
function formatRang(r) {
  if (!r) return "";
  return `${r.n === 1 ? "1er" : r.n + "e"}${r.ex ? " ex" : ""}`;
}

// Moyenne d'un élève pour une période, à partir de SES lignes de notes (null s'il n'en a aucune)
function moyenneDepuisNotes(niveau, notes) {
  if (!notes.length) return null;
  if (niveau === "Primaire") return arrondi(notes.reduce((a, n) => a + num(n.note_generale), 0) / notes.length);
  const coef = notes.reduce((a, n) => a + num(n.coefficient), 0);
  return coef > 0 ? arrondi(notes.reduce((a, n) => a + num(n.note_finale), 0) / coef) : 0;
}

function statsValeurs(valeurs) {
  if (!valeurs.length) return { min: null, max: null, moyenne: null, n: 0 };
  return { min: Math.min(...valeurs), max: Math.max(...valeurs), moyenne: arrondi(valeurs.reduce((a, b) => a + b, 0) / valeurs.length), n: valeurs.length };
}

const INFOS_VIDES = {
  retards: null, absences: null, punitions: null, exclusion: null, conduite: "", appreciation: "", distinction: "",
  decision: "", observations: "", avertissement: "", blame: "", felicitations: false, encouragements: false, tableauHonneur: false,
};

function infosDepuisLigne(r) {
  if (!r) return { ...INFOS_VIDES };
  return {
    retards: r.retards, absences: r.absences, punitions: r.punitions, exclusion: r.exclusion,
    conduite: r.conduite || "", appreciation: r.appreciation || "", distinction: r.distinction || "",
    decision: r.decision || "", observations: r.observations || "", avertissement: r.avertissement || "", blame: r.blame || "",
    felicitations: !!r.felicitations, encouragements: !!r.encouragements, tableauHonneur: !!r.tableau_honneur,
  };
}

// Charge et calcule tout ce qu'il faut pour les bulletins d'une classe (niveau + classe + série éventuelle)
async function chargerClasse({ etablissementId, niveau, classe, serie = "", periode = null }) {
  const settings = await getSettingsRaw(etablissementId);
  const periodeCourante = periode || settings.periode_actuelle;

  const params = [etablissementId, niveau, classe];
  let filtreSerie = "";
  if (serie) { params.push(serie); filtreSerie = ` AND serie = $${params.length}`; }
  const elevesRes = await query(
    `SELECT id, nom, prenom, niveau, classe, serie, annee, sexe, statut FROM eleves
     WHERE etablissement_id = $1 AND niveau = $2 AND classe = $3${filtreSerie} ORDER BY nom, prenom`,
    params
  );
  const eleves = elevesRes.rows.map((e, i) => ({ ...e, id: Number(e.id), numero: i + 1 }));
  const ids = eleves.map((e) => e.id);

  const matieres = await getMatieresFor({ etablissementId, niveau, classe, serie });
  const notesRes = ids.length
    ? await query("SELECT * FROM notes WHERE etablissement_id = $1 AND id_eleve = ANY($2::int[])", [etablissementId, ids])
    : { rows: [] };
  const notesParEleve = new Map(ids.map((id) => [id, []]));
  for (const n of notesRes.rows) notesParEleve.get(Number(n.id_eleve))?.push(n);

  // Données annexes : tolérantes à une migration non exécutée
  let infosRes = { rows: [] }, titulaire = "";
  try {
    if (ids.length) infosRes = await query("SELECT * FROM bulletin_infos WHERE etablissement_id = $1 AND periode = $2 AND id_eleve = ANY($3::int[])", [etablissementId, periodeCourante, ids]);
  } catch { /* migration v3 non exécutée */ }
  try {
    const t = await query(
      `SELECT e.nom, e.prenom FROM titulaires_classes t JOIN enseignants e ON e.id = t.id_enseignant
       WHERE t.etablissement_id = $1 AND t.niveau = $2 AND t.classe = $3 AND (t.serie = $4 OR t.serie = '') ORDER BY (t.serie = $4) DESC LIMIT 1`,
      [etablissementId, niveau, classe, serie]
    );
    if (t.rows[0]) titulaire = `${t.rows[0].prenom} ${t.rows[0].nom}`.trim();
  } catch { /* migration v3 non exécutée */ }
  const profsRes = await query(
    `SELECT a.matiere, e.nom, e.prenom FROM affectations a JOIN enseignants e ON e.id = a.id_enseignant
     WHERE a.etablissement_id = $1 AND a.niveau = $2 AND a.classe = $3 AND (a.serie = '' OR a.serie = $4) AND a.matiere <> ''`,
    [etablissementId, niveau, classe, serie]
  );
  const profParMatiere = new Map();
  for (const p of profsRes.rows) if (!profParMatiere.has(p.matiere)) profParMatiere.set(p.matiere, `${p.prenom} ${p.nom}`.trim());
  const infosParEleve = new Map(infosRes.rows.map((r) => [Number(r.id_eleve), infosDepuisLigne(r)]));

  // Périodes de la même famille (trimestres OU semestres), jusqu'à la période courante incluse
  const famille = /semestre/i.test(periodeCourante) ? ORDRE_PERIODES.filter((p) => /semestre/i.test(p)) : ORDRE_PERIODES.filter((p) => /trimestre/i.test(p));
  const periodes = famille.filter((p) => famille.indexOf(p) <= famille.indexOf(periodeCourante) && (p === periodeCourante || notesRes.rows.some((n) => n.periode === p)));

  // Moyennes, rangs et statistiques de chaque période
  const parPeriode = new Map();
  for (const p of periodes) {
    const moyennes = new Map();
    for (const e of eleves) {
      const m = moyenneDepuisNotes(niveau, notesParEleve.get(e.id).filter((n) => n.periode === p));
      if (m !== null) moyennes.set(e.id, m);
    }
    parPeriode.set(p, {
      moyennes,
      rangs: rangsAvecEgalites([...moyennes].map(([id, valeur]) => ({ id, valeur }))),
      stats: statsValeurs([...moyennes.values()]),
    });
  }

  // Moyenne annuelle "à ce jour" : moyenne des moyennes des périodes où l'élève a des notes
  const annuelles = new Map();
  for (const e of eleves) {
    const vals = periodes.map((p) => parPeriode.get(p).moyennes.get(e.id)).filter((v) => v !== undefined);
    if (vals.length) annuelles.set(e.id, arrondi(vals.reduce((a, b) => a + b, 0) / vals.length));
  }
  const annuel = {
    moyennes: annuelles,
    rangs: rangsAvecEgalites([...annuelles].map(([id, valeur]) => ({ id, valeur }))),
    stats: statsValeurs([...annuelles.values()]),
  };

  // Rang de chaque élève dans chaque matière (période courante)
  const rangsMatiere = new Map();
  for (const m of matieres) {
    const entrees = [];
    for (const e of eleves) {
      const n = notesParEleve.get(e.id).find((x) => x.periode === periodeCourante && x.matiere === m.Nom);
      if (n) entrees.push({ id: e.id, valeur: arrondi(n.note_generale) });
    }
    rangsMatiere.set(m.Nom, rangsAvecEgalites(entrees));
  }

  return { settings, periode: periodeCourante, periodes, niveau, classe, serie, eleves, matieres, notesParEleve, infosParEleve, titulaire, profParMatiere, parPeriode, annuel, rangsMatiere };
}

// Contexte complet d'un élève pour les modèles de bulletin
function contexteEleve(data, idEleve) {
  const { settings, periode, periodes, matieres, parPeriode, annuel } = data;
  const eleve = data.eleves.find((e) => e.id === Number(idEleve));
  if (!eleve) return null;
  const notes = data.notesParEleve.get(eleve.id).filter((n) => n.periode === periode);

  const lignes = matieres.map((m) => {
    const n = notes.find((x) => x.matiere === m.Nom);
    const c = n ? {
      interros: listeEvals(n.interros, n.interro), devoirs: listeEvals(n.devoirs, n.devoir), compositions: listeEvals(n.compositions, n.composition),
    } : { interros: [], devoirs: [], compositions: [] };
    const noteGenerale = n ? arrondi(n.note_generale) : 0;
    const coefficient = Number(m.Coefficient);
    return {
      matiere: m.Nom, categorie: m.Categorie, coefficient, aNote: !!n,
      interros: c.interros, moyInterros: arrondi(moyenneListe(c.interros)),
      devoir: n ? arrondi(n.devoir) : 0, composition: n ? arrondi(n.composition) : 0,
      noteClasse: n ? arrondi((moyenneListe(c.interros) + moyenneListe(c.devoirs)) / 2) : 0,
      noteGenerale, noteFinale: n ? arrondi(n.note_finale) : 0,
      professeur: (n && n.professeur) || data.profParMatiere.get(m.Nom) || "",
      rang: n ? data.rangsMatiere.get(m.Nom).get(eleve.id) || null : null,
      appreciation: n ? appreciation(noteGenerale) : "",
    };
  });

  // Groupes de matières (littéraires / scientifiques / facultatives) avec leur moyenne
  const cats = [...new Set(lignes.map((l) => l.categorie))].sort((a, b) => {
    const ia = ORDRE_CATEGORIES.indexOf(a), ib = ORDRE_CATEGORIES.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const groupes = cats.map((c) => {
    const ls = lignes.filter((l) => l.categorie === c);
    const notees = ls.filter((l) => l.aNote);
    const coef = notees.reduce((a, l) => a + l.coefficient, 0);
    return {
      categorie: c, libelle: LIBELLE_GROUPE[c] || String(c).toUpperCase(), lignes: ls,
      moyenne: coef > 0 && c !== "Non obligatoires" ? arrondi(notees.reduce((a, l) => a + l.noteFinale, 0) / coef) : null,
    };
  });
  const moyGroupe = (c) => groupes.find((g) => g.categorie === c)?.moyenne ?? null;

  const notees = lignes.filter((l) => l.aNote);
  const totalCoef = notees.reduce((a, l) => a + l.coefficient, 0);
  const totalPoints = arrondi(notees.reduce((a, l) => a + l.noteFinale, 0));
  const pp = parPeriode.get(periode);
  const moyenne = pp.moyennes.has(eleve.id) ? pp.moyennes.get(eleve.id) : null;

  const precedentes = periodes.filter((p) => p !== periode).map((p) => {
    const d = parPeriode.get(p);
    return { periode: p, moyenne: d.moyennes.has(eleve.id) ? d.moyennes.get(eleve.id) : null, rang: d.rangs.get(eleve.id) || null, stats: d.stats };
  });
  const aAnnuelle = annuel.moyennes.has(eleve.id) && periodes.length > 1;

  return {
    eleve: { ID: eleve.id, Nom: eleve.nom, Prenom: eleve.prenom, Niveau: eleve.niveau, Classe: eleve.classe, Serie: eleve.serie, Annee: eleve.annee, Sexe: eleve.sexe, Statut: eleve.statut, Numero: eleve.numero },
    settings, periode, effectif: data.eleves.length, lignes, groupes, moyLitt: moyGroupe("Littéraires"), moySci: moyGroupe("Scientifiques"),
    totalCoef, totalPoints, moyenne, mention: moyenne === null ? "" : getMention(moyenne),
    appreciationGenerale: moyenne === null ? "" : appreciation(moyenne),
    rangClasse: pp.rangs.get(eleve.id) || null, statsPeriode: pp.stats, precedentes,
    annuelle: aAnnuelle ? { moyenne: annuel.moyennes.get(eleve.id), rang: annuel.rangs.get(eleve.id) || null, stats: annuel.stats } : null,
    infos: data.infosParEleve.get(eleve.id) || { ...INFOS_VIDES }, titulaire: data.titulaire,
  };
}

// Groupes (niveau, classe, série) à imprimer pour un lot, dans l'ordre officiel : niveau, classe, série
async function groupesDuLot({ etablissementId, niveau, classe, serie }) {
  const params = [etablissementId];
  const cond = ["etablissement_id = $1"];
  if (niveau) { params.push(niveau); cond.push(`niveau = $${params.length}`); }
  if (classe) { params.push(classe); cond.push(`classe = $${params.length}`); }
  if (serie) { params.push(serie); cond.push(`serie = $${params.length}`); }
  const r = await query(`SELECT DISTINCT niveau, classe, serie FROM eleves WHERE ${cond.join(" AND ")}`, params);
  const ordreNiveau = ["Primaire", "College", "Lycee"];
  return r.rows.sort((a, b) =>
    ordreNiveau.indexOf(a.niveau) - ordreNiveau.indexOf(b.niveau) ||
    (NIVEAUX[a.niveau] || []).indexOf(a.classe) - (NIVEAUX[b.niveau] || []).indexOf(b.classe) ||
    String(a.serie || "").localeCompare(String(b.serie || ""))
  ).map((g) => ({ niveau: g.niveau, classe: g.classe, serie: g.serie || "" }));
}

// Élèves d'une classe dans l'ordre de mérite (meilleure moyenne d'abord ; sans notes en dernier, par ordre alphabétique)
function ordreDeMerite(data) {
  const pp = data.parPeriode.get(data.periode);
  return [...data.eleves].sort((a, b) => {
    const ma = pp.moyennes.has(a.id) ? pp.moyennes.get(a.id) : -1, mb = pp.moyennes.has(b.id) ? pp.moyennes.get(b.id) : -1;
    return mb - ma || a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom);
  }).map((e) => e.id);
}

module.exports = { chargerClasse, contexteEleve, groupesDuLot, ordreDeMerite, rangsAvecEgalites, formatRang, appreciation, moyenneDepuisNotes, ORDRE_PERIODES, INFOS_VIDES };
