const express = require("express");
const { pool, query } = require("../db/pool");
const { hashPassword, createToken, requireAuth, requireRole } = require("../lib/auth");
const { genererMotDePasse, definirMotDePasse } = require("../lib/motsDePasse");
const { seedMatieresForEtablissement } = require("../lib/matieresSeed");
const { suspendreEcole, reactiverEcole, restaurerEcole, appliquerCycleDeVieSiNecessaire, DELAI_SUSPENSION_JOURS, DUREE_ARCHIVE_JOURS } = require("../lib/cycleDeVie");

const router = express.Router();
router.use(requireAuth, requireRole("SuperAdmin"));

const joursRestants = (date) => (date ? Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)) : null);

function toEcoleJson(e) {
  const statut = e.statut || (e.active === false ? "suspendu" : "actif");
  return {
    ID: e.id, Nom: e.nom, Type: e.type, NiveauxActifs: e.niveaux_actifs, Active: statut === "actif",
    Statut: statut, // actif | suspendu | archive
    SuspenduLe: e.suspendu_le || null, MotifSuspension: e.motif_suspension || "",
    SuppressionPrevueLe: e.suppression_prevue_le || null, JoursAvantFermeture: statut === "suspendu" ? joursRestants(e.suppression_prevue_le) : null,
    ArchiveLe: e.archive_le || null, PurgePrevueLe: e.purge_prevue_le || null, JoursAvantPurge: statut === "archive" ? joursRestants(e.purge_prevue_le) : null,
    Ministere: e.ministere, DirectionRegionale: e.direction_regionale, IESG: e.iesg,
    Adresse: e.adresse, Telephone: e.telephone, BP: e.bp,
    hasLogo: !!e.logo, CreatedAt: e.created_at,
  };
}

router.get("/", async (req, res) => {
  await appliquerCycleDeVieSiNecessaire(); // fermetures / suppressions automatiques échues (filet de sécurité du cron)
  const r = await query("SELECT * FROM etablissements ORDER BY nom");
  const counts = await query("SELECT etablissement_id, COUNT(*) AS n FROM eleves GROUP BY etablissement_id");
  const countMap = Object.fromEntries(counts.rows.map((c) => [c.etablissement_id, Number(c.n)]));

  // Nombre de comptes par rôle, par école (visibilité utile pour le SuperAdmin)
  const comptesRes = await query("SELECT etablissement_id, role, COUNT(*) AS n FROM utilisateurs WHERE etablissement_id IS NOT NULL GROUP BY etablissement_id, role");
  const comptesMap = {};
  for (const row of comptesRes.rows) {
    const id = row.etablissement_id;
    if (!comptesMap[id]) comptesMap[id] = { Administrateur: 0, Enseignant: 0, Eleve: 0 };
    comptesMap[id][row.role] = Number(row.n);
  }

  res.json(r.rows.map((e) => ({
    ...toEcoleJson(e),
    effectifTotal: countMap[e.id] || 0,
    comptes: comptesMap[e.id] || { Administrateur: 0, Enseignant: 0, Eleve: 0 },
  })));
});

// Règles du cycle de vie, pour l'affichage
router.get("/regles", (req, res) => res.json({ delaiSuspensionJours: DELAI_SUSPENSION_JOURS, dureeArchiveJours: DUREE_ARCHIVE_JOURS }));

// Journal permanent des suspensions, réactivations, fermetures, restaurations et suppressions définitives
router.get("/journal", async (req, res) => {
  const limite = Math.min(500, Math.max(1, Number(req.query.limite) || 100));
  let r;
  try {
    r = await query("SELECT id, etablissement_id, nom_ecole, action, motif, auteur, date FROM journal_ecoles ORDER BY date DESC, id DESC LIMIT $1", [limite]);
  } catch (err) { if (err.code === "42P01") return res.json([]); throw err; } // migration v4 non exécutée
  res.json(r.rows.map((j) => ({ ID: j.id, EcoleID: j.etablissement_id, Ecole: j.nom_ecole, Action: j.action, Motif: j.motif, Auteur: j.auteur, Date: j.date })));
});

// Suspension : coupe l'accès de TOUS les comptes de l'école (y compris les sessions ouvertes) et lance le délai de 30 jours
router.post("/:id/suspendre", async (req, res) => {
  const e = await suspendreEcole({ id: Number(req.params.id), motif: req.body.Motif, auteur: req.user.nom });
  res.json({ success: true, SuppressionPrevueLe: e.suppression_prevue_le });
});

// Régularisation : l'école retrouve son accès
router.post("/:id/reactiver", async (req, res) => {
  await reactiverEcole({ id: Number(req.params.id), auteur: req.user.nom });
  res.json({ success: true });
});

// Restauration d'une école archivée (pendant la durée de conservation)
router.post("/:id/restaurer", async (req, res) => {
  await restaurerEcole({ id: Number(req.params.id), auteur: req.user.nom });
  res.json({ success: true });
});

