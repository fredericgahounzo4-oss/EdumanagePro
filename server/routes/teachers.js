const express = require("express");
const { query } = require("../db/pool");
const { requireAuth, requireRole } = require("../lib/auth");
const { getAffectationsForUser, memeClasse } = require("../lib/scope");

const router = express.Router();
router.use(requireAuth);

function toAffJson(a) {
  return { ID: a.id, IDEnseignant: a.id_enseignant, Niveau: a.niveau, Classe: a.classe, Serie: a.serie, Matiere: a.matiere };
}

async function withAffectations(t, etabId) {
  const r = await query("SELECT * FROM affectations WHERE id_enseignant = $1 AND etablissement_id = $2", [t.id, etabId]);
  let titulaireDe = [];
  try {
    const tit = await query("SELECT niveau, classe, serie FROM titulaires_classes WHERE id_enseignant = $1 AND etablissement_id = $2", [t.id, etabId]);
    titulaireDe = tit.rows.map((x) => ({ Niveau: x.niveau, Classe: x.classe, Serie: x.serie }));
  } catch { /* migration v3 non exécutée */ }
  return {
    ID: t.id, Nom: t.nom, Prenom: t.prenom, Telephone: t.telephone, Email: t.email,
    affectations: r.rows.map(toAffJson), titulaireDe,
  };
}

// Un enseignant ne voit que ses collègues qui partagent au moins une de ses classes, et seulement leurs
// affectations dans ces classes communes. L'administrateur voit tout.
function restreindre(t, mesPortees, monIdEnseignant) {
  if (mesPortees === null) return t;
  const affs = t.affectations.filter((a) => mesPortees.some((m) => memeClasse(m, { Niveau: a.Niveau, Classe: a.Classe, Serie: a.Serie })));
  const tits = t.titulaireDe.filter((x) => mesPortees.some((m) => memeClasse(m, x)));
  if (t.ID !== monIdEnseignant && affs.length === 0 && tits.length === 0) return null;
  return { ...t, affectations: affs, titulaireDe: tits };
}

async function monIdEnseignant(req) {
  if (req.user.role !== "Enseignant") return null;
  const r = await query("SELECT id_enseignant FROM utilisateurs WHERE id = $1", [req.user.id]);
  return r.rows[0]?.id_enseignant ?? null;
}

router.get("/", async (req, res) => {
  const r = await query("SELECT * FROM enseignants WHERE etablissement_id = $1 ORDER BY nom", [req.user.etablissementId]);
  const portees = await getAffectationsForUser(req.user);
  const moi = await monIdEnseignant(req);
  const tous = await Promise.all(r.rows.map((t) => withAffectations(t, req.user.etablissementId)));
  res.json(tous.map((t) => restreindre(t, portees, moi)).filter(Boolean));
});

router.get("/:id", async (req, res) => {
  const r = await query("SELECT * FROM enseignants WHERE id = $1 AND etablissement_id = $2", [req.params.id, req.user.etablissementId]);
  if (!r.rows.length) return res.status(404).json({ error: "Enseignant introuvable" });
  const t = restreindre(await withAffectations(r.rows[0], req.user.etablissementId), await getAffectationsForUser(req.user), await monIdEnseignant(req));
  if (!t) return res.status(403).json({ error: "Cet enseignant n'intervient dans aucune de vos classes" });
  res.json(t);
});

router.post("/", requireRole("Administrateur"), async (req, res) => {
  const { Nom, Prenom, Telephone, Email } = req.body;
  if (!Nom || !Prenom) return res.status(400).json({ error: "Nom et prénom sont requis" });
  const r = await query(
    `INSERT INTO enseignants (etablissement_id, nom, prenom, telephone, email) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.user.etablissementId, Nom, Prenom, Telephone || "", Email || ""]
  );
  res.status(201).json(await withAffectations(r.rows[0], req.user.etablissementId));
});

router.put("/:id", requireRole("Administrateur"), async (req, res) => {
  const { Nom, Prenom, Telephone, Email } = req.body;
  const r = await query(
    `UPDATE enseignants SET nom=COALESCE($1,nom), prenom=COALESCE($2,prenom), telephone=COALESCE($3,telephone), email=COALESCE($4,email)
     WHERE id = $5 AND etablissement_id = $6 RETURNING *`,
    [Nom, Prenom, Telephone, Email, req.params.id, req.user.etablissementId]
  );
  if (!r.rows.length) return res.status(404).json({ error: "Enseignant introuvable" });
  res.json(await withAffectations(r.rows[0], req.user.etablissementId));
});

router.delete("/:id", requireRole("Administrateur"), async (req, res) => {
  // ON DELETE CASCADE supprime ses affectations ; les comptes liés sont déliés (SET NULL)
  const r = await query("DELETE FROM enseignants WHERE id = $1 AND etablissement_id = $2", [req.params.id, req.user.etablissementId]);
  if (r.rowCount === 0) return res.status(404).json({ error: "Enseignant introuvable" });
  res.json({ success: true });
});

// --- Affectations ---
router.post("/:id/affectations", requireRole("Administrateur"), async (req, res) => {
  const teacher = await query("SELECT id FROM enseignants WHERE id = $1 AND etablissement_id = $2", [req.params.id, req.user.etablissementId]);
  if (!teacher.rows.length) return res.status(404).json({ error: "Enseignant introuvable" });
  const { Niveau, Classe, Serie, Matiere } = req.body;
  if (!Niveau || !Classe) return res.status(400).json({ error: "Niveau et Classe sont requis" });
  const r = await query(
    `INSERT INTO affectations (etablissement_id, id_enseignant, niveau, classe, serie, matiere) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.user.etablissementId, req.params.id, Niveau, Classe, Serie || "", Matiere || ""]
  );
  res.status(201).json(toAffJson(r.rows[0]));
});

router.delete("/affectations/:affId", requireRole("Administrateur"), async (req, res) => {
  const r = await query("DELETE FROM affectations WHERE id = $1 AND etablissement_id = $2", [req.params.affId, req.user.etablissementId]);
  if (r.rowCount === 0) return res.status(404).json({ error: "Affectation introuvable" });
  res.json({ success: true });
});

module.exports = router;
