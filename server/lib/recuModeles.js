// Modèles de reçus de paiement. Le modèle "Standard" reste dans routes/ecolage.js (inchangé).
//   Talon      : reçu à talon (B.P.F., somme en toutes lettres, année scolaire, classe, signatures) — blanc
//   TalonBleu  : même reçu sur papier bleu
const { montantEnLettres } = require("./enLettres");
const { THEMES, texte, paragraphe, cellule, ligneH, fondDePage, dateFR } = require("./pdfUtil");

const milliers = (n) => Math.round(Number(n) || 0).toLocaleString("fr-FR").replace(/[\u202f\u00a0]/g, " ");
const maj1 = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// data : { settings, paiement, eleve, devise, total, cumul }
function buildTalon(doc, data, themeNom = "blanc") {
  const T = THEMES[themeNom] || THEMES.blanc;
  const W = doc.page.width, H = doc.page.height, M = 24;
  const { settings: S, paiement: p, eleve: e, devise } = data;
  fondDePage(doc, T.fond);
  const txt = (s, x, y, w, o = {}) => texte(doc, s, x, y, w, { color: T.texte, ...o });

  doc.lineWidth(1).strokeColor(T.trait).roundedRect(M - 8, M - 8, W - 2 * M + 16, H - 2 * M + 16, 6).stroke(T.trait);

  // ---- En-tête : établissement à gauche, "B.P.F." et montant en chiffres à droite -----------------------------------
  let nx = M;
  if (S.logo && S.logo.length) { try { doc.image(S.logo, M, M, { fit: [46, 46] }); nx = M + 56; } catch { /* logo illisible */ } }
  let y = paragraphe(doc, String(S.nom || "").toUpperCase(), nx, M + 2, 330, { size: 15, font: "Helvetica-Bold", color: T.texte, max: 2 });
  const contact = [S.bp && `${S.bp}`, S.telephone && `Tél. ${S.telephone}`].filter(Boolean).join("   ");
  if (contact) { txt(contact, nx, y + 2, 330, { size: 8.5, font: "Helvetica-Bold" }); y += 12; }
  if (S.adresse || S.ville) txt([S.adresse, S.ville && `${S.ville} - TOGO`].filter(Boolean).join("  "), nx, y + 2, 330, { size: 8.5 });

  txt("B.P.F.", W - M - 132, M + 6, 40, { size: 11, font: "Helvetica-Bold" });
  cellule(doc, W - M - 92, M, 92, 26, `${milliers(p.montant)} F`, { size: 14, font: "Helvetica-Bold", trait: T.trait, lw: 1.2, color: T.texte });

  // ---- Titre : REÇU  N° ------------------------------------------------------------------------------------------------
  const ty = 112;
  txt("REÇU", M + 40, ty, 120, { size: 26, font: "Helvetica-Bold" });
  const numero = String(p.numero_recu || "").replace(/\D/g, "").padStart(7, "0");
  txt("N°", W - M - 220, ty + 8, 24, { size: 13, font: "Helvetica-Bold" });
  txt(numero, W - M - 190, ty + 4, 190, { size: 20, font: "Helvetica-Bold", color: "#B00020" });

  // ---- Corps : valeurs manuscrites simulées sur lignes pointillées -------------------------------------------------
  const ligne = (yy, label, valeur, o = {}) => {
    txt(label, M + 4, yy + 4, 110, { size: 9, font: "Helvetica-Oblique" });
    ligneH(doc, M + 4, W - M - 4, yy + 18, { trait: T.trait, pointille: true, lw: 0.6 });
    if (valeur) txt(valeur, M + 112, yy + 2, W - 2 * M - 120, { size: o.size || 13, font: "Helvetica-Bold", ...o });
  };
  let by = ty + 48;
  ligne(by, "de l'Élève", `${String(e.Nom).toUpperCase()} ${e.Prenom}`, { size: 14 });
  by += 32;
  const lettres = maj1(montantEnLettres(p.montant, devise === "FCFA" ? "francs" : devise));
  ligne(by, "la somme de", lettres, { size: 12.5 });
  by += 32;
  ligne(by, "Pour", `${p.motif || "Écolage"}${p.mode && p.mode !== "Espèces" ? ` (${p.mode})` : ""}`, { size: 12.5 });
  by += 38;
  txt("Année Scolaire", M + 4, by, 90, { size: 9, font: "Helvetica-Oblique" });
  txt(p.annee || e.annee || "", M + 92, by - 2, 110, { size: 12, font: "Helvetica-Bold" });
  ligneH(doc, M + 90, M + 190, by + 12, { trait: T.trait, pointille: true, lw: 0.6 });
  txt("Classe", M + 4, by + 22, 90, { size: 9, font: "Helvetica-Oblique" });
  txt(`${e.classe}${e.serie ? " " + e.serie : ""}`, M + 92, by + 20, 110, { size: 12, font: "Helvetica-Bold" });
  ligneH(doc, M + 90, M + 190, by + 34, { trait: T.trait, pointille: true, lw: 0.6 });

  // Date et lieu, à droite
  txt(`${S.ville || ""}${S.ville ? ", le " : "Le "}${dateFR(new Date(p.date_paiement))}`, W - M - 250, by + 8, 250, { size: 11, font: "Helvetica-Bold", align: "right" });

  // ---- Signatures -------------------------------------------------------------------------------------------------
  const sy = by + 56;
  txt("Le Caissier", M + 20, sy, 160, { size: 10, font: "Helvetica-Bold" });
  txt(p.encaisse_par || "", M + 20, sy + 44, 200, { size: 8.5, font: "Helvetica-Oblique" });
  txt(S.titre_direction || "Le Directeur", W - M - 210, sy, 190, { size: 10, font: "Helvetica-Bold", align: "right" });
  txt(S.nom_direction || "", W - M - 230, sy + 44, 210, { size: 8.5, font: "Helvetica-Oblique", align: "right" });

  // ---- Situation de l'élève (petit, au pied du reçu) ------------------------------------------------------------------------
  if (data.total > 0) {
    const reste = Math.max(0, data.total - data.cumul);
    txt(`Écolage : ${milliers(data.total)} ${devise}   —   Cumul versé : ${milliers(data.cumul)} ${devise}   —   Reste à payer : ${milliers(reste)} ${devise}`, M, H - M - 8, W - 2 * M, { size: 7.5, align: "center" });
  }
}

module.exports = {
  RECU_MODELES: { Talon: (d, x) => buildTalon(d, x, "blanc"), TalonBleu: (d, x) => buildTalon(d, x, "bleu") },
};
