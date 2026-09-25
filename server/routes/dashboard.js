const express = require("express");
const { query } = require("../db/pool");
const { moyenneEleve } = require("../lib/calculs");
const { getMention } = require("../lib/reference");
const { requireAuth, requireRole } = require("../lib/auth");
const { getAffectationsForUser, filterStudentsForScope } = require("../lib/scope");

const router = express.Router();
router.use(requireAuth);

const NIVEAUX = ["Primaire", "College", "Lycee"];

router.get("/", async (req, res) => {
  const etabId = req.user.etablissementId;
  const etabRes = await query("SELECT periode_actuelle FROM etablissements WHERE id = $1", [etabId]);
  const periode = etabRes.rows[0].periode_actuelle;

  const elevesRes = await query(
    `SELECT id AS "ID", nom AS "Nom", prenom AS "Prenom", niveau AS "Niveau", classe AS "Classe", serie AS "Serie"
     FROM eleves WHERE etablissement_id = $1`,
    [etabId]
  );
  let eleves = elevesRes.rows;

  // Un enseignant ne voit les statistiques que de ses classes assignées
  const affectations = await getAffectationsForUser(req.user);
  eleves = filterStudentsForScope(eleves, affectations);

  const parNiveau = {};
  for (const niveau of NIVEAUX) {
    const elevesNiveau = eleves.filter((e) => e.Niveau === niveau);

    // Répartition par classe (et par série au Lycée), pour éviter tout comptage manuel
    const parClasse = {};
    for (const e of elevesNiveau) {
      const cle = e.Classe;
      if (!parClasse[cle]) parClasse[cle] = { total: 0, series: {} };
      parClasse[cle].total++;
      if (e.Serie) parClasse[cle].series[e.Serie] = (parClasse[cle].series[e.Serie] || 0) + 1;
    }

    let sommeMoyennes = 0, compte = 0, admis = 0, major = null;
    for (const e of elevesNiveau) {
      const notesCount = await query(
        "SELECT COUNT(*) FROM notes WHERE id_eleve = $1 AND etablissement_id = $2 AND periode = $3",
        [e.ID, etabId, periode]
      );
      if (Number(notesCount.rows[0].count) === 0) continue;
      const m = await moyenneEleve(e.ID, e.Niveau, etabId, periode);
      sommeMoyennes += m;
      compte++;
      if (m >= 10) admis++;
      if (!major || m > major.moyenne) {
        major = { id: e.ID, nom: e.Nom, prenom: e.Prenom, classe: e.Classe, serie: e.Serie, moyenne: Math.round(m * 100) / 100 };
      }
    }

    parNiveau[niveau] = {
      totalEleves: elevesNiveau.length,
      parClasse: Object.fromEntries(Object.entries(parClasse).map(([classe, v]) => [classe, { total: v.total, series: v.series }])),
      moyenneNiveau: compte > 0 ? Math.round((sommeMoyennes / compte) * 100) / 100 : 0,
      tauxReussite: compte > 0 ? Math.round((admis / compte) * 1000) / 10 : 0,
      eleveMajor: major,
    };
  }

  // Répartition des mentions et moyennes par classe, toutes classes confondues (pour les graphiques)
  const moyenneParClasse = {};
  const mentionsCount = {};
  for (const e of eleves) {
    const notesCount = await query(
      "SELECT COUNT(*) FROM notes WHERE id_eleve = $1 AND etablissement_id = $2 AND periode = $3",
      [e.ID, etabId, periode]
    );
    if (Number(notesCount.rows[0].count) === 0) continue;
    const m = await moyenneEleve(e.ID, e.Niveau, etabId, periode);
    const cle = `${e.Classe}${e.Serie ? " " + e.Serie : ""}`;
    if (!moyenneParClasse[cle]) moyenneParClasse[cle] = { somme: 0, n: 0 };
    moyenneParClasse[cle].somme += m;
    moyenneParClasse[cle].n += 1;
    const mention = getMention(Math.round(m * 100) / 100);
    mentionsCount[mention] = (mentionsCount[mention] || 0) + 1;
  }

  res.json({
    periode,
    totalEleves: eleves.length,
    repartitionParNiveau: Object.fromEntries(NIVEAUX.map((n) => [n, parNiveau[n].totalEleves])),
    parNiveau,
    moyennesParClasse: Object.entries(moyenneParClasse).map(([classe, v]) => ({ classe, moyenne: Math.round((v.somme / v.n) * 100) / 100 })),
    repartitionMentions: Object.entries(mentionsCount).map(([mention, count]) => ({ mention, count })),
  });
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/apercu?date=AAAA-MM-JJ&jour=Lundi
// Données "du jour" du tableau de bord, propres au rôle (Administrateur | Enseignant).
// La date et le jour sont fournis par le navigateur pour respecter le fuseau horaire de l'utilisateur.
// Ne modifie pas la route "/" ci-dessus (statistiques pédagogiques par niveau).
// ---------------------------------------------------------------------------
const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function compterStatuts(rows) {
  const o = { presents: 0, absents: 0, retards: 0, saisis: 0 };
  for (const r of rows) {
    const n = Number(r.nb);
    if (r.statut === "Absent") o.absents += n;
    else if (r.statut === "Retard") o.retards += n;
    else o.presents += n;
    o.saisis += n;
  }
  return o;
}

router.get("/apercu", requireRole("Administrateur", "Enseignant"), async (req, res) => {
  const etabId = req.user.etablissementId;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || "") ? req.query.date : new Date().toISOString().slice(0, 10);
  const jour = JOURS.includes(req.query.jour) ? req.query.jour : null;

  const etabRes = await query("SELECT periode_actuelle FROM etablissements WHERE id = $1", [etabId]);
  const periode = etabRes.rows[0]?.periode_actuelle || "";

  const exRes = await query(
    `SELECT id, nom, type, date_debut, date_fin, niveau, classe, serie, statut FROM examens
     WHERE etablissement_id = $1 AND date_debut >= $2::date ORDER BY date_debut LIMIT 10`,
    [etabId, date]
  );
  const examens = exRes.rows.map((e) => ({
    ID: e.id, Nom: e.nom, Type: e.type, DateDebut: e.date_debut, DateFin: e.date_fin,
    Niveau: e.niveau, Classe: e.classe, Serie: e.serie, Statut: e.statut,
  }));

  // ------------------------------ Administrateur ------------------------------
  if (req.user.role === "Administrateur") {
    const [comptes, presJour, classesAvecAppel, paiements, recents] = await Promise.all([
      query(
        `SELECT (SELECT COUNT(*) FROM eleves WHERE etablissement_id = $1)::int AS eleves,
                (SELECT COUNT(*) FROM enseignants WHERE etablissement_id = $1)::int AS enseignants,
                (SELECT COUNT(*) FROM utilisateurs WHERE etablissement_id = $1 AND role = 'Parent')::int AS parents,
                (SELECT COUNT(*) FROM (SELECT DISTINCT niveau, classe, serie FROM eleves WHERE etablissement_id = $1) c)::int AS classes`,
        [etabId]
      ),
      query("SELECT statut, COUNT(*)::int AS nb FROM presences WHERE etablissement_id = $1 AND date = $2::date GROUP BY statut", [etabId, date]),
      query(
        `SELECT COUNT(*)::int AS c FROM (
           SELECT DISTINCT e.niveau, e.classe, e.serie FROM presences p JOIN eleves e ON e.id = p.id_eleve
           WHERE p.etablissement_id = $1 AND p.date = $2::date) x`,
        [etabId, date]
      ),
      query(
        `SELECT p.id, p.montant, p.date_paiement, p.mode, p.numero_recu, e.id AS id_eleve, e.nom, e.prenom, e.classe
         FROM paiements p JOIN eleves e ON e.id = p.id_eleve
         WHERE p.etablissement_id = $1 ORDER BY p.date_paiement DESC LIMIT 5`,
        [etabId]
      ),
      query(
        `SELECT id, nom, prenom, niveau, classe, serie FROM eleves WHERE etablissement_id = $1 ORDER BY id DESC LIMIT 5`,
        [etabId]
      ),
    ]);
    const c = comptes.rows[0];
    return res.json({
      role: "Administrateur", date, jour, periode,
      totaux: { eleves: c.eleves, enseignants: c.enseignants, parents: c.parents, classes: c.classes },
      presencesJour: compterStatuts(presJour.rows),
      classesAvecAppel: classesAvecAppel.rows[0].c,
      classesSansAppel: Math.max(0, c.classes - classesAvecAppel.rows[0].c),
      derniersPaiements: paiements.rows.map((p) => ({
        ID: p.id, Montant: Number(p.montant), Date: p.date_paiement, Mode: p.mode, NumeroRecu: p.numero_recu,
        IDEleve: p.id_eleve, Eleve: `${p.prenom} ${p.nom}`, Classe: p.classe,
      })),
      derniersEleves: recents.rows.map((e) => ({ ID: e.id, Nom: e.nom, Prenom: e.prenom, Niveau: e.niveau, Classe: e.classe, Serie: e.serie })),
      examensAVenir: examens.slice(0, 4),
    });
  }

  // -------------------------------- Enseignant --------------------------------
  const affectations = (await getAffectationsForUser(req.user)) || [];
  const elevesRes = await query(
    `SELECT id AS "ID", niveau AS "Niveau", classe AS "Classe", serie AS "Serie" FROM eleves WHERE etablissement_id = $1`,
    [etabId]
  );
  const mesEleves = filterStudentsForScope(elevesRes.rows, affectations);
  const idsEleves = new Set(mesEleves.map((e) => Number(e.ID)));

  const groupes = new Map();
  for (const e of mesEleves) {
    const k = `${e.Niveau}|${e.Classe}|${e.Serie || ""}`;
    if (!groupes.has(k)) groupes.set(k, { Niveau: e.Niveau, Classe: e.Classe, Serie: e.Serie || "", Effectif: 0 });
    groupes.get(k).Effectif += 1;
  }
  const matieresParClasse = (c) => [...new Set(affectations
    .filter((a) => a.Niveau === c.Niveau && a.Classe === c.Classe && (!a.Serie || a.Serie === c.Serie) && a.Matiere)
    .map((a) => a.Matiere))];

  const [cours, presJour] = await Promise.all([
    jour
      ? query(
        `SELECT id, niveau, classe, serie, heure_debut, heure_fin, matiere, salle FROM emploi_du_temps
         WHERE etablissement_id = $1 AND jour = $2
           AND id_enseignant = (SELECT id_enseignant FROM utilisateurs WHERE id = $3)
         ORDER BY heure_debut`,
        [etabId, jour, req.user.id]
      )
      : { rows: [] },
    query(
      `SELECT p.id_eleve, p.statut FROM presences p WHERE p.etablissement_id = $1 AND p.date = $2::date`,
      [etabId, date]
    ),
  ]);

  const presRows = presJour.rows.filter((r) => idsEleves.has(Number(r.id_eleve)))
    .reduce((acc, r) => { acc[r.statut] = (acc[r.statut] || 0) + 1; return acc; }, {});
  const presencesJour = compterStatuts(Object.entries(presRows).map(([statut, nb]) => ({ statut, nb })));

  const examensConcernes = examens.filter((e) =>
    !e.Niveau || affectations.some((a) => a.Niveau === e.Niveau && (!e.Classe || a.Classe === e.Classe) && (!e.Serie || !a.Serie || a.Serie === e.Serie))
  ).slice(0, 4);

  res.json({
    role: "Enseignant", date, jour, periode,
    totaux: { eleves: mesEleves.length, classes: groupes.size },
    mesClasses: [...groupes.values()].map((c) => ({ ...c, Matieres: matieresParClasse(c) }))
      .sort((a, b) => (a.Niveau + a.Classe).localeCompare(b.Niveau + b.Classe)),
    coursDuJour: cours.rows.map((c) => ({
      ID: c.id, Niveau: c.niveau, Classe: c.classe, Serie: c.serie, HeureDebut: c.heure_debut, HeureFin: c.heure_fin,
      Matiere: c.matiere, Salle: c.salle,
    })),
    presencesJour,
    examensAVenir: examensConcernes,
  });
});

module.exports = router;
