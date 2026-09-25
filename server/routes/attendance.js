const express = require("express");
const { query, pool } = require("../db/pool");
const { requireAuth, requireRole } = require("../lib/auth");
const { getAffectationsForUser, studentInScope, filterStudentsForScope } = require("../lib/scope");
const { notifier, idsFamille } = require("../lib/notify");

const router = express.Router();
router.use(requireAuth, requireRole("Administrateur", "Enseignant"));

function toPresenceJson(p) {
  return { ID: p.id, IDEleve: p.id_eleve, Date: p.date, Heure: p.heure, Statut: p.statut };
}

async function checkAccess(req, res, idEleve) {
  const r = await query(
    `SELECT id AS "ID", nom AS "Nom", niveau AS "Niveau", classe AS "Classe", serie AS "Serie"
     FROM eleves WHERE id = $1 AND etablissement_id = $2`,
    [idEleve, req.user.etablissementId]
  );
  const eleve = r.rows[0];
  if (!eleve) { res.status(404).json({ error: "Élève introuvable" }); return null; }
  const affectations = await getAffectationsForUser(req.user);
  if (!studentInScope(eleve, affectations)) {
    res.status(403).json({ error: "Vous n'êtes pas affecté à la classe de cet élève" });
    return null;
  }
  return eleve;
}

router.get("/", async (req, res) => {
  const { idEleve } = req.query;
  if (idEleve && !(await checkAccess(req, res, idEleve))) return;
  const r = idEleve
    ? await query("SELECT * FROM presences WHERE id_eleve = $1 AND etablissement_id = $2 ORDER BY date DESC", [idEleve, req.user.etablissementId])
    : await query("SELECT * FROM presences WHERE etablissement_id = $1 ORDER BY date DESC", [req.user.etablissementId]);
  res.json(r.rows.map(toPresenceJson));
});

