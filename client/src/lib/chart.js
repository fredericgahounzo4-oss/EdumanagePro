// Réglages communs des graphiques (Recharts), reliés aux variables CSS pour suivre le thème clair/sombre.
export const tooltipProps = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--text)", fontSize: 12, boxShadow: "var(--shadow)" },
  labelStyle: { color: "var(--text)", fontWeight: 600 },
  itemStyle: { color: "var(--text)" },
  cursor: { fill: "var(--paper-alt)", opacity: 0.6 },
};
export const axisTick = { fill: "var(--text-soft)", fontSize: 11, fontFamily: "var(--font-mono)" };
export const gridStroke = "var(--line-soft)";

export const NIVEAU_COLORS = { Primaire: "var(--brass)", College: "var(--primary)", Lycee: "var(--alert)" };
// Ajourné, Passable, Assez Bien, Bien, Très Bien, Excellent
export const MENTION_COLORS = ["var(--alert)", "var(--brass)", "var(--info)", "var(--success)", "var(--primary)", "var(--brass-light)"];
