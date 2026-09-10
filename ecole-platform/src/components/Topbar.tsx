import React, { useState, useEffect } from 'react';
import { Bell, Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchNotifications } from '../api/resources';

interface TopbarProps {
  title: string;
  onNavigate: (page: string) => void;
  onMenuToggle: () => void;
}

const Topbar: React.FC<TopbarProps> = ({ title, onNavigate, onMenuToggle }) => {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // L'API ne renvoie déjà que les notifications de l'utilisateur connecté.
    fetchNotifications().then(n => { if (!cancelled) setUnread(n.filter(x => !x.lu).length); }).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]);

  return (
    <div className="topbar">
      {/* Burger menu - visible uniquement sur mobile */}
      <button className="btn btn-ghost btn-icon burger-btn" onClick={onMenuToggle} aria-label="Menu">
        <Menu size={20} />
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
      </div>

      <button className="btn btn-ghost btn-icon" style={{ position: 'relative', flexShrink: 0 }} onClick={() => onNavigate('notifications')}>
        <Bell size={18} />
        {unread > 0 && (
          <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, background: 'var(--accent)', borderRadius: '50%', border: '2px solid white' }} />
        )}
      </button>

      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'pointer', flexShrink: 0 }}>
          <div className="avatar avatar-sm" style={{ background: 'var(--primary-pale)', color: 'var(--primary-light)', fontWeight: 700 }}>
            {user.prenom[0]}{user.nom[0]}
          </div>
          <span className="topbar-username" style={{ fontSize: 13, fontWeight: 600 }}>{user.prenom}</span>
        </div>
      )}
    </div>
  );
};

export default Topbar;
