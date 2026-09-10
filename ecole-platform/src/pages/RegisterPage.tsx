import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Lock, Mail, Eye, EyeOff, GraduationCap, User as UserIcon, ArrowLeft } from 'lucide-react';

const RegisterPage: React.FC<{ onSwitchToLogin: () => void }> = ({ onSwitchToLogin }) => {
  const { register, authError } = useAuth();
  const [form, setForm] = useState({ prenom: '', nom: '', email: '', password: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères.'); return; }
    if (form.password !== form.confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    setLoading(true);
    const ok = await register({ nom: form.nom, prenom: form.prenom, email: form.email, password: form.password });
    if (!ok) setError(authError || "Impossible de créer le compte.");
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
            Suivez la scolarité<br />de votre enfant
          </h1>
          <p style={{ opacity: 0.6, lineHeight: 1.7, fontSize: 15, marginBottom: 32 }}>
            Notes, bulletins, paiements et emploi du temps — accessibles en un coup d'œil.
          </p>
          <div className="login-branding-features" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {['Consultez les notes et bulletins', 'Suivez les paiements de scolarité', "Recevez les notifications de l'école"].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, opacity: 0.75 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316', flexShrink: 0 }} />
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Carte inscription */}
        <div className="login-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <BookOpen size={20} color="var(--primary-light)" />
            <span style={{ fontWeight: 700, fontSize: 18 }}>Créer un compte parent</span>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Prénom</label>
                <div style={{ position: 'relative' }}>
                  <UserIcon size={16} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                  <input className="form-control" style={{ paddingLeft: 36 }} value={form.prenom}
                    onChange={e => { setForm(f => ({ ...f, prenom: e.target.value })); setError(''); }}
                    placeholder="Afi" required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Nom</label>
                <input className="form-control" value={form.nom}
                  onChange={e => { setForm(f => ({ ...f, nom: e.target.value })); setError(''); }}
                  placeholder="Koffi" required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Adresse email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                <input className="form-control" style={{ paddingLeft: 36 }} type="email" value={form.email}
                  onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setError(''); }}
                  placeholder="votre@email.com" required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Mot de passe</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                <input className="form-control" style={{ paddingLeft: 36, paddingRight: 36 }}
                  type={showPass ? 'text' : 'password'} value={form.password}
                  onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setError(''); }}
                  placeholder="6 caractères minimum" required />
                <button type="button" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-light)', padding: 2, cursor: 'pointer' }}
                  onClick={() => setShowPass(!showPass)}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Confirmer le mot de passe</label>
              <input className="form-control" type={showPass ? 'text' : 'password'} value={form.confirm}
                onChange={e => { setForm(f => ({ ...f, confirm: e.target.value })); setError(''); }}
                placeholder="••••••••" required />
            </div>
            {error && <div style={{ background: 'var(--danger-pale)', color: 'var(--danger)', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
              Votre compte sera créé avec le rôle Parent. L'établissement associera ensuite votre ou vos enfant(s) à votre compte.
            </div>
            <button type="submit" className="btn btn-primary w-full" style={{ justifyContent: 'center', padding: '11px', fontSize: 14 }} disabled={loading}>
              {loading ? 'Création...' : 'Créer mon compte'}
            </button>
          </form>

          <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
            <button type="button" onClick={onSwitchToLogin} style={{ background: 'none', border: 'none', color: 'var(--primary-light)', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ArrowLeft size={13} /> Retour à la connexion
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
