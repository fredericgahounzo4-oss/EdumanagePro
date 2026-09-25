const express = require("express");
const { query } = require("../db/pool");
const { requireAuth, requireRole, requireEtablissement } = require("../lib/auth");
const { getAffectationsForUser, filterStudentsForScope, estTitulaire } = require("../lib/scope");
const { notifier } = require("../lib/notify");
const { getMention } = require("../lib/reference");
const { periodeActuelle, moyennesParEleve, presencesParEleve, tauxPresence, comparerClasses } = require("../lib/agregats");

const router = express.Router();
router.use(requireAuth, requireRole("Administrateur", "Enseignant"), requireEtablissement);

const arrondi = (v) => Math.round(v * 100) / 100;

// Titulaires de toutes les classes : Map "niveau|classe|série" -> { ID, Nom }
async function chargerTitulaires(etablissementId) {
  const out = new Map();
  try {
    const r = await query(
      `SELECT t.niveau, t.classe, t.serie, e.id, e.nom, e.prenom FROM titulaires_classes t
       JOIN enseignants e ON e.id = t.id_enseignant WHERE t.etablissement_id = $1`,
      [etablissementId]
    );
    for (const x of r.rows) out.set(`${x.niveau}|${x.classe}|${x.serie || ""}`, { ID: x.id, Nom: `${x.prenom} ${x.nom}`.trim() });
  } catch { /* migration v3 non exécutée */ }
  return out;
}
// Titulaire d'une classe ; pour une classe sans série précise, on reprend celui de la classe entière
const titulaireDe = (map, c) => map.get(`${c.Niveau}|${c.Classe}|${c.Serie || ""}`) || (c.Serie ? null : map.get(`${c.Niveau}|${c.Classe}|`)) || null;
const cle = (e) => `${e.Niveau}|${e.Classe}|${e.Serie || ""}`;

function moyenne(liste) {
  return liste.length ? arrondi(liste.reduce((a, b) => a + b, 0) / liste.length) : null;
}

// Un enseignant n'est rattaché qu'aux classes de ses affectations (une affectation sans série couvre toutes les séries)
function enseignantsDeClasse(affectationsEtab, c) {
  const vus = new Set();
  const out = [];
  for (const a of affectationsEtab) {
    if (a.niveau !== c.Niveau || a.classe !== c.Classe) continue;
    if (a.serie && a.serie !== (c.Serie || "")) continue;
    const k = `${a.id_enseignant}|${a.matiere}`;
    if (vus.has(k)) continue;
    vus.add(k);
    out.push({ ID: a.id_enseignant, Nom: `${a.prenom} ${a.nom}`.trim(), Matiere: a.matiere || "" });
  }
  return out;
}

