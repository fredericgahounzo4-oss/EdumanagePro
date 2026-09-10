import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Role } from '../types';
import {
  LayoutDashboard, Users, BookOpen, CreditCard, Calendar,
  BarChart3, Bell, Settings, LogOut, GraduationCap,
  FileText, UserCheck, BookMarked, X, ShieldCheck
} from 'lucide-react';

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const menuByRole: Record<Role, { sectionKey: string; items: { id: string; labelKey: string; icon: React.ReactNode }[] }[]> = {
  admin: [
    { sectionKey: 'section.principal', items: [
      { id: 'dashboard', labelKey: 'nav.dashboard', icon: <LayoutDashboard size={16} /> },
      { id: 'eleves', labelKey: 'nav.eleves', icon: <Users size={16} /> },
      { id: 'classes', labelKey: 'nav.classes', icon: <BookMarked size={16} /> },
      { id: 'notes', labelKey: 'nav.notes', icon: <BookOpen size={16} /> },
    ]},
    { sectionKey: 'section.gestion', items: [
      { id: 'paiements', labelKey: 'nav.paiements', icon: <CreditCard size={16} /> },
      { id: 'emploi-du-temps', labelKey: 'nav.emploiDuTemps', icon: <Calendar size={16} /> },
      { id: 'presences', labelKey: 'nav.presences', icon: <UserCheck size={16} /> },
    ]},
    { sectionKey: 'section.rapports', items: [
      { id: 'statistiques', labelKey: 'nav.statistiques', icon: <BarChart3 size={16} /> },
      { id: 'bulletins', labelKey: 'nav.bulletins', icon: <FileText size={16} /> },
    ]},
    { sectionKey: 'section.systeme', items: [
      { id: 'utilisateurs', labelKey: 'nav.utilisateurs', icon: <ShieldCheck size={16} /> },
      { id: 'notifications', labelKey: 'nav.notifications', icon: <Bell size={16} /> },
      { id: 'settings', labelKey: 'nav.settings', icon: <Settings size={16} /> },
    ]},
  ],
  professeur: [
    { sectionKey: 'section.monEspace', items: [
      { id: 'dashboard', labelKey: 'nav.dashboard', icon: <LayoutDashboard size={16} /> },
      { id: 'notes', labelKey: 'nav.saisieNotes', icon: <BookOpen size={16} /> },
      { id: 'presences', labelKey: 'nav.presences', icon: <UserCheck size={16} /> },
      { id: 'emploi-du-temps', labelKey: 'nav.monPlanning', icon: <Calendar size={16} /> },
    ]},
    { sectionKey: 'section.outils', items: [
      { id: 'titulaire', labelKey: 'nav.titulaire', icon: <FileText size={16} /> },
      { id: 'notifications', labelKey: 'nav.notifications', icon: <Bell size={16} /> },
    ]},
  ],
  parent: [
    { sectionKey: 'section.monEnfant', items: [
      { id: 'dashboard', labelKey: 'nav.dashboard', icon: <LayoutDashboard size={16} /> },
      { id: 'notes', labelKey: 'nav.notesResultats', icon: <BookOpen size={16} /> },
      { id: 'bulletins', labelKey: 'nav.bulletins', icon: <FileText size={16} /> },
      { id: 'emploi-du-temps', labelKey: 'nav.emploiDuTemps', icon: <Calendar size={16} /> },
    ]},
    { sectionKey: 'section.finances', items: [
      { id: 'paiements', labelKey: 'nav.paiements', icon: <CreditCard size={16} /> },
    ]},
    { sectionKey: 'section.communication', items: [
      { id: 'notifications', labelKey: 'nav.notifications', icon: <Bell size={16} /> },
    ]},
  ],
  surveillant: [
    { sectionKey: 'section.surveillance', items: [
      { id: 'dashboard', labelKey: 'nav.dashboard', icon: <LayoutDashboard size={16} /> },
      { id: 'presences', labelKey: 'nav.presences', icon: <UserCheck size={16} /> },
      { id: 'eleves', labelKey: 'nav.eleves', icon: <Users size={16} /> },
      { id: 'emploi-du-temps', labelKey: 'nav.emploiDuTemps', icon: <Calendar size={16} /> },
    ]},
    { sectionKey: 'section.rapports', items: [
      { id: 'notifications', labelKey: 'nav.notifications', icon: <Bell size={16} /> },
    ]},
  ],
};

const roleLabelKeys: Record<Role, string> = { admin: 'role.admin', professeur: 'role.professeur', parent: 'role.parent', surveillant: 'role.surveillant' };
const roleColors: Record<Role, string> = { admin: '#2563a8', professeur: '#16a34a', parent: '#d97706', surveillant: '#7c3aed' };

const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate, isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const { t } = useSettings();
  if (!user) return null;
  const menu = menuByRole[user.role];

  return (
    <div className={`sidebar${isOpen ? ' sidebar-open' : ''}`}>
      <div className="sidebar-logo">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GraduationCap size={20} color="white" />
          </div>
          <div style={{ flex: 1 }}>
            <div className="sidebar-logo-text">EduManage Pro</div>
            <div className="sidebar-logo-sub">Gestion Scolaire</div>
          </div>
          {/* Bouton fermer visible seulement sur mobile */}
          <button className="sidebar-close-btn" onClick={onClose} aria-label="Fermer le menu">
            <X size={18} color="rgba(255,255,255,0.7)" />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {menu.map(section => (
          <div key={section.sectionKey} className="sidebar-section">
            <div className="sidebar-section-label">{t(section.sectionKey)}</div>
            {section.items.map(item => (
              <div key={item.id} className={`sidebar-item ${activePage === item.id ? 'active' : ''}`} onClick={() => onNavigate(item.id)}>
                {item.icon}
                <span>{t(item.labelKey)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div className="avatar" style={{ background: roleColors[user.role], color: 'white', fontSize: 13, fontWeight: 700 }}>
            {user.prenom[0]}{user.nom[0]}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'white', fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.prenom} {user.nom}</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>{t(roleLabelKeys[user.role])}</div>
          </div>
        </div>
        <button className="sidebar-item" style={{ width: '100%', border: 'none', background: 'transparent' }} onClick={logout}>
          <LogOut size={16} />
          <span>{t('nav.deconnexion')}</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
