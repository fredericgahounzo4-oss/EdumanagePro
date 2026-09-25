const express = require("express");
const { query } = require("../db/pool");
const { requireAuth, requireRole, requireEtablissement } = require("../lib/auth");
const { getAffectationsForUser, filterStudentsForScope } = require("../lib/scope");
const { MENTIONS, getMention } = require("../lib/reference");
const { periodeActuelle, moyennesParEleve } = require("../lib/agregats");

const router = express.Router();
router.use(requireAuth, requireRole("Administrateur", "Enseignant"), requireEtablissement);

const arrondi = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

// Les 6 derniers mois (AAAA-MM), du plus ancien au plus récent
function derniersMois(n = 6) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

// GET /api/stats?periode=&niveau=
router.get("/", async (req, res) => {
  const etabId = req.user.etablissementId;
  const isAdmin = req.user.role === "Administrateur";
  const periode = req.query.periode || await periodeActuelle(etabId);
  const niveauFiltre = req.query.niveau || "";

  const elevesRes = await query(
    `SELECT id AS "ID", nom AS "Nom", prenom AS "Prenom", niveau AS "Niveau", classe AS "Classe", serie AS "Serie"
     FROM eleves WHERE etablissement_id = $1`,
    [etabId]
  );
  const affectations = await getAffectationsForUser(req.user);
  let eleves = filterStudentsForScope(elevesRes.rows, affectations);
  if (niveauFiltre) eleves = eleves.filter((e) => e.Niveau === niveauFiltre);
  const ids = eleves.map((e) => Number(e.ID));

  // --- Effectifs
  const effectifParNiveau = {};
  for (const e of eleves) effectifParNiveau[e.Niveau] = (effectifParNiveau[e.Niveau] || 0) + 1;

  // --- Résultats scolaires (une requête pour les moyennes, une pour les matières)
  const moyennes = await moyennesParEleve(etabId, periode);
  const noted = eleves
    .filter((e) => moyennes.has(Number(e.ID)))
    .map((e) => ({ ...e, moyenne: moyennes.get(Number(e.ID)) }));
  const valeurs = noted.map((e) => e.moyenne);

  const matieresRes = ids.length
    ? await query(
      `SELECT matiere, AVG(note_generale)::float AS moyenne, COUNT(*)::int AS nb
       FROM notes WHERE etablissement_id = $1 AND periode = $2 AND id_eleve = ANY($3::int[])
       GROUP BY matiere ORDER BY moyenne DESC`,
      [etabId, periode, ids]
    )
    : { rows: [] };

  const mentionsCount = Object.fromEntries(MENTIONS.map((m) => [m.label, 0]));
  for (const v of valeurs) mentionsCount[getMention(v)] += 1;

  const lite = (e) => ({ ID: e.ID, Nom: e.Nom, Prenom: e.Prenom, Classe: `${e.Classe}${e.Serie ? " " + e.Serie : ""}`, Niveau: e.Niveau, Moyenne: e.moyenne });
  const tries = [...noted].sort((a, b) => b.moyenne - a.moyenne);

  // --- Présences
  let presenceParMois = [];
  let tauxPresence30j = null;
  let elevesAbsents = [];
  if (ids.length) {
    const mois = derniersMois(6);
    const [pm, p30, abs] = await Promise.all([
      query(
        `SELECT to_char(date_trunc('month', date), 'YYYY-MM') AS mois, statut, COUNT(*)::int AS nb
         FROM presences WHERE etablissement_id = $1 AND id_eleve = ANY($2::int[])
           AND date >= date_trunc('month', CURRENT_DATE) - interval '5 months'
         GROUP BY 1, 2`,
        [etabId, ids]
      ),
      query(
        `SELECT statut, COUNT(*)::int AS nb FROM presences
         WHERE etablissement_id = $1 AND id_eleve = ANY($2::int[]) AND date >= CURRENT_DATE - 30 GROUP BY statut`,
        [etabId, ids]
      ),
      query(
        `SELECT id_eleve, COUNT(*) FILTER (WHERE statut = 'Absent')::int AS absences,
                COUNT(*) FILTER (WHERE statut = 'Retard')::int AS retards
         FROM presences WHERE etablissement_id = $1 AND id_eleve = ANY($2::int[]) AND date >= CURRENT_DATE - 30
         GROUP BY id_eleve HAVING COUNT(*) FILTER (WHERE statut = 'Absent') > 0
         ORDER BY absences DESC, retards DESC LIMIT 5`,
        [etabId, ids]
      ),
    ]);
    presenceParMois = mois.map((m) => {
      const row = { mois: m, presents: 0, absents: 0, retards: 0 };
      for (const r of pm.rows) {
        if (r.mois !== m) continue;
        if (r.statut === "Absent") row.absents += r.nb;
        else if (r.statut === "Retard") row.retards += r.nb;
        else row.presents += r.nb;
      }
      return row;
    });
    const tot = p30.rows.reduce((s, r) => s + r.nb, 0);
    const pres30 = p30.rows.filter((r) => r.statut === "Présent").reduce((s, r) => s + r.nb, 0);
    tauxPresence30j = tot > 0 ? arrondi((pres30 / tot) * 100, 1) : null;

    const parId = new Map(eleves.map((e) => [Number(e.ID), e]));
    elevesAbsents = abs.rows.map((r) => {
      const e = parId.get(Number(r.id_eleve));
      return e ? { ID: e.ID, Nom: e.Nom, Prenom: e.Prenom, Classe: `${e.Classe}${e.Serie ? " " + e.Serie : ""}`, Absences: r.absences, Retards: r.retards } : null;
    }).filter(Boolean);
  }

  // --- Encaissements (réservé à l'administration)
  let encaissementsParMois = null;
  if (isAdmin) {
    const mois = derniersMois(6);
    const enc = await query(
      `SELECT to_char(date_trunc('month', date_paiement), 'YYYY-MM') AS mois, SUM(montant)::float AS total, COUNT(*)::int AS nb
       FROM paiements WHERE etablissement_id = $1 AND date_paiement >= date_trunc('month', CURRENT_DATE) - interval '5 months'
       GROUP BY 1`,
      [etabId]
    );
    encaissementsParMois = mois.map((m) => {
      const r = enc.rows.find((x) => x.mois === m);
      return { mois: m, total: r ? r.total : 0, nb: r ? r.nb : 0 };
    });
  }

  res.json({
    periode,
    niveau: niveauFiltre,
    portee: affectations === null ? "etablissement" : "mes-classes",
    totalEleves: eleves.length,
    elevesNotes: noted.length,
    moyenneGenerale: valeurs.length ? arrondi(valeurs.reduce((a, b) => a + b, 0) / valeurs.length) : null,
    tauxReussite: valeurs.length ? arrondi((valeurs.filter((v) => v >= 10).length / valeurs.length) * 100, 1) : null,
    tauxPresence30j,
    effectifParNiveau,
    moyenneParMatiere: matieresRes.rows.map((r) => ({ matiere: r.matiere, moyenne: arrondi(r.moyenne), nb: r.nb })),
    repartitionMentions: MENTIONS.map((m) => ({ mention: m.label, count: mentionsCount[m.label] })),
    meilleursEleves: tries.slice(0, 5).map(lite),
    elevesEnDifficulte: [...tries].reverse().filter((e) => e.moyenne < 10).slice(0, 5).map(lite),
    elevesAbsents,
    presenceParMois,
    encaissementsParMois,
  });
});

module.exports = router;