router.post("/", async (req, res) => {
  const { IDEleve, Date: date, Heure, Statut } = req.body;
  if (!IDEleve || !date || !Statut) return res.status(400).json({ error: "IDEleve, Date et Statut sont requis" });
  if (!(await checkAccess(req, res, IDEleve))) return;
  const r = await query(
    `INSERT INTO presences (etablissement_id, id_eleve, date, heure, statut) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.user.etablissementId, IDEleve, date, Heure || "", Statut]
  );
  if (Statut === "Absent" || Statut === "Retard") {
    const eleve = await query("SELECT nom, prenom FROM eleves WHERE id = $1", [IDEleve]);
    await prevenirFamille(req.user.etablissementId, { id: IDEleve, ...eleve.rows[0] }, Statut, date);
  }
  res.status(201).json(toPresenceJson(r.rows[0]));
});

router.delete("/:id", async (req, res) => {
  const existing = await query("SELECT * FROM presences WHERE id = $1 AND etablissement_id = $2", [req.params.id, req.user.etablissementId]);
  if (!existing.rows.length) return res.status(404).json({ error: "Enregistrement introuvable" });
  if (!(await checkAccess(req, res, existing.rows[0].id_eleve))) return;
  await query("DELETE FROM presences WHERE id = $1", [req.params.id]);
  res.json({ success: true });
});

router.get("/stats/:idEleve", async (req, res) => {
  if (!(await checkAccess(req, res, req.params.idEleve))) return;
  const r = await query("SELECT statut FROM presences WHERE id_eleve = $1 AND etablissement_id = $2", [req.params.idEleve, req.user.etablissementId]);
  const rows = r.rows;
  const total = rows.length;
  const absences = rows.filter((x) => x.statut === "Absent").length;
  const retards = rows.filter((x) => x.statut === "Retard").length;
  const presences = rows.filter((x) => x.statut === "Présent").length;
  const taux = total > 0 ? Math.round((presences / total) * 1000) / 10 : 100;
  res.json({ total, presences, absences, retards, tauxPresence: taux });
});


// ---------------------------------------------------------------------------
// Appel de classe : saisie de toute une classe en une fois
// ---------------------------------------------------------------------------
const STATUTS = ["Présent", "Absent", "Retard"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Prévient les parents (et le compte élève) d'une absence ou d'un retard — sans jamais bloquer l'appel
async function prevenirFamille(etablissementId, eleve, statut, date) {
  const ids = await idsFamille(etablissementId, eleve.id);
  if (!ids.length) return;
  const nom = `${eleve.prenom || ""} ${eleve.nom || ""}`.trim();
  const jourTxt = new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  await notifier({
    etablissementId, userIds: ids,
    type: statut === "Absent" ? "danger" : "warning",
    titre: statut === "Absent" ? `Absence de ${nom}` : `Retard de ${nom}`,
    message: statut === "Absent"
      ? `${nom} a été marqué(e) absent(e) le ${jourTxt}.`
      : `${nom} est arrivé(e) en retard le ${jourTxt}.`,
    lien: "/",
  });
}

async function classeAutorisee(req, res, niveau, classe, serie) {
  const affectations = await getAffectationsForUser(req.user);
  if (affectations !== null && !affectations.some((a) => a.Niveau === niveau && a.Classe === classe && (!a.Serie || a.Serie === serie))) {
    res.status(403).json({ error: "Vous n'êtes pas affecté à cette classe" });
    return false;
  }
  return true;
}

async function elevesDeClasse(etablissementId, niveau, classe, serie) {
  const params = [etablissementId, niveau, classe];
  let filtre = "";
  if (serie) { params.push(serie); filtre = ` AND serie = $${params.length}`; }
  const r = await query(
    `SELECT id, nom, prenom FROM eleves WHERE etablissement_id = $1 AND niveau = $2 AND classe = $3${filtre} ORDER BY nom, prenom`,
    params
  );
  return r.rows;
}

// GET /api/attendance/appel?niveau=&classe=&serie=&date=  -> liste de la classe et statuts déjà saisis ce jour-là
router.get("/appel", async (req, res) => {
  const { niveau, classe, date } = req.query;
  const serie = req.query.serie || "";
  if (!niveau || !classe || !DATE_RE.test(date || "")) return res.status(400).json({ error: "Niveau, classe et date (AAAA-MM-JJ) sont requis" });
  if (!(await classeAutorisee(req, res, niveau, classe, serie))) return;

  const eleves = await elevesDeClasse(req.user.etablissementId, niveau, classe, serie);
  const ids = eleves.map((e) => e.id);
  const pres = ids.length
    ? await query(
      "SELECT id_eleve, statut, heure FROM presences WHERE etablissement_id = $1 AND date = $2::date AND id_eleve = ANY($3::int[]) ORDER BY id",
      [req.user.etablissementId, date, ids]
    )
    : { rows: [] };
  const parEleve = new Map();
  for (const p of pres.rows) parEleve.set(Number(p.id_eleve), p); // la dernière saisie l'emporte

  res.json({
    Date: date, Niveau: niveau, Classe: classe, Serie: serie,
    AppelFait: pres.rows.length > 0,
    Heure: pres.rows.length ? (pres.rows[pres.rows.length - 1].heure || "") : "",
    Eleves: eleves.map((e) => ({
      ID: e.id, Nom: e.nom, Prenom: e.prenom,
      Statut: parEleve.get(Number(e.id))?.statut || null,
    })),
  });
});

// POST /api/attendance/appel  { Date, Heure, Niveau, Classe, Serie, Statuts: [{ IDEleve, Statut }] }
// Remplace la saisie du jour pour les élèves de la classe (idempotent : on peut refaire l'appel).
router.post("/appel", async (req, res) => {
  const { Date: date, Heure, Niveau, Classe, Statuts } = req.body;
  const serie = req.body.Serie || "";
  if (!Niveau || !Classe || !DATE_RE.test(date || "") || !Array.isArray(Statuts) || !Statuts.length) {
    return res.status(400).json({ error: "Date, classe et liste des statuts sont requis" });
  }
  if (Statuts.some((x) => !STATUTS.includes(x.Statut))) return res.status(400).json({ error: "Statut invalide (Présent, Absent ou Retard)" });
  if (!(await classeAutorisee(req, res, Niveau, Classe, serie))) return;

  const etabId = req.user.etablissementId;
  // Seuls les élèves réellement présents dans cette classe sont acceptés (jamais d'identifiant "libre")
  const eleves = await elevesDeClasse(etabId, Niveau, Classe, serie);
  const parId = new Map(eleves.map((e) => [Number(e.id), e]));
  const retenus = Statuts.filter((x) => parId.has(Number(x.IDEleve)));
  if (!retenus.length) return res.status(400).json({ error: "Aucun élève valide dans cette classe" });
  const ids = retenus.map((x) => Number(x.IDEleve));

  // Statuts précédents : on ne notifie les parents que si l'absence/le retard est nouveau
  const avant = await query(
    "SELECT id_eleve, statut FROM presences WHERE etablissement_id = $1 AND date = $2::date AND id_eleve = ANY($3::int[]) ORDER BY id",
    [etabId, date, ids]
  );
  const precedent = new Map();
  for (const p of avant.rows) precedent.set(Number(p.id_eleve), p.statut);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM presences WHERE etablissement_id = $1 AND date = $2::date AND id_eleve = ANY($3::int[])", [etabId, date, ids]);
    await client.query(
      `INSERT INTO presences (etablissement_id, id_eleve, date, heure, statut)
       SELECT $1::int, u.id, $2::date, $3::text, u.statut FROM unnest($4::int[], $5::text[]) AS u(id, statut)`,
      [etabId, date, Heure || "", ids, retenus.map((x) => x.Statut)]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  for (const x of retenus) {
    if ((x.Statut === "Absent" || x.Statut === "Retard") && precedent.get(Number(x.IDEleve)) !== x.Statut) {
      await prevenirFamille(etabId, parId.get(Number(x.IDEleve)), x.Statut, date);
    }
  }

  res.json({
    success: true,
    enregistres: retenus.length,
    presents: retenus.filter((x) => x.Statut === "Présent").length,
    absents: retenus.filter((x) => x.Statut === "Absent").length,
    retards: retenus.filter((x) => x.Statut === "Retard").length,
  });
});

// GET /api/attendance/synthese?niveau=&classe=&serie=&jours=30  -> courbe journalière + élèves les plus absents
router.get("/synthese", async (req, res) => {
  const etabId = req.user.etablissementId;
  const jours = Math.min(180, Math.max(7, Number(req.query.jours) || 30));
  const { niveau, classe } = req.query;
  const serie = req.query.serie || "";

  const elevesRes = await query(
    `SELECT id AS "ID", nom AS "Nom", prenom AS "Prenom", niveau AS "Niveau", classe AS "Classe", serie AS "Serie"
     FROM eleves WHERE etablissement_id = $1`,
    [etabId]
  );
  const affectations = await getAffectationsForUser(req.user);
  let eleves = filterStudentsForScope(elevesRes.rows, affectations);
  if (niveau) eleves = eleves.filter((e) => e.Niveau === niveau);
  if (classe) eleves = eleves.filter((e) => e.Classe === classe);
  if (serie) eleves = eleves.filter((e) => e.Serie === serie);
  const ids = eleves.map((e) => Number(e.ID));
  if (!ids.length) return res.json({ jours, parJour: [], tauxPresence: null, topAbsents: [] });

  const [parJour, parEleve] = await Promise.all([
    query(
      `SELECT to_char(date, 'YYYY-MM-DD') AS jour, statut, COUNT(*)::int AS nb FROM presences
       WHERE etablissement_id = $1 AND id_eleve = ANY($2::int[]) AND date >= CURRENT_DATE - $3::int
       GROUP BY 1, 2 ORDER BY 1`,
      [etabId, ids, jours]
    ),
    query(
      `SELECT id_eleve, COUNT(*) FILTER (WHERE statut = 'Absent')::int AS absences,
              COUNT(*) FILTER (WHERE statut = 'Retard')::int AS retards
       FROM presences WHERE etablissement_id = $1 AND id_eleve = ANY($2::int[]) AND date >= CURRENT_DATE - $3::int
       GROUP BY id_eleve HAVING COUNT(*) FILTER (WHERE statut IN ('Absent','Retard')) > 0
       ORDER BY absences DESC, retards DESC LIMIT 8`,
      [etabId, ids, jours]
    ),
  ]);

  const jourMap = new Map();
  for (const r of parJour.rows) {
    if (!jourMap.has(r.jour)) jourMap.set(r.jour, { date: r.jour, presents: 0, absents: 0, retards: 0 });
    const o = jourMap.get(r.jour);
    if (r.statut === "Absent") o.absents += r.nb;
    else if (r.statut === "Retard") o.retards += r.nb;
    else o.presents += r.nb;
  }
  const serieJour = [...jourMap.values()];
  const tot = serieJour.reduce((a, j) => a + j.presents + j.absents + j.retards, 0);
  const pres = serieJour.reduce((a, j) => a + j.presents, 0);

  const parId = new Map(eleves.map((e) => [Number(e.ID), e]));
  res.json({
    jours,
    parJour: serieJour,
    tauxPresence: tot > 0 ? Math.round((pres / tot) * 1000) / 10 : null,
    topAbsents: parEleve.rows.map((r) => {
      const e = parId.get(Number(r.id_eleve));
      return e ? { ID: e.ID, Nom: e.Nom, Prenom: e.Prenom, Classe: `${e.Classe}${e.Serie ? " " + e.Serie : ""}`, Absences: r.absences, Retards: r.retards } : null;
    }).filter(Boolean),
  });
});

module.exports = router;
