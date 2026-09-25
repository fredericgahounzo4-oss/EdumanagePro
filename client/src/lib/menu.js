import {
  LayoutDashboard, Users, School, Trophy, UserCheck, FileText, CalendarDays, Calendar, ClipboardList, BookOpen,
  GraduationCap, Wallet, BarChart3, MessageCircle, Bell, KeyRound, ShieldCheck, Settings, Download, Building2, Heart, Award,
} from "lucide-react";

// Menu de navigation par rôle, organisé en sections (structure inspirée d'EduManagePro).
// Les chemins et les droits d'accès sont ceux de SchoolManagePro : aucune route n'est ajoutée à un rôle
// qui n'y avait pas accès, sauf les nouveaux écrans (Classes, Présences, Statistiques, Notifications).
// badge : "messages" | "notifications" -> pastille de compteur non lu.

const item = (to, labelKey, icon, extra = {}) => ({ to, labelKey, icon, ...extra });

export function menuPour(role, { titulaire = false } = {}) {
  switch (role) {
    case "SuperAdmin":
      return [{ key: "section.plateforme", items: [item("/", "nav.ecoles", Building2, { end: true })] }];

    case "Caissier":
      return [
        { key: "section.finances", items: [item("/", "nav.ecolage", Wallet, { end: true })] },
        { key: "section.communication", items: [
          item("/messagerie", "nav.messagerie", MessageCircle, { badge: "messages" }),
          item("/notifications", "nav.notifications", Bell, { badge: "notifications" }),
        ] },
      ];

    case "Eleve":
      return [
        { key: "section.monEspace", items: [item("/", "nav.monEspaceEleve", GraduationCap, { end: true })] },
        { key: "section.communication", items: [
          item("/messagerie", "nav.messagerie", MessageCircle, { badge: "messages" }),
          item("/notifications", "nav.notifications", Bell, { badge: "notifications" }),
        ] },
      ];

    case "Parent":
      return [
        { key: "section.famille", items: [item("/", "nav.mesEnfants", Heart, { end: true })] },
        { key: "section.communication", items: [
          item("/messagerie", "nav.messagerie", MessageCircle, { badge: "messages" }),
          item("/notifications", "nav.notifications", Bell, { badge: "notifications" }),
        ] },
      ];

    case "Enseignant":
      return [
        { key: "section.monEspace", items: [
          item("/", "nav.dashboard", LayoutDashboard, { end: true }),
          item("/notes-rapides", "nav.notes", FileText),
          item("/presences", "nav.presences", UserCheck),
          item("/mon-emploi-du-temps", "nav.monEmploi", CalendarDays),
          ...(titulaire ? [item("/conseil", "nav.conseil", Award)] : []),
        ] },
        { key: "section.etablissement", items: [
          item("/eleves", "nav.eleves", Users),
          item("/classes", "nav.classes", School),
          item("/resultats", "nav.resultats", Trophy),
          item("/enseignants", "nav.enseignants", GraduationCap),
          item("/emploi-du-temps", "nav.emploi", Calendar),
          item("/examens", "nav.examens", ClipboardList),
          item("/matieres", "nav.matieres", BookOpen),
        ] },
        { key: "section.rapports", items: [item("/statistiques", "nav.statistiques", BarChart3)] },
        { key: "section.communication", items: [
          item("/messagerie", "nav.messagerie", MessageCircle, { badge: "messages" }),
          item("/notifications", "nav.notifications", Bell, { badge: "notifications" }),
        ] },
      ];

    default: // Administrateur
      return [
        { key: "section.principal", items: [
          item("/", "nav.dashboard", LayoutDashboard, { end: true }),
          item("/eleves", "nav.eleves", Users),
          item("/classes", "nav.classes", School),
          item("/resultats", "nav.resultats", Trophy),
        ] },
        { key: "section.gestion", items: [
          item("/presences", "nav.presences", UserCheck),
          item("/conseil", "nav.conseil", Award),
          item("/enseignants", "nav.enseignants", GraduationCap),
          item("/emploi-du-temps", "nav.emploi", Calendar),
          item("/examens", "nav.examens", ClipboardList),
          item("/matieres", "nav.matieres", BookOpen),
        ] },
        { key: "section.finances", items: [item("/ecolage", "nav.ecolage", Wallet)] },
        { key: "section.rapports", items: [item("/statistiques", "nav.statistiques", BarChart3)] },
        { key: "section.communication", items: [
          item("/messagerie", "nav.messagerie", MessageCircle, { badge: "messages" }),
          item("/notifications", "nav.notifications", Bell, { badge: "notifications" }),
        ] },
        { key: "section.administration", items: [
          item("/parents", "nav.parents", Heart),
          item("/utilisateurs", "nav.utilisateurs", KeyRound),
          item("/parametres", "nav.parametres", Settings),
        ] },
      ];
  }
}

// Lien d'export (fichier), affiché en bas du menu pour l'administrateur
export const EXPORT_ITEM = { labelKey: "nav.export", icon: Download };

// Clé de traduction du titre de la page affichée dans la barre du haut
export function titreDepuisChemin(menu, pathname) {
  let meilleur = null;
  for (const section of menu) {
    for (const it of section.items) {
      const ok = it.to === "/" ? pathname === "/" : pathname === it.to || pathname.startsWith(it.to + "/");
      if (ok && (!meilleur || it.to.length > meilleur.to.length)) meilleur = it;
    }
  }
  return meilleur ? meilleur.labelKey : null;
}
