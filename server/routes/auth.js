const express = require("express");
const { query } = require("../db/pool");
const { hashPassword, verifyPassword, createToken, requireAuth, requireRole } = require("../lib/auth");
const { corpsBlocage, appliquerCycleDeVieSiNecessaire } = require("../lib/cycleDeVie");
const { genererMotDePasse, validerNouveauMotDePasse, definirMotDePasse, profsPeuventChanger } = require("../lib/motsDePasse");

const router = express.Router();

function toUserJson(u) {
  return {
    id: u.id, nom: u.nom, identifiant: u.identifiant, role: u.role,
    idEnseignant: u.id_enseignant || "", idEleve: u.id_eleve || "", etablissementId: u.etablissement_id || null,
  };
}

// Indique si la plateforme n'a encore aucun compte (affiche l'écran de création du SuperAdmin)
router.get("/status", async (req, res) => {
  const r = await query("SELECT COUNT(*) FROM utilisateurs");
  res.json({ needsSuperAdminBootstrap: Number(r.rows[0].count) === 0 });
});

// Création du tout premier compte de la plateforme : le SuperAdmin (gère la liste des écoles).
// N'est possible que si aucun utilisateur n'existe encore, nulle part.
router.post("/bootstrap", async (req, res) => {
  const count = await query("SELECT COUNT(*) FROM utilisateurs");
  if (Number(count.rows[0].count) > 0) {
    return res.status(403).json({ error: "Un compte existe déjà sur la plateforme." });
  }
  const { Nom, Identifiant, MotDePasse } = req.body;
  if (!Nom || !Identifiant || !MotDePasse) {
    return res.status(400).json({ error: "Nom, identifiant et mot de passe requis" });
  }
  const { hash, salt } = hashPassword(MotDePasse);
  const r = await query(
    `INSERT INTO utilisateurs (nom, identifiant, mot_de_passe_hash, mot_de_passe_sel, role)
     VALUES ($1, $2, $3, $4, 'SuperAdmin') RETURNING *`,
    [Nom, Identifiant, hash, salt]
  );
  const user = r.rows[0];
  const token = createToken({ id: user.id, identifiant: user.identifiant, nom: user.nom, role: "SuperAdmin", etablissementId: null });
  res.status(201).json({ token, user: toUserJson(user) });
});

router.post("/login", async (req, res) => {
  const { Identifiant, MotDePasse } = req.body;
  // Les transitions automatiques (fermeture après 30 jours...) se déclenchent aussi ici, au plus une fois par heure
  appliquerCycleDeVieSiNecessaire();
  let r;
  try {
    r = await query(
      `SELECT u.*, e.active AS etab_active, e.statut AS etab_statut, e.nom AS etab_nom, e.motif_suspension, e.suspendu_le, e.suppression_prevue_le
       FROM utilisateurs u LEFT JOIN etablissements e ON e.id = u.etablissement_id
       WHERE u.identifiant = $1`,
      [Identifiant]
    );
  } catch (err) {
    if (err.code !== "42703") throw err; // migration v4 non exécutée : ancien fonctionnement
    r = await query(
      `SELECT u.*, e.active AS etab_active, e.nom AS etab_nom FROM utilisateurs u LEFT JOIN etablissements e ON e.id = u.etablissement_id WHERE u.identifiant = $1`,
      [Identifiant]
    );
  }
  const user = r.rows[0];
  if (!user || !verifyPassword(MotDePasse || "", user.mot_de_passe_hash, user.mot_de_passe_sel)) {
    return res.status(401).json({ error: "Identifiant ou mot de passe incorrect" });
  }
  if (user.etablissement_id) {
    const statut = user.etab_statut || (user.etab_active === false ? "suspendu" : "actif");
    if (statut !== "actif") {
      return res.status(403).json(corpsBlocage({ statut, nom: user.etab_nom, motif_suspension: user.motif_suspension, suspendu_le: user.suspendu_le, suppression_prevue_le: user.suppression_prevue_le }));
    }
  }
  const token = createToken({
    id: user.id, identifiant: user.identifiant, nom: user.nom, role: user.role,
    etablissementId: user.etablissement_id || null, idEnseignant: user.id_enseignant || null, idEleve: user.id_eleve || null,
  });
  res.json({ token, user: toUserJson(user) });
});

router.get("/me", requireAuth, (req, res) => res.json(req.user));

