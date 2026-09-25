const express = require("express");
const crypto = require("crypto");
const { query } = require("../db/pool");
const { requireAuth, requireRole, hashPassword } = require("../lib/auth");
const { definirMotDePasse } = require("../lib/motsDePasse");
const { getAffectationsForUser, studentInScope, filterStudentsForScope } = require("../lib/scope");

const router = express.Router();
router.use(requireAuth);

function toEleveJson(e) {
  return { ID: e.id, Nom: e.nom, Prenom: e.prenom, Niveau: e.niveau, Classe: e.classe, Serie: e.serie, Annee: e.annee, Sexe: e.sexe || "", Statut: e.statut || "" };
}

function slugify(text) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function randomPassword() {
  return crypto.randomBytes(5).toString("hex"); // 10 caractères, facile à communiquer
}

// Génère un identifiant unique du type "kossi.amavi3" pour le compte élève
async function generateUniqueIdentifiant(prenom, nom) {
  const base = `${slugify(prenom)}.${slugify(nom)}`;
  let identifiant = base;
  let suffix = 0;
  while (true) {
    const exists = await query("SELECT 1 FROM utilisateurs WHERE identifiant = $1", [identifiant]);
    if (!exists.rows.length) return identifiant;
    suffix++;
    identifiant = `${base}${suffix}`;
  }
}

async function createCompteEleve(idEleve, prenom, nom, etablissementId) {
  const identifiant = await generateUniqueIdentifiant(prenom, nom);
  const motDePasse = randomPassword();
  const { hash, salt } = hashPassword(motDePasse);
  await query(
    `INSERT INTO utilisateurs (etablissement_id, nom, identifiant, mot_de_passe_hash, mot_de_passe_sel, role, id_eleve)
     VALUES ($1,$2,$3,$4,$5,'Eleve',$6)`,
    [etablissementId, `${nom} ${prenom}`, identifiant, hash, salt, idEleve]
  );
  return { identifiant, motDePasse };
}

// GET /api/students?search=&classe=&serie=&niveau=
router.get("/", async (req, res) => {
  const { search, classe, serie, niveau } = req.query;
  const conditions = ["etablissement_id = $1"];
  const params = [req.user.etablissementId];
  if (niveau) { params.push(niveau); conditions.push(`niveau = $${params.length}`); }
  if (classe) { params.push(classe); conditions.push(`classe = $${params.length}`); }
  if (serie) { params.push(serie); conditions.push(`serie = $${params.length}`); }
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    conditions.push(`(LOWER(nom) LIKE $${params.length} OR LOWER(prenom) LIKE $${params.length})`);
  }

  const r = await query(`SELECT * FROM eleves WHERE ${conditions.join(" AND ")} ORDER BY nom, prenom`, params);
  let eleves = r.rows.map(toEleveJson);

  const affectations = await getAffectationsForUser(req.user);
  eleves = filterStudentsForScope(eleves, affectations);
  res.json(eleves);
});

router.get("/:id", async (req, res) => {
  const r = await query("SELECT * FROM eleves WHERE id = $1 AND etablissement_id = $2", [req.params.id, req.user.etablissementId]);
  if (!r.rows.length) return res.status(404).json({ error: "Élève introuvable" });
  const eleve = toEleveJson(r.rows[0]);

  const affectations = await getAffectationsForUser(req.user);
  if (!studentInScope(eleve, affectations)) {
    return res.status(403).json({ error: "Vous n'êtes pas affecté à la classe de cet élève" });
  }

  const etabRes = await query("SELECT periode_actuelle FROM etablissements WHERE id = $1", [req.user.etablissementId]);
  const periode = req.query.periode || etabRes.rows[0].periode_actuelle;
  const { moyenneEleve } = require("../lib/calculs");
  const moyenne = await moyenneEleve(eleve.ID, eleve.Niveau, req.user.etablissementId, periode);

  const compteRes = await query("SELECT identifiant FROM utilisateurs WHERE id_eleve = $1", [eleve.ID]);
  res.json({ ...eleve, moyenne, periode, compteIdentifiant: compteRes.rows[0]?.identifiant || null });
});

