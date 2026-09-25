// Données de référence : niveaux, classes, séries, mentions
// (Module 2 du cahier des charges — les matières sont gérées dynamiquement,
// voir lib/matieres.js et lib/matieresSeed.js)

const NIVEAUX = {
  Primaire: ["CP1", "CP2", "CE1", "CE2", "CM1", "CM2"],
  College: ["6ème", "5ème", "4ème", "3ème"],
  Lycee: ["Seconde", "Première", "Terminale"],
};

const SERIES = {
  general: ["A4", "C", "D", "S"],
  technique: ["G1", "G2", "G3", "G4", "F1", "F2", "F3", "F4"],
};

const ALL_SERIES = [...SERIES.general, ...SERIES.technique];

const MENTIONS = [
  { min: 0, max: 8, label: "Ajourné" },
  { min: 8, max: 10, label: "Passable" },
  { min: 10, max: 12, label: "Assez Bien" },
  { min: 12, max: 14, label: "Bien" },
  { min: 14, max: 16, label: "Très Bien" },
  { min: 16, max: 20.01, label: "Excellent" },
];

function getMention(moyenne) {
  const m = MENTIONS.find((x) => moyenne >= x.min && moyenne < x.max);
  return m ? m.label : "Ajourné";
}

module.exports = { NIVEAUX, SERIES, ALL_SERIES, MENTIONS, getMention };