// Export Excel des données d'une école (utile pour les archives : remettre ses données à une école qui les réclame)
router.get("/:id/export", async (req, res) => {
  const ecole = await query("SELECT id, nom FROM etablissements WHERE id = $1", [req.params.id]);
  if (!ecole.rows[0]) return res.status(404).json({ error: "École introuvable" });
  const { construireClasseur } = require("./export");
  const buffer = await construireClasseur(ecole.rows[0].id);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="export_${ecole.rows[0].nom.replace(/[^\w-]+/g, "_")}.xlsx"`);
  res.send(buffer);
});

// Comptes ADMINISTRATEUR d'une école (pour réinitialiser un mot de passe oublié).
// La plateforme ne gère que les administrateurs : les comptes des enseignants relèvent de l'administrateur de l'école.
router.get("/:id/comptes", async (req, res) => {
  const r = await query(
    "SELECT id, nom, identifiant, role FROM utilisateurs WHERE etablissement_id = $1 AND role = 'Administrateur' ORDER BY nom",
    [req.params.id]
  );
  res.json(r.rows.map((u) => ({ ID: u.id, Nom: u.nom, Identifiant: u.identifiant, Role: u.role })));
});

// Réinitialise le mot de passe d'un ADMINISTRATEUR d'école (mot de passe provisoire à lui communiquer).
// Refusé pour tout autre rôle : un enseignant, un élève ou un parent s'adresse à l'administrateur de son école.
router.post("/:id/comptes/:userId/reinitialiser", async (req, res) => {
  const motDePasse = genererMotDePasse();
  const u = await definirMotDePasse({ userId: Number(req.params.userId), etablissementId: Number(req.params.id), roles: ["Administrateur"], motDePasse });
  if (!u) {
    const existe = await query("SELECT role FROM utilisateurs WHERE id = $1 AND etablissement_id = $2", [req.params.userId, req.params.id]);
    if (existe.rows.length) {
      return res.status(403).json({ error: "La plateforme ne gère que les comptes administrateur. Les mots de passe des enseignants sont gérés par l'administrateur de l'école." });
    }
    return res.status(404).json({ error: "Compte introuvable" });
  }
  res.json({ identifiant: u.identifiant, motDePasse });
});

// Crée une nouvelle école ET son premier compte Administrateur, en une seule opération.
router.post("/", async (req, res) => {
  const { Nom, Type, NiveauxActifs, AdminNom, AdminIdentifiant, AdminMotDePasse } = req.body;
  if (!Nom || !AdminNom || !AdminIdentifiant || !AdminMotDePasse) {
    return res.status(400).json({ error: "Nom de l'école et informations du premier administrateur requis" });
  }
  const existing = await query("SELECT 1 FROM utilisateurs WHERE identifiant = $1", [AdminIdentifiant]);
  if (existing.rows.length) return res.status(409).json({ error: "Cet identifiant administrateur existe déjà" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ecoleRes = await client.query(
      `INSERT INTO etablissements (nom, type, niveaux_actifs)
       VALUES ($1, $2, $3) RETURNING *`,
      [Nom, Type || "Prive", NiveauxActifs && NiveauxActifs.length ? NiveauxActifs : ["Primaire", "College", "Lycee"]]
    );
    const ecole = ecoleRes.rows[0];

    await seedMatieresForEtablissement(client, ecole.id);

    const { hash, salt } = hashPassword(AdminMotDePasse);
    await client.query(
      `INSERT INTO utilisateurs (etablissement_id, nom, identifiant, mot_de_passe_hash, mot_de_passe_sel, role)
       VALUES ($1, $2, $3, $4, $5, 'Administrateur')`,
      [ecole.id, AdminNom, AdminIdentifiant, hash, salt]
    );

    await client.query("COMMIT");
    res.status(201).json(toEcoleJson(ecole));
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Erreur lors de la création de l'école : " + err.message });
  } finally {
    client.release();
  }
});

router.put("/:id", async (req, res) => {
  const { Nom, Type, NiveauxActifs } = req.body; // le statut ne se modifie que par suspendre / réactiver / restaurer
  const r = await query(
    `UPDATE etablissements SET
       nom = COALESCE($1, nom),
       type = COALESCE($2, type),
       niveaux_actifs = COALESCE($3, niveaux_actifs)
     WHERE id = $4 RETURNING *`,
    [Nom, Type, NiveauxActifs, req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: "École introuvable" });
  res.json(toEcoleJson(r.rows[0]));
});

// UNE ÉCOLE NE SE SUPPRIME JAMAIS DIRECTEMENT, même par le superadmin (risque de perte de données par erreur).
// Cycle prévu : suspension -> fermeture automatique après 30 jours -> archives (1 an) -> suppression définitive.
router.delete("/:id", (req, res) => {
  res.status(405).json({
    error: `Une école ne peut pas être supprimée directement. Suspendez-la : sans régularisation sous ${DELAI_SUSPENSION_JOURS} jours, ` +
      `elle est fermée et archivée automatiquement (données conservées ${Math.round(DUREE_ARCHIVE_JOURS / 365)} an, puis supprimées).`,
  });
});

// Les transitions du cycle de vie signalent leurs refus (motif manquant, mauvais statut...) par une erreur typée
router.use((err, req, res, next) => {
  if (err && err.status) return res.status(err.status).json({ error: err.message });
  next(err);
});

module.exports = router;
