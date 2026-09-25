// Catalogue par défaut des matières, utilisé pour préremplir la feuille "Matieres"
// au premier démarrage. L'administrateur peut ensuite ajouter/supprimer des matières
// depuis l'interface (menu "Matières"), avec leur propre coefficient.
//
// Pour le Lycée, les matières sont définies par SÉRIE (Classe = "" = s'applique à
// Seconde, Première ET Terminale de cette série — la Seconde a bien des séries
// comme les autres classes du Lycée : A4, S (regroupant C/D), G1-G4, F1-F4, etc.)

const COEF_SCIENTIFIQUE = 4;
const COEF_LITTERAIRE = 3;
const COEF_OPTION = 1;

const MATIERES_LYCEE = {
  D: {
    Scientifiques: ["Mathématiques", "Physique-Chimie", "SVT"],
    Littéraires: ["Français", "Anglais", "Histoire-Géographie", "Philosophie"],
    "Non obligatoires": ["EPS", "Informatique"],
  },
  C: {
    Scientifiques: ["Mathématiques", "Physique-Chimie", "SVT"],
    Littéraires: ["Français", "Anglais", "Histoire-Géographie", "Philosophie"],
    "Non obligatoires": ["EPS", "Informatique"],
  },
  S: {
    Scientifiques: ["Mathématiques", "Physique-Chimie", "SVT"],
    Littéraires: ["Français", "Anglais", "Histoire-Géographie", "Philosophie"],
    "Non obligatoires": ["EPS", "Informatique"],
  },
  A4: {
    Scientifiques: ["Mathématiques", "Physique-Chimie", "SVT"],
    Littéraires: ["Français", "Anglais", "Histoire-Géographie", "Philosophie", "Allemand"],
    "Non obligatoires": ["EPS", "Informatique"],
  },
  G1: {
    Scientifiques: ["Mathématiques financières", "Comptabilité"],
    Littéraires: ["Français", "Anglais", "Droit", "Économie"],
    "Non obligatoires": ["EPS", "Informatique"],
  },
  G2: {
    Scientifiques: ["Mathématiques financières", "Comptabilité approfondie"],
    Littéraires: ["Français", "Anglais", "Économie", "Gestion"],
    "Non obligatoires": ["EPS", "Informatique"],
  },
  G3: {
    Scientifiques: ["Mathématiques", "Comptabilité"],
    Littéraires: ["Français", "Anglais", "Économie", "Secrétariat"],
    "Non obligatoires": ["EPS"],
  },
  G4: {
    Scientifiques: ["Mathématiques", "Informatique de gestion"],
    Littéraires: ["Français", "Anglais", "Économie", "Gestion"],
    "Non obligatoires": ["EPS"],
  },
  F1: {
    Scientifiques: ["Mathématiques", "Physique", "Technologie industrielle"],
    Littéraires: ["Français", "Anglais"],
    "Non obligatoires": ["Dessin industriel", "EPS"],
  },
  F2: {
    Scientifiques: ["Électricité", "Mathématiques", "Physique"],
    Littéraires: ["Français", "Anglais"],
    "Non obligatoires": ["EPS"],
  },
  F3: {
    Scientifiques: ["Électronique", "Mathématiques", "Physique"],
    Littéraires: ["Français", "Anglais"],
    "Non obligatoires": ["EPS"],
  },
  F4: {
    Scientifiques: ["Informatique industrielle", "Mathématiques", "Physique"],
    Littéraires: ["Français", "Anglais"],
    "Non obligatoires": ["EPS"],
  },
};

const MATIERES_COLLEGE = {
  "3ème": {
    Scientifiques: ["Mathématiques", "Physique-Chimie", "SVT"],
    Littéraires: ["Français", "Anglais", "Histoire-Géographie"],
    Autres: ["EPS", "Informatique"],
  },
  "4ème": {
    Scientifiques: ["Mathématiques", "Physique", "Chimie"],
    Littéraires: ["Français", "Anglais", "Histoire-Géographie"],
    Autres: ["EPS", "Technologie"],
  },
  "5ème": {
    Scientifiques: ["Mathématiques", "Physique", "Chimie"],
    Littéraires: ["Français", "Anglais", "Histoire-Géographie"],
    Autres: ["EPS", "Technologie"],
  },
  "6ème": {
    Scientifiques: ["Mathématiques", "Physique", "Chimie"],
    Littéraires: ["Français", "Anglais", "Histoire-Géographie"],
    Autres: ["EPS", "Technologie"],
  },
};

