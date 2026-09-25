const express = require("express");
const { query } = require("../db/pool");
const { requireAuth, requireRole } = require("../lib/auth");
const { getAffectationsForUser, cibleConcerne } = require("../lib/scope");

const router = express.Router();
router.use(requireAuth);

const JOUR_ORDRE = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

router.get("/", async (req, res) => {
  const { niveau, classe, serie } = req.query;
  const conditions = ["e.etablissement_id = $1"];
  const params = [req.user.etablissementId];
  if (niveau) { params.push(niveau); conditions.push(`e.niveau = $${params.length}`); }
  if (classe) { params.push(classe); conditions.push(`e.classe = $${params.length}`); }
  if (serie) { params.push(serie); conditions.push(`e.serie = $${params.length}`); }

  const r = await query(
    `SELECT e.*, t.nom AS t_nom, t.prenom AS t_prenom
     FROM emploi_du_temps e
     LEFT JOIN enseignants t ON t.id = e.id_enseignant
     WHERE ${conditions.join(" AND ")}`,
    params
  );

  // Un enseignant ne voit que l'emploi du temps des classes où il intervient (ou dont il est titulaire)
  const affectations = await getAffectationsForUser(req.user);
  r.rows = r.rows.filter((row) => cibleConcerne({ Niveau: row.niveau, Classe: row.classe, Serie: row.serie }, affectations) && (affectations === null || row.niveau));

  const rows = r.rows.map((row) => ({
    ID: row.id, Niveau: row.niveau, Classe: row.classe, Serie: row.serie, Jour: row.jour,
    HeureDebut: row.heure_debut, HeureFin: row.heure_fin, Matiere: row.matiere,
    IDEnseignant: row.id_enseignant, Salle: row.salle,
    Enseignant: row.t_nom ? `${row.t_nom} ${row.t_prenom}` : "",
  }));
  rows.sort((a, b) => JOUR_ORDRE.indexOf(a.Jour) - JOUR_ORDRE.indexOf(b.Jour) || String(a.HeureDebut).localeCompare(b.HeureDebut));
  res.json(rows);
});

// Emploi du temps personnel d'un enseignant, toutes classes confondues, en une seule grille.
router.get("/mon-emploi", requireRole("Enseignant"), async (req, res) => {
  const compteRes = await query("SELECT id_enseignant FROM utilisateurs WHERE id = $1", [req.user.id]);
  const idEnseignant = compteRes.rows[0]?.id_enseignant;
  if (!idEnseignant) return res.json([]);

  const r = await query(
    `SELECT * FROM emploi_du_temps WHERE etablissement_id = $1 AND id_enseignant = $2`,
    [req.user.etablissementId, idEnseignant]
  );
  const rows = r.rows.map((row) => ({
    ID: row.id, Niveau: row.niveau, Classe: row.classe, Serie: row.serie, Jour: row.jour,
    HeureDebut: row.heure_debut, HeureFin: row.heure_fin, Matiere: row.matiere, Salle: row.salle,
  }));
  rows.sort((a, b) => JOUR_ORDRE.indexOf(a.Jour) - JOUR_ORDRE.indexOf(b.Jour) || String(a.HeureDebut).localeCompare(b.HeureDebut));
  res.json(rows);
});

router.post("/", requireRole("Administrateur"), async (req, res) => {
  const { Niveau, Classe, Serie, Jour, HeureDebut, HeureFin, Matiere, IDEnseignant, Salle } = req.body;
  if (!Niveau || !Classe || !Jour || !HeureDebut || !HeureFin || !Matiere) {
    return res.status(400).json({ error: "Niveau, classe, jour, horaires et matière sont requis" });
  }
  const r = await query(
    `INSERT INTO emploi_du_temps (etablissement_id, niveau, classe, serie, jour, heure_debut, heure_fin, matiere, id_enseignant, salle)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [req.user.etablissementId, Niveau, Classe, Serie || "", Jour, HeureDebut, HeureFin, Matiere, IDEnseignant || null, Salle || ""]
  );
  const row = r.rows[0];
  res.status(201).json({
    ID: row.id, Niveau: row.niveau, Classe: row.classe, Serie: row.serie, Jour: row.jour,
    HeureDebut: row.heure_debut, HeureFin: row.heure_fin, Matiere: row.matiere, IDEnseignant: row.id_enseignant, Salle: row.salle,
  });
});

router.delete("/:id", requireRole("Administrateur"), async (req, res) => {
  const r = await query("DELETE FROM emploi_du_temps WHERE id = $1 AND etablissement_id = $2", [req.params.id, req.user.etablissementId]);
  if (r.rowCount === 0) return res.status(404).json({ error: "Créneau introuvable" });
  res.json({ success: true });
});

module.exports = router;
