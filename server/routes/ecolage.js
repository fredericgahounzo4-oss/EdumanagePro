const express = require("express");
const PDFDocument = require("pdfkit");
const { query } = require("../db/pool");
const { requireAuth, requireRole } = require("../lib/auth");
const { getSettingsRaw } = require("./settings");
const { notifier, idsParRole } = require("../lib/notify");
const { RECU_MODELES } = require("../lib/recuModeles");

const router = express.Router();
router.use(requireAuth);

// Le caissier gère les encaissements ; l'administrateur a accès à tout également.
const CAISSE = ["Administrateur", "Caissier"];

function money(n) {
  // Séparateur de milliers en espace simple : PDFKit ne rend pas correctement
  // l'espace insécable fine produite par toLocaleString("fr-FR").
  return Number(n || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// --------- Barèmes d'écolage ---------

router.get("/baremes", requireRole(...CAISSE), async (req, res) => {
  const r = await query(
    `SELECT id AS "ID", niveau AS "Niveau", classe AS "Classe", serie AS "Serie",
            annee AS "Annee", montant_total AS "MontantTotal"
     FROM baremes_ecolage WHERE etablissement_id = $1 ORDER BY niveau, classe, serie`,
    [req.user.etablissementId]
  );
  res.json(r.rows);
});

router.post("/baremes", requireRole("Administrateur"), async (req, res) => {
  const { Niveau, Classe, Serie, Annee, MontantTotal } = req.body;
  if (!Niveau || MontantTotal === undefined) {
    return res.status(400).json({ error: "Niveau et montant total sont requis" });
  }
  const r = await query(
    `INSERT INTO baremes_ecolage (etablissement_id, niveau, classe, serie, annee, montant_total)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id AS "ID", niveau AS "Niveau", classe AS "Classe", serie AS "Serie", annee AS "Annee", montant_total AS "MontantTotal"`,
    [req.user.etablissementId, Niveau, Classe || "", Serie || "", Annee || "", MontantTotal]
  );
  res.status(201).json(r.rows[0]);
});

router.delete("/baremes/:id", requireRole("Administrateur"), async (req, res) => {
  const r = await query("DELETE FROM baremes_ecolage WHERE id = $1 AND etablissement_id = $2", [req.params.id, req.user.etablissementId]);
  if (r.rowCount === 0) return res.status(404).json({ error: "Barème introuvable" });
  res.json({ success: true });
});

// Retrouve le barème applicable à un élève : la règle la plus spécifique gagne
// (classe+série > classe > niveau seul).
async function baremeFor(etablissementId, eleve) {
  const r = await query(
    `SELECT montant_total,
       (CASE WHEN classe <> '' THEN 2 ELSE 0 END) + (CASE WHEN serie <> '' THEN 1 ELSE 0 END) AS specificite
     FROM baremes_ecolage
     WHERE etablissement_id = $1 AND niveau = $2
       AND (classe = '' OR classe = $3)
       AND (serie = '' OR serie = $4)
     ORDER BY specificite DESC LIMIT 1`,
    [etablissementId, eleve.niveau, eleve.classe, eleve.serie || ""]
  );
  return r.rows[0] ? Number(r.rows[0].montant_total) : 0;
}

// --------- Situation d'un élève ---------

router.get("/eleve/:id", async (req, res) => {
  const eleveRes = await query(
    "SELECT id, nom, prenom, niveau, classe, serie, annee FROM eleves WHERE id = $1 AND etablissement_id = $2",
    [req.params.id, req.user.etablissementId]
  );
  const eleve = eleveRes.rows[0];
  if (!eleve) return res.status(404).json({ error: "Élève introuvable" });

  const total = await baremeFor(req.user.etablissementId, eleve);
  const paiementsRes = await query(
    `SELECT id AS "ID", montant AS "Montant", mode AS "Mode", motif AS "Motif",
            numero_recu AS "NumeroRecu", encaisse_par AS "EncaissePar", date_paiement AS "DatePaiement"
     FROM paiements WHERE id_eleve = $1 AND etablissement_id = $2 ORDER BY date_paiement DESC`,
    [req.params.id, req.user.etablissementId]
  );
  const paye = paiementsRes.rows.reduce((a, p) => a + Number(p.Montant), 0);

  res.json({
    eleve: { ID: eleve.id, Nom: eleve.nom, Prenom: eleve.prenom, Classe: eleve.classe, Serie: eleve.serie, Niveau: eleve.niveau },
    total, paye, reste: Math.max(0, total - paye),
    solde: total - paye,
    paiements: paiementsRes.rows,
  });
});

// --------- Encaissement ---------

router.post("/paiements", requireRole(...CAISSE), async (req, res) => {
  const { IDEleve, Montant, Mode, Motif } = req.body;
  if (!IDEleve || !Montant || Number(Montant) <= 0) {
    return res.status(400).json({ error: "Élève et montant (positif) sont requis" });
  }
  const eleveRes = await query("SELECT id, nom, prenom, annee FROM eleves WHERE id = $1 AND etablissement_id = $2", [IDEleve, req.user.etablissementId]);
  const eleve = eleveRes.rows[0];
  if (!eleve) return res.status(404).json({ error: "Élève introuvable" });

  // Numéro de reçu séquentiel par établissement : REC-000001
  const countRes = await query("SELECT COUNT(*) FROM paiements WHERE etablissement_id = $1", [req.user.etablissementId]);
  const numero = "REC-" + String(Number(countRes.rows[0].count) + 1).padStart(6, "0");

  const r = await query(
    `INSERT INTO paiements (etablissement_id, id_eleve, montant, mode, motif, numero_recu, encaisse_par, annee)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id AS "ID", numero_recu AS "NumeroRecu", montant AS "Montant", date_paiement AS "DatePaiement"`,
    [req.user.etablissementId, IDEleve, Montant, Mode || "Espèces", Motif || "Écolage", numero, req.user.nom, eleve.annee || ""]
  );

  // Notifie automatiquement les parents rattachés à cet élève (preuve de paiement)
  const parentsRes = await query("SELECT id_utilisateur FROM parents_eleves WHERE id_eleve = $1", [IDEleve]);
  for (const p of parentsRes.rows) {
    await query(
      `INSERT INTO messages (etablissement_id, expediteur_id, destinataire_id, id_eleve, sujet, corps, type)
       VALUES ($1,$2,$3,$4,$5,$6,'Notification')`,
      [req.user.etablissementId, req.user.id, p.id_utilisateur, IDEleve,
        "Paiement enregistré",
        `Un paiement de ${money(Montant)} a été enregistré pour ${eleve.nom} ${eleve.prenom}. Reçu n° ${numero}.`]
    );
  }

  // Tient l'administration informée de chaque encaissement (cloche) — sans jamais bloquer le paiement
  const admins = await idsParRole(req.user.etablissementId, ["Administrateur"]);
  await notifier({
    etablissementId: req.user.etablissementId,
    userIds: admins.filter((id) => id !== req.user.id),
    type: "success",
    titre: `Paiement encaissé : ${money(Montant)}`,
    message: `${eleve.nom} ${eleve.prenom} — reçu n° ${numero}, encaissé par ${req.user.nom}.`,
    lien: "/ecolage",
  });

  res.status(201).json(r.rows[0]);
});

router.delete("/paiements/:id", requireRole("Administrateur"), async (req, res) => {
  const r = await query("DELETE FROM paiements WHERE id = $1 AND etablissement_id = $2", [req.params.id, req.user.etablissementId]);
  if (r.rowCount === 0) return res.status(404).json({ error: "Paiement introuvable" });
  res.json({ success: true });
});

// --------- Reçu imprimable (PDF) ---------

router.get("/recu/:idPaiement", requireRole(...CAISSE), async (req, res) => {
  const pRes = await query(
    `SELECT p.*, e.nom AS eleve_nom, e.prenom AS eleve_prenom, e.classe, e.serie, e.niveau, e.annee AS eleve_annee
     FROM paiements p JOIN eleves e ON e.id = p.id_eleve
     WHERE p.id = $1 AND p.etablissement_id = $2`,
    [req.params.idPaiement, req.user.etablissementId]
  );
  const p = pRes.rows[0];
  if (!p) return res.status(404).json({ error: "Paiement introuvable" });

  const settings = await getSettingsRaw(req.user.etablissementId);
  const devise = settings.devise || "FCFA";
  const total = await baremeFor(req.user.etablissementId, p);
  const cumulRes = await query(
    "SELECT COALESCE(SUM(montant),0) AS s FROM paiements WHERE id_eleve = $1 AND etablissement_id = $2",
    [p.id_eleve, req.user.etablissementId]
  );
  const cumul = Number(cumulRes.rows[0].s);

  // Modèles de reçu personnalisés (reçu à talon...) : dessinés par lib/recuModeles.js
  const modeleRecu = settings.modele_recu || "Standard";
  if (RECU_MODELES[modeleRecu]) {
    const docTalon = new PDFDocument({ size: [595, 420], margin: 0 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="recu_${p.numero_recu}.pdf"`);
    docTalon.pipe(res);
    RECU_MODELES[modeleRecu](docTalon, {
      settings, devise, total, cumul, paiement: p,
      eleve: { Nom: p.eleve_nom, Prenom: p.eleve_prenom, nom: p.eleve_nom, prenom: p.eleve_prenom, classe: p.classe, serie: p.serie, annee: p.eleve_annee },
    });
    docTalon.end();
    return;
  }

  // Format A5 paysage : s'imprime bien sur une imprimante de bureau, ou se découpe en deux sur A4
  const doc = new PDFDocument({ size: [595, 420], margin: 30 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="recu_${p.numero_recu}.pdf"`);
  doc.pipe(res);

  if (settings.logo && settings.logo.length) {
    try { doc.image(settings.logo, 30, 26, { fit: [48, 48] }); } catch { /* logo illisible */ }
  }
  doc.font("Helvetica-Bold").fontSize(13).text((settings.nom || "").toUpperCase(), 88, 30, { width: 350 });
  doc.font("Helvetica").fontSize(8);
  const contact = [settings.adresse, settings.bp && `BP ${settings.bp}`, settings.telephone && `Tél : ${settings.telephone}`].filter(Boolean).join("  —  ");
  if (contact) doc.text(contact, 88, doc.y + 2, { width: 350 });

  doc.moveTo(30, 84).lineTo(565, 84).lineWidth(1.2).stroke();

  doc.font("Helvetica-Bold").fontSize(15).text("REÇU DE PAIEMENT", 30, 96, { width: 535, align: "center" });
  doc.font("Helvetica").fontSize(9).text(`N° ${p.numero_recu}`, 30, doc.y + 4, { width: 535, align: "center" });

  let y = 140;
  const ligne = (label, valeur, bold = false) => {
    doc.font("Helvetica").fontSize(10).text(label, 40, y, { width: 180 });
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10).text(valeur, 225, y, { width: 330 });
    y += 20;
  };

  ligne("Élève :", `${p.eleve_nom} ${p.eleve_prenom}`, true);
  ligne("Classe :", `${p.classe}${p.serie ? " " + p.serie : ""} (${p.niveau})`);
  ligne("Motif :", p.motif || "Écolage");
  ligne("Mode de paiement :", p.mode || "Espèces");
  ligne("Date :", new Date(p.date_paiement).toLocaleString("fr-FR"));
  ligne("Encaissé par :", p.encaisse_par || "—");

  y += 6;
  doc.rect(40, y, 515, 30).fillAndStroke("#F0E6D2", "#C9BFA4");
  doc.fillColor("#000").font("Helvetica-Bold").fontSize(13)
    .text(`MONTANT VERSÉ : ${money(p.montant)} ${devise}`, 50, y + 9, { width: 495 });
  y += 46;

  doc.font("Helvetica").fontSize(9);
  if (total > 0) {
    doc.text(`Écolage total : ${money(total)} ${devise}`, 40, y);
    doc.text(`Cumul versé : ${money(cumul)} ${devise}`, 230, y);
    doc.font("Helvetica-Bold").text(`Reste à payer : ${money(Math.max(0, total - cumul))} ${devise}`, 400, y);
    y += 24;
  }

  doc.font("Helvetica").fontSize(9).text("Signature et cachet", 380, y + 10, { width: 175, align: "center" });
  doc.moveTo(380, y + 40).lineTo(555, y + 40).stroke("#999");
  doc.fontSize(7).fillColor("#666").text("Ce reçu doit être conservé comme preuve de paiement.", 40, y + 44);

  doc.end();
});

// --------- Synthèse établissement (tableau de bord) ---------

router.get("/synthese", requireRole(...CAISSE), async (req, res) => {
  const etabId = req.user.etablissementId;
  const elevesRes = await query("SELECT id, niveau, classe, serie FROM eleves WHERE etablissement_id = $1", [etabId]);
  const paiementsRes = await query(
    "SELECT id_eleve, COALESCE(SUM(montant),0) AS s FROM paiements WHERE etablissement_id = $1 GROUP BY id_eleve",
    [etabId]
  );
  const payeParEleve = Object.fromEntries(paiementsRes.rows.map((p) => [p.id_eleve, Number(p.s)]));

  let totalAttendu = 0, totalPaye = 0, nbSoldes = 0, nbEnRetard = 0;
  const parNiveau = {};

  for (const e of elevesRes.rows) {
    const total = await baremeFor(etabId, e);
    const paye = payeParEleve[e.id] || 0;
    totalAttendu += total;
    totalPaye += paye;
    if (total > 0 && paye >= total) nbSoldes++;
    else if (total > 0) nbEnRetard++;

    if (!parNiveau[e.niveau]) parNiveau[e.niveau] = { attendu: 0, paye: 0 };
    parNiveau[e.niveau].attendu += total;
    parNiveau[e.niveau].paye += paye;
  }

  res.json({
    totalAttendu, totalPaye, reste: Math.max(0, totalAttendu - totalPaye),
    tauxRecouvrement: totalAttendu > 0 ? Math.round((totalPaye / totalAttendu) * 1000) / 10 : 0,
    nbSoldes, nbEnRetard, effectif: elevesRes.rows.length,
    parNiveau: Object.entries(parNiveau).map(([niveau, v]) => ({
      niveau, attendu: v.attendu, paye: v.paye, reste: Math.max(0, v.attendu - v.paye),
    })),
  });
});

// Liste des élèves avec leur situation, pour l'écran du caissier
router.get("/situations", requireRole(...CAISSE), async (req, res) => {
  const { classe, niveau, statut } = req.query;
  const conditions = ["etablissement_id = $1"];
  const params = [req.user.etablissementId];
  if (niveau) { params.push(niveau); conditions.push(`niveau = $${params.length}`); }
  if (classe) { params.push(classe); conditions.push(`classe = $${params.length}`); }

  const elevesRes = await query(
    `SELECT id, nom, prenom, niveau, classe, serie FROM eleves WHERE ${conditions.join(" AND ")} ORDER BY nom, prenom`,
    params
  );
  const paiementsRes = await query(
    "SELECT id_eleve, COALESCE(SUM(montant),0) AS s FROM paiements WHERE etablissement_id = $1 GROUP BY id_eleve",
    [req.user.etablissementId]
  );
  const payeParEleve = Object.fromEntries(paiementsRes.rows.map((p) => [p.id_eleve, Number(p.s)]));

  let rows = [];
  for (const e of elevesRes.rows) {
    const total = await baremeFor(req.user.etablissementId, e);
    const paye = payeParEleve[e.id] || 0;
    rows.push({
      ID: e.id, Nom: e.nom, Prenom: e.prenom, Niveau: e.niveau, Classe: e.classe, Serie: e.serie,
      total, paye, reste: Math.max(0, total - paye), solde: total > 0 && paye >= total,
    });
  }
  if (statut === "solde") rows = rows.filter((r) => r.solde);
  if (statut === "retard") rows = rows.filter((r) => !r.solde && r.total > 0);

  res.json(rows);
});

module.exports = router;
