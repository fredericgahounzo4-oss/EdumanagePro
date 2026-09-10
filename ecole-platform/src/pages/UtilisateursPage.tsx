import React, { useState, useEffect } from 'react';
import { Plus, X, Copy, Check, Power, KeyRound, ShieldCheck } from 'lucide-react';
import { User } from '../types';
import { fetchUsersByRole, createStaffUser, setUserActive, resetUserPassword } from '../api/resources';
import { errorMessage } from '../api/client';

const ROLE_LABELS: Record<string, string> = { professeur: 'Professeur', surveillant: 'Surveillant' };
const ROLE_COLORS: Record<string, string> = { professeur: '#16a34a', surveillant: '#7c3aed' };

const UtilisateursPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<'' | 'professeur' | 'surveillant'>('');

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ nom: '', prenom: '', email: '', role: 'professeur' as 'professeur' | 'surveillant', password: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [resetFor, setResetFor] = useState<User | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([fetchUsersByRole('professeur'), fetchUsersByRole('surveillant')])
      .then(([profs, surveillants]) => setUsers([...profs, ...surveillants].sort((a, b) => a.nom.localeCompare(b.nom))))
      .catch(err => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = filterRole ? users.filter(u => u.role === filterRole) : users;

  const openAdd = () => {
    setForm({ nom: '', prenom: '', email: '', role: 'professeur', password: '' });
    setSaveError(null);
    setShowModal(true);
  };

  const generateLocalPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let pwd = '';
    for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    setForm(f => ({ ...f, password: pwd }));
  };

  const handleSave = async () => {
    if (!form.nom || !form.prenom || !form.email) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { user, generatedPassword } = await createStaffUser({
        nom: form.nom, prenom: form.prenom, email: form.email, role: form.role,
        password: form.password || undefined,
      });
      setUsers(prev => [...prev, user].sort((a, b) => a.nom.localeCompare(b.nom)));
      setShowModal(false);
      setCredentials({ email: user.email, password: form.password || generatedPassword || '' });
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: User) => {
    try {
      const updated = await setUserActive(u.id, !u.isActive);
      setUsers(prev => prev.map(x => x.id === u.id ? updated : x));
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const handleResetPassword = async (regenerate: boolean, manualPassword?: string) => {
    if (!resetFor) return;
    try {
      const password = await resetUserPassword(resetFor.id, regenerate ? undefined : manualPassword);
      setCredentials({ email: resetFor.email, password });
      setResetFor(null);
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const copyCredentials = () => {
    if (!credentials) return;
    navigator.clipboard.writeText(`Email : ${credentials.email}\nMot de passe : ${credentials.password}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Chargement...</div>;
  if (error) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>{error}</div>;

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <div className="page-title">Comptes</div>
            <div className="page-subtitle">Créez et gérez les accès des professeurs et des surveillants</div>
          </div>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={14} /> Nouveau compte</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <select className="form-control" style={{ width: 200 }} value={filterRole} onChange={e => setFilterRole(e.target.value as any)}>
            <option value="">Tous les rôles</option>
            <option value="professeur">Professeurs</option>
            <option value="surveillant">Surveillants</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>Statut</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Aucun compte pour le moment</td></tr>
              ) : filtered.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="avatar avatar-sm" style={{ background: ROLE_COLORS[u.role] + '22', color: ROLE_COLORS[u.role], fontWeight: 700 }}>{u.prenom[0]}{u.nom[0]}</div>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{u.prenom} {u.nom}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{u.email}</td>
                  <td><span className="badge badge-primary">{ROLE_LABELS[u.role] || u.role}</span></td>
                  <td><span className={`badge badge-${u.isActive === false ? 'neutral' : 'success'}`}>{u.isActive === false ? 'Désactivé' : 'Actif'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-icon btn-sm" title="Réinitialiser le mot de passe" onClick={() => setResetFor(u)}><KeyRound size={14} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" style={{ color: u.isActive === false ? 'var(--success)' : 'var(--danger)' }}
                        title={u.isActive === false ? 'Réactiver' : 'Désactiver'} onClick={() => toggleActive(u)}>
                        <Power size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Nouveau compte</div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {saveError && <div style={{ background: 'var(--danger-pale)', color: 'var(--danger)', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{saveError}</div>}
              <div className="form-group">
                <label className="form-label">Rôle *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['professeur', 'surveillant'] as const).map(r => (
                    <button key={r} type="button" className={`btn ${form.role === r ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ flex: 1, justifyContent: 'center', border: form.role === r ? 'none' : '1px solid var(--border)' }}
                      onClick={() => setForm(f => ({ ...f, role: r }))}>
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Prénom *</label>
                  <input className="form-control" value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Nom *</label>
                  <input className="form-control" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input className="form-control" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="prenom.nom@ecole.tg" />
              </div>
              <div className="form-group">
                <label className="form-label">Mot de passe</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="form-control" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Laisser vide pour générer automatiquement" />
                  <button type="button" className="btn btn-ghost" onClick={generateLocalPassword}>Générer</button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Si vous laissez ce champ vide, un mot de passe sera généré et affiché après la création.</div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Création...' : 'Créer le compte'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {resetFor && (
        <div className="modal-overlay" onClick={() => setResetFor(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Réinitialiser le mot de passe</div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setResetFor(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Nouveau mot de passe pour <strong>{resetFor.prenom} {resetFor.nom}</strong> ({resetFor.email}).
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setResetFor(null)}>Annuler</button>
              <button className="btn btn-primary" onClick={() => handleResetPassword(true)}>Générer un nouveau mot de passe</button>
            </div>
          </div>
        </div>
      )}

      {/* Credentials display modal */}
      {credentials && (
        <div className="modal-overlay" onClick={() => setCredentials(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ShieldCheck size={16} color="var(--success)" /> Identifiants du compte</div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setCredentials(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                Communiquez ces identifiants à la personne concernée — ce mot de passe ne sera plus jamais affiché.
              </p>
              <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 14, fontFamily: 'monospace', fontSize: 13 }}>
                <div>Email : <strong>{credentials.email}</strong></div>
                <div>Mot de passe : <strong>{credentials.password}</strong></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={copyCredentials}>
                {copied ? <><Check size={14} /> Copié</> : <><Copy size={14} /> Copier</>}
              </button>
              <button className="btn btn-primary" onClick={() => setCredentials(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UtilisateursPage;
