import { http, isQueuedResponse } from './client';
import {
  mapUser, mapClasse, mapMatiere, mapEleve, mapNote, mapPaiement, mapCreneau, mapPresence, mapNotification,
  mapConversation, mapMessage,
} from './mappers';
import { User, Eleve, Classe, Matiere, Note, Paiement, CreneauEDT, Presence, Notification, Conversation, Message } from '../types';

/** Identifiant temporaire pour un enregistrement créé hors-ligne, en attente de synchronisation. */
const tempId = () => 'pending-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

// -------------------------------------------------------------- Auth
export async function apiLogin(email: string, password: string): Promise<{ access: string; refresh: string; user: User }> {
  const data = await http.post<any>('/auth/login/', { email, password });
  return { access: data.access, refresh: data.refresh, user: mapUser(data.user) };
}

export async function apiRegisterParent(payload: { nom: string; prenom: string; email: string; password: string }): Promise<{ access: string; refresh: string; user: User }> {
  const data = await http.post<any>('/auth/register/', payload);
  return { access: data.access, refresh: data.refresh, user: mapUser(data.user) };
}

export async function apiMe(): Promise<User> {
  return mapUser(await http.get<any>('/auth/me/'));
}

// ------------------------------------------------------------ Classes
export const fetchClasses = async (): Promise<Classe[]> => (await http.getAll<any>('/classes/')).map(mapClasse);
export const updateClasse = async (id: string, payload: { professeurPrincipalId?: string | null; nom?: string; niveau?: string; effectif?: number; anneeScolaire?: string }): Promise<Classe> => {
  const body: Record<string, unknown> = {};
  if (payload.professeurPrincipalId !== undefined) body.professeur_principal = payload.professeurPrincipalId ? Number(payload.professeurPrincipalId) : null;
  if (payload.nom !== undefined) body.nom = payload.nom;
  if (payload.niveau !== undefined) body.niveau = payload.niveau;
  if (payload.effectif !== undefined) body.effectif = payload.effectif;
  if (payload.anneeScolaire !== undefined) body.annee_scolaire = payload.anneeScolaire;
  return mapClasse(await http.patch<any>(`/classes/${id}/`, body));
};

// ----------------------------------------------------------- Matieres
export const fetchMatieres = async (): Promise<Matiere[]> => (await http.getAll<any>('/matieres/')).map(mapMatiere);
export const createMatiere = async (payload: Partial<Matiere>): Promise<Matiere> =>
  mapMatiere(await http.post<any>('/matieres/', {
    nom: payload.nom, coefficient: payload.coefficient,
    professeur: payload.professeurId ? Number(payload.professeurId) : null,
    classe: Number(payload.classeId), couleur: payload.couleur,
  }));

// ------------------------------------------------------------- Eleves
export const fetchEleves = async (): Promise<Eleve[]> => (await http.getAll<any>('/eleves/')).map(mapEleve);
export const createEleve = async (payload: {
  nom: string; prenom: string; dateNaissance: string; classeId: string; parentId?: string;
  status: string; adresse: string; telephone: string;
}): Promise<Eleve> =>
  mapEleve(await http.post<any>('/eleves/', {
    nom: payload.nom, prenom: payload.prenom, date_naissance: payload.dateNaissance,
    classe: Number(payload.classeId), parent: payload.parentId ? Number(payload.parentId) : null,
    status: payload.status, adresse: payload.adresse, telephone: payload.telephone,
  }));
export const updateEleve = async (id: string, payload: Record<string, unknown>): Promise<Eleve> =>
  mapEleve(await http.patch<any>(`/eleves/${id}/`, payload));
export const deleteEleve = async (id: string): Promise<void> => http.delete(`/eleves/${id}/`);

// -------------------------------------------------------------- Notes
export const fetchNotes = async (): Promise<Note[]> => (await http.getAll<any>('/notes/')).map(mapNote);
export const createNote = async (payload: {
  eleveId: string; matiereId: string; valeur: number; type: string; date: string; trimestre: number; commentaire?: string;
}): Promise<Note> => {
  const raw = await http.post<any>('/notes/', {
    eleve: Number(payload.eleveId), matiere: Number(payload.matiereId), valeur: payload.valeur,
    type: payload.type, date: payload.date, trimestre: payload.trimestre, commentaire: payload.commentaire || '',
  });
  if (isQueuedResponse(raw)) {
    // Hors-ligne : la requête a été mise en file par le service worker et
    // sera envoyée automatiquement à la reconnexion. On affiche la note
    // localement en attendant, marquée "pending".
    return {
      id: tempId(), eleveId: payload.eleveId, matiereId: payload.matiereId, valeur: payload.valeur,
      type: payload.type as Note['type'], date: payload.date, trimestre: payload.trimestre as Note['trimestre'],
      commentaire: payload.commentaire, pending: true,
    };
  }
  return mapNote(raw);
};
export const deleteNote = async (id: string): Promise<void> => http.delete(`/notes/${id}/`);

