const express = require("express");
const { pool, query } = require("../db/pool");
const { requireAuth, requireRole, requireEtablissement } = require("../lib/auth");
const { getAffectationsForUser, estTitulaire } = require("../lib/scope");
const { chargerClasse, INFOS_VIDES } = require("../lib/bulletinData");

const router = express.Router();
router.use(requireAuth, requireRole("Administrateur", "Enseignant"), requireEtablissement);

// CONSEIL DE CLASSE : conduite, absences, décision du conseil, observations... imprimés sur le bulletin.
// Réservé à l'administrateur et au professeur TITULAIRE de la classe.

async function verifierAcces(req, res, { niveau, classe, serie }) {
  const affectations = await getAffectationsForUser(req.user);
  if (!estTitulaire(affectations, { Niveau: niveau, Classe: classe, Serie: serie || "" })) {
    res.status(403).json({ error: "Seul le professeur titulaire de cette classe peut renseigner le conseil de classe" });
    return false;
  }
  return true;
}

// GET /api/conseil?niveau=&classe=&serie=&periode=
router.get("/", async (req, res) => {
  const { niveau, classe, periode } = req.query;
  const serie = req.query.serie || "";
  if (!niveau || !classe) return res.status(400).json({ error: "Niveau et classe sont requis" });
  if (!(await verifierAcces(req, res, { niveau, classe, serie }))) return;

  const data = await chargerClasse({ etablissementId: req.user.etablissementId, niveau, classe, serie, periode: periode || null });
  const pp = data.parPeriode.get(data.periode);
  const eleves = data.eleves.map((e) => ({
    ID: e.id, Nom: e.nom, Prenom: e.prenom,
    Moyenne: pp.moyennes.has(e.id) ? pp.moyennes.get(e.id) : null,
    Rang: pp.rangs.get(e.id)?.n ?? null,
    Infos: data.infosParEleve.get(e.id) || { ...INFOS_VIDES },
  }));
  eleves.sort((a, b) => (a.Rang ?? 9999) - (b.Rang ?? 9999) || a.Nom.localeCompare(b.Nom));
  res.json({ Periode: data.periode, Niveau: niveau, Classe: classe, Serie: serie, Titulaire: data.titulaire, Eleves: eleves });
});

const texte = (v, max = 400) => String(v ?? "").trim().slice(0, max);
const entier = (v) => (v === "" || v === null || v === undefined ? null : Math.max(0, Math.min(9999, Math.round(Number(v)) || 0)));

// PUT /api/conseil  { Niveau, Classe, Serie, Periode, Infos: [{ IDEleve, retards, absences, ... }] }
router.put("/", async (req, res) => {
  const { Niveau, Classe, Periode, Infos } = req.body;
  const Serie = req.body.Serie || "";
  if (!Niveau || !Classe || !Periode || !Array.isArray(Infos)) return res.status(400).json({ error: "Classe, période et informations sont requis" });
  if (!(await verifierAcces(req, res, { niveau: Niveau, classe: Classe, serie: Serie }))) return;

  const etabId = req.user.etablissementId;
  const params = [etabId, Niveau, Classe];
  let filtre = "";
  if (Serie) { params.push(Serie); filtre = ` AND serie = $${params.length}`; }
  const ids = new Set((await query(`SELECT id FROM eleves WHERE etablissement_id = $1 AND niveau = $2 AND classe = $3${filtre}`, params)).rows.map((r) => Number(r.id)));

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let n = 0;
    for (const i of Infos) {
      if (!ids.has(Number(i.IDEleve))) continue; // jamais d'identifiant "libre" : uniquement les élèves de cette classe
      await client.query(
        `INSERT INTO bulletin_infos (etablissement_id, id_eleve, periode, retards, absences, punitions, exclusion, conduite, appreciation,
                                     distinction, decision, observations, avertissement, blame, felicitations, encouragements, tableau_honneur)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT (id_eleve, periode) DO UPDATE SET retards=EXCLUDED.retards, absences=EXCLUDED.absences, punitions=EXCLUDED.punitions,
           exclusion=EXCLUDED.exclusion, conduite=EXCLUDED.conduite, appreciation=EXCLUDED.appreciation, distinction=EXCLUDED.distinction,
           decision=EXCLUDED.decision, observations=EXCLUDED.observations, avertissement=EXCLUDED.avertissement, blame=EXCLUDED.blame,
           felicitations=EXCLUDED.felicitations, encouragements=EXCLUDED.encouragements, tableau_honneur=EXCLUDED.tableau_honneur`,
        [etabId, Number(i.IDEleve), Periode, entier(i.retards), entier(i.absences), entier(i.punitions), entier(i.exclusion),
          texte(i.conduite, 60), texte(i.appreciation, 120), texte(i.distinction, 200), texte(i.decision, 120), texte(i.observations, 500),
          ["", "Travail", "Discipline"].includes(i.avertissement) ? i.avertissement || "" : "", ["", "Travail", "Discipline"].includes(i.blame) ? i.blame || "" : "",
          !!i.felicitations, !!i.encouragements, !!(i.tableauHonneur ?? i.tableau_honneur)]
      );
      n++;
    }
    await client.query("COMMIT");
    res.json({ success: true, enregistres: n });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ error: "Erreur lors de l'enregistrement : " + err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