// GET /api/classes?periode=  -> une fiche par classe (et par série au Lycée)
router.get("/", async (req, res) => {
  const etabId = req.user.etablissementId;
  const periode = req.query.periode || await periodeActuelle(etabId);

  const elevesRes = await query(
    `SELECT id AS "ID", niveau AS "Niveau", classe AS "Classe", serie AS "Serie" FROM eleves WHERE etablissement_id = $1`,
    [etabId]
  );
  const affectations = await getAffectationsForUser(req.user);
  const eleves = filterStudentsForScope(elevesRes.rows, affectations);

  const [moyennes, presences, affRes, titulaires] = await Promise.all([
    moyennesParEleve(etabId, periode),
    presencesParEleve(etabId, 30),
    query(
      `SELECT a.id_enseignant, a.niveau, a.classe, a.serie, a.matiere, e.nom, e.prenom
       FROM affectations a JOIN enseignants e ON e.id = a.id_enseignant WHERE a.etablissement_id = $1`,
      [etabId]
    ),
    chargerTitulaires(etabId),
  ]);

  const groupes = new Map();
  for (const e of eleves) {
    const k = cle(e);
    if (!groupes.has(k)) groupes.set(k, { Niveau: e.Niveau, Classe: e.Classe, Serie: e.Serie || "", eleves: [] });
    groupes.get(k).eleves.push(e);
  }

  const classes = [...groupes.values()].map((g) => {
    const moys = g.eleves.map((e) => moyennes.get(Number(e.ID))).filter((m) => m !== undefined);
    const dec = { presents: 0, absents: 0, retards: 0 };
    for (const e of g.eleves) {
      const d = presences.get(Number(e.ID));
      if (d) { dec.presents += d.presents; dec.absents += d.absents; dec.retards += d.retards; }
    }
    return {
      Niveau: g.Niveau, Classe: g.Classe, Serie: g.Serie,
      Effectif: g.eleves.length,
      ElevesNotes: moys.length,
      MoyenneClasse: moyenne(moys),
      TauxReussite: moys.length ? Math.round((moys.filter((m) => m >= 10).length / moys.length) * 1000) / 10 : null,
      TauxPresence: tauxPresence(dec),
      Enseignants: enseignantsDeClasse(affRes.rows, g),
      Titulaire: titulaireDe(titulaires, g),
      SuisTitulaire: estTitulaire(affectations, g) && affectations !== null,
    };
  }).sort(comparerClasses);

  res.json({ periode, classes });
});

// GET /api/classes/detail?niveau=&classe=&serie=&periode=  -> classement et indicateurs d'une classe
router.get("/detail", async (req, res) => {
  const etabId = req.user.etablissementId;
  const { niveau, classe } = req.query;
  const serie = req.query.serie || "";
  if (!niveau || !classe) return res.status(400).json({ error: "Niveau et classe sont requis" });

  const affectations = await getAffectationsForUser(req.user);
  if (affectations !== null && !affectations.some((a) => a.Niveau === niveau && a.Classe === classe && (!a.Serie || a.Serie === serie))) {
    return res.status(403).json({ error: "Vous n'êtes pas affecté à cette classe" });
  }

  const periode = req.query.periode || await periodeActuelle(etabId);
  const params = [etabId, niveau, classe];
  let filtreSerie = "";
  if (serie) { params.push(serie); filtreSerie = ` AND serie = $${params.length}`; }
  const elevesRes = await query(
    `SELECT id AS "ID", nom AS "Nom", prenom AS "Prenom" FROM eleves
     WHERE etablissement_id = $1 AND niveau = $2 AND classe = $3${filtreSerie} ORDER BY nom, prenom`,
    params
  );

  const [moyennes, presences, affRes, titulaires] = await Promise.all([
    moyennesParEleve(etabId, periode),
    presencesParEleve(etabId, 30),
    query(
      `SELECT a.id_enseignant, a.niveau, a.classe, a.serie, a.matiere, e.nom, e.prenom
       FROM affectations a JOIN enseignants e ON e.id = a.id_enseignant WHERE a.etablissement_id = $1`,
      [etabId]
    ),
    chargerTitulaires(etabId),
  ]);

  const lignes = elevesRes.rows.map((e) => {
    const m = moyennes.get(Number(e.ID));
    const d = presences.get(Number(e.ID));
    return {
      ID: e.ID, Nom: e.Nom, Prenom: e.Prenom,
      Moyenne: m === undefined ? null : m,
      Mention: m === undefined ? null : getMention(m),
      Absences: d ? d.absents : 0,
      Retards: d ? d.retards : 0,
      TauxPresence: tauxPresence(d),
      Rang: null,
    };
  });
  // Rang uniquement parmi les élèves ayant des notes (mêmes rangs que l'écran Résultats)
  lignes.filter((l) => l.Moyenne !== null).sort((a, b) => b.Moyenne - a.Moyenne).forEach((l, i) => { l.Rang = i + 1; });
  lignes.sort((a, b) => (a.Rang ?? 9999) - (b.Rang ?? 9999) || a.Nom.localeCompare(b.Nom));

  const moys = lignes.filter((l) => l.Moyenne !== null).map((l) => l.Moyenne);
  const dec = { presents: 0, absents: 0, retards: 0 };
  for (const e of elevesRes.rows) {
    const d = presences.get(Number(e.ID));
    if (d) { dec.presents += d.presents; dec.absents += d.absents; dec.retards += d.retards; }
  }

  res.json({
    Niveau: niveau, Classe: classe, Serie: serie, Periode: periode,
    Effectif: lignes.length,
    MoyenneClasse: moyenne(moys),
    Min: moys.length ? Math.min(...moys) : null,
    Max: moys.length ? Math.max(...moys) : null,
    TauxReussite: moys.length ? Math.round((moys.filter((m) => m >= 10).length / moys.length) * 1000) / 10 : null,
    TauxPresence: tauxPresence(dec),
    Enseignants: enseignantsDeClasse(affRes.rows, { Niveau: niveau, Classe: classe, Serie: serie }),
    Titulaire: titulaireDe(titulaires, { Niveau: niveau, Classe: classe, Serie: serie }),
    SuisTitulaire: affectations !== null && estTitulaire(affectations, { Niveau: niveau, Classe: classe, Serie: serie }),
    Eleves: lignes,
  });
});

