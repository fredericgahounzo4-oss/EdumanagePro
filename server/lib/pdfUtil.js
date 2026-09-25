// Petits outils de mise en page PDF (pdfkit), partagés par les modèles de bulletins et de reçus.
// Règles : tout est positionné explicitement (x, y, largeur) et le texte est ajusté à sa case AVANT de l'écrire,
// pour ne jamais déborder ni déclencher de saut de page automatique.

const THEMES = {
  gris:  { fond: null,      trait: "#222222", entete: "#E3E3E3", doux: "#F4F4F4", texte: "#111111" },
  blanc: { fond: null,      trait: "#1B1B1B", entete: "#ECECEC", doux: "#F7F7F7", texte: "#111111" },
  bleu:  { fond: "#CFE0F4", trait: "#1B2F66", entete: "#B7CDEB", doux: "#DCE8F7", texte: "#14275C" },
};

const fr2 = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? "" : Number(v).toFixed(2).replace(".", ","));
const pad2 = (n) => String(n).padStart(2, "0");

function dateFR(d = new Date()) {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Tronque avec "…" pour tenir dans la largeur (police et taille courantes du document)
function ajuster(doc, str, w) {
  str = String(str ?? "");
  if (doc.widthOfString(str) <= w) return str;
  while (str.length > 1 && doc.widthOfString(str + "…") > w) str = str.slice(0, -1);
  return str + "…";
}

// Écrit une ligne de texte dans une largeur donnée
function texte(doc, str, x, y, w, { size = 9, font = "Helvetica", align = "left", color = "#111", ajustee = true } = {}) {
  doc.font(font).fontSize(size).fillColor(color);
  const s = ajustee ? ajuster(doc, str, w) : String(str ?? "");
  doc.text(s, x, y, { width: w, align, lineBreak: false });
}

// Coupe un texte en lignes qui tiennent dans une largeur
function lignes(doc, str, w, { size = 9, font = "Helvetica" } = {}) {
  doc.font(font).fontSize(size);
  const out = [];
  for (const par of String(str ?? "").split("\n")) {
    let cur = "";
    for (const mot of par.split(/\s+/).filter(Boolean)) {
      const t = cur ? `${cur} ${mot}` : mot;
      if (!cur || doc.widthOfString(t) <= w) cur = t; else { out.push(cur); cur = mot; }
    }
    out.push(cur);
  }
  return out;
}

// Paragraphe sur plusieurs lignes ; renvoie l'ordonnée suivante
function paragraphe(doc, str, x, y, w, { size = 9, font = "Helvetica", align = "left", color = "#111", interligne = 1.25, max = 99 } = {}) {
  const ls = lignes(doc, str, w, { size, font }).slice(0, max);
  ls.forEach((l, i) => texte(doc, l, x, y + i * size * interligne, w, { size, font, align, color, ajustee: false }));
  return y + ls.length * size * interligne;
}

// Case : fond, bordure, texte centré verticalement
function cellule(doc, x, y, w, h, str, { size = 8.5, font = "Helvetica", align = "center", color = "#111", fill = null, trait = "#222", lw = 0.6, bord = true, pad = 3 } = {}) {
  if (fill || bord) {
    doc.lineWidth(lw).strokeColor(trait);
    doc.rect(x, y, w, h);
    if (fill && bord) doc.fillAndStroke(fill, trait); else if (fill) doc.fill(fill); else doc.stroke(trait);
  }
  if (str !== "" && str !== null && str !== undefined) {
    texte(doc, str, x + pad, y + (h - size) / 2 - 0.3, w - 2 * pad, { size, font, align, color });
  }
}

function ligneH(doc, x1, x2, y, { trait = "#222", lw = 0.6, pointille = false } = {}) {
  doc.lineWidth(lw).strokeColor(trait);
  if (pointille) doc.dash(1, { space: 2 });
  doc.moveTo(x1, y).lineTo(x2, y).stroke(trait);
  if (pointille) doc.undash();
}

function fondDePage(doc, couleur) {
  if (couleur) doc.rect(0, 0, doc.page.width, doc.page.height).fill(couleur);
}

// Libellés de période en toutes lettres : "2e Semestre" -> "DEUXIEME SEMESTRE"
function periodeEnLettres(p) {
  const m = { "1er": "PREMIER", "2e": "DEUXIEME", "3e": "TROISIEME" };
  const [rang, ...reste] = String(p).split(" ");
  return `${m[rang] || rang.toUpperCase()} ${reste.join(" ").toUpperCase()}`.trim();
}
const nomPeriode = (p) => (/semestre/i.test(p) ? "SEMESTRE" : /trimestre/i.test(p) ? "TRIMESTRE" : "PERIODE");

// "1er" / "5e" / "3e ex"
function rangTexte(r) {
  if (!r) return "";
  return `${r.n === 1 ? "1er" : r.n + "e"}${r.ex ? " ex" : ""}`;
}

module.exports = { THEMES, fr2, pad2, dateFR, ajuster, texte, lignes, paragraphe, cellule, ligneH, fondDePage, periodeEnLettres, nomPeriode, rangTexte };
