const express = require("express");
const { genererBulletinPDF, genererBulletinsLotPDF, LISTE_MODELES } = require("../lib/bulletin");
const { requireAuth, requireRole } = require("../lib/auth");
const { getAffectationsForUser, estTitulaire } = require("../lib/scope");
const { query } = require("../db/pool");

const router = express.Router();

// Liste des modèles de bulletin disponibles (pour les Paramètres établissement)
router.get("/modeles", requireAuth, (req, res) => res.json(LISTE_MODELES));

// L'administrateur imprime tout ; un enseignant n'imprime que les bulletins des classes dont il est TITULAIRE.
router.use(requireAuth, requireRole("Administrateur", "Enseignant"));

async function autorisation(req) {
  const affectations = await getAffectationsForUser(req.user);
  return (g) => estTitulaire(affectations, { Niveau: g.niveau, Classe: g.classe, Serie: g.serie });
}

// Lot : ?niveau=&classe=&serie=&periode=  (tout paramètre absent = "tous")
// Classé par niveau, puis classe, puis série ; dans chaque classe/série, par ordre de mérite.
router.get("/lot", async (req, res) => {
  const { niveau, classe, serie, periode } = req.query;
  await genererBulletinsLotPDF({
    etablissementId: req.user.etablissementId, niveau, classe, serie, periode: periode || null, autorise: await autorisation(req),
  }, res);
});

// Ancienne adresse conservée : bulletins d'une classe
router.get("/classe", async (req, res) => {
  const { niveau, classe, serie, periode } = req.query;
  if (!niveau || !classe) return res.status(400).json({ error: "Niveau et classe sont requis" });
  await genererBulletinsLotPDF({
    etablissementId: req.user.etablissementId, niveau, classe, serie: serie || "", periode: periode || null, autorise: await autorisation(req),
  }, res);
});

// Bulletin individuel
router.get("/:idEleve", async (req, res) => {
  const el = await query("SELECT niveau, classe, serie FROM eleves WHERE id = $1 AND etablissement_id = $2", [req.params.idEleve, req.user.etablissementId]);
  if (!el.rows[0]) return res.status(404).json({ error: "Élève introuvable" });
  const autorise = await autorisation(req);
  if (!autorise(el.rows[0])) return res.status(403).json({ error: "Seul le titulaire de la classe peut imprimer ce bulletin" });
  await genererBulletinPDF(req.params.idEleve, req.user.etablissementId, req.query.periode || null, res);
});

module.exports = router;
