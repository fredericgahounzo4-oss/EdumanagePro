import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Lock, Mail, Eye, EyeOff, GraduationCap } from 'lucide-react';

const LoginPage: React.FC<{ onSwitchToRegister: () => void }> = ({ onSwitchToRegister }) => {
  const { login, authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const ok = await login(email, password);
    if (!ok) setError(authError || 'Email ou mot de passe incorrect.');
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-inner-wrapper" style={{ display: 'flex', gap: 48, alignItems: 'center', padding: '0 24px', maxWidth: 960, width: '100%' }}>

        {/* Colonne gauche : branding */}
        <div className="login-branding" style={{ flex: 1, color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ width: 52, height: 52, background: 'rgba(255,255,255,0.15)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <GraduationCap size={28} color="white" />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>EduManage Pro</div>
              <div style={{ fontSize: 12, opacity: 0.55 }}>Plateforme de Gestion Scolaire</div>
            </div>
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.2, marginBottom: 16 }}>
            Gérez votre établissement<br />avec efficacité
          </h1>
          <p style={{ opacity: 0.6, lineHeight: 1.7, fontSize: 15, marginBottom: 32 }}>
            Centralisation des données, gestion des notes, paiements et communication — tout en un.
          </p>
          <div className="login-branding-features" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {['Suivi en temps réel des élèves', 'Bulletins PDF automatiques', 'Gestion des paiements', 'Emplois du temps interactifs'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, opacity: 0.75 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316', flexShrink: 0 }} />
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Carte connexion */}
        <div className="login-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <BookOpen size={20} color="var(--primary-light)" />
            <span style={{ fontWeight: 700, fontSize: 18 }}>Connexion</span>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Adresse email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                <input className="form-control" style={{ paddingLeft: 36 }} type="email" value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  placeholder="votre@email.com" required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Mot de passe</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                <input className="form-control" style={{ paddingLeft: 36, paddingRight: 36 }}
                  type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="••••••••" required />
                <button type="button" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-light)', padding: 2, cursor: 'pointer' }}
                  onClick={() => setShowPass(!showPass)}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && <div style={{ background: 'var(--danger-pale)', color: 'var(--danger)', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <button type="submit" className="btn btn-primary w-full" style={{ justifyContent: 'center', padding: '11px', fontSize: 14 }} disabled={loading}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
            Vous êtes parent d'élève ?{' '}
            <button type="button" onClick={onSwitchToRegister} style={{ background: 'none', border: 'none', color: 'var(--primary-light)', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: 13 }}>
              Créer un compte
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
