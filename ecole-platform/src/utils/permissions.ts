import { User, Classe, Matiere, Eleve } from '../types';

/**
 * Règles d'accès aux notes / bulletins :
 *
 * - Admin                → voit tout, partout.
 * - Professeur titulaire d'une classe (classe.professeurPrincipalId === user.id)
 *                        → voit TOUTES les notes / le bulletin complet de CETTE classe,
 *                          même les matières qu'il n'enseigne pas lui-même.
 * - Professeur non-titulaire → voit / saisit UNIQUEMENT les notes des matières
 *                          qu'il enseigne lui-même dans cette classe (matiere.professeurId === user.id).
 * - Parent               → voit le bulletin complet de son/ses enfant(s) uniquement (lecture seule).
 *
 * La saisie de notes (ajout/modif) est toujours limitée aux matières que le prof
 * enseigne réellement — être titulaire ne donne PAS le droit de noter la matière d'un collègue,
 * seulement de consulter.
 */

export const getClasseOfEleve = (eleve: Eleve, classes: Classe[]): Classe | undefined =>
  classes.find(c => c.nom === eleve.classe);

export const isTitulaireDeClasse = (user: User | null, classe: Classe | undefined): boolean =>
  !!user && !!classe && classe.professeurPrincipalId === user.id;

/** Matières qu'un professeur enseigne réellement dans une classe donnée. */
export const matieresEnseigneesParProf = (userId: string, classeId: string, matieres: Matiere[]): Matiere[] =>
  matieres.filter(m => m.classeId === classeId && m.professeurId === userId);

/** Toutes les classes où ce professeur intervient (comme enseignant d'une matière OU comme titulaire). */
export const classesDuProfesseur = (userId: string, classes: Classe[], matieres: Matiere[]): Classe[] => {
  const ids = new Set<string>();
  matieres.forEach(m => { if (m.professeurId === userId) ids.add(m.classeId); });
  classes.forEach(c => { if (c.professeurPrincipalId === userId) ids.add(c.id); });
  return classes.filter(c => ids.has(c.id));
};

/** Élèves qu'un professeur a le droit de voir (dans ses classes). */
export const elevesDuProfesseur = (userId: string, eleves: Eleve[], classes: Classe[], matieres: Matiere[]): Eleve[] => {
  const mesClasses = new Set(classesDuProfesseur(userId, classes, matieres).map(c => c.nom));
  return eleves.filter(e => mesClasses.has(e.classe));
};

/**
 * Matières visibles pour l'utilisateur courant sur le bulletin d'un élève donné.
 * - admin / titulaire de la classe de l'élève → toutes les matières de la classe
 * - professeur non-titulaire → seulement les matières qu'il enseigne dans cette classe
 * - parent / surveillant → toutes les matières de la classe (lecture seule)
 */
export const matieresVisibles = (
  user: User | null,
  eleve: Eleve,
  classes: Classe[],
  matieres: Matiere[]
): Matiere[] => {
  const classe = getClasseOfEleve(eleve, classes);
  if (!classe) return [];
  const matieresDeLaClasse = matieres.filter(m => m.classeId === classe.id);

  if (!user) return [];
  if (user.role === 'admin') return matieresDeLaClasse;
  if (user.role === 'professeur') {
    if (isTitulaireDeClasse(user, classe)) return matieresDeLaClasse;
    return matieresDeLaClasse.filter(m => m.professeurId === user.id);
  }
  // parent, surveillant : lecture seule, bulletin complet
  return matieresDeLaClasse;
};
