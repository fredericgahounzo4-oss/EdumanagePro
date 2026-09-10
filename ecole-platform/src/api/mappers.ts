/**
 * Convertit les réponses de l'API Django (snake_case, id numériques, objets
 * imbriqués) vers les types frontend existants (camelCase, id en string).
 * Ainsi, toutes les pages déjà écrites contre src/types/index.ts continuent
 * de fonctionner sans modification de leur logique d'affichage.
 */
import { User, Eleve, Classe, Matiere, Note, Paiement, CreneauEDT, Presence, Notification } from '../types';

const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

export function mapUser(u: any): User {
  return { id: s(u.id), nom: u.nom, prenom: u.prenom, email: u.email, role: u.role, avatar: u.avatar || undefined, isActive: u.is_active };
}

export function mapClasse(c: any): Classe {
  return {
    id: s(c.id), nom: c.nom, niveau: c.niveau, effectif: c.effectif,
    professeurPrincipalId: s(c.professeur_principal), anneeScolaire: c.annee_scolaire,
  };
}

export function mapMatiere(m: any): Matiere {
  return {
    id: s(m.id), nom: m.nom, coefficient: m.coefficient,
    professeurId: s(m.professeur), classeId: s(m.classe), couleur: m.couleur,
  };
}

export function mapEleve(e: any): Eleve {
  return {
    id: s(e.id), nom: e.nom, prenom: e.prenom, dateNaissance: e.date_naissance,
    classe: e.classe_nom, parentId: s(e.parent), photo: e.photo || undefined,
    status: e.status, adresse: e.adresse, telephone: e.telephone,
  };
}

export function mapNote(n: any): Note {
  return {
    id: s(n.id), eleveId: s(n.eleve), matiereId: s(n.matiere),
    valeur: parseFloat(n.valeur), type: n.type, date: n.date,
    commentaire: n.commentaire || undefined, trimestre: n.trimestre,
  };
}

export function mapPaiement(p: any): Paiement {
  return {
    id: s(p.id), eleveId: s(p.eleve), montant: parseFloat(p.montant),
    type: p.type, status: p.status, date: p.date, reference: p.reference,
    mois: p.mois || undefined,
  };
}

export function mapCreneau(c: any): CreneauEDT {
  return {
    id: s(c.id), jour: c.jour, heureDebut: c.heure_debut, heureFin: c.heure_fin,
    matiereId: s(c.matiere), classeId: s(c.classe), salle: c.salle,
  };
}

export function mapPresence(p: any): Presence {
  return { id: s(p.id), eleveId: s(p.eleve), date: p.date, statut: p.statut, commentaire: p.commentaire || undefined };
}

export function mapNotification(n: any): Notification {
  return { id: s(n.id), titre: n.titre, message: n.message, type: n.type, date: n.date, lu: n.lu, destinataireId: s(n.destinataire) };
}
