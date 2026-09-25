const express = require("express");
const { query } = require("../db/pool");
const { classement } = require("../lib/calculs");
const { requireAuth } = require("../lib/auth");
const { getAffectationsForUser, filterStudentsForScope } = require("../lib/scope");

const router = express.Router();
router.use(requireAuth);

// GET /api/results?niveau=Lycee&classe=Terminale&serie=D&periode=1er Trimestre
router.get("/", async (req, res) => {
  const { niveau, classe, serie } = req.query;
  let periode = req.query.periode;
  if (!periode) {
    const etabRes = await query("SELECT periode_actuelle FROM etablissements WHERE id = $1", [req.user.etablissementId]);
    periode = etabRes.rows[0].periode_actuelle;
  }
  const rows = await classement({ etablissementId: req.user.etablissementId, niveau, classe, serie, periode });
  const affectations = await getAffectationsForUser(req.user);
  res.json({ periode, resultats: filterStudentsForScope(rows, affectations) });
});

module.exports = router;
