// Modèles de bulletins reproduisant les bulletins papier des établissements togolais.
// Chaque modèle dessine UNE page pour un élève à partir du contexte calculé par lib/bulletinData.js.
//   Vogan      : paysage, matières groupées (littéraires / scientifiques / facultatives), rappel des semestres
//   Baguida    : portrait, notes de classe, points obtenus, conduite, observations du conseil
//   Reussite   : portrait, trimestriel, relevés de discipline, avertissement / blâme
const { moyenneEnLettres } = require("./enLettres");
const { THEMES, fr2, pad2, dateFR, texte, lignes, paragraphe, cellule, ligneH, fondDePage, periodeEnLettres, nomPeriode, rangTexte } = require("./pdfUtil");

const NUM = (v) => (v === null || v === undefined ? "" : fr2(v));
const coefTxt = (c) => pad2(Number(c));
const cycle = (niveau) => (niveau === "College" ? "1er CYCLE" : niveau === "Lycee" ? "2e CYCLE" : "");
const classeLibelle = (e) => `${String(e.Classe).toUpperCase()}${e.Serie ? " " + e.Serie : ""}`;

// Bloc "stats" d'une période : RANG : 5e / 51   Moy.mini : ...
function statsTexte(rang, effectif, stats) {
  const s = stats || {};
  return `RANG : ${rangTexte(rang) || "-"} / ${effectif}   Moy.mini : ${NUM(s.min)}   Moy.maxi : ${NUM(s.max)}   Moy. de la classe : ${NUM(s.moyenne)} / 20`;
}

