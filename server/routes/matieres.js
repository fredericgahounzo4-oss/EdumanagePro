const express = require("express");
const { query } = require("../db/pool");
const { getMatieresFor } = require("../lib/matieres");
const { requireAuth, requireRole } = require("../lib/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const { niveau, classe, serie } = req.query;
  if (!niveau) return res.status(400).json({ error: "Niveau requis" });
  res.json(await getMatieresFor({ etablissementId: req.user.etablissementId, niveau, classe, serie }));
});

router.post("/", requireRole("Administrateur"), async (req, res) => {
  const { Niveau, Classe, Serie, Categorie, Nom, Coefficient } = req.body;
  if (!Niveau || !Nom || !Categorie) {
    return res.status(400).json({ error: "Niveau, catégorie et nom de la matière sont requis" });
  }
  const r = await query(
    `INSERT INTO matieres (etablissement_id, niveau, classe, serie, categorie, nom, coefficient)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id AS "ID", niveau AS "Niveau", classe AS "Classe", serie AS "Serie", categorie AS "Categorie", nom AS "Nom", coefficient AS "Coefficient"`,
    [req.user.etablissementId, Niveau, Classe || "", Serie || "", Categorie, Nom, Coefficient || 1]
  );
  res.status(201).json(r.rows[0]);
});

router.put("/:id", requireRole("Administrateur"), async (req, res) => {
  const { Categorie, Nom, Coefficient } = req.body;
  const r = await query(
    `UPDATE matieres SET categorie=COALESCE($1,categorie), nom=COALESCE($2,nom), coefficient=COALESCE($3,coefficient)
     WHERE id = $4 AND etablissement_id = $5
     RETURNING id AS "ID", niveau AS "Niveau", classe AS "Classe", serie AS "Serie", categorie AS "Categorie", nom AS "Nom", coefficient AS "Coefficient"`,
    [Categorie, Nom, Coefficient, req.params.id, req.user.etablissementId]
  );
  if (!r.rows.length) return res.status(404).json({ error: "Matière introuvable" });
  res.json(r.rows[0]);
});

router.delete("/:id", requireRole("Administrateur"), async (req, res) => {
  const r = await query("DELETE FROM matieres WHERE id = $1 AND etablissement_id = $2", [req.params.id, req.user.etablissementId]);
  if (r.rowCount === 0) return res.status(404).json({ error: "Matière introuvable" });
  res.json({ success: true });
});

module.exports = router;
