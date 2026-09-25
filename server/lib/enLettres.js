// Nombres écrits en toutes lettres, en français, comme sur les bulletins papier : trait d'union dans les dizaines
// ("quatre-vingt-dix-huit"), espaces entre les centaines et les milliers ("deux cent cinquante-quatre").
// Sert aux bulletins ("neuf virgule dix") et aux reçus ("cinq mille francs").

const UNITES = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze",
  "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
const DIZAINES = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

// n entre 0 et 99. `pluriel` : le "vingts" de quatre-vingts prend son s seulement s'il termine le nombre.
function sousCent(n, pluriel) {
  if (n < 20) return UNITES[n];
  const d = Math.floor(n / 10), u = n % 10;
  if (d <= 6) {
    if (u === 0) return DIZAINES[d];
    if (u === 1) return `${DIZAINES[d]} et un`;
    return `${DIZAINES[d]}-${UNITES[u]}`;
  }
  if (d === 7) return u === 1 ? "soixante et onze" : `soixante-${UNITES[10 + u]}`;
  if (d === 8) return u === 0 ? (pluriel ? "quatre-vingts" : "quatre-vingt") : `quatre-vingt-${UNITES[u]}`;
  return `quatre-vingt-${UNITES[10 + u]}`; // 90-99
}

// n entre 1 et 999
function sousMille(n, pluriel) {
  const c = Math.floor(n / 100), r = n % 100;
  let out = "";
  if (c === 1) out = "cent";
  else if (c > 1) out = `${UNITES[c]} cent${r === 0 && pluriel ? "s" : ""}`;
  if (r === 0) return out;
  return out ? `${out} ${sousCent(r, pluriel)}` : sousCent(r, pluriel);
}

// Entier positif ou nul, jusqu'à 999 999 999 999
function nombreEnLettres(n) {
  n = Math.floor(Math.abs(Number(n)) || 0);
  if (n === 0) return "zéro";
  const milliards = Math.floor(n / 1e9);
  const millions = Math.floor((n % 1e9) / 1e6);
  const milliers = Math.floor((n % 1e6) / 1e3);
  const reste = n % 1e3;
  const parts = [];
  if (milliards) parts.push(`${sousMille(milliards, true)} milliard${milliards > 1 ? "s" : ""}`);
  if (millions) parts.push(`${sousMille(millions, true)} million${millions > 1 ? "s" : ""}`);
  if (milliers) parts.push(milliers === 1 ? "mille" : `${sousMille(milliers, false)} mille`); // "quatre-vingt mille", "deux-cent-mille"
  if (reste) parts.push(sousMille(reste, true));
  return parts.join(" ");
}

// Montant d'argent : "cinq mille francs" (le nom de la monnaie est libre)
function montantEnLettres(montant, monnaie = "francs") {
  const n = Math.round(Number(montant) || 0);
  const mot = n > 1 ? monnaie : monnaie.replace(/s$/, "");
  return `${nombreEnLettres(n)} ${mot}`;
}

// Moyenne / note avec décimales : 9.1 -> "neuf virgule dix", 11.98 -> "onze virgule quatre-vingt-dix-huit",
// 254 -> "deux cent cinquante-quatre" (les décimales nulles ne sont pas lues)
function moyenneEnLettres(valeur, decimales = 2) {
  const v = Math.abs(Number(valeur) || 0);
  const txt = v.toFixed(decimales);
  const [entier, dec = ""] = txt.split(".");
  const partieEntiere = nombreEnLettres(Number(entier));
  if (!dec || /^0+$/.test(dec)) return partieEntiere;
  const partieDec = dec.startsWith("0") ? `zéro ${nombreEnLettres(Number(dec.replace(/^0+/, "")))}` : nombreEnLettres(Number(dec));
  return `${partieEntiere} virgule ${partieDec}`;
}

module.exports = { nombreEnLettres, montantEnLettres, moyenneEnLettres };
