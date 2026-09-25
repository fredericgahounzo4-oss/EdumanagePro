const express = require("express");
const crypto = require("crypto");
const { query } = require("../db/pool");
const { requireAuth, requireRole, hashPassword } = require("../lib/auth");
const { definirMotDePasse } = require("../lib/motsDePasse");

const router = express.Router();
router.use(requireAuth);

function slugify(t) {
  return String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function uniqueIdentifiant(base) {
  let id = base, i = 0;
  while ((await query("SELECT 1 FROM utilisateurs WHERE identifiant = $1", [id])).rows.length) {
    i++; id = `${base}${i}`;
  }
  return id;
}

// --------- Gestion des comptes parents (Administrateur) ---------

router.get("/", requireRole("Administrateur"), async (req, res) => {
  const r = await query(
    `SELECT u.id, u.nom, u.identifiant,
            COALESCE(json_agg(json_build_object('ID', e.id, 'Nom', e.nom, 'Prenom', e.prenom, 'Classe', e.classe, 'Lien', pe.lien))
                     FILTER (WHERE e.id IS NOT NULL), '[]') AS enfants
     FROM utilisateurs u
     LEFT JOIN parents_eleves pe ON pe.id_utilisateur = u.id
     LEFT JOIN eleves e ON e.id = pe.id_eleve
     WHERE u.etablissement_id = $1 AND u.role = 'Parent'
     GROUP BY u.id ORDER BY u.nom`,
    [req.user.etablissementId]
  );
  res.json(r.rows.map((p) => ({ ID: p.id, Nom: p.nom, Identifiant: p.identifiant, enfants: p.enfants })));
});

// Crée un compte parent et le rattache à un ou plusieurs élèves
router.post("/", requireRole("Administrateur"), async (req, res) => {
  const { Nom, Telephone, IDEleves, Lien } = req.body;
  if (!Nom || !Array.isArray(IDEleves) || IDEleves.length === 0) {
    return res.status(400).json({ error: "Nom du parent et au moins un enfant sont requis" });
  }
  const identifiant = await uniqueIdentifiant("parent." + slugify(Nom).slice(0, 18));
  const motDePasse = crypto.randomBytes(5).toString("hex");
  const { hash, salt } = hashPassword(motDePasse);

  const uRes = await query(
    `INSERT INTO utilisateurs (etablissement_id, nom, identifiant, mot_de_passe_hash, mot_de_passe_sel, role)
     VALUES ($1,$2,$3,$4,$5,'Parent') RETURNING id`,
    [req.user.etablissementId, Nom, identifiant, hash, salt]
  );
  const idUtilisateur = uRes.rows[0].id;

  for (const idEleve of IDEleves) {
    const ok = await query("SELECT 1 FROM eleves WHERE id = $1 AND etablissement_id = $2", [idEleve, req.user.etablissementId]);
    if (!ok.rows.length) continue;
    await query(
      "INSERT INTO parents_eleves (etablissement_id, id_utilisateur, id_eleve, lien) VALUES ($1,$2,$3,$4)",
      [req.user.etablissementId, idUtilisateur, idEleve, Lien || "Parent"]
    );
  }

  res.status(201).json({ ID: idUtilisateur, Nom, compte: { identifiant, motDePasse }, telephone: Telephone || "" });
});

router.post("/:id/reinitialiser", requireRole("Administrateur"), async (req, res) => {
  const motDePasse = crypto.randomBytes(5).toString("hex");
  const u = await definirMotDePasse({ userId: Number(req.params.id), etablissementId: req.user.etablissementId, roles: ["Parent"], motDePasse });
  if (!u) return res.status(404).json({ error: "Compte parent introuvable" });
  res.json({ identifiant: u.identifiant, motDePasse });
});

router.delete("/:id", requireRole("Administrateur"), async (req, res) => {
  const r = await query("DELETE FROM utilisateurs WHERE id=$1 AND etablissement_id=$2 AND role='Parent'", [req.params.id, req.user.etablissementId]);
  if (r.rowCount === 0) return res.status(404).json({ error: "Compte parent introuvable" });
  res.json({ success: true });
});

// --------- Espace parent : suivi de ses enfants ---------

router.get("/mes-enfants", requireRole("Parent"), async (req, res) => {
  const { moyenneEleve } = require("../lib/calculs");
  const { getMention } = require("../lib/reference");

  const etabRes = await query("SELECT nom, periode_actuelle FROM etablissements WHERE id = $1", [req.user.etablissementId]);
  const periode = etabRes.rows[0].periode_actuelle;

  const enfantsRes = await query(
    `SELECT e.id, e.nom, e.prenom, e.niveau, e.classe, e.serie, pe.lien
     FROM parents_eleves pe JOIN eleves e ON e.id = pe.id_eleve
     WHERE pe.id_utilisateur = $1`,
    [req.user.id]
  );

  const enfants = [];
  for (const e of enfantsRes.rows) {
    const notesRes = await query(
      `SELECT matiere AS "Matiere", interro AS "Interro", devoir AS "Devoir", composition AS "Composition",
              note_generale AS "NoteGenerale", professeur AS "Professeur"
       FROM notes WHERE id_eleve=$1 AND etablissement_id=$2 AND periode=$3 ORDER BY matiere`,
      [e.id, req.user.etablissementId, periode]
    );
    const moyenne = Math.round((await moyenneEleve(e.id, e.niveau, req.user.etablissementId, periode)) * 100) / 100;

    const presRes = await query("SELECT statut FROM presences WHERE id_eleve=$1 AND etablissement_id=$2", [e.id, req.user.etablissementId]);
    const total = presRes.rows.length;
    const absences = presRes.rows.filter((p) => p.statut === "Absent").length;

    // Situation d'écolage
    const barRes = await query(
      `SELECT montant_total,
         (CASE WHEN classe <> '' THEN 2 ELSE 0 END) + (CASE WHEN serie <> '' THEN 1 ELSE 0 END) AS spec
       FROM baremes_ecolage WHERE etablissement_id=$1 AND niveau=$2
         AND (classe='' OR classe=$3) AND (serie='' OR serie=$4)
       ORDER BY spec DESC LIMIT 1`,
      [req.user.etablissementId, e.niveau, e.classe, e.serie || ""]
    );
    const totalEcolage = barRes.rows[0] ? Number(barRes.rows[0].montant_total) : 0;
    const payeRes = await query("SELECT COALESCE(SUM(montant),0) AS s FROM paiements WHERE id_eleve=$1 AND etablissement_id=$2", [e.id, req.user.etablissementId]);
    const paye = Number(payeRes.rows[0].s);

    const examensRes = await query(
      `SELECT nom AS "Nom", type AS "Type", date_debut AS "DateDebut", statut AS "Statut" FROM examens
       WHERE etablissement_id=$1 AND (niveau='' OR niveau=$2) AND (classe='' OR classe=$3) AND (serie='' OR serie=$4)
         AND statut <> 'Terminé' ORDER BY date_debut`,
      [req.user.etablissementId, e.niveau, e.classe, e.serie || ""]
    );

    enfants.push({
      eleve: { ID: e.id, Nom: e.nom, Prenom: e.prenom, Niveau: e.niveau, Classe: e.classe, Serie: e.serie, Lien: e.lien },
      notes: notesRes.rows, moyenne, mention: getMention(moyenne),
      presences: { total, absences, taux: total > 0 ? Math.round(((total - absences) / total) * 1000) / 10 : 100 },
      ecolage: { total: totalEcolage, paye, reste: Math.max(0, totalEcolage - paye) },
      examensAVenir: examensRes.rows,
    });
  }

  res.json({ etablissementNom: etabRes.rows[0].nom, periode, enfants });
});

module.exports = router;
