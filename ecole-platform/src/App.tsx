import React, { useState, useEffect } from 'react';
import './index.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Dashboard from './pages/Dashboard';
import ElevesPage from './pages/ElevesPage';
import UtilisateursPage from './pages/UtilisateursPage';
import NotesPage from './pages/NotesPage';
import PaiementsPage from './pages/PaiementsPage';
import EmploiDuTempsPage from './pages/EmploiDuTempsPage';
import MessagesPage from './pages/MessagesPage';
import {
  PresencesPage, ClassesPage, NotificationsPage,
  StatistiquesPage, BulletinsPage, SettingsPage, TitulairePage
} from './pages/OtherPages';

const PAGE_TITLE_KEYS: Record<string, string> = {
  dashboard: 'nav.dashboard',
  eleves: 'nav.eleves',
  utilisateurs: 'nav.utilisateurs',
  classes: 'nav.classes',
  notes: 'nav.notes',
  paiements: 'nav.paiements',
  'emploi-du-temps': 'nav.emploiDuTemps',
  presences: 'nav.presences',
  statistiques: 'nav.statistiques',
  bulletins: 'nav.bulletins',
  titulaire: 'nav.titulaire',
  notifications: 'nav.notifications',
  messages: 'nav.messages',
  settings: 'nav.settings',
};

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const { t } = useSettings();
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  // Bloquer le scroll du body quand la sidebar est ouverte sur mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
        Chargement...
      </div>
    );
  }

  if (!user) {
    return authView === 'register'
      ? <RegisterPage onSwitchToLogin={() => setAuthView('login')} />
      : <LoginPage onSwitchToRegister={() => setAuthView('register')} />;
  }

  const handleNavigate = (page: string) => {
    setActivePage(page);
    setSidebarOpen(false);
  };

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard onNavigate={handleNavigate} />;
      case 'eleves': return <ElevesPage />;
      case 'utilisateurs': return <UtilisateursPage />;
      case 'classes': return <ClassesPage />;
      case 'notes': return <NotesPage />;
      case 'paiements': return <PaiementsPage />;
      case 'emploi-du-temps': return <EmploiDuTempsPage />;
      case 'presences': return <PresencesPage />;
      case 'statistiques': return <StatistiquesPage />;
      case 'bulletins': return <BulletinsPage />;
      case 'titulaire': return <TitulairePage />;
      case 'notifications': return <NotificationsPage />;
      case 'messages': return <MessagesPage />;
      case 'settings': return <SettingsPage />;
      default: return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="app-layout">
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="main-content">
        <Topbar
          title={t(PAGE_TITLE_KEYS[activePage] || 'nav.dashboard')}
          onNavigate={handleNavigate}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        <div className="page-content">
          {renderPage()}
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => (
  <SettingsProvider>
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  </SettingsProvider>
);

export default App;
