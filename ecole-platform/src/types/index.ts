export type Role = 'admin' | 'professeur' | 'parent' | 'surveillant';

export interface User {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: Role;
  avatar?: string;
  isActive?: boolean;
}

export interface Eleve {
  id: string;
  nom: string;
  prenom: string;
  dateNaissance: string;
  classe: string;
  parentId: string;
  photo?: string;
  status: 'actif' | 'inactif';
  adresse: string;
  telephone: string;
  compteParentId?: string;
}

export interface Classe {
  id: string;
  nom: string;
  niveau: string;
  effectif: number;
  professeurPrincipalId: string;
  anneeScolaire: string;
}

export interface Matiere {
  id: string;
  nom: string;
  coefficient: number;
  professeurId: string;
  classeId: string;
  couleur: string;
}

export interface Note {
  id: string;
  eleveId: string;
  matiereId: string;
  valeur: number;
  type: 'devoir' | 'examen' | 'interrogation';
  date: string;
  commentaire?: string;
  trimestre: 1 | 2 | 3;
}

export interface Paiement {
  id: string;
  eleveId: string;
  montant: number;
  type: 'inscription' | 'mensualite' | 'transport' | 'cantine';
  status: 'payé' | 'impayé' | 'partiel';
  date: string;
  reference: string;
  mois?: string;
}

export interface CreneauEDT {
  id: string;
  jour: 'Lundi' | 'Mardi' | 'Mercredi' | 'Jeudi' | 'Vendredi';
  heureDebut: string;
  heureFin: string;
  matiereId: string;
  classeId: string;
  salle: string;
}

export interface Presence {
  id: string;
  eleveId: string;
  date: string;
  statut: 'présent' | 'absent' | 'retard' | 'excusé';
  commentaire?: string;
}

export interface Notification {
  id: string;
  titre: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  date: string;
  lu: boolean;
  destinataireId: string;
}
