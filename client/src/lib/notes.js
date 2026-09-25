// Calcul des notes, identique à celui du serveur (server/lib/calculs.js) : sert à l'aperçu en direct pendant la saisie.
//   moyenne des interros = somme des interros / nombre d'interros donnés (une interro manquée compte pour 0)
//   note de classe       = (moyenne des interros + devoir) / 2
//   note générale        = (note de classe + composition) / 2
//   Primaire             = note directe sur 20
export function moyenneListe(liste) {
  if (!liste || !liste.length) return 0;
  return liste.reduce((a, v) => a + (v === null || v === undefined || !Number.isFinite(Number(v)) ? 0 : Number(v)), 0) / liste.length;
}

export function calculer({ interros = [], devoirs = [], compositions = [], niveau }) {
  const mi = moyenneListe(interros), md = moyenneListe(devoirs), mc = moyenneListe(compositions);
  if (niveau === "Primaire" && devoirs.length === 0 && compositions.length === 0) return { moyInterros: mi, noteClasse: mi, noteGenerale: mi };
  const noteClasse = (mi + md) / 2;
  return { moyInterros: mi, noteClasse, noteGenerale: (noteClasse + mc) / 2 };
}

export const arrondi = (v) => Math.round(Number(v) * 100) / 100;
export const fmt = (v) => (v === "" || v === null || v === undefined || Number.isNaN(Number(v)) ? "—" : String(arrondi(v)).replace(".", ","));

// Valeur saisie -> nombre valide entre 0 et 20, "" (vide) ou NaN (invalide)
export function lireNote(texte) {
  const t = String(texte ?? "").trim().replace(",", ".");
  if (t === "") return "";
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= 20 ? n : NaN;
}
