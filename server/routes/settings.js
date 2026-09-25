const express = require("express");
const multer = require("multer");
const { query } = require("../db/pool");
const { requireAuth, requireRole } = require("../lib/auth");

const router = express.Router();

// Stockage en mémoire (pas sur disque) : indispensable sur Vercel, où le système de
// fichiers d'une fonction serverless est éphémère et non partagé entre invocations.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(png|jpe?g)$/.test(file.mimetype)) return cb(new Error("Le logo doit être une image PNG ou JPEG"));
    cb(null, true);
  },
});

const PERIODES_DISPONIBLES = ["1er Trimestre", "2e Trimestre", "3e Trimestre", "1er Semestre", "2e Semestre"];

function toSettingsJson(e, hasLogo) {
  return {
    ID: e.id, Nom: e.nom, Type: e.type, Ministere: e.ministere, DirectionRegionale: e.direction_regionale,
    IESG: e.iesg, Adresse: e.adresse, Telephone: e.telephone, BP: e.bp, PeriodeActuelle: e.periode_actuelle,
    ModeleBulletin: e.modele_bulletin, Devise: e.devise,
    Ville: e.ville || "", TitreDirection: e.titre_direction || "Le Directeur", NomDirection: e.nom_direction || "",
    DeviseEcole: e.devise_ecole || "", ModeleRecu: e.modele_recu || "Standard",
    ProfsChangentMotDePasse: !!e.profs_changent_mdp, // les enseignants peuvent-ils changer eux-mêmes leur mot de passe ?
    PeriodesDisponibles: PERIODES_DISPONIBLES,
    NiveauxActifs: e.niveaux_actifs, logoUrl: hasLogo ? "/api/settings/logo" : "",
  };
}

router.get("/", requireAuth, async (req, res) => {
  if (!req.user.etablissementId) return res.status(403).json({ error: "Aucun établissement associé à ce compte" });
  const base = "id, nom, type, ministere, direction_regionale, iesg, adresse, telephone, bp, niveaux_actifs, periode_actuelle, modele_bulletin, devise";
  const v3 = "ville, titre_direction, nom_direction, devise_ecole, modele_recu";
  // Les colonnes des migrations v3 / v5 peuvent ne pas exister encore : l'application reste utilisable avec ce qui est disponible
  const variantes = [`${base}, ${v3}, profs_changent_mdp`, `${base}, ${v3}`, base];
  let r;
  for (let i = 0; i < variantes.length; i++) {
    try {
      r = await query(`SELECT ${variantes[i]}, (logo IS NOT NULL) AS has_logo FROM etablissements WHERE id = $1`, [req.user.etablissementId]);
      break;
    } catch (err) { if (err.code !== "42703" || i === variantes.length - 1) throw err; }
  }
  if (!r.rows.length) return res.status(404).json({ error: "Établissement introuvable" });
  res.json(toSettingsJson(r.rows[0], r.rows[0].has_logo));
});

router.put("/", requireAuth, requireRole("Administrateur"), async (req, res) => {
  const { Nom, Type, Ministere, DirectionRegionale, IESG, Adresse, Telephone, BP, PeriodeActuelle, ModeleBulletin, Devise, Ville, TitreDirection, NomDirection, DeviseEcole, ModeleRecu } = req.body;
  const r = await query(
    `UPDATE etablissements SET
       nom=COALESCE($1,nom), type=COALESCE($2,type), ministere=COALESCE($3,ministere),
       direction_regionale=COALESCE($4,direction_regionale), iesg=COALESCE($5,iesg),
       adresse=COALESCE($6,adresse), telephone=COALESCE($7,telephone), bp=COALESCE($8,bp),
       periode_actuelle=COALESCE($9,periode_actuelle), modele_bulletin=COALESCE($10,modele_bulletin), devise=COALESCE($11,devise),
       ville=COALESCE($12,ville), titre_direction=COALESCE($13,titre_direction), nom_direction=COALESCE($14,nom_direction),
       devise_ecole=COALESCE($15,devise_ecole), modele_recu=COALESCE($16,modele_recu)
     WHERE id = $17
     RETURNING id, nom, type, ministere, direction_regionale, iesg, adresse, telephone, bp, niveaux_actifs, periode_actuelle, modele_bulletin, devise, ville, titre_direction, nom_direction, devise_ecole, modele_recu, (logo IS NOT NULL) AS has_logo`,
    [Nom, Type, Ministere, DirectionRegionale, IESG, Adresse, Telephone, BP, PeriodeActuelle, ModeleBulletin, Devise, Ville, TitreDirection, NomDirection, DeviseEcole, ModeleRecu, req.user.etablissementId]
  );
  if (!r.rows.length) return res.status(404).json({ error: "Établissement introuvable" });
  // Autorisation donnée aux enseignants de changer eux-mêmes leur mot de passe (migration v5)
  if (typeof req.body.ProfsChangentMotDePasse === "boolean") {
    try {
      await query("UPDATE etablissements SET profs_changent_mdp = $1 WHERE id = $2", [req.body.ProfsChangentMotDePasse, req.user.etablissementId]);
      r.rows[0].profs_changent_mdp = req.body.ProfsChangentMotDePasse;
    } catch (err) {
      if (err.code !== "42703") throw err;
      return res.status(409).json({ error: "Ce réglage nécessite la migration v5 de la base de données (db/migration-v5.sql)." });
    }
  } else {
    try {
      const cur = await query("SELECT profs_changent_mdp FROM etablissements WHERE id = $1", [req.user.etablissementId]);
      r.rows[0].profs_changent_mdp = cur.rows[0]?.profs_changent_mdp;
    } catch { /* migration v5 non exécutée */ }
  }
  res.json(toSettingsJson(r.rows[0], r.rows[0].has_logo));
});

router.post("/logo", requireAuth, requireRole("Administrateur"), upload.single("logo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu" });
  await query("UPDATE etablissements SET logo = $1, logo_mimetype = $2 WHERE id = $3",
    [req.file.buffer, req.file.mimetype, req.user.etablissementId]);
  res.json({ success: true, logoUrl: "/api/settings/logo" });
});

// Le logo est chargé via <img src="/api/settings/logo?token=..."> — requireAuth accepte
// déjà un token en paramètre de requête, ce qui fonctionne nativement avec une balise <img>.
router.get("/logo", requireAuth, async (req, res) => {
  if (!req.user.etablissementId) return res.status(404).json({ error: "Aucun logo configuré" });
  const r = await query("SELECT logo, logo_mimetype FROM etablissements WHERE id = $1", [req.user.etablissementId]);
  if (!r.rows.length || !r.rows[0].logo) return res.status(404).json({ error: "Aucun logo configuré" });
  res.setHeader("Content-Type", r.rows[0].logo_mimetype || "image/png");
  res.send(r.rows[0].logo);
});

// Utilisé en interne par le générateur de bulletin (accès direct par établissement, sans passer par HTTP)
async function getSettingsRaw(etablissementId) {
  const r = await query("SELECT * FROM etablissements WHERE id = $1", [etablissementId]);
  return r.rows[0] || null;
}

module.exports = { router, getSettingsRaw };
