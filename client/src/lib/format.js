// Utilitaires de formatage partagés par les nouveaux écrans.

export const JOURS_FR = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

// Date locale au format AAAA-MM-JJ (et non UTC : évite le décalage d'un jour en soirée)
export function dateLocaleISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function jourFrancais(d = new Date()) {
  return JOURS_FR[d.getDay()];
}

export function formatDateLongue(date, locale) {
  return new Date(date).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function formatDateCourte(date, locale) {
  return new Date(date).toLocaleDateString(locale, { day: "2-digit", month: "short" });
}

export function formatMois(aaaaMm, locale) {
  const [a, m] = aaaaMm.split("-").map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString(locale, { month: "short" });
}

export function formatNombre(n, locale, digits = 0) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString(locale, { maximumFractionDigits: digits });
}

export function formatArgent(n, devise, locale) {
  if (n === null || n === undefined) return "—";
  return `${Number(n).toLocaleString(locale, { maximumFractionDigits: 0 })} ${devise || ""}`.trim();
}

// Montant compact pour les cartes KPI : 3 230 000 -> "3,23 M FCFA"
export function formatArgentCompact(n, devise, locale) {
  if (n === null || n === undefined) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${(n / 1e6).toLocaleString(locale, { maximumFractionDigits: 2 })} M ${devise || ""}`.trim();
  if (abs >= 1e4) return `${Math.round(n / 1e3).toLocaleString(locale)} k ${devise || ""}`.trim();
  return formatArgent(n, devise, locale);
}

// "il y a 5 min", "hier"… selon la langue
export function tempsRelatif(date, locale) {
  const diff = (new Date(date).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return new Date(date).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

export function initiales(...parts) {
  return parts.filter(Boolean).map((p) => String(p).trim()[0]).join("").slice(0, 2).toUpperCase() || "?";
}

export function libelleClasse(c) {
  return `${c.Classe}${c.Serie ? " " + c.Serie : ""}`;
}

// "HH:MM" -> minutes depuis minuit
export function enMinutes(hhmm) {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