// PUT /api/classes/titulaire  { Niveau, Classe, Serie, IDEnseignant }  (IDEnseignant null = retirer le titulaire)
// Réservé à l'administrateur. Le titulaire voit et gère TOUT ce qui concerne sa classe (toutes les matières).
router.put("/titulaire", requireRole("Administrateur"), async (req, res) => {
  const etabId = req.user.etablissementId;
  const { Niveau, Classe, IDEnseignant } = req.body;
  const Serie = req.body.Serie || "";
  if (!Niveau || !Classe) return res.status(400).json({ error: "Niveau et classe sont requis" });

  const classeOk = await query(
    "SELECT 1 FROM eleves WHERE etablissement_id = $1 AND niveau = $2 AND classe = $3 AND ($4 = '' OR serie = $4) LIMIT 1",
    [etabId, Niveau, Classe, Serie]
  );
  if (!classeOk.rows.length) return res.status(404).json({ error: "Cette classe n'existe pas (aucun élève inscrit)" });

  if (!IDEnseignant) {
    await query("DELETE FROM titulaires_classes WHERE etablissement_id = $1 AND niveau = $2 AND classe = $3 AND serie = $4", [etabId, Niveau, Classe, Serie]);
    return res.json({ success: true, Titulaire: null });
  }
  const ens = await query("SELECT id, nom, prenom FROM enseignants WHERE id = $1 AND etablissement_id = $2", [IDEnseignant, etabId]);
  if (!ens.rows.length) return res.status(404).json({ error: "Enseignant introuvable" });

  await query(
    `INSERT INTO titulaires_classes (etablissement_id, niveau, classe, serie, id_enseignant) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (etablissement_id, niveau, classe, serie) DO UPDATE SET id_enseignant = EXCLUDED.id_enseignant`,
    [etabId, Niveau, Classe, Serie, IDEnseignant]
  );
  // Prévient le professeur (cloche) — sans jamais bloquer l'attribution
  const comptes = await query("SELECT id FROM utilisateurs WHERE etablissement_id = $1 AND id_enseignant = $2", [etabId, IDEnseignant]);
  await notifier({
    etablissementId: etabId, userIds: comptes.rows.map((c) => c.id), type: "info",
    titre: `Vous êtes titulaire de ${Classe}${Serie ? " " + Serie : ""}`,
    message: "Vous avez désormais accès à toutes les matières et à toutes les données de cette classe.", lien: "/classes",
  });
  const e = ens.rows[0];
  res.json({ success: true, Titulaire: { ID: e.id, Nom: `${e.prenom} ${e.nom}`.trim() } });
});

module.exports = router;