// ============================================================================================
// VOGAN — A4 paysage
// ============================================================================================
function buildVogan(doc, ctx, themeNom = "blanc") {
  const T = THEMES[themeNom] || THEMES.blanc;
  const W = doc.page.width, H = doc.page.height, M = 22, CW = W - 2 * M;
  const S = ctx.settings, e = ctx.eleve;
  fondDePage(doc, T.fond);
  const txt = (s, x, y, w, o = {}) => texte(doc, s, x, y, w, { color: T.texte, ...o });
  const periodeMot = nomPeriode(ctx.periode);

  // ---- En-tête -------------------------------------------------------------------------
  let y = paragraphe(doc, (S.ministere || "").toUpperCase(), M, M, 300, { size: 8, font: "Helvetica-Bold", color: T.texte, max: 2 });
  if (S.direction_regionale) { txt(String(S.direction_regionale).toUpperCase(), M, y + 4, 300, { size: 11, font: "Helvetica-Bold" }); y += 18; }
  if (S.iesg) { txt(String(S.iesg).toUpperCase(), M, y + 2, 300, { size: 9, font: "Helvetica-Bold" }); y += 13; }
  const contact = [String(S.nom || "").toUpperCase(), S.bp && `BP ${S.bp}`, S.telephone && `TEL: ${S.telephone}`].filter(Boolean).join("  ");
  cellule(doc, M, 86, 320, 16, contact, { size: 8, font: "Helvetica-Bold", align: "left", trait: T.trait, color: T.texte });

  if (S.logo && S.logo.length) { try { doc.image(S.logo, 352, 28, { fit: [48, 48] }); } catch { /* logo illisible */ } }
  const bx = 408, bw = 190;
  cellule(doc, bx, M, bw, 24, String(S.nom || "").toUpperCase(), { size: 10, font: "Helvetica-Bold", trait: T.trait, color: T.texte });
  cellule(doc, bx, M + 24, bw, 22, "BULLETIN D'EVALUATION", { size: 9, font: "Helvetica-Bold", trait: T.trait, color: T.texte });
  cellule(doc, bx, M + 46, bw, 22, periodeEnLettres(ctx.periode), { size: 9, font: "Helvetica-Bold", trait: T.trait, color: T.texte });
  cellule(doc, bx + bw, M, 30, 68, "", { trait: T.trait });
  txt(cycle(e.Niveau).split(" ")[0] || "", bx + bw, M + 20, 30, { size: 7.5, font: "Helvetica-Bold", align: "center" });
  txt("CYCLE", bx + bw, M + 32, 30, { size: 6.5, font: "Helvetica-Bold", align: "center" });

  const rx = W - M - 175;
  txt("REPUBLIQUE TOGOLAISE", rx, M, 175, { size: 9.5, font: "Helvetica-Bold", align: "right" });
  txt("Travail - Liberté - Patrie", rx, M + 12, 175, { size: 8.5, font: "Helvetica-Oblique", align: "right" });
  txt(`ANNEE SCOLAIRE : ${e.Annee || ""}`, rx, M + 34, 175, { size: 8.5, font: "Helvetica-Bold" });
  txt(`CLASSE : ${classeLibelle(e)}`, rx, M + 46, 175, { size: 8.5, font: "Helvetica-Bold" });
  txt(`EFFECTIF : ${ctx.effectif}`, rx, M + 58, 175, { size: 8.5, font: "Helvetica-Bold" });

  // ---- Identité --------------------------------------------------------------------------
  const by = 108, bh = 40;
  cellule(doc, M, by, 120, bh, `N° ${pad2(e.Numero || 0).padStart(3, "0")}`, { size: 13, font: "Helvetica-Bold", trait: T.trait, color: T.texte });
  const idW = CW - 120 - 190;
  cellule(doc, M + 120, by, idW, bh, "", { trait: T.trait });
  txt(`NOM : ${String(e.Nom).toUpperCase()}`, M + 128, by + 4, idW - 12, { size: 10.5, font: "Helvetica-Bold" });
  txt(`PRENOMS : ${e.Prenom}`, M + 128, by + 17, idW - 12, { size: 10.5, font: "Helvetica-Bold" });
  if (e.Sexe) txt(`SEXE : ${e.Sexe}${e.Statut ? "     STATUT : " + e.Statut : ""}`, M + 128, by + 29, idW - 12, { size: 8.5, font: "Helvetica-Bold" });
  cellule(doc, W - M - 190, by, 190, bh, "", { trait: T.trait });
  const a = ctx.annuelle;
  const refM = a ? a.moyenne : ctx.moyenne, refR = a ? a.rang : ctx.rangClasse;
  // Une seule période disponible (1er trimestre/semestre de l'année) : « MOY.1er S » plutôt que « MOY. » nu, comme sur vos bulletins
  const abrevPeriode = String(ctx.periode).match(/^(\d(?:er|e))\s*(Trimestre|Semestre)/);
  const labelMoy = a ? "MOY.AN." : abrevPeriode ? `MOY.${abrevPeriode[1]} ${abrevPeriode[2][0]}` : "MOY.";
  txt(`${labelMoy} ${NUM(refM)}`, W - M - 190, by + 6, 190, { size: 13, font: "Helvetica-Bold", align: "center" });
  txt(`Rg : ${rangTexte(refR) || "-"} / ${ctx.effectif}`, W - M - 190, by + 23, 190, { size: 10.5, font: "Helvetica-Bold", align: "center" });

  // ---- Tableau des matières ----------------------------------------------------------------
  const cw = [138, 47, 47, 46, 46, 48, 36, 52, 120, CW - 580];
  const xs = []; let ax = M;
  for (const w of cw) { xs.push(ax); ax += w; }
  const top = by + bh + 8;
  const hd = { size: 7, font: "Helvetica-Bold", trait: T.trait, color: T.texte };
  cellule(doc, xs[0], top, cw[0], 28, "MATIERES", hd);
  cellule(doc, xs[1], top, cw[1] + cw[2] + cw[3], 13, "EVALUATIONS INTERMEDIAIRES", hd);
  cellule(doc, xs[1], top + 13, cw[1], 15, "1ère NOTE", hd);
  cellule(doc, xs[2], top + 13, cw[2], 15, "2ème NOTE", hd);
  cellule(doc, xs[3], top + 13, cw[3], 15, "MOY./20", hd);
  ["COMPO./20", "MOY G./20", "COEF", "MOY. POND."].forEach((t, i) => cellule(doc, xs[4 + i], top, cw[4 + i], 28, t, hd));
  cellule(doc, xs[8], top, cw[8], 28, "RANG..APPREC.", hd);
  cellule(doc, xs[9], top, cw[9], 28, "PROF. ET SIGNATURE", hd);

  // Lignes : (en-tête de groupe) + matières
  const avecGroupes = ctx.groupes.length > 1;
  const rows = [];
  let n = 0;
  for (const g of ctx.groupes) {
    if (avecGroupes) rows.push({ groupe: g });
    for (const l of g.lignes) rows.push({ l, n: ++n });
  }
  const nbPrec = ctx.precedentes.length + (ctx.annuelle ? 1 : 0);
  const pied = 15 + 15 * (1 + nbPrec) + 4 * 13 + 18;
  const yCorps = top + 28, yMax = H - M - pied;
  const rh = Math.max(12, Math.min(19, (yMax - yCorps) / Math.max(rows.length, 1)));
  let ry = yCorps;
  for (const r of rows) {
    if (r.groupe) {
      cellule(doc, M, ry, CW, rh, `${r.groupe.libelle}${r.groupe.moyenne !== null ? `     MOY. : ${NUM(r.groupe.moyenne)} / 20` : ""}`, { size: 7.5, font: "Helvetica-Bold", align: "left", trait: T.trait, color: T.texte });
    } else {
      const l = r.l;
      const vide = !l.aNote;
      const c = (i, s, o = {}) => cellule(doc, xs[i], ry, cw[i], rh, vide ? "" : s, { size: 8, trait: T.trait, color: T.texte, ...o });
      c(0, "", { align: "left" }); txt(`${pad2(r.n)}. ${String(l.matiere).toUpperCase()}`, xs[0] + 3, ry + (rh - 8) / 2 - 0.3, cw[0] - 6, { size: 8 });
      // "1ère NOTE" / "2ème NOTE" : les deux notes d'interrogation telles que saisies par le professeur (et non une
      // moyenne) — conforme à la disposition du bulletin papier. "MOY./20" en est la moyenne.
      c(1, NUM(l.interros?.[0])); c(2, NUM(l.interros?.[1])); c(3, NUM(l.moyInterros)); c(4, NUM(l.composition));
      c(5, NUM(l.noteGenerale), { font: "Helvetica-Bold" }); c(6, coefTxt(l.coefficient)); c(7, NUM(l.noteFinale));
      c(8, l.aNote ? `${rangTexte(l.rang)} - ${l.appreciation}` : "", { align: "left", size: 7.5 });
      cellule(doc, xs[9], ry, cw[9], rh, "", { trait: T.trait });
      if (l.professeur) txt(l.professeur.toUpperCase(), xs[9] + 3, ry + (rh - 7) / 2 - 0.3, cw[9] * 0.5, { size: 7 });
    }
    ry += rh;
  }

  // ---- Totaux et moyennes -------------------------------------------------------------------
  const sc = ctx.moySci !== null ? `Moy. des mat. Scie. : ${NUM(ctx.moySci)}` : "";
  const li = ctx.moyLitt !== null ? `Moy. des mat. Litt. : ${NUM(ctx.moyLitt)}` : "";
  const wLab = cw[0] + cw[1] + cw[2] + cw[3] + cw[4];
  cellule(doc, M, ry, wLab, 15, [sc, li].filter(Boolean).join("     "), { size: 8, align: "left", trait: T.trait, color: T.texte });
  cellule(doc, xs[5], ry, cw[5], 15, "TOTAUX", { size: 8, font: "Helvetica-Bold", trait: T.trait, color: T.texte });
  cellule(doc, xs[6], ry, cw[6], 15, coefTxt(ctx.totalCoef), { size: 8.5, font: "Helvetica-Bold", trait: T.trait, color: T.texte });
  cellule(doc, xs[7], ry, cw[7], 15, NUM(ctx.totalPoints), { size: 8.5, font: "Helvetica-Bold", trait: T.trait, color: T.texte });
  cellule(doc, xs[8], ry, cw[8] + cw[9], 15, "", { trait: T.trait });
  ry += 15;

  const wVal = cw[5] + cw[6] + cw[7], wSt = cw[8] + cw[9];
  const ligneMoy = (label, m, rang, stats, gras = false) => {
    cellule(doc, M, ry, wLab, 15, label, { size: 8.5, font: "Helvetica-Bold", align: "left", trait: T.trait, color: T.texte });
    cellule(doc, xs[5], ry, wVal, 15, NUM(m), { size: 10.5, font: "Helvetica-Bold", trait: T.trait, color: T.texte });
    cellule(doc, xs[8], ry, wSt, 15, statsTexte(rang, ctx.effectif, stats), { size: 7.5, align: "left", trait: T.trait, color: T.texte });
    ry += 15;
  };
  const court = (p) => String(p).replace(/^(\d)e\b/, "$1ème");
  ligneMoy(`Moy.du ${court(ctx.periode)} :`, ctx.moyenne, ctx.rangClasse, ctx.statsPeriode);
  for (const p of ctx.precedentes) ligneMoy(`Moy.du ${court(p.periode)} :`, p.moyenne, p.rang, p.stats);
  if (ctx.annuelle) ligneMoy("MOY. ANNUELLE :", ctx.annuelle.moyenne, ctx.annuelle.rang, ctx.annuelle.stats);

  // ---- Lignes en lettres, conduite, signatures ---------------------------------------------------
  const gauche = 540;
  const ref = ctx.annuelle ? ctx.annuelle.moyenne : ctx.moyenne;
  let yy = ry + 6;
  const ligneTxt = (s) => { txt(s, M, yy, gauche, { size: 8.5, font: "Helvetica-Bold" }); yy += 13; };
  ligneTxt(`TOTAL ${periodeMot === "PERIODE" ? "" : periodeMot.replace(/E$/, "IEL")} : ${moyenneEnLettres(ctx.totalPoints).toUpperCase()}`);
  ligneTxt(`${ctx.annuelle ? "MOY. ANNUELLE" : "MOYENNE"} : ${moyenneEnLettres(ref).toUpperCase()}`);
  const i = ctx.infos;
  ligneTxt(`RETARDS : ${i.retards ?? ""} HEURES     ABSENCES : ${i.absences ?? ""} JOURS.     CONDUITE : ${(i.conduite || "").toUpperCase()}`);
  ligneTxt(`MOY. AN. : ${NUM(ref)}     TRAVAIL : ${(ctx.appreciationGenerale || "").toUpperCase()}`);

  const px = M + gauche + 10, pw = W - M - px;
  const py = ry + 6;
  cellule(doc, px, py, pw, 44, "", { trait: T.trait });
  txt(`${S.ville ? String(S.ville).toUpperCase() : ""}${S.ville ? ", " : ""}LE ${dateFR()}`, px, py + 4, pw, { size: 8, font: "Helvetica-Bold", align: "center" });
  txt((S.titre_direction || "Le Directeur").toUpperCase(), px, py + 15, pw, { size: 8.5, font: "Helvetica-Bold", align: "center" });
  txt(S.nom_direction || "", px, py + 34, pw, { size: 8, align: "center" });
  const hw = pw / 2;
  cellule(doc, px, py + 44, hw, 13, "PROF. TITULAIRE", { size: 7.5, font: "Helvetica-Bold", trait: T.trait, color: T.texte });
  cellule(doc, px + hw, py + 44, hw, 13, "DECISION DU CONSEIL", { size: 7.5, font: "Helvetica-Bold", trait: T.trait, color: T.texte });
  cellule(doc, px, py + 57, hw, 24, "", { trait: T.trait });
  cellule(doc, px + hw, py + 57, hw, 24, "", { trait: T.trait });
  txt(ctx.titulaire || "", px + 2, py + 65, hw - 4, { size: 7.5, align: "center" });
  txt((i.decision || "").toUpperCase(), px + hw + 2, py + 65, hw - 4, { size: 8, font: "Helvetica-Bold", align: "center" });

  txt("Il n'est délivré qu'un seul relevé de notes, au besoin l'élève se fera établir un duplicata.", M, H - M - 8, 520, { size: 7.5, font: "Helvetica-Oblique" });
  if (S.devise_ecole) txt(S.devise_ecole, W - M - 260, H - M - 8, 260, { size: 8, font: "Helvetica-Oblique", align: "right" });
}