// Changer SON PROPRE mot de passe.
//   SuperAdmin et Administrateur : toujours. Enseignant : uniquement si l'administrateur de son école l'a autorisé.
//   Caissier, élève, parent : non (leur mot de passe est géré par l'administrateur de l'école).
router.post("/mot-de-passe", requireAuth, async (req, res) => {
  const { MotDePasseActuel, NouveauMotDePasse } = req.body;
  const role = req.user.role;
  if (role !== "SuperAdmin" && role !== "Administrateur") {
    const autorise = role === "Enseignant" && (await profsPeuventChanger(req.user.etablissementId));
    if (!autorise) {
      return res.status(403).json({
        error: role === "Enseignant"
          ? "L'administrateur de votre école ne vous a pas autorisé à changer votre mot de passe. Adressez-vous à lui pour le faire réinitialiser."
          : "Votre mot de passe est géré par l'administrateur de votre école. Adressez-vous à lui pour le faire réinitialiser.",
      });
    }
  }
  const r = await query("SELECT * FROM utilisateurs WHERE id = $1", [req.user.id]);
  const u = r.rows[0];
  if (!u) return res.status(401).json({ error: "Compte introuvable" });
  // 400 (et non 401) : un 401 fermerait la session côté navigateur
  if (!verifyPassword(MotDePasseActuel || "", u.mot_de_passe_hash, u.mot_de_passe_sel)) {
    return res.status(400).json({ error: "Le mot de passe actuel est incorrect." });
  }
  const erreur = validerNouveauMotDePasse(NouveauMotDePasse, { ancien: MotDePasseActuel, identifiant: u.identifiant });
  if (erreur) return res.status(400).json({ error: erreur });

  await definirMotDePasse({ userId: u.id, motDePasse: NouveauMotDePasse });
  // Les autres sessions de ce compte sont désormais coupées ; on remet un jeton neuf à l'appareil qui vient de changer le mot de passe
  const token = createToken({
    id: u.id, identifiant: u.identifiant, nom: u.nom, role: u.role,
    etablissementId: u.etablissement_id || null, idEnseignant: u.id_enseignant || null, idEleve: u.id_eleve || null,
  });
  res.json({ success: true, token, user: toUserJson(u) });
});

// Un administrateur d'école crée les comptes enseignants de SON établissement (Module 2.1)
router.post("/users", requireAuth, requireRole("Administrateur"), async (req, res) => {
  const { Nom, Identifiant, MotDePasse, Role, IDEnseignant } = req.body;
  if (!Nom || !Identifiant || !MotDePasse || !Role) {
    return res.status(400).json({ error: "Tous les champs sont requis" });
  }
  if (Role === "SuperAdmin") {
    return res.status(403).json({ error: "Un administrateur d'école ne peut pas créer de compte SuperAdmin" });
  }
  const existing = await query("SELECT 1 FROM utilisateurs WHERE identifiant = $1", [Identifiant]);
  if (existing.rows.length) return res.status(409).json({ error: "Cet identifiant existe déjà" });

  const { hash, salt } = hashPassword(MotDePasse);
  const r = await query(
    `INSERT INTO utilisateurs (etablissement_id, nom, identifiant, mot_de_passe_hash, mot_de_passe_sel, role, id_enseignant)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [req.user.etablissementId, Nom, Identifiant, hash, salt, Role, Role === "Enseignant" ? (IDEnseignant || null) : null]
  );
  res.status(201).json(toUserJson(r.rows[0]));
});

router.put("/users/:id", requireAuth, requireRole("Administrateur"), async (req, res) => {
  const { IDEnseignant } = req.body;
  const r = await query(
    `UPDATE utilisateurs SET id_enseignant = $1
     WHERE id = $2 AND etablissement_id = $3 RETURNING *`,
    [IDEnseignant || null, req.params.id, req.user.etablissementId]
  );
  if (!r.rows.length) return res.status(404).json({ error: "Utilisateur introuvable" });
  res.json(toUserJson(r.rows[0]));
});

router.get("/users", requireAuth, requireRole("Administrateur"), async (req, res) => {
  const r = await query(
    "SELECT * FROM utilisateurs WHERE etablissement_id = $1 ORDER BY nom",
    [req.user.etablissementId]
  );
  res.json(r.rows.map(toUserJson));
});

// L'administrateur de l'école réinitialise le mot de passe des enseignants (et des autres comptes de SON école).
// Il ne peut pas toucher aux comptes administrateur : ceux-ci sont gérés par la plateforme (superadmin).
router.post("/users/:id/reinitialiser", requireAuth, requireRole("Administrateur"), async (req, res) => {
  const cible = await query("SELECT id, role FROM utilisateurs WHERE id = $1 AND etablissement_id = $2", [req.params.id, req.user.etablissementId]);
  if (!cible.rows.length) return res.status(404).json({ error: "Compte introuvable" });
  if (cible.rows[0].role === "Administrateur") {
    return res.status(403).json({ error: "Le mot de passe d'un administrateur est géré par la plateforme. Pour changer le vôtre, utilisez « Changer mon mot de passe »." });
  }
  const motDePasse = genererMotDePasse();
  const u = await definirMotDePasse({ userId: cible.rows[0].id, etablissementId: req.user.etablissementId, roles: ["Enseignant", "Caissier", "Eleve", "Parent"], motDePasse });
  if (!u) return res.status(404).json({ error: "Compte introuvable" });
  res.json({ identifiant: u.identifiant, motDePasse });
});

router.delete("/users/:id", requireAuth, requireRole("Administrateur"), async (req, res) => {
  const r = await query(
    "DELETE FROM utilisateurs WHERE id = $1 AND etablissement_id = $2",
    [req.params.id, req.user.etablissementId]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: "Utilisateur introuvable" });
  res.json({ success: true });
});

module.exports = router;