const MATIERES_PRIMAIRE = {
  CM2: {
    Fondamentales: ["Mathématiques", "Problème", "Calcul mental", "Dictée Question", "Rédaction", "Educivip"],
    Complémentaires: ["Anglais", "Éducation civique", "EPS"],
  },
  CM1: {
    Fondamentales: ["Mathématiques", "Problème", "Calcul mental", "Dictée Question", "Rédaction", "Educivip"],
    Complémentaires: ["Anglais", "Éducation civique", "EPS"],
  },
  CE2: {
    Fondamentales: ["Mathématiques", "Problème", "Calcul mental", "Dictée Question", "Rédaction", "Educivip"],
    Complémentaires: ["Anglais", "Éducation civique", "EPS"],
  },
  CE1: {
    Fondamentales: ["Mathématiques", "Problème", "Calcul mental", "Dictée Question", "Rédaction", "Educivip"],
    Complémentaires: ["Anglais", "Éducation civique", "EPS"],
  },
  CP2: {
    Fondamentales: ["Mathématiques", "Français", "Sciences"],
    Complémentaires: ["Anglais", "Éducation civique", "EPS"],
  },
  CP1: {
    Fondamentales: ["Mathématiques", "Français", "Sciences"],
    Complémentaires: ["Anglais", "Éducation civique", "EPS"],
  },
};

function coefFor(categorie) {
  if (categorie === "Scientifiques") return COEF_SCIENTIFIQUE;
  if (categorie === "Littéraires") return COEF_LITTERAIRE;
  if (categorie === "Fondamentales") return 1; // Primaire : pas de pondération par coefficient
  if (categorie === "Complémentaires") return 1;
  return COEF_OPTION;
}

function buildDefaultRows() {
  const rows = [];

  // Lycée : Classe = "" -> s'applique à Seconde, Première ET Terminale de la série concernée
  for (const [serie, categories] of Object.entries(MATIERES_LYCEE)) {
    for (const [categorie, noms] of Object.entries(categories)) {
      for (const nom of noms) {
        rows.push({ Niveau: "Lycee", Classe: "", Serie: serie, Categorie: categorie, Nom: nom, Coefficient: coefFor(categorie) });
      }
    }
  }
  // Collège
  for (const [classe, categories] of Object.entries(MATIERES_COLLEGE)) {
    for (const [categorie, noms] of Object.entries(categories)) {
      for (const nom of noms) {
        rows.push({ Niveau: "College", Classe: classe, Serie: "", Categorie: categorie, Nom: nom, Coefficient: coefFor(categorie) });
      }
    }
  }
  // Primaire
  for (const [classe, categories] of Object.entries(MATIERES_PRIMAIRE)) {
    for (const [categorie, noms] of Object.entries(categories)) {
      for (const nom of noms) {
        rows.push({ Niveau: "Primaire", Classe: classe, Serie: "", Categorie: categorie, Nom: nom, Coefficient: coefFor(categorie) });
      }
    }
  }
  return rows;
}

// Préremplit la feuille de matières d'un NOUVEL établissement (appelé une seule fois,
// à la création de l'école — voir routes/ecoles.js).
async function seedMatieresForEtablissement(client, etablissementId) {
  const rows = buildDefaultRows();
  if (rows.length === 0) return;
  const params = [etablissementId];
  const tuples = rows.map((r) => {
    params.push(r.Niveau, r.Classe, r.Serie, r.Categorie, r.Nom, r.Coefficient);
    const n = params.length;
    return `($1, $${n - 5}, $${n - 4}, $${n - 3}, $${n - 2}, $${n - 1}, $${n})`;
  });
  await client.query(
    `INSERT INTO matieres (etablissement_id, niveau, classe, serie, categorie, nom, coefficient)
     VALUES ${tuples.join(",")}`,
    params
  );
}

module.exports = { seedMatieresForEtablissement };