// ============================================================================================
// BAGUIDA — A4 portrait, gris
// ============================================================================================
// Format des bulletins Baguida : point décimal ("8.50"), moyennes sur 5 caractères ("09.10")
const pt = (v) => (v === null || v === undefined || v === "" ? "" : Number(v).toFixed(2));
const moyPt = (v) => (v === null || v === undefined || v === "" ? "" : Number(v).toFixed(2).padStart(5, "0"));
// Note de classe compacte : 9 -> "9", 10.5 -> "10.5", 10.25 -> "10.25"
const compact = (v) => (v === null || v === undefined || v === "" ? "" : String(Math.round(Number(v) * 100) / 100));

function periodeMots(p) {
  const m = { "1er": "Premier", "2e": "Deuxième", "3e": "Troisième" };
  const [rang, ...reste] = String(p).split(" ");
  return `${m[rang] || rang} ${reste.join(" ").toLowerCase()}`.trim();
}

function buildBaguida(doc, ctx, themeNom = "gris") {
  const T = THEMES[themeNom] || THEMES.gris;
  const W = doc.page.width, H = doc.page.height, M = 24, CW = W - 2 * M;
  const S = ctx.settings, e = ctx.eleve, i = ctx.infos;
  fondDePage(doc, T.fond);
  const txt = (s, x, y, w, o = {}) => texte(doc, s, x, y, w, { color: T.texte, ...o });

  // ---- En-tête ------------------------------------------------------------------------------------
  let y = paragraphe(doc, (S.ministere || "").toUpperCase(), M, M, 250, { size: 7.5, font: "Helvetica-Bold", align: "center", color: T.texte, max: 2 });
  ligneH(doc, M + 20, M + 230, y + 1, { trait: T.trait, pointille: true }); y += 5;
  if (S.direction_regionale) { txt(String(S.direction_regionale).toUpperCase(), M, y, 250, { size: 7.5, align: "center" }); y += 10; }
  if (S.iesg) { txt(String(S.iesg).toUpperCase(), M, y, 250, { size: 7.5, align: "center" }); y += 10; }
  txt("REPUBLIQUE TOGOLAISE", W - M - 200, M, 200, { size: 9, font: "Helvetica-Bold", align: "right" });
  txt("Travail - Liberté - Patrie", W - M - 200, M + 11, 200, { size: 8, font: "Helvetica-Oblique", align: "right" });

  const y2 = 84;
  let nx = M;
  if (S.logo && S.logo.length) { try { doc.image(S.logo, M, y2, { fit: [52, 52] }); nx = M + 62; } catch { /* logo illisible */ } }
  const wn = W - M - 200 - nx;
  y = paragraphe(doc, String(S.nom || "").toUpperCase(), nx, y2 + 2, wn, { size: 10.5, font: "Helvetica-Bold", align: "center", color: T.texte, max: 2 });
  if (S.ville) { txt(S.ville, nx, y + 3, wn, { size: 8.5, font: "Helvetica-Bold", align: "center" }); y += 12; }
  if (S.telephone) { txt(`Tel: ${S.telephone}`, nx, y + 2, wn, { size: 8, align: "center" }); y += 10; }
  if (S.adresse || S.bp) { txt([S.adresse, S.bp && `BP: ${S.bp}`].filter(Boolean).join("  "), nx, y + 2, wn, { size: 8, align: "center" }); }
  txt(`Année scolaire: ${e.Annee || ""}`, W - M - 200, y2 + 30, 200, { size: 9, font: "Helvetica-Bold", align: "right" });
  txt(periodeEnLettres(ctx.periode), W - M - 200, y2 + 44, 200, { size: 8.5, font: "Helvetica-Bold", align: "right" });

  const ty = 146;
  cellule(doc, (W - 220) / 2, ty, 220, 20, "BULLETIN DE NOTES", { size: 11, font: "Helvetica-Bold", trait: T.trait, lw: 1, color: T.texte });
  txt(`Classe: ${e.Classe}${e.Serie ? " " + e.Serie : ""}          Effectif: ${ctx.effectif}`, M, ty + 25, CW, { size: 8.5, font: "Helvetica-Bold", align: "center" });

  const sy = ty + 42;
  cellule(doc, M, sy, CW, 22, "", { trait: T.trait });
  txt("Nom et Prénom(s) de l'élève:", M + 5, sy + 7, 130, { size: 7.5, font: "Helvetica-Oblique" });
  txt(`${String(e.Nom).toUpperCase()} ${e.Prenom}`, M + 135, sy + 5, CW - 300, { size: 10.5, font: "Helvetica-Bold" });
  if (e.Sexe || e.Statut) txt(`${e.Sexe ? "Sexe: " + e.Sexe : ""}${e.Statut ? "     Statut: " + e.Statut : ""}`, W - M - 160, sy + 7, 155, { size: 9, font: "Helvetica-Bold", align: "right" });

  // ---- Tableau -------------------------------------------------------------------------------------
  const cw = [138, 32, 32, 40, 36, 40, 28, 46, 34, CW - 426];
  const xs = []; let ax = M;
  for (const w of cw) { xs.push(ax); ax += w; }
  const top = sy + 30, hh = 34;
  const hd = { size: 6.8, font: "Helvetica-Bold", trait: T.trait, color: T.texte };
  const entete = (i0, span, lignesTxt) => {
    const w = cw.slice(i0, i0 + span).reduce((a, b) => a + b, 0);
    cellule(doc, xs[i0], top, w, hh, "", hd);
    lignesTxt.forEach((t, k) => txt(t, xs[i0], top + (hh - lignesTxt.length * 8) / 2 + k * 8, w, { size: 6.8, font: "Helvetica-Bold", align: "center" }));
  };
  entete(0, 1, ["Matière / Professeur"]); entete(1, 2, ["Notes de Classe"]); entete(3, 1, ["Moy. de", "Classe"]);
  entete(4, 1, ["Note", "Compo."]); entete(5, 1, ["Moy.", "générale"]); entete(6, 1, ["Coef."]);
  entete(7, 1, ["Points", "obtenus"]); entete(8, 1, ["Rang"]); entete(9, 1, ["Appréciation et signature", "du professeur"]);

  const bas = 236; // place réservée sous le tableau (totaux, synthèse, signatures, pied de page)
  const y0 = top + hh, rh = Math.max(16, Math.min(26, (H - M - bas - y0) / Math.max(ctx.lignes.length, 1)));
  let ry = y0;
  ctx.lignes.forEach((l) => {
    const vide = !l.aNote;
    const c = (k, s, o = {}) => cellule(doc, xs[k], ry, cw[k], rh, vide ? "" : s, { size: 8.5, trait: T.trait, color: T.texte, ...o });
    cellule(doc, xs[0], ry, cw[0], rh, "", { trait: T.trait });
    txt(l.matiere, xs[0] + 3, ry + (l.professeur && rh >= 21 ? 3 : (rh - 8.5) / 2 - 0.3), cw[0] - 6, { size: 8.5, font: "Helvetica-Bold" });
    if (l.professeur && rh >= 21) txt(l.professeur, xs[0] + 3, ry + rh - 10, cw[0] - 6, { size: 6.5, font: "Helvetica-Oblique" });
    c(1, compact(l.moyInterros)); c(2, compact(l.devoir)); c(3, pt(l.noteClasse)); c(4, compact(l.composition));
    c(5, pt(l.noteGenerale), { font: "Helvetica-Bold" }); c(6, String(l.coefficient)); c(7, pt(l.noteFinale)); c(8, rangTexte(l.rang), { size: 8 });
    c(9, l.appreciation, { align: "left", font: "Helvetica-Oblique", size: 8 });
    ry += rh;
  });
  cellule(doc, M, ry, cw.slice(0, 6).reduce((a, b) => a + b, 0), 16, "Totaux :", { size: 8.5, font: "Helvetica-Bold", align: "right", trait: T.trait, color: T.texte });
  cellule(doc, xs[6], ry, cw[6], 16, String(ctx.totalCoef), { size: 8.5, font: "Helvetica-Bold", trait: T.trait, color: T.texte });
  cellule(doc, xs[7], ry, cw[7], 16, pt(ctx.totalPoints), { size: 8.5, font: "Helvetica-Bold", trait: T.trait, color: T.texte });
  cellule(doc, xs[8], ry, cw[8] + cw[9], 16, "", { trait: T.trait });
  ry += 24;

  // ---- Synthèse : moyennes (gauche), conduite et décisions (droite) -----------------------------------------
  const gw = 292, dx = M + gw + 8, dw = CW - gw - 8;
  const barre = (x, yb, w, s) => cellule(doc, x, yb, w, 14, s, { size: 8, font: "Helvetica-Bold", trait: T.trait, color: T.texte });
  let gy = ry;
  const blocMoyenne = (titre, m, rang, stats, avecStats) => {
    if (titre) txt(titre, M + 4, gy + 3, gw - 8, { size: 8.5, font: "Helvetica-Bold" });
    txt(`Moyenne: ${moyPt(m)}      Rang: ${rangTexte(rang) || "-"}`, M + 4, gy + (titre ? 15 : 3), gw - 8, { size: 9.5, font: "Helvetica-Bold" });
    if (m !== null && m !== undefined) txt(moyenneEnLettres(m), M + 4, gy + (titre ? 28 : 16), gw - 8, { size: 7.5, font: "Helvetica-Oblique" });
    if (avecStats && stats) txt(`Moy min: ${moyPt(stats.min)}   Moy max: ${moyPt(stats.max)}   Moy classe: ${moyPt(stats.moyenne)}`, M + 4, gy + 38, gw - 8, { size: 7 });
    gy += avecStats ? 50 : (titre ? 40 : 28);
  };
  const gauche0 = gy;
  blocMoyenne(`Moyenne du ${periodeMots(ctx.periode)}`, ctx.moyenne, ctx.rangClasse, ctx.statsPeriode, true);
  if (ctx.precedentes.length || ctx.annuelle) {
    barre(M, gy, gw, "RAPPEL DES MOYENNES"); gy += 16;
    for (const p of ctx.precedentes) blocMoyenne(`Moyenne du ${periodeMots(p.periode)}`, p.moyenne, p.rang, p.stats, false);
  }
  if (ctx.annuelle) { barre(M, gy, gw, "MOYENNE ANNUELLE"); gy += 16; blocMoyenne("", ctx.annuelle.moyenne, ctx.annuelle.rang, ctx.annuelle.stats, false); }
  cellule(doc, M, gauche0 - 2, gw, gy - gauche0 + 4, "", { trait: T.trait });

  let dy = ry;
  txt("Conduite:", dx + 4, dy + 2, dw - 8, { size: 8.5, font: "Helvetica-Bold" });
  txt(`Retards : ${i.retards ?? ""}`, dx + 4, dy + 15, dw / 2, { size: 8 }); txt(`Absences : ${i.absences ?? ""}`, dx + dw / 2, dy + 15, dw / 2 - 4, { size: 8 });
  txt(`Appréciation : ${i.appreciation || i.conduite || ""}`, dx + 4, dy + 28, dw - 8, { size: 8 });
  txt(`Distinction(s) particulière(s) : ${i.distinction || ""}`, dx + 4, dy + 41, dw - 8, { size: 8 });
  dy += 58;
  barre(dx, dy, dw, "Observations et décisions du Conseil"); dy += 14;
  const hobs = Math.max(60, gy - dy + 2);
  cellule(doc, dx, dy, dw, hobs, "", { trait: T.trait });
  if (i.decision) txt(i.decision, dx + 4, dy + hobs / 2 - 8, dw - 8, { size: 11, font: "Helvetica-Bold", align: "center", color: "#B00020" });
  if (i.observations) paragraphe(doc, i.observations, dx + 5, dy + 4, dw - 10, { size: 8, color: T.texte, max: 4 });
  cellule(doc, dx, ry, dw, dy - ry, "", { trait: T.trait });

  // ---- Signatures --------------------------------------------------------------------------------------------
  const sgy = Math.max(gy, dy + hobs) + 12;
  txt(`Fait à ${S.ville || "..........."} le ${dateFR()}`, M, sgy, 260, { size: 8.5, font: "Helvetica-Bold" });
  txt("Le Titulaire", M + 10, sgy + 18, 200, { size: 8.5, font: "Helvetica-Bold" });
  txt(ctx.titulaire || "", M + 10, sgy + 48, 220, { size: 8.5, font: "Helvetica-Bold" });
  txt(S.titre_direction || "Le Directeur", W - M - 210, sgy + 18, 200, { size: 8.5, font: "Helvetica-Bold", align: "right" });
  txt(S.nom_direction || "", W - M - 230, sgy + 48, 220, { size: 8.5, font: "Helvetica-Bold", align: "right" });
  txt("NB: Il n'est délivré qu'un seul bulletin.", W - M - 320, H - M - 6, 320, { size: 7.5, font: "Helvetica-BoldOblique", align: "right" });
}