// Un compte élève est créé automatiquement à l'inscription, pour qu'il puisse consulter
// ses notes et les évaluations à venir depuis son propre espace.
router.post("/", requireRole("Administrateur"), async (req, res) => {
  const { Nom, Prenom, Niveau, Classe, Serie, Annee, Sexe, Statut } = req.body;
  if (!Nom || !Prenom || !Niveau || !Classe) {
    return res.status(400).json({ error: "Nom, Prénom, Niveau et Classe sont requis" });
  }
  const r = await query(
    `INSERT INTO eleves (etablissement_id, nom, prenom, niveau, classe, serie, annee, sexe, statut)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.user.etablissementId, Nom, Prenom, Niveau, Classe, Serie || "", Annee || "", ["M", "F"].includes(Sexe) ? Sexe : "", ["N", "R"].includes(Statut) ? Statut : ""]
  );
  const eleve = r.rows[0];
  const identifiants = await createCompteEleve(eleve.id, Prenom, Nom, req.user.etablissementId);
  res.status(201).json({ ...toEleveJson(eleve), compte: identifiants });
});

router.put("/:id", requireRole("Administrateur"), async (req, res) => {
  const { Nom, Prenom, Niveau, Classe, Serie, Annee, Sexe, Statut } = req.body;
  const r = await query(
    `UPDATE eleves SET nom=COALESCE($1,nom), prenom=COALESCE($2,prenom), niveau=COALESCE($3,niveau),
       classe=COALESCE($4,classe), serie=COALESCE($5,serie), annee=COALESCE($6,annee),
       sexe=COALESCE($7,sexe), statut=COALESCE($8,statut)
     WHERE id = $9 AND etablissement_id = $10 RETURNING *`,
    [Nom, Prenom, Niveau, Classe, Serie, Annee, Sexe === undefined ? null : (["M", "F"].includes(Sexe) ? Sexe : ""), Statut === undefined ? null : (["N", "R"].includes(Statut) ? Statut : ""), req.params.id, req.user.etablissementId]
  );
  if (!r.rows.length) return res.status(404).json({ error: "Élève introuvable" });
  res.json(toEleveJson(r.rows[0]));
});

router.delete("/:id", requireRole("Administrateur"), async (req, res) => {
  // ON DELETE CASCADE supprime automatiquement ses notes, présences et son compte
  const r = await query("DELETE FROM eleves WHERE id = $1 AND etablissement_id = $2", [req.params.id, req.user.etablissementId]);
  if (r.rowCount === 0) return res.status(404).json({ error: "Élève introuvable" });
  res.json({ success: true });
});

// Réinitialise le mot de passe du compte élève (l'admin peut le communiquer à nouveau)
router.post("/:id/compte/reinitialiser", requireRole("Administrateur"), async (req, res) => {
  const eleveRes = await query("SELECT nom, prenom FROM eleves WHERE id = $1 AND etablissement_id = $2", [req.params.id, req.user.etablissementId]);
  if (!eleveRes.rows.length) return res.status(404).json({ error: "Élève introuvable" });

  const compteRes = await query("SELECT id, identifiant FROM utilisateurs WHERE id_eleve = $1", [req.params.id]);
  const motDePasse = randomPassword();
  const { hash, salt } = hashPassword(motDePasse);

  if (compteRes.rows.length) {
    await definirMotDePasse({ userId: compteRes.rows[0].id, etablissementId: req.user.etablissementId, roles: ["Eleve"], motDePasse });
    res.json({ identifiant: compteRes.rows[0].identifiant, motDePasse });
  } else {
    const { nom, prenom } = eleveRes.rows[0];
    const identifiants = await createCompteEleve(req.params.id, prenom, nom, req.user.etablissementId);
    res.json(identifiants);
  }
});

module.exports = router;
