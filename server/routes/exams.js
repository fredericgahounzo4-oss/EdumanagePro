const express = require("express");
const { query } = require("../db/pool");
const { requireAuth, requireRole } = require("../lib/auth");
const { notifier, idsParRole, idsFamillesDeClasse } = require("../lib/notify");
const { getAffectationsForUser, cibleConcerne } = require("../lib/scope");

const router = express.Router();
router.use(requireAuth);

function toExamJson(e) {
  return {
    ID: e.id, Nom: e.nom, Type: e.type, DateDebut: e.date_debut, DateFin: e.date_fin,
    Niveau: e.niveau, Classe: e.classe, Serie: e.serie, Statut: e.statut,
  };
}

router.get("/", async (req, res) => {
  const r = await query("SELECT * FROM examens WHERE etablissement_id = $1 ORDER BY date_debut", [req.user.etablissementId]);
  // Un enseignant ne voit que les examens qui concernent ses classes (ou toute l'école)
  const affectations = await getAffectationsForUser(req.user);
  res.json(r.rows.map(toExamJson).filter((e) => cibleConcerne(e, affectations)));
});

router.post("/", requireRole("Administrateur"), async (req, res) => {
  const { Nom, Type, DateDebut, DateFin, Niveau, Classe, Serie, Statut } = req.body;
  if (!Nom || !DateDebut) return res.status(400).json({ error: "Nom et date de début sont requis" });
  const r = await query(
    `INSERT INTO examens (etablissement_id, nom, type, date_debut, date_fin, niveau, classe, serie, statut)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.user.etablissementId, Nom, Type || "Composition", DateDebut, DateFin || DateDebut, Niveau || "", Classe || "", Serie || "", Statut || "Planifié"]
  );

  // Prévient les enseignants, ainsi que les parents/élèves concernés (cloche) — sans jamais bloquer la création
  const [profs, familles] = await Promise.all([
    idsParRole(req.user.etablissementId, ["Enseignant"]),
    idsFamillesDeClasse(req.user.etablissementId, { niveau: Niveau || "", classe: Classe || "", serie: Serie || "" }),
  ]);
  const cible = [Niveau, Classe, Serie].filter(Boolean).join(" ");
  await notifier({
    etablissementId: req.user.etablissementId,
    userIds: [...profs, ...familles],
    type: "info",
    titre: `Nouvel examen : ${Nom}`,
    message: `${Type || "Composition"} prévu(e) le ${new Date(DateDebut).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}${cible ? ` — ${cible}` : " — tous niveaux"}.`,
    lien: "/examens",
  });

  res.status(201).json(toExamJson(r.rows[0]));
});

router.put("/:id", requireRole("Administrateur"), async (req, res) => {
  const { Nom, Type, DateDebut, DateFin, Niveau, Classe, Serie, Statut } = req.body;
  const r = await query(
    `UPDATE examens SET nom=COALESCE($1,nom), type=COALESCE($2,type), date_debut=COALESCE($3,date_debut),
       date_fin=COALESCE($4,date_fin), niveau=COALESCE($5,niveau), classe=COALESCE($6,classe),
       serie=COALESCE($7,serie), statut=COALESCE($8,statut)
     WHERE id = $9 AND etablissement_id = $10 RETURNING *`,
    [Nom, Type, DateDebut, DateFin, Niveau, Classe, Serie, Statut, req.params.id, req.user.etablissementId]
  );
  if (!r.rows.length) return res.status(404).json({ error: "Examen introuvable" });
  res.json(toExamJson(r.rows[0]));
});

router.delete("/:id", requireRole("Administrateur"), async (req, res) => {
  const r = await query("DELETE FROM examens WHERE id = $1 AND etablissement_id = $2", [req.params.id, req.user.etablissementId]);
  if (r.rowCount === 0) return res.status(404).json({ error: "Examen introuvable" });
  res.json({ success: true });
});

module.exports = router;