// ============================================================================================
// LA RÉUSSITE — A4 portrait, trimestriel, bleu
// ============================================================================================
function buildReussite(doc, ctx, themeNom = "bleu") {
  const T = THEMES[themeNom] || THEMES.bleu;
  const W = doc.page.width, H = doc.page.height, M = 24, CW = W - 2 * M;
  const S = ctx.settings, e = ctx.eleve, i = ctx.infos;
  fondDePage(doc, T.fond);
  const txt = (s, x, y, w, o = {}) => texte(doc, s, x, y, w, { color: T.texte, ...o });

  // ---- En-tête ------------------------------------------------------------------------------------
  let y = paragraphe(doc, (S.ministere || "").toUpperCase(), M, M, 230, { size: 6.5, color: T.texte, max: 3 });
  if (S.iesg) { txt(String(S.iesg).toUpperCase(), M, y + 4, 230, { size: 8, font: "Helvetica-Bold" }); }
  txt("REPUBLIQUE TOGOLAISE", W - M - 200, M, 200, { size: 8.5, font: "Helvetica-Bold", align: "right" });
  txt("Travail - Liberté - Patrie", W - M - 200, M + 11, 200, { size: 7.5, font: "Helvetica-Oblique", align: "right" });
  if (S.logo && S.logo.length) { try { doc.image(S.logo, (W - 44) / 2, M - 4, { fit: [44, 44] }); } catch { /* logo illisible */ } }

  txt(String(S.nom || "").toUpperCase(), M, 74, CW, { size: 13, font: "Helvetica-Bold", align: "center" });
  const contact = [S.adresse, S.bp && `BP ${S.bp}`, S.telephone && `Tél: ${S.telephone}`].filter(Boolean).join("  —  ");
  if (contact) txt(contact, M, 91, CW, { size: 8, font: "Helvetica-Oblique", align: "center" });
  txt("BULLETIN D'EVALUATION", M, 108, CW, { size: 14, font: "Helvetica-Bold", align: "center" });
  txt(`${String(ctx.periode).replace(/^(\d)e\b/, "$1ème").toUpperCase()}  /  ANNEE ${e.Annee || ""}`, M, 126, CW, { size: 9, font: "Helvetica-Bold", align: "center" });

  // ---- Identité --------------------------------------------------------------------------------------
  const iy = 142;
  cellule(doc, M, iy, CW, 30, "", { trait: T.trait, lw: 0.9 });
  txt("de l'Élève", M + 5, iy + 5, 60, { size: 7, font: "Helvetica-Oblique" });
  txt(`${String(e.Nom).toUpperCase()} ${e.Prenom}`, M + 5, iy + 15, CW - 250, { size: 11, font: "Helvetica-Bold" });
  // Sexe : la lettre de l'élève est cochée (case pleine), l'autre reste vide
  ["G", "F"].forEach((s, k) => {
    const bx = W - M - 232 + k * 30, coche = e.Sexe === (s === "G" ? "M" : "F");
    cellule(doc, bx, iy + 5, 22, 20, s, { size: 11, font: coche ? "Helvetica-Bold" : "Helvetica", fill: coche ? T.entete : null, trait: T.trait, lw: coche ? 1.4 : 0.6, color: T.texte });
  });
  txt(`CLASSE : ${e.Classe}${e.Serie ? " " + e.Serie : ""}`, W - M - 165, iy + 5, 160, { size: 9, font: "Helvetica-Bold" });
  txt(`EFFECTIF : ${ctx.effectif}`, W - M - 165, iy + 17, 160, { size: 9, font: "Helvetica-Bold" });

  // ---- Tableau --------------------------------------------------------------------------------------------
  const cw = [150, 28, 34, 34, 38, 30, 96, 80, CW - 490];
  const xs = []; let ax = M;
  for (const w of cw) { xs.push(ax); ax += w; }
  const top = iy + 38, hh = 24;
  const hd = { size: 6.8, font: "Helvetica-Bold", trait: T.trait, color: T.texte };
  [["MATIERES"], ["Coef"], ["Classe"], ["Compo"], ["Moy Trim"], ["Rang"], ["NOM DES", "PROFESSEURS"], ["APPRECIATION DES", "PROFESSEURS"], ["Signature"]].forEach((t, k) => {
    cellule(doc, xs[k], top, cw[k], hh, "", hd);
    t.forEach((ligne, n) => txt(ligne, xs[k], top + (hh - t.length * 8) / 2 + n * 8, cw[k], { size: 6.8, font: "Helvetica-Bold", align: "center" }));
  });
  const bas = 292;
  const y0 = top + hh, rh = Math.max(14, Math.min(24, (H - M - bas - y0) / Math.max(ctx.lignes.length, 1)));
  let ry = y0;
  ctx.lignes.forEach((l) => {
    const vide = !l.aNote;
    const c = (k, s, o = {}) => cellule(doc, xs[k], ry, cw[k], rh, vide ? "" : s, { size: 8.5, trait: T.trait, color: T.texte, ...o });
    cellule(doc, xs[0], ry, cw[0], rh, l.matiere, { size: 8.5, align: "left", trait: T.trait, color: T.texte });
    c(1, String(l.coefficient)); c(2, NUM(l.noteClasse)); c(3, NUM(l.composition)); c(4, NUM(l.noteGenerale), { font: "Helvetica-Bold" }); c(5, rangTexte(l.rang), { size: 8 });
    cellule(doc, xs[6], ry, cw[6], rh, l.professeur, { size: 7.5, align: "left", trait: T.trait, color: T.texte });
    c(7, l.appreciation, { size: 7.5, font: "Helvetica-Oblique" }); cellule(doc, xs[8], ry, cw[8], rh, "", { trait: T.trait });
    ry += rh;
  });
  cellule(doc, M, ry, cw[0], 16, "TOTAUX", { size: 8.5, font: "Helvetica-Bold", trait: T.trait, color: T.texte });
  cellule(doc, xs[1], ry, cw[1], 16, String(ctx.totalCoef), { size: 8.5, font: "Helvetica-Bold", trait: T.trait, color: T.texte });
  cellule(doc, xs[2], ry, CW - cw[0] - cw[1], 16, NUM(ctx.totalPoints), { size: 8.5, font: "Helvetica-Bold", align: "left", trait: T.trait, color: T.texte });
  ry += 22;

  // ---- Trois blocs : relevés | moyennes | classe --------------------------------------------------------------------
  const bh = 128, w1 = 176, w2 = 210, w3 = CW - w1 - w2;
  const barre = (x, yb, w, s) => cellule(doc, x, yb, w, 13, s, { size: 7.5, font: "Helvetica-Bold", trait: T.trait, color: T.texte });
  cellule(doc, M, ry, w1, bh, "", { trait: T.trait });
  const rel = [["Retards", i.retards], ["Absences", i.absences], ["Punitions", i.punitions], ["Exclusion", i.exclusion],
    ["Félicitations", i.felicitations ? "X" : ""], ["Encouragements", i.encouragements ? "X" : ""], ["Tableau d'honneur", i.tableauHonneur ? "X" : ""]];
  rel.forEach(([k, v], n) => {
    txt(k, M + 5, ry + 4 + n * 10.5, 100, { size: 7.5 });
    ligneH(doc, M + 78, M + w1 - 30, ry + 12 + n * 10.5, { trait: T.trait, pointille: true, lw: 0.4 });
    txt(v === null || v === undefined ? "" : String(v), M + w1 - 28, ry + 4 + n * 10.5, 24, { size: 8, font: "Helvetica-Bold", align: "center" });
  });
  barre(M, ry + 80, w1, "MOYENNE DU TRIMESTRE");
  txt(`Chiffres : ${NUM(ctx.moyenne)}`, M + 5, ry + 96, w1 - 10, { size: 9, font: "Helvetica-Bold" });
  if (ctx.moyenne !== null) paragraphe(doc, `Lettres : ${moyenneEnLettres(ctx.moyenne)}`, M + 5, ry + 108, w1 - 10, { size: 7.5, font: "Helvetica-Oblique", color: T.texte, max: 2 });

  const x2 = M + w1;
  cellule(doc, x2, ry, w2, bh, "", { trait: T.trait });
  const trim = (nom, p) => {
    const rec = p || { moyenne: null, rang: null };
    return [nom, rec.moyenne, rec.rang];
  };
  const lignesTrim = ["1er Trimestre", "2e Trimestre", "3e Trimestre"].map((nom) => {
    if (nom === ctx.periode) return [nom, ctx.moyenne, ctx.rangClasse];
    const p = ctx.precedentes.find((x) => x.periode === nom);
    return trim(nom, p);
  });
  lignesTrim.forEach(([nom, m, r], n) => {
    txt(`Moy du ${String(nom).replace(/^(\d)e\b/, "$1ème")}`, x2 + 5, ry + 5 + n * 15, 110, { size: 7.5 });
    txt(m === null ? "" : NUM(m), x2 + 105, ry + 5 + n * 15, 40, { size: 8.5, font: "Helvetica-Bold" });
    txt(r ? `Rang ${rangTexte(r)} sur ${ctx.effectif}` : "", x2 + 138, ry + 5 + n * 15, w2 - 142, { size: 7 });
  });
  barre(x2, ry + 52, w2, "Moyenne annuelle");
  txt(ctx.annuelle ? NUM(ctx.annuelle.moyenne) : "", x2 + 5, ry + 70, 60, { size: 10, font: "Helvetica-Bold" });
  txt(ctx.annuelle && ctx.annuelle.rang ? `Rang ${rangTexte(ctx.annuelle.rang)} sur ${ctx.effectif}` : "", x2 + 70, ry + 72, w2 - 74, { size: 8 });
  if (ctx.annuelle) paragraphe(doc, `(en lettres) ${moyenneEnLettres(ctx.annuelle.moyenne)}`, x2 + 5, ry + 90, w2 - 10, { size: 7.5, font: "Helvetica-Oblique", color: T.texte, max: 2 });

  const x3 = x2 + w2, st = ctx.statsPeriode || {};
  cellule(doc, x3, ry, w3, bh, "", { trait: T.trait });
  barre(x3, ry, w3, "MOYENNE DE CLASSE");
  txt(NUM(st.moyenne), x3, ry + 20, w3, { size: 15, font: "Helvetica-Bold", align: "center" });
  txt("La plus forte", x3 + 5, ry + 52, w3 - 10, { size: 7.5 }); txt(`${NUM(st.max)} sur 20`, x3 + 5, ry + 63, w3 - 10, { size: 9, font: "Helvetica-Bold" });
  txt("La plus faible", x3 + 5, ry + 82, w3 - 10, { size: 7.5 }); txt(`${NUM(st.min)} sur 20`, x3 + 5, ry + 93, w3 - 10, { size: 9, font: "Helvetica-Bold" });
  ry += bh + 8;

  // ---- Avertissement / blâme et observations du conseil --------------------------------------------------------------
  const oh = 96, wl = 190;
  cellule(doc, M, ry, wl, oh, "", { trait: T.trait });
  const cases = (yy, titre, val) => {
    txt(titre, M + 5, yy, 80, { size: 8, font: "Helvetica-Bold" });
    [["Travail", "Travail"], ["Discipline", "Discipline"]].forEach(([lib, cle], k) => {
      cellule(doc, M + 82, yy - 1 + k * 13, 10, 10, val === cle ? "X" : "", { size: 8, font: "Helvetica-Bold", trait: T.trait, color: T.texte, pad: 0 });
      txt(lib, M + 96, yy + k * 13, 80, { size: 7.5 });
    });
  };
  cases(ry + 6, "AVERTISSEMENT", i.avertissement); cases(ry + 38, "BLAME", i.blame);
  txt("Nom et Sign. du Titulaire", M + 5, ry + 70, wl - 10, { size: 7.5, font: "Helvetica-Bold" });
  txt(ctx.titulaire || "", M + 5, ry + 82, wl - 10, { size: 8, font: "Helvetica-Oblique" });
  const ox = M + wl + 6, ow = CW - wl - 6;
  cellule(doc, ox, ry, ow, oh, "", { trait: T.trait });
  barre(ox, ry, ow, "OBSERVATIONS GENERALES DU CONSEIL");
  let oy = ry + 18;
  if (i.decision) { txt(i.decision, ox + 6, oy, ow - 12, { size: 10, font: "Helvetica-Bold", color: "#B00020" }); oy += 16; }
  if (i.observations) paragraphe(doc, i.observations, ox + 6, oy, ow - 12, { size: 8.5, color: T.texte, max: 3 });
  ry += oh + 10;
  txt(`${S.ville || "..........."}, le ${dateFR()}`, ox, ry, ow, { size: 8.5, font: "Helvetica-Bold", align: "right" });
  txt(S.titre_direction || "Le Directeur", ox, ry + 14, ow, { size: 9, font: "Helvetica-Bold", align: "right" });
  txt(S.nom_direction || "", ox, ry + 40, ow, { size: 8.5, align: "right" });
  if (S.devise_ecole) txt(S.devise_ecole, M, H - M - 6, CW, { size: 7.5, font: "Helvetica-Oblique", align: "center" });
}

module.exports = {
  buildVogan, buildBaguida, buildReussite, periodeMots,
  MODELES_PAPIER: {
    Vogan: (d, c) => buildVogan(d, c, "blanc"),
    VoganBleu: (d, c) => buildVogan(d, c, "bleu"),
    Baguida: (d, c) => buildBaguida(d, c, "gris"),
    Reussite: (d, c) => buildReussite(d, c, "bleu"),
    ReussiteBlanc: (d, c) => buildReussite(d, c, "blanc") },
  // Format de page de chaque modèle (le reste de la mise en page en dépend)
  FORMAT_PAPIER: { Vogan: "paysage", VoganBleu: "paysage", Baguida: "portrait", Reussite: "portrait", ReussiteBlanc: "portrait" } };