// ---------------------------------------------------------- Paiements
export const fetchPaiements = async (): Promise<Paiement[]> => (await http.getAll<any>('/paiements/')).map(mapPaiement);
export const createPaiement = async (payload: {
  eleveId: string; montant: number; type: string; status: string; date: string; reference: string; mois?: string;
}): Promise<Paiement> => {
  const raw = await http.post<any>('/paiements/', {
    eleve: Number(payload.eleveId), montant: payload.montant, type: payload.type,
    status: payload.status, date: payload.date, reference: payload.reference, mois: payload.mois || '',
  });
  if (isQueuedResponse(raw)) {
    return {
      id: tempId(), eleveId: payload.eleveId, montant: payload.montant, type: payload.type as Paiement['type'],
      status: payload.status as Paiement['status'], date: payload.date, reference: payload.reference,
      mois: payload.mois, pending: true,
    };
  }
  return mapPaiement(raw);
};
export const updatePaiementStatus = async (id: string, status: string): Promise<{ id: string; status: string; pending?: boolean }> => {
  const raw = await http.patch<any>(`/paiements/${id}/`, { status });
  if (isQueuedResponse(raw)) return { id, status, pending: true };
  const mapped = mapPaiement(raw);
  return { id: mapped.id, status: mapped.status };
};

// ------------------------------------------------------ Emploi du temps
export const fetchEmploiDuTemps = async (): Promise<CreneauEDT[]> => (await http.getAll<any>('/emploi-du-temps/')).map(mapCreneau);
export const upsertCreneau = async (payload: {
  id?: string; jour: string; heureDebut: string; heureFin: string; matiereId: string; classeId: string; salle: string;
}): Promise<CreneauEDT> => {
  const body = {
    jour: payload.jour, heure_debut: payload.heureDebut, heure_fin: payload.heureFin,
    matiere: Number(payload.matiereId), classe: Number(payload.classeId), salle: payload.salle,
  };
  return mapCreneau(payload.id ? await http.patch<any>(`/emploi-du-temps/${payload.id}/`, body) : await http.post<any>('/emploi-du-temps/', body));
};
export const deleteCreneau = async (id: string): Promise<void> => http.delete(`/emploi-du-temps/${id}/`);

// ---------------------------------------------------------- Presences
export const fetchPresences = async (): Promise<Presence[]> => (await http.getAll<any>('/presences/')).map(mapPresence);
export const upsertPresence = async (payload: { id?: string; eleveId: string; date: string; statut: string; commentaire?: string }): Promise<Presence> => {
  const body = { eleve: Number(payload.eleveId), date: payload.date, statut: payload.statut, commentaire: payload.commentaire || '' };
  const raw = payload.id ? await http.patch<any>(`/presences/${payload.id}/`, body) : await http.post<any>('/presences/', body);
  if (isQueuedResponse(raw)) {
    return {
      id: payload.id || tempId(), eleveId: payload.eleveId, date: payload.date,
      statut: payload.statut as Presence['statut'], commentaire: payload.commentaire, pending: true,
    };
  }
  return mapPresence(raw);
};

// ------------------------------------------------------- Notifications
export const fetchNotifications = async (): Promise<Notification[]> => (await http.getAll<any>('/notifications/')).map(mapNotification);
export const marquerNotificationLue = async (id: string): Promise<Notification> =>
  mapNotification(await http.post<any>(`/notifications/${id}/marquer_lu/`));

// ---------------------------------------------------------------- Users
export const fetchUsersByRole = async (role: string): Promise<User[]> =>
  (await http.getAll<any>(`/auth/users/?role=${role}`)).map(mapUser);

export const createStaffUser = async (payload: {
  nom: string; prenom: string; email: string; role: 'professeur' | 'surveillant'; password?: string;
}): Promise<{ user: User; generatedPassword?: string }> => {
  const raw = await http.post<any>('/auth/users/', {
    nom: payload.nom, prenom: payload.prenom, email: payload.email, role: payload.role,
    ...(payload.password ? { password: payload.password } : {}),
  });
  return { user: mapUser(raw), generatedPassword: raw.generated_password };
};

export const setUserActive = async (id: string, isActive: boolean): Promise<User> =>
  mapUser(await http.patch<any>(`/auth/users/${id}/`, { is_active: isActive }));

export const resetUserPassword = async (id: string, password?: string): Promise<string> =>
  (await http.post<{ password: string }>(`/auth/users/${id}/reset_password/`, password ? { password } : {})).password;

// ---------------------------------------------------------- Messagerie
export const fetchConversations = async (): Promise<Conversation[]> =>
  (await http.getAll<any>('/conversations/')).map(mapConversation);

export const createConversationForEleve = async (eleveId: string, contenu: string): Promise<Conversation> =>
  mapConversation(await http.post<any>('/conversations/', { eleve: Number(eleveId), contenu }));

export const createConversationForClasse = async (classeId: string, contenu: string): Promise<{ created: number }> =>
  http.post<{ created: number }>('/conversations/', { classe: Number(classeId), contenu });

export const fetchMessages = async (conversationId: string): Promise<Message[]> =>
  (await http.get<any[]>(`/conversations/${conversationId}/messages/`)).map(mapMessage);

export const sendReply = async (conversationId: string, contenu: string): Promise<Message> =>
  mapMessage(await http.post<any>(`/conversations/${conversationId}/messages/`, { contenu }));

export const marquerConversationLue = async (conversationId: string): Promise<void> => {
  await http.post(`/conversations/${conversationId}/marquer_lu/`, {});
};
