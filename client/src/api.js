import { ajouterAFile } from "./lib/offline";

const BASE = "/api";

// Écritures autorisées hors connexion : elles sont mises en file d'attente puis
// rejouées automatiquement au retour du réseau (saisie de notes, présences).
const BUFFERISABLE = ["/notes", "/notes/feuille", "/attendance"];

function getToken() {
  return localStorage.getItem("smp_token");
}

async function request(path, options = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...options,
    });
  } catch (err) {
    // Panne réseau : on met l'écriture en attente si elle peut être rejouée plus tard
    const method = (options.method || "GET").toUpperCase();
    const bufferisable = method !== "GET" && BUFFERISABLE.some((p) => path.startsWith(p));
    if (bufferisable) {
      ajouterAFile({
        url: `${BASE}${path}`,
        method,
        body: options.body ? JSON.parse(options.body) : null,
      });
      return { differe: true, message: "Hors connexion — enregistré localement, sera synchronisé automatiquement." };
    }
    throw new Error("Vous êtes hors connexion. Cette action nécessite internet.");
  }
  if (res.status === 401) {
    localStorage.removeItem("smp_token");
    localStorage.removeItem("smp_user");
    window.location.reload();
    throw new Error("Session expirée");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // École suspendue ou fermée : l'application affiche l'écran de blocage (voir AuthContext / CompteBloque)
    if (res.status === 403 && (body.code === "ECOLE_SUSPENDUE" || body.code === "ECOLE_ARCHIVEE")) {
      window.dispatchEvent(new CustomEvent("smp-compte-bloque", { detail: body }));
    }
    throw new Error(body.error || `Erreur ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Authentification
  authStatus: () => request("/auth/status"),
  bootstrap: (data) => request("/auth/bootstrap", { method: "POST", body: JSON.stringify(data) }),
  login: (data) => request("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  getUsers: () => request("/auth/users"),
  createUser: (data) => request("/auth/users", { method: "POST", body: JSON.stringify(data) }),
  deleteUser: (id) => request(`/auth/users/${id}`, { method: "DELETE" }),
  // Mots de passe : changer le sien (selon les droits) / réinitialiser celui d'un enseignant ou autre compte de l'école (administrateur)
  changerMotDePasse: (data) => request("/auth/mot-de-passe", { method: "POST", body: JSON.stringify(data) }),
  reinitialiserUtilisateur: (id) => request(`/auth/users/${id}/reinitialiser`, { method: "POST" }),

  // Élèves
  getStudents: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/students${q ? `?${q}` : ""}`);
  },
  getStudent: (id, periode) => request(`/students/${id}${periode ? `?periode=${encodeURIComponent(periode)}` : ""}`),
  createStudent: (data) => request("/students", { method: "POST", body: JSON.stringify(data) }),
  updateStudent: (id, data) => request(`/students/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteStudent: (id) => request(`/students/${id}`, { method: "DELETE" }),
  reinitialiserCompteEleve: (id) => request(`/students/${id}/compte/reinitialiser`, { method: "POST" }),

  // Référence
  getNiveaux: () => request("/reference/niveaux"),
  getSeries: () => request("/reference/series"),

  // Matières (configurables)
  getMatieres: (params) => request(`/matieres?${new URLSearchParams(params)}`),
  createMatiere: (data) => request("/matieres", { method: "POST", body: JSON.stringify(data) }),
  deleteMatiere: (id) => request(`/matieres/${id}`, { method: "DELETE" }),

  // Notes
  getNotes: (idEleve, periode) => request(`/notes?idEleve=${idEleve}${periode ? `&periode=${encodeURIComponent(periode)}` : ""}`),
  createNote: (data) => request("/notes", { method: "POST", body: JSON.stringify(data) }),
  updateNote: (id, data) => request(`/notes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteNote: (id) => request(`/notes/${id}`, { method: "DELETE" }),

  // Présences
  getAttendance: (idEleve) => request(`/attendance?idEleve=${idEleve}`),
  createAttendance: (data) => request("/attendance", { method: "POST", body: JSON.stringify(data) }),
  deleteAttendance: (id) => request(`/attendance/${id}`, { method: "DELETE" }),
  getAttendanceStats: (idEleve) => request(`/attendance/stats/${idEleve}`),

  // Résultats
  getResults: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/results${q ? `?${q}` : ""}`);
  },

  // Dashboard
  getDashboard: () => request("/dashboard"),

  // Enseignants
  getTeachers: () => request("/teachers"),
  createTeacher: (data) => request("/teachers", { method: "POST", body: JSON.stringify(data) }),
  updateTeacher: (id, data) => request(`/teachers/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTeacher: (id) => request(`/teachers/${id}`, { method: "DELETE" }),
  addAffectation: (teacherId, data) => request(`/teachers/${teacherId}/affectations`, { method: "POST", body: JSON.stringify(data) }),
  removeAffectation: (affId) => request(`/teachers/affectations/${affId}`, { method: "DELETE" }),
  linkUserToTeacher: (userId, IDEnseignant) => request(`/auth/users/${userId}`, { method: "PUT", body: JSON.stringify({ IDEnseignant }) }),

  // Emploi du temps
  getTimetable: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/timetable${q ? `?${q}` : ""}`);
  },
  createTimetableEntry: (data) => request("/timetable", { method: "POST", body: JSON.stringify(data) }),
  deleteTimetableEntry: (id) => request(`/timetable/${id}`, { method: "DELETE" }),

  // Examens
  getExams: () => request("/exams"),
  createExam: (data) => request("/exams", { method: "POST", body: JSON.stringify(data) }),
  updateExam: (id, data) => request(`/exams/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteExam: (id) => request(`/exams/${id}`, { method: "DELETE" }),

  bulletinUrl: (idEleve, periode) => `${BASE}/bulletin/${idEleve}?token=${encodeURIComponent(getToken() || "")}${periode ? `&periode=${encodeURIComponent(periode)}` : ""}`,
  exportUrl: () => `${BASE}/export?token=${encodeURIComponent(getToken() || "")}`,
  getToken,

  // Paramètres établissement
  getSettings: () => request("/settings"),
  updateSettings: (data) => request("/settings", { method: "PUT", body: JSON.stringify(data) }),
  uploadLogo: async (file) => {
    const formData = new FormData();
    formData.append("logo", file);
    const token = getToken();
    const res = await fetch(`${BASE}/settings/logo`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Erreur ${res.status}`);
    }
    return res.json();
  },
  logoUrl: () => `${BASE}/settings/logo?token=${encodeURIComponent(getToken() || "")}&t=${Date.now()}`,

  // Écoles (SuperAdmin uniquement)
  getEcoles: () => request("/ecoles"),
  createEcole: (data) => request("/ecoles", { method: "POST", body: JSON.stringify(data) }),
  updateEcole: (id, data) => request(`/ecoles/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  // Cycle de vie : une école ne se supprime jamais directement (suspension -> archives après 30 jours -> suppression après 1 an)
  suspendreEcole: (id, Motif) => request(`/ecoles/${id}/suspendre`, { method: "POST", body: JSON.stringify({ Motif }) }),
  reactiverEcole: (id) => request(`/ecoles/${id}/reactiver`, { method: "POST" }),
  restaurerEcole: (id) => request(`/ecoles/${id}/restaurer`, { method: "POST" }),
  getJournalEcoles: () => request("/ecoles/journal"),
  getReglesEcoles: () => request("/ecoles/regles"),
  exportEcoleUrl: (id) => `${BASE}/ecoles/${id}/export?token=${encodeURIComponent(getToken() || "")}`,
  getEcoleComptes: (id) => request(`/ecoles/${id}/comptes`),
  reinitialiserCompteEcole: (ecoleId, userId) => request(`/ecoles/${ecoleId}/comptes/${userId}/reinitialiser`, { method: "POST" }),

  // Feuille de notes collective (saisie par classe entière)
  getFeuilleNotes: (params) => request(`/notes/feuille?${new URLSearchParams(params)}`),
  saveFeuilleNotes: (data) => request("/notes/feuille", { method: "POST", body: JSON.stringify(data) }),

  // Espace élève
  getMonEspace: () => request("/mon-espace"),

  // Emploi du temps personnel de l'enseignant
  getMonEmploiDuTemps: () => request("/timetable/mon-emploi"),

  // Écolage / caisse
  getBaremes: () => request("/ecolage/baremes"),
  createBareme: (d) => request("/ecolage/baremes", { method: "POST", body: JSON.stringify(d) }),
  deleteBareme: (id) => request(`/ecolage/baremes/${id}`, { method: "DELETE" }),
  getSituationEleve: (id) => request(`/ecolage/eleve/${id}`),
  getSituations: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/ecolage/situations${q ? `?${q}` : ""}`);
  },
  createPaiement: (d) => request("/ecolage/paiements", { method: "POST", body: JSON.stringify(d) }),
  deletePaiement: (id) => request(`/ecolage/paiements/${id}`, { method: "DELETE" }),
  getSyntheseEcolage: () => request("/ecolage/synthese"),
  recuUrl: (idPaiement) => `${BASE}/ecolage/recu/${idPaiement}?token=${encodeURIComponent(getToken() || "")}`,

  // Parents
  getParents: () => request("/parents"),
  createParent: (d) => request("/parents", { method: "POST", body: JSON.stringify(d) }),
  reinitialiserParent: (id) => request(`/parents/${id}/reinitialiser`, { method: "POST" }),
  deleteParent: (id) => request(`/parents/${id}`, { method: "DELETE" }),
  getMesEnfants: () => request("/parents/mes-enfants"),

  // Messagerie
  getMessages: () => request("/messages"),
  getContacts: () => request("/messages/contacts"),
  getNonLus: () => request("/messages/non-lus"),
  sendMessage: (d) => request("/messages", { method: "POST", body: JSON.stringify(d) }),
  marquerLu: (id) => request(`/messages/${id}/lu`, { method: "POST" }),

  // Bulletins
  getModelesBulletin: () => request("/bulletin/modeles"),
  bulletinsClasseUrl: (params) => `${BASE}/bulletin/classe?${new URLSearchParams({ ...params, token: getToken() || "" })}`,
  // Lot de bulletins (niveau / classe / série au choix), classés par ordre de mérite
  bulletinsLotUrl: (params) => `${BASE}/bulletin/lot?${new URLSearchParams({ ...params, token: getToken() || "" })}`,

  // Classes autorisées pour la saisie des notes (avec matières et statut de titulaire)
  getMesClassesNotes: () => request("/notes/mes-classes"),

  // Professeur titulaire d'une classe (administrateur)
  setTitulaire: (data) => request("/classes/titulaire", { method: "PUT", body: JSON.stringify(data) }),

  // Conseil de classe (conduite, décision, observations imprimées sur le bulletin)
  getConseil: (params) => request(`/conseil?${new URLSearchParams(params)}`),
  saveConseil: (data) => request("/conseil", { method: "PUT", body: JSON.stringify(data) }),

  // Cartes scolaires
  carteEleveUrl: (idEleve) => `${BASE}/cartes/eleve/${idEleve}?token=${encodeURIComponent(getToken() || "")}`,
  cartesClasseUrl: (params) => `${BASE}/cartes/classe?${new URLSearchParams({ ...params, token: getToken() || "" })}`,

  // Tableau de bord : données du jour selon le rôle
  getApercu: (params) => request(`/dashboard/apercu?${new URLSearchParams(params)}`),

  // Notifications (cloche)
  getNotifications: () => request("/notifications"),
  getNotifCompteur: () => request("/notifications/compteur"),
  marquerNotifLue: (id) => request(`/notifications/${encodeURIComponent(id)}/lu`, { method: "POST" }),
  toutMarquerLu: () => request("/notifications/tout-lu", { method: "POST" }),
  supprimerNotif: (id) => request(`/notifications/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // Classes
  getClasses: (params = {}) => request(`/classes?${new URLSearchParams(params)}`),
  getClasseDetail: (params) => request(`/classes/detail?${new URLSearchParams(params)}`),

  // Présences : appel de classe et historique
  getAppel: (params) => request(`/attendance/appel?${new URLSearchParams(params)}`),
  saveAppel: (data) => request("/attendance/appel", { method: "POST", body: JSON.stringify(data) }),
  getSyntheseAppel: (params = {}) => request(`/attendance/synthese?${new URLSearchParams(params)}`),

  // Statistiques
  getStats: (params = {}) => request(`/stats?${new URLSearchParams(params)}`),
};
