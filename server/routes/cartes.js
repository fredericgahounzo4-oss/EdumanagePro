const express = require("express");
const PDFDocument = require("pdfkit");
const { query } = require("../db/pool");
const { requireAuth, requireRole } = require("../lib/auth");
const { getSettingsRaw } = require("./settings");

const router = express.Router();
router.use(requireAuth, requireRole("Administrateur"));

// Dessine une carte au format carte bancaire (85.6 x 54 mm ≈ 243 x 153 points)
function dessinerCarte(doc, x, y, { eleve, settings, numero, annee }) {
  const L = 243, H = 153;

  doc.roundedRect(x, y, L, H, 8).lineWidth(1).stroke("#C9BFA4");
  doc.rect(x, y, L, 30).fill("#1F3B39");

  if (settings.logo && settings.logo.length) {
    try { doc.image(settings.logo, x + 6, y + 4, { fit: [22, 22] }); } catch { /* logo illisible */ }
  }
  doc.fillColor("#F6F1E6").font("Helvetica-Bold").fontSize(8)
    .text((settings.nom || "").toUpperCase(), x + 32, y + 8, { width: L - 40, ellipsis: true });
  doc.fillColor("#000");

  doc.font("Helvetica-Bold").fontSize(7.5).text("CARTE SCOLAIRE", x + 8, y + 36, { width: L - 16, align: "center" });
  doc.font("Helvetica").fontSize(6.5).fillColor("#5B5442")
    .text(`Année scolaire ${annee || ""}`, x + 8, y + 46, { width: L - 16, align: "center" });
  doc.fillColor("#000");

  // Emplacement photo
  doc.roundedRect(x + 10, y + 60, 50, 62, 3).stroke("#C9BFA4");
  doc.fontSize(5.5).fillColor("#999").text("PHOTO", x + 10, y + 88, { width: 50, align: "center" });
  doc.fillColor("#000");

  let ly = y + 62;
  const champ = (label, valeur, gras = false) => {
    doc.font("Helvetica").fontSize(6).fillColor("#5B5442").text(label, x + 70, ly);
    doc.font(gras ? "Helvetica-Bold" : "Helvetica").fontSize(8).fillColor("#000")
      .text(String(valeur || "—"), x + 70, ly + 7, { width: L - 80, ellipsis: true });
    ly += 20;
  };
  champ("NOM ET PRÉNOM", `${eleve.nom} ${eleve.prenom}`, true);
  champ("CLASSE", `${eleve.classe}${eleve.serie ? " " + eleve.serie : ""}`);
  champ("NIVEAU", eleve.niveau);

  doc.font("Helvetica").fontSize(6).fillColor("#5B5442").text("N° " + numero, x + 10, y + H - 16);
  doc.fontSize(5.5).text("Signature du Directeur", x + L - 95, y + H - 16, { width: 88, align: "right" });
  doc.fillColor("#000");
}

async function numeroCarte(etabId, eleveId) {
  const existant = await query(
    "SELECT numero FROM cartes_scolaires WHERE id_eleve = $1 AND etablissement_id = $2 ORDER BY id DESC LIMIT 1",
    [eleveId, etabId]
  );
  if (existant.rows.length) return existant.rows[0].numero;
  const n = await query("SELECT COUNT(*) FROM cartes_scolaires WHERE etablissement_id = $1", [etabId]);
  const numero = `CS-${String(etabId).padStart(3, "0")}-${String(Number(n.rows[0].count) + 1).padStart(5, "0")}`;
  await query(
    "INSERT INTO cartes_scolaires (etablissement_id, id_eleve, numero, annee) VALUES ($1,$2,$3,(SELECT annee FROM eleves WHERE id=$2))",
    [etabId, eleveId, numero]
  );
  return numero;
}

// Carte d'un élève
router.get("/eleve/:id", async (req, res) => {
  const r = await query("SELECT * FROM eleves WHERE id = $1 AND etablissement_id = $2", [req.params.id, req.user.etablissementId]);
  const eleve = r.rows[0];
  if (!eleve) return res.status(404).json({ error: "Élève introuvable" });

  const settings = await getSettingsRaw(req.user.etablissementId);
  const numero = await numeroCarte(req.user.etablissementId, eleve.id);

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="carte_${eleve.nom}_${eleve.prenom}.pdf"`);
  doc.pipe(res);
  dessinerCarte(doc, 60, 80, { eleve, settings, numero, annee: eleve.annee });
  doc.end();
});

// Cartes de toute une classe : 8 par page A4, prêtes à découper
router.get("/classe", async (req, res) => {
  const { niveau, classe, serie } = req.query;
  if (!niveau || !classe) return res.status(400).json({ error: "Niveau et classe sont requis" });

  const conditions = ["etablissement_id = $1", "niveau = $2", "classe = $3"];
  const params = [req.user.etablissementId, niveau, classe];
  if (serie) { params.push(serie); conditions.push(`serie = $${params.length}`); }

  const r = await query(`SELECT * FROM eleves WHERE ${conditions.join(" AND ")} ORDER BY nom, prenom`, params);
  if (r.rows.length === 0) return res.status(404).json({ error: "Aucun élève dans cette classe" });

  const settings = await getSettingsRaw(req.user.etablissementId);
  const doc = new PDFDocument({ size: "A4", margin: 30 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="cartes_${classe}${serie ? "_" + serie : ""}.pdf"`);
  doc.pipe(res);

  let i = 0;
  for (const eleve of r.rows) {
    const numero = await numeroCarte(req.user.etablissementId, eleve.id);
    const pos = i % 8;
    if (pos === 0 && i > 0) doc.addPage();
    const col = pos % 2, lig = Math.floor(pos / 2);
    dessinerCarte(doc, 40 + col * 260, 40 + lig * 170, { eleve, settings, numero, annee: eleve.annee });
    i++;
  }
  doc.end();
});

module.exports = router;
