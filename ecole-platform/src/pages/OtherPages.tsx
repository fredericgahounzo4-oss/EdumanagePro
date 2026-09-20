import React, { useState, useEffect, useRef } from 'react';
import { Presence, Notification, Classe, Matiere, Eleve, Note, Paiement, User } from '../types';
import { Check, X, Clock, AlertCircle, Bell, BellOff, Download, Users, TrendingUp, BookOpen, CheckCircle, Lock, Palette, Save, GraduationCap } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { useConnectivity } from '../context/ConnectivityContext';
import { downloadElementAsPdf, downloadElementsAsPdf } from '../utils/pdfExport';
import {
  fetchClasses, fetchMatieres, fetchEleves, fetchNotes, fetchPaiements,
  fetchPresences, upsertPresence, fetchNotifications, marquerNotificationLue,
  fetchUsersByRole, updateClasse,
} from '../api/resources';
import { errorMessage } from '../api/client';

// ===== PRESENCES =====
export const PresencesPage: React.FC = () => {
  const { reconnectedAt } = useConnectivity();
  const [classes, setClasses] = useState<Classe[]>([]);
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [presences, setPresences] = useState<Presence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClasse, setSelectedClasse] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([fetchClasses(), fetchEleves(), fetchPresences()])
      .then(([c, e, p]) => { if (!cancelled) { setClasses(c); setEleves(e); setPresences(p); setSelectedClasse(prev => prev || c[0]?.id || ''); } })
      .catch(err => { if (!cancelled) setError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Retour de connexion : remplace silencieusement les présences "en attente"
  // par les vraies données synchronisées.
  useEffect(() => {
    if (reconnectedAt === 0) return;
    Promise.all([fetchEleves(), fetchPresences()])
      .then(([e, p]) => { setEleves(e); setPresences(p); })
      .catch(() => { /* échec silencieux */ });
  }, [reconnectedAt]);

  const classeEleves = eleves.filter(e => {
    const cls = classes.find(c => c.id === selectedClasse);
    return cls && e.classe === cls.nom;
  });

  const getPresenceForEleve = (eleveId: string) => presences.find(p => p.eleveId === eleveId && p.date === selectedDate);

  const setStatut = async (eleveId: string, statut: Presence['statut']) => {
    const existing = getPresenceForEleve(eleveId);
    try {
      const saved = await upsertPresence({ id: existing?.id, eleveId, date: selectedDate, statut });
      setPresences(prev => {
        const exists = prev.some(p => p.eleveId === eleveId && p.date === selectedDate);
        return exists ? prev.map(p => (p.eleveId === eleveId && p.date === selectedDate ? saved : p)) : [...prev, saved];
      });
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const stats = { présent: 0, absent: 0, retard: 0, excusé: 0 };
  classeEleves.forEach(e => {
    const p = getPresenceForEleve(e.id);
    if (p) stats[p.statut]++;
    else stats['absent']++;
  });

  const statutConfig = {
    présent: { color: '#16a34a', bg: 'var(--success-pale)', icon: <Check size={14} /> },
    absent: { color: '#dc2626', bg: 'var(--danger-pale)', icon: <X size={14} /> },
    retard: { color: '#d97706', bg: 'var(--warning-pale)', icon: <Clock size={14} /> },
    excusé: { color: '#0891b2', bg: 'var(--info-pale)', icon: <AlertCircle size={14} /> },
  };

  if (loading) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Chargement...</div>;
  if (error) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>{error}</div>;

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div><div className="page-title">Gestion des présences</div><div className="page-subtitle">Suivi quotidien des absences</div></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label className="form-label">Date</label>
            <input className="form-control" type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ width: 180 }} />
          </div>
          <div>
            <label className="form-label">Classe</label>
            <select className="form-control" style={{ width: 160 }} value={selectedClasse} onChange={e => setSelectedClasse(e.target.value)}>
              {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        {Object.entries(stats).map(([statut, count]) => {
          const cfg = statutConfig[statut as keyof typeof statutConfig];
          return (
            <div key={statut} className="stat-card">
              <div className="stat-icon" style={{ background: cfg.bg, color: cfg.color }}>{cfg.icon}</div>
              <div>
                <div className="stat-label" style={{ textTransform: 'capitalize' }}>{statut}</div>
                <div className="stat-value" style={{ fontSize: 22, color: cfg.color }}>{count}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-header">
          <span style={{ fontWeight: 700 }}>Feuille de présence — {new Date(selectedDate).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Élève</th><th>Classe</th>{Object.keys(statutConfig).map(s => <th key={s} style={{ textAlign: 'center', textTransform: 'capitalize' }}>{s}</th>)}</tr></thead>
            <tbody>
              {classeEleves.map(e => {
                const p = getPresenceForEleve(e.id);
                const current = p?.statut || 'absent';
                return (
                  <tr key={e.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="avatar avatar-sm" style={{ background: 'var(--primary-pale)', color: 'var(--primary-light)', fontWeight: 700 }}>{e.prenom[0]}{e.nom[0]}</div>
                        <span style={{ fontWeight: 600 }}>{e.prenom} {e.nom}</span>
                      </div>
                    </td>
                    <td><span className="badge badge-primary">{e.classe}</span></td>
                    {(Object.keys(statutConfig) as Presence['statut'][]).map(s => {
                      const cfg = statutConfig[s];
                      const active = current === s;
                      return (
                        <td key={s} style={{ textAlign: 'center', position: 'relative' }}>
                          <button
                            onClick={() => setStatut(e.id, s)}
                            title={active && p?.pending ? 'En attente de synchronisation' : undefined}
                            style={{ width: 32, height: 32, borderRadius: '50%', border: active ? `2px solid ${cfg.color}` : '1px solid var(--border)', background: active ? cfg.bg : 'transparent', color: active ? cfg.color : 'var(--text-light)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', opacity: active && p?.pending ? 0.6 : 1, outline: active && p?.pending ? '1px dashed var(--text-light)' : 'none', outlineOffset: 2 }}
                          >{cfg.icon}</button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ===== CLASSES =====
export const ClassesPage: React.FC = () => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [classes, setClasses] = useState<Classe[]>([]);
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [professeurs, setProfesseurs] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editClasse, setEditClasse] = useState<Classe | null>(null);
  const [selectedProf, setSelectedProf] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canManage = user?.role === 'admin';

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchClasses(), fetchEleves(), canManage ? fetchUsersByRole('professeur') : Promise.resolve([])])
      .then(([c, e, p]) => { if (!cancelled) { setClasses(c); setEleves(e); setProfesseurs(p); } })
      .catch(err => { if (!cancelled) setError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [canManage]);

  const openEditTitulaire = (c: Classe) => {
    setEditClasse(c);
    setSelectedProf(c.professeurPrincipalId || '');
    setSaveError(null);
  };

  const handleSaveTitulaire = async () => {
    if (!editClasse) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateClasse(editClasse.id, { professeurPrincipalId: selectedProf || null });
      setClasses(prev => prev.map(c => c.id === editClasse.id ? updated : c));
      setEditClasse(null);
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Chargement...</div>;
  if (error) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>{error}</div>;

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div><div className="page-title">Gestion des classes</div><div className="page-subtitle">{classes.length} classes — Année {settings.anneeScolaire}</div></div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {classes.map(c => {
          const effectifReel = eleves.filter(e => e.classe === c.nom).length;
          return (
          <div key={c.id} className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{c.nom}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{c.niveau}</div>
              </div>
              <span className="badge badge-primary">{c.anneeScolaire}</span>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              {[
                { label: 'Effectif', value: `${effectifReel} élèves`, icon: <Users size={14} /> },
                { label: 'Niveau', value: c.niveau, icon: <BookOpen size={14} /> },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>{row.icon} {row.label}</span>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{row.value}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}><GraduationCap size={14} /> Titulaire</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  {c.professeurPrincipalId ? (professeurs.find(p => p.id === c.professeurPrincipalId) ? `${professeurs.find(p => p.id === c.professeurPrincipalId)!.prenom} ${professeurs.find(p => p.id === c.professeurPrincipalId)!.nom}` : '—') : <span style={{ color: 'var(--text-light)', fontWeight: 500 }}>Non assigné</span>}
                </span>
              </div>
            </div>
            {canManage && (
              <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={() => openEditTitulaire(c)}>
                Attribuer le titulaire
              </button>
            )}
          </div>
          );
        })}
      </div>

      {editClasse && (
        <div className="modal-overlay" onClick={() => setEditClasse(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Titulaire de {editClasse.nom}</div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditClasse(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {saveError && <div style={{ background: 'var(--danger-pale)', color: 'var(--danger)', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{saveError}</div>}
              <div className="form-group">
                <label className="form-label">Professeur titulaire</label>
                <select className="form-control" value={selectedProf} onChange={e => setSelectedProf(e.target.value)}>
                  <option value="">Aucun titulaire</option>
                  {professeurs.map(p => <option key={p.id} value={p.id}>{p.prenom} {p.nom} — {p.email}</option>)}
                </select>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  Le titulaire voit le bulletin complet de cette classe (toutes matières), même celles qu'il n'enseigne pas lui-même.
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setEditClasse(null)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleSaveTitulaire} disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ===== NOTIFICATIONS =====
export const NotificationsPage: React.FC = () => {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchNotifications()
      .then(n => { if (!cancelled) setNotifs(n); })
      .catch(err => { if (!cancelled) setError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const markRead = async (id: string) => {
    try {
      const updated = await marquerNotificationLue(id);
      setNotifs(prev => prev.map(n => n.id === id ? updated : n));
    } catch (err) {
      alert(errorMessage(err));
    }
  };
  const markAllRead = async () => {
    const unread = notifs.filter(n => !n.lu);
    try {
      await Promise.all(unread.map(n => marquerNotificationLue(n.id)));
      setNotifs(prev => prev.map(n => ({ ...n, lu: true })));
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const typeConfig = { info: { badge: 'badge-info', icon: '💬' }, success: { badge: 'badge-success', icon: '✅' }, warning: { badge: 'badge-warning', icon: '⚠️' }, danger: { badge: 'badge-danger', icon: '🔴' } };

  if (loading) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Chargement...</div>;
  if (error) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>{error}</div>;

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div><div className="page-title">Notifications</div><div className="page-subtitle">{notifs.filter(n => !n.lu).length} non lue(s)</div></div>
          <button className="btn btn-ghost btn-sm" onClick={markAllRead}><BellOff size={13} /> Tout marquer lu</button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {notifs.length === 0 && (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Aucune notification.</div>
        )}
        {notifs.map(n => (
          <div key={n.id} className="card" style={{ padding: '16px 20px', opacity: n.lu ? 0.7 : 1, borderLeft: n.lu ? '1px solid var(--border)' : `3px solid var(--${n.type === 'info' ? 'info' : n.type === 'success' ? 'success' : n.type === 'warning' ? 'warning' : 'danger'})` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ fontSize: 20 }}>{typeConfig[n.type].icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{n.titre}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(n.date).toLocaleDateString('fr-FR')}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{n.message}</div>
              </div>
              {!n.lu && (
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => markRead(n.id)} title="Marquer comme lu">
                  <Check size={14} />
                </button>
              )}
              {n.lu && <span className="badge badge-neutral" style={{ flexShrink: 0 }}>Lu</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ===== STATISTIQUES =====
export const StatistiquesPage: React.FC = () => {
  const [classes, setClasses] = useState<Classe[]>([]);
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchClasses(), fetchMatieres(), fetchEleves(), fetchNotes(), fetchPaiements()])
      .then(([c, m, e, n, p]) => { if (!cancelled) { setClasses(c); setMatieres(m); setEleves(e); setNotes(n); setPaiements(p); } })
      .catch(err => { if (!cancelled) setError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Chargement...</div>;
  if (error) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>{error}</div>;

  // ----- Statistiques regroupées par niveau (Collège, Lycée, Primaire...) -----
  const niveaux = Array.from(new Set(classes.map(c => c.niveau)));
  const niveauStats = niveaux.map(niveau => {
    const classesDuNiveau = classes.filter(c => c.niveau === niveau);
    const nomsClasses = new Set(classesDuNiveau.map(c => c.nom));
    const elevesDuNiveau = eleves.filter(e => nomsClasses.has(e.classe));
    const idsEleves = new Set(elevesDuNiveau.map(e => e.id));
    const notesDuNiveau = notes.filter(n => idsEleves.has(n.eleveId));
    const moyenne = notesDuNiveau.length ? notesDuNiveau.reduce((s, n) => s + n.valeur, 0) / notesDuNiveau.length : null;
    const paiementsDuNiveau = paiements.filter(p => idsEleves.has(p.eleveId));
    const tauxPaiement = paiementsDuNiveau.length
      ? Math.round((paiementsDuNiveau.filter(p => p.status === 'payé').length / paiementsDuNiveau.length) * 100)
      : 0;
    return { niveau, nbClasses: classesDuNiveau.length, effectif: elevesDuNiveau.length, moyenne, tauxPaiement };
  });

  const NIVEAU_COLORS = ['#2563a8', '#16a34a', '#d97706', '#7c3aed', '#dc2626'];
  const niveauColor = (niveau: string) => NIVEAU_COLORS[niveaux.indexOf(niveau) % NIVEAU_COLORS.length];

  // ----- Moyennes par matière, par niveau -----
  const allMatiereNoms = Array.from(new Set(matieres.map(m => m.nom)));
  const matiereParNiveauData = allMatiereNoms.map(nom => {
    const row: Record<string, any> = { matiere: nom };
    niveaux.forEach(niveau => {
      const classeIdsNiveau = classes.filter(c => c.niveau === niveau).map(c => c.id);
      const matiereIds = matieres.filter(m => m.nom === nom && classeIdsNiveau.includes(m.classeId)).map(m => m.id);
      const ns = notes.filter(n => matiereIds.includes(n.matiereId));
      row[niveau] = ns.length ? parseFloat((ns.reduce((s, n) => s + n.valeur, 0) / ns.length).toFixed(1)) : null;
    });
    return row;
  }).filter(row => niveaux.some(niv => row[niv] !== null));

  // ----- Évolution mensuelle, par niveau -----
  const moisLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  const evolutionParNiveauData = moisLabels.map((label, idx) => {
    const row: Record<string, any> = { mois: label };
    niveaux.forEach(niveau => {
      const nomsClassesNiveau = new Set(classes.filter(c => c.niveau === niveau).map(c => c.nom));
      const idsElevesNiveau = new Set(eleves.filter(e => nomsClassesNiveau.has(e.classe)).map(e => e.id));
      const ns = notes.filter(n => idsElevesNiveau.has(n.eleveId) && new Date(n.date).getMonth() === idx);
      row[niveau] = ns.length ? parseFloat((ns.reduce((s, n) => s + n.valeur, 0) / ns.length).toFixed(1)) : null;
    });
    return row;
  }).filter(row => niveaux.some(niv => row[niv] !== null && row[niv] !== undefined));

  // ----- Répartition des paiements, par niveau -----
  const paiementNiveauData = niveaux.map(niveau => {
    const nomsClassesNiveau = new Set(classes.filter(c => c.niveau === niveau).map(c => c.nom));
    const idsElevesNiveau = new Set(eleves.filter(e => nomsClassesNiveau.has(e.classe)).map(e => e.id));
    const ps = paiements.filter(p => idsElevesNiveau.has(p.eleveId));
    return {
      niveau,
      'Payé': ps.filter(p => p.status === 'payé').length,
      'Impayé': ps.filter(p => p.status === 'impayé').length,
      'Partiel': ps.filter(p => p.status === 'partiel').length,
    };
  });

  // ----- Taux de réussite (part des élèves notés dont la moyenne générale est ≥ 10/20) -----
  const elevesAvecNotes = eleves.filter(e => notes.some(n => n.eleveId === e.id));
  const tauxReussite = elevesAvecNotes.length
    ? Math.round((elevesAvecNotes.filter(e => {
        const ns = notes.filter(n => n.eleveId === e.id);
        return ns.reduce((s, n) => s + n.valeur, 0) / ns.length >= 10;
      }).length / elevesAvecNotes.length) * 100)
    : null;

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Statistiques & Rapports</div><div className="page-subtitle">Indicateurs de performance de l'établissement</div></div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        {[
          { label: 'Élèves total', value: eleves.length, icon: <Users size={20} />, color: '#2563a8', bg: 'var(--primary-pale)' },
          { label: 'Taux de réussite', value: tauxReussite !== null ? `${tauxReussite}%` : '—', icon: <CheckCircle size={20} />, color: '#16a34a', bg: 'var(--success-pale)' },
          { label: 'Moyenne globale', value: notes.length ? (notes.reduce((s, n) => s + n.valeur, 0) / notes.length).toFixed(1) + '/20' : '—', icon: <TrendingUp size={20} />, color: '#0891b2', bg: 'var(--info-pale)' },
          { label: 'Notes saisies', value: notes.length, icon: <BookOpen size={20} />, color: '#d97706', bg: 'var(--warning-pale)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
            <div><div className="stat-label">{s.label}</div><div className="stat-value" style={{ fontSize: 20, color: s.color }}>{s.value}</div></div>
          </div>
        ))}
      </div>

      {/* Performance par niveau */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header"><span style={{ fontWeight: 700 }}>Performance par niveau</span></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Niveau</th>
                <th>Classes</th>
                <th>Effectif</th>
                <th>Moyenne générale</th>
                <th>Taux de paiement</th>
              </tr>
            </thead>
            <tbody>
              {niveauStats.map(n => (
                <tr key={n.niveau}>
                  <td style={{ fontWeight: 700 }}>{n.niveau}</td>
                  <td>{n.nbClasses}</td>
                  <td>{n.effectif}</td>
                  <td>
                    {n.moyenne !== null ? (
                      <span className={`badge badge-${n.moyenne >= 14 ? 'success' : n.moyenne >= 10 ? 'warning' : 'danger'}`}>
                        {n.moyenne.toFixed(1)}/20
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-light)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
                      <div className="progress-bar" style={{ flex: 1 }}>
                        <div className="progress-fill" style={{ width: `${n.tauxPaiement}%`, background: n.tauxPaiement >= 70 ? 'var(--success)' : n.tauxPaiement >= 40 ? 'var(--warning)' : 'var(--danger)' }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{n.tauxPaiement}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header"><span style={{ fontWeight: 700 }}>Moyennes par matière, par niveau</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={matiereParNiveauData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="matiere" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={50} interval={0} />
                <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => [v !== null ? String(v) : '—', '']} />
                <Legend />
                {niveaux.map(niveau => (
                  <Bar key={niveau} dataKey={niveau} fill={niveauColor(niveau)} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span style={{ fontWeight: 700 }}>Évolution mensuelle, par niveau</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={evolutionParNiveauData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => [v !== null ? String(v) : '—', '']} />
                <Legend />
                {niveaux.map(niveau => (
                  <Line key={niveau} type="monotone" dataKey={niveau} stroke={niveauColor(niveau)} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><span style={{ fontWeight: 700 }}>Répartition des paiements, par niveau</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={paiementNiveauData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="niveau" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Payé" stackId="p" fill="#16a34a" />
                <Bar dataKey="Partiel" stackId="p" fill="#d97706" />
                <Bar dataKey="Impayé" stackId="p" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span style={{ fontWeight: 700 }}>Profil de compétences, par niveau</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={matiereParNiveauData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="matiere" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis domain={[0, 20]} tick={{ fontSize: 9 }} />
                <Tooltip formatter={(v: any) => [v !== null ? String(v) : '—', '']} />
                <Legend />
                {niveaux.map(niveau => (
                  <Radar key={niveau} name={niveau} dataKey={niveau} stroke={niveauColor(niveau)} fill={niveauColor(niveau)} fillOpacity={0.15} />
                ))}
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

// ===== BULLETINS =====

const appreciationFor = (avg: number | null) =>
  avg === null ? '—' : avg >= 16 ? 'Très bien' : avg >= 14 ? 'Bien' : avg >= 12 ? 'Assez bien' : avg >= 10 ? 'Passable' : 'Insuffisant';

const normalizeNom = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const hexToRgba = (hex: string, alpha: number) => {
  const clean = (hex || '#2563a8').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const bigint = parseInt(full, 16);
  if (Number.isNaN(bigint)) return `rgba(37, 99, 168, ${alpha})`;
  const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const FACULTATIVE_MATCHERS: { label: string; keywords: string[] }[] = [
  { label: 'EPS', keywords: ['eps', 'sport', 'education physique'] },
  { label: 'Dessin', keywords: ['dessin'] },
  { label: 'Enseign. Ménager', keywords: ['menager', 'menagere'] },
  { label: 'Langues Nation.', keywords: ['langue national'] },
  { label: 'Conduite', keywords: ['conduite'] },
];

const isFacultative = (nomMatiere: string) => {
  const n = normalizeNom(nomMatiere);
  return FACULTATIVE_MATCHERS.some(f => f.keywords.some(k => n.includes(k)));
};

export const BulletinPreview: React.FC<{ eleve: Eleve; classes: Classe[]; matieres: Matiere[]; notes: Note[]; eleves: Eleve[]; professeurs: User[]; trimestre: 1 | 2 | 3 }> = ({ eleve, classes, matieres, notes, eleves, professeurs, trimestre }) => {
  const { settings } = useSettings();
  const classeObj = classes.find(c => c.nom === eleve.classe);
  const allClasseMatieres = matieres.filter(m => m.classeId === classeObj?.id);
  const classeMatieres = allClasseMatieres.filter(m => !isFacultative(m.nom));
  const facultativeMatieresConfig = allClasseMatieres.filter(m => isFacultative(m.nom));
  const classeEleves = eleves.filter(e => e.classe === eleve.classe);

  // Pour une matière et un élève donnés :
  //   Moy Classe   = moyenne des interros et devoirs de CET élève (travail de classe)
  //   Moy de Comp  = moyenne de ses notes de composition/examen
  //   Notes Moy des 2 = moyenne de (Moy Classe, Moy de Comp) = moyenne finale de la matière
  // "Moy Classe" n'est PAS une comparaison avec les autres élèves — seul le
  // "Rang" compare l'élève à ses camarades, sur la base de sa moyenne finale.
  const avgOfType = (ns: Note[], type: Note['type']) => {
    const filtered = ns.filter(n => n.type === type);
    return filtered.length ? filtered.reduce((s, n) => s + n.valeur, 0) / filtered.length : null;
  };
  const subjectAverages = (eleveId: string, matiereId: string, tri: 1 | 2 | 3) => {
    const ns = notes.filter(n => n.eleveId === eleveId && n.matiereId === matiereId && n.trimestre === tri);
    const moyInterro = avgOfType(ns, 'interrogation');
    const moyDevoir = avgOfType(ns, 'devoir');
    const moyComp = avgOfType(ns, 'examen');
    const partiesClasse = [moyInterro, moyDevoir].filter((v): v is number => v !== null);
    const moyClasse = partiesClasse.length ? partiesClasse.reduce((s, v) => s + v, 0) / partiesClasse.length : null;
    const partiesFinal = [moyClasse, moyComp].filter((v): v is number => v !== null);
    const moyDes2 = partiesFinal.length ? partiesFinal.reduce((s, v) => s + v, 0) / partiesFinal.length : null;
    return { moyInterro, moyDevoir, moyComp, moyClasse, moyDes2 };
  };

  const computeRow = (m: Matiere) => {
    const { moyInterro, moyDevoir, moyComp, moyClasse, moyDes2 } = subjectAverages(eleve.id, m.id, trimestre);
    let rang: number | null = null;
    if (moyDes2 !== null) {
      const ranked = classeEleves
        .map(ce => ({ id: ce.id, moy: subjectAverages(ce.id, m.id, trimestre).moyDes2 }))
        .filter((x): x is { id: string; moy: number } => x.moy !== null)
        .sort((a, b) => b.moy - a.moy);
      rang = ranked.findIndex(x => x.id === eleve.id) + 1;
    }
    const prof = professeurs.find(p => p.id === m.professeurId);
    return { matiere: m, moyInterro, moyDevoir, moyComp, moyClasse, moyDes2, rang, totalClasse: classeEleves.length, prof };
  };

  const rowsData = classeMatieres.map(computeRow);

  const totalCoeff = rowsData.filter(r => r.moyDes2 !== null).reduce((s, r) => s + r.matiere.coefficient, 0);
  const totalProduit = rowsData.filter(r => r.moyDes2 !== null).reduce((s, r) => s + (r.moyDes2 as number) * r.matiere.coefficient, 0);
  const moyenneGenerale = totalCoeff ? totalProduit / totalCoeff : null;

  const facultativeRows = FACULTATIVE_MATCHERS.map(f => {
    const matched = facultativeMatieresConfig.find(m => f.keywords.some(k => normalizeNom(m.nom).includes(k)));
    return matched ? { label: matched.nom, row: computeRow(matched) } : { label: f.label, row: null };
  });

  const moyenneEleveTrimestre = (eleveId: string, tri: 1 | 2 | 3) => {
    const parties = classeMatieres.map(m => ({ avg: subjectAverages(eleveId, m.id, tri).moyDes2, coeff: m.coefficient })).filter((x): x is { avg: number; coeff: number } => x.avg !== null);
    if (!parties.length) return null;
    return parties.reduce((s, x) => s + x.avg * x.coeff, 0) / parties.reduce((s, x) => s + x.coeff, 0);
  };

  const classementGeneral = (() => {
    const ranked = classeEleves.map(ce => ({ id: ce.id, moy: moyenneEleveTrimestre(ce.id, trimestre) })).filter((x): x is { id: string; moy: number } => x.moy !== null).sort((a, b) => b.moy - a.moy);
    const idx = ranked.findIndex(x => x.id === eleve.id);
    return idx >= 0 ? `${idx + 1}${idx === 0 ? 'er' : 'ème'} / ${ranked.length}` : '—';
  })();

  const moyAnnuelleFor = (eleveId: string) => {
    const parTrim = ([1, 2, 3] as const).map(t => moyenneEleveTrimestre(eleveId, t)).filter((v): v is number => v !== null);
    return parTrim.length ? parTrim.reduce((s, v) => s + v, 0) / parTrim.length : null;
  };
  const moyenneAnnuelle = moyAnnuelleFor(eleve.id);

  const classementAnnuel = (() => {
    const ranked = classeEleves.map(ce => ({ id: ce.id, moy: moyAnnuelleFor(ce.id) })).filter((x): x is { id: string; moy: number } => x.moy !== null).sort((a, b) => b.moy - a.moy);
    const idx = ranked.findIndex(x => x.id === eleve.id);
    return idx >= 0 ? `${idx + 1}${idx === 0 ? 'er' : 'ème'} / ${ranked.length}` : '—';
  })();

  const mention = moyenneGenerale === null ? '—' : moyenneGenerale >= 16 ? 'Excellent' : moyenneGenerale >= 14 ? 'Très bien' : moyenneGenerale >= 12 ? 'Bien' : moyenneGenerale >= 10 ? 'Passable' : 'Insuffisant';

  const accent = settings.couleurBulletin || '#2563a8';
  const accentPale = hexToRgba(accent, 0.12);

  const renderRow = (label: string, r: ReturnType<typeof computeRow> | null, key: string) => (
    <tr key={key} style={{ background: 'white' }}>
      <td style={{ padding: '3px 5px', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{label}</td>
      <td style={{ padding: '3px 5px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>{r?.moyInterro !== null && r?.moyInterro !== undefined ? r.moyInterro.toFixed(2) : '—'}</td>
      <td style={{ padding: '3px 5px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>{r?.moyDevoir !== null && r?.moyDevoir !== undefined ? r.moyDevoir.toFixed(2) : '—'}</td>
      <td style={{ padding: '3px 5px', textAlign: 'center', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{r?.moyClasse !== null && r?.moyClasse !== undefined ? r.moyClasse.toFixed(2) : '—'}</td>
      <td style={{ padding: '3px 5px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>{r?.moyComp !== null && r?.moyComp !== undefined ? r.moyComp.toFixed(2) : '—'}</td>
      <td style={{ padding: '3px 5px', textAlign: 'center', fontWeight: 700, borderBottom: '1px solid var(--border)', color: !r || r.moyDes2 === null ? 'var(--text-light)' : r.moyDes2 >= 14 ? 'var(--success)' : r.moyDes2 >= 10 ? 'var(--warning)' : 'var(--danger)' }}>
        {r?.moyDes2 !== null && r?.moyDes2 !== undefined ? r.moyDes2.toFixed(2) : '—'}
      </td>
      <td style={{ padding: '3px 5px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>{r ? r.matiere.coefficient : '—'}</td>
      <td style={{ padding: '3px 5px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>{r?.moyDes2 !== null && r?.moyDes2 !== undefined ? (r.moyDes2 * r.matiere.coefficient).toFixed(2) : '—'}</td>
      <td style={{ padding: '3px 5px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>{r?.rang ? `${r.rang}/${r.totalClasse}` : '—'}</td>
      <td style={{ padding: '3px 5px', borderBottom: '1px solid var(--border)', fontSize: 9 }}>{r?.prof ? `${r.prof.prenom} ${r.prof.nom}` : '—'}</td>
      <td style={{ padding: '3px 5px', borderBottom: '1px solid var(--border)', fontSize: 9 }}>{r ? appreciationFor(r.moyDes2) : '—'}</td>
      <td style={{ padding: '3px 5px', borderBottom: '1px solid var(--border)' }} />
    </tr>
  );

  return (
    <div className="card bulletin-print" style={{ padding: '14px 18px', maxWidth: 920, margin: '0 auto', fontSize: 10, background: settings.couleurFondBulletin }}>
      {/* En-tête officiel */}
      <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 190px', gap: 8, alignItems: 'center', borderBottom: '2px solid var(--text)', paddingBottom: 6, marginBottom: 6 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', border: `2px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: 7, fontWeight: 800, color: accent, lineHeight: 1.1, padding: 3 }}>
          {settings.nomEcole.split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 6).toUpperCase()}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>{settings.ministere}</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: accent, marginTop: 1 }}>{settings.nomEcole}</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>
            B.P: {settings.bp} {settings.ville}-{settings.pays} — Tél : {settings.telephone1}{settings.telephone2 ? ` / ${settings.telephone2}` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 9, fontWeight: 700 }}>
          <div>{settings.republique.toUpperCase()}</div>
          <div style={{ fontWeight: 400, fontSize: 8, marginTop: 1 }}>{settings.deviseNationale}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 800 }}>BULLETIN DE NOTES N°.... DU {trimestre}{trimestre === 1 ? 'er' : 'ème'} TRIMESTRE</div>
        <div style={{ display: 'flex', gap: 12, fontSize: 9 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 10, height: 10, border: '1px solid var(--text)', display: 'inline-block' }} /> Doublant</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 10, height: 10, border: '1px solid var(--text)', display: 'inline-block' }} /> Nouveau</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 10, marginBottom: 2 }}>
        <div>Année scolaire <b>{settings.anneeScolaire}</b></div>
        <div>Classe <b>{eleve.classe}</b></div>
        <div>Effectif <b>{classeEleves.length}</b></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 6, borderBottom: '1px solid var(--border)', paddingBottom: 5, flexWrap: 'wrap', gap: 6 }}>
        <div>Nom et prénoms de l'élève <b>{eleve.nom} {eleve.prenom}</b></div>
        <div>N° MLE <b>—</b></div>
      </div>

      {/* Tableau principal */}
      <div className="table-wrap">
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 2 }}>
          <thead>
            <tr style={{ background: accent, color: 'white' }}>
              <th style={{ padding: '3px 5px', textAlign: 'left', fontSize: 8 }}>Matières</th>
              <th style={{ padding: '3px 5px', textAlign: 'center', fontSize: 8 }}>Interro /20</th>
              <th style={{ padding: '3px 5px', textAlign: 'center', fontSize: 8 }}>Devoir /20</th>
              <th style={{ padding: '3px 5px', textAlign: 'center', fontSize: 8 }}>Moy classe /20</th>
              <th style={{ padding: '3px 5px', textAlign: 'center', fontSize: 8 }}>Moy comp /20</th>
              <th style={{ padding: '3px 5px', textAlign: 'center', fontSize: 8 }}>Moy des 2 /20</th>
              <th style={{ padding: '3px 5px', textAlign: 'center', fontSize: 8 }}>Coef</th>
              <th style={{ padding: '3px 5px', textAlign: 'center', fontSize: 8 }}>Produit</th>
              <th style={{ padding: '3px 5px', textAlign: 'center', fontSize: 8 }}>Rang</th>
              <th style={{ padding: '3px 5px', textAlign: 'left', fontSize: 8 }}>Prof</th>
              <th style={{ padding: '3px 5px', textAlign: 'left', fontSize: 8 }}>Appréc.</th>
              <th style={{ padding: '3px 5px', textAlign: 'left', fontSize: 8 }}>Signature</th>
            </tr>
          </thead>
          <tbody>
            {rowsData.map(r => renderRow(r.matiere.nom, r, r.matiere.id))}
            <tr style={{ background: accentPale, fontWeight: 700 }}>
              <td style={{ padding: '4px 5px' }}>TOTAL</td>
              <td colSpan={5} />
              <td style={{ padding: '4px 5px', textAlign: 'center' }}>{totalCoeff || '—'}</td>
              <td style={{ padding: '4px 5px', textAlign: 'center' }}>{totalProduit ? totalProduit.toFixed(2) : '—'}</td>
              <td colSpan={3} />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Matières facultatives */}
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 10, margin: '6px 0 3px' }}>MATIÈRES FACULTATIVES</div>
      <div className="table-wrap">
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 6 }}>
          <tbody>
            {facultativeRows.map((f, i) => renderRow(f.label, f.row, 'fac-' + i))}
          </tbody>
        </table>
      </div>

      {/* Majoration / Observation du titulaire */}
      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8, marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 2 }}>MAJORATION</div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 5, minHeight: 20 }} />
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 2 }}>OBSERVATION DU TITULAIRE</div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 5, minHeight: 20 }} />
        </div>
      </div>

      {/* Total des points */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8, marginBottom: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 10, marginBottom: 4 }}>TOTAL DES POINTS</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {[
              ['Moyenne du trimestre', moyenneGenerale !== null ? moyenneGenerale.toFixed(2) + '/20 (' + mention + ')' : '—'],
              ['Classement du trimestre', classementGeneral],
              ['Moyenne annuelle', moyenneAnnuelle !== null ? moyenneAnnuelle.toFixed(2) + '/20' : '—'],
              ['Classement annuel', classementAnnuel],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted var(--border)', paddingBottom: 2, fontSize: 10 }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}</span><span style={{ fontWeight: 700 }}>{val}</span>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>Moyenne annuelle en toutes lettres</div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 5, minHeight: 16, marginBottom: 4, padding: 4, fontSize: 9 }} />
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>Décision et observation du conseil</div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 5, minHeight: 16, padding: 4, fontSize: 9 }} />
          </div>
        </div>
      </div>

      {/* Assiduité / Décision */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 6, fontSize: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {['Travail', 'Conduite', "Nbre d'absences"].map(label => (
            <div key={label} style={{ display: 'flex', gap: 6, borderBottom: '1px dotted var(--border)', paddingBottom: 2 }}>
              <span style={{ color: 'var(--text-muted)' }}>{label}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ display: 'flex', gap: 6, borderBottom: '1px dotted var(--border)', paddingBottom: 2, marginBottom: 3 }}><span style={{ color: 'var(--text-muted)' }}>Passe en</span></div>
          <div style={{ display: 'flex', gap: 6, borderBottom: '1px dotted var(--border)', paddingBottom: 2, marginBottom: 3 }}><span style={{ color: 'var(--text-muted)' }}>Double la</span></div>
          <div style={{ display: 'flex', gap: 6, borderBottom: '1px dotted var(--border)', paddingBottom: 2 }}><span style={{ color: 'var(--text-muted)' }}>Exclu pour</span></div>
        </div>
      </div>

      {/* Résultat */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8, marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 10, marginBottom: 4, textAlign: 'center' }}>RÉSULTAT</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, fontSize: 9 }}>
          {[
            "Doit s'appliquer", 'Peut mieux faire', 'Travail satisfaisant', 'Bon travail', 'Excellent élève',
            'A fait des efforts', "Peu d'amélioration pour le travail", 'Elève faible', 'Ne fait aucun effort', 'Discipline insuffisante',
          ].map(m => (
            <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 8, height: 8, border: '1px solid var(--text)', display: 'inline-block', flexShrink: 0 }} /> {m}
            </div>
          ))}
        </div>
      </div>

      {/* Signatures */}
      <div style={{ display: 'flex', gap: 20, justifyContent: 'flex-end', paddingTop: 6, borderTop: '1px solid var(--border)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 18 }}>Signature du Directeur</div>
          <div style={{ borderTop: '1px solid var(--text)', paddingTop: 3, fontSize: 9, color: 'var(--text-muted)' }}>Cachet et signature</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 18 }}>Signature du Parent</div>
          <div style={{ borderTop: '1px solid var(--text)', paddingTop: 3, fontSize: 9, color: 'var(--text-muted)' }}>Signature</div>
        </div>
      </div>
    </div>
  );
};

// ===== REÇUS DE PAIEMENT =====

const UNITES_FR = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const DIZAINES_FR: Record<number, string> = { 2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante' };

const deuxChiffresEnLettres = (n: number): string => {
  if (n < 20) return UNITES_FR[n];
  const d = Math.floor(n / 10), u = n % 10;
  if (d === 7 || d === 9) {
    const base = d === 7 ? 'soixante' : 'quatre-vingt';
    if (u === 0) return base + '-dix';
    if (u === 1) return base + (d === 7 ? ' et onze' : '-onze');
    return base + '-' + UNITES_FR[10 + u];
  }
  if (d === 8) return u === 0 ? 'quatre-vingts' : 'quatre-vingt-' + UNITES_FR[u];
  if (u === 0) return DIZAINES_FR[d];
  if (u === 1) return DIZAINES_FR[d] + ' et un';
  return DIZAINES_FR[d] + '-' + UNITES_FR[u];
};

const nombreEnLettres = (n: number): string => {
  if (n === 0) return 'zéro';
  if (n < 100) return deuxChiffresEnLettres(n);
  if (n < 1000) {
    const c = Math.floor(n / 100), r = n % 100;
    const centPart = (c === 1 ? 'cent' : UNITES_FR[c] + ' cent') + (r === 0 && c > 1 ? 's' : '');
    return r === 0 ? centPart : centPart + ' ' + nombreEnLettres(r);
  }
  if (n < 1000000) {
    const m = Math.floor(n / 1000), r = n % 1000;
    const millePart = m === 1 ? 'mille' : nombreEnLettres(m) + ' mille';
    return r === 0 ? millePart : millePart + ' ' + nombreEnLettres(r);
  }
  const mi = Math.floor(n / 1000000), r = n % 1000000;
  const millionPart = mi === 1 ? 'un million' : nombreEnLettres(mi) + ' millions';
  return r === 0 ? millionPart : millionPart + ' ' + nombreEnLettres(r);
};

const montantEnLettres = (montant: number, devise: string) => {
  const mot = nombreEnLettres(Math.round(montant));
  return mot.charAt(0).toUpperCase() + mot.slice(1) + ' ' + (devise === 'FCFA' ? 'francs CFA' : devise);
};

const MOTIF_LABELS: Record<Paiement['type'], string> = {
  inscription: "Frais d'inscription",
  mensualite: 'Mensualité',
  transport: 'Frais de transport',
  cantine: 'Frais de cantine',
};

export const ReceiptPreview: React.FC<{ paiement: Paiement; eleve?: Eleve }> = ({ paiement, eleve }) => {
  const { settings } = useSettings();
  const motif = MOTIF_LABELS[paiement.type] + (paiement.type === 'mensualite' && paiement.mois ? ` — ${paiement.mois}` : '');
  const accent = settings.couleurBulletin || '#2563a8';

  return (
    <div className="card receipt-print" style={{ padding: 32, maxWidth: 420, margin: '0 auto', border: '1px solid var(--text)', borderRadius: 4, background: settings.couleurFondBulletin }}>
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: accent }}>{settings.nomEcole}</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{settings.ville}, {settings.pays}</div>
      </div>

      <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 1, marginBottom: 22 }}>
        BPF <span style={{ borderBottom: '1px solid var(--text)', paddingBottom: 2, marginLeft: 6 }}>{paiement.montant.toLocaleString('fr-FR')}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 1 }}>REÇU</div>
        <div style={{ fontSize: 12 }}>N° <b>{paiement.reference}</b></div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontSize: 13 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span>de M</span>
          <span style={{ flex: 1, fontWeight: 700, borderBottom: '1px dotted var(--text)', paddingBottom: 2, minHeight: 16 }}>
            {eleve ? `${eleve.prenom} ${eleve.nom}` : ''}
          </span>
        </div>
        <div>
          <div style={{ borderBottom: '1px dotted var(--text)', minHeight: 18, fontWeight: 700 }}>{montantEnLettres(paiement.montant, 'BPF')}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>la somme de</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span>pour</span>
          <span style={{ flex: 1, fontWeight: 700, borderBottom: '1px dotted var(--text)', paddingBottom: 2 }}>
            {motif}{eleve ? ` (${eleve.classe})` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 6 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span>Date</span>
            <span style={{ fontWeight: 700, borderBottom: '1px dotted var(--text)', paddingBottom: 2 }}>{new Date(paiement.date).toLocaleDateString('fr-FR')}</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ height: 30 }} />
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>signature</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const BulletinsPage: React.FC = () => {
  const [classes, setClasses] = useState<Classe[]>([]);
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [professeurs, setProfesseurs] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchClasses(), fetchMatieres(), fetchEleves(), fetchNotes(), fetchUsersByRole('professeur').catch(() => [] as User[])])
      .then(([c, m, e, n, p]) => { if (!cancelled) { setClasses(c); setMatieres(m); setEleves(e); setNotes(n); setProfesseurs(p); setSelectedClasse(prev => prev || c[0]?.id || ''); } })
      .catch(err => { if (!cancelled) setError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const [selectedClasse, setSelectedClasse] = useState('');
  const [selectedTrimestre, setSelectedTrimestre] = useState<1 | 2 | 3>(1);
  const [viewEleve, setViewEleve] = useState<string | null>(null);
  const [viewAllClasse, setViewAllClasse] = useState(false);
  const [exporting, setExporting] = useState(false);
  const bulletinRef = useRef<HTMLDivElement>(null);
  const allBulletinRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const classeObj = classes.find(c => c.id === selectedClasse);
  const classeEleves = eleves.filter(e => e.classe === classeObj?.nom);

  const moyenneEleve = (eleveId: string) => {
    const classeMatieres = matieres.filter(m => m.classeId === selectedClasse);
    const eleveNotes = notes.filter(n => n.eleveId === eleveId && n.trimestre === selectedTrimestre);
    const parties = classeMatieres.map(m => {
      const ns = eleveNotes.filter(n => n.matiereId === m.id);
      const avg = ns.length ? ns.reduce((s, n) => s + n.valeur, 0) / ns.length : null;
      return { avg, coeff: m.coefficient };
    }).filter(x => x.avg !== null);
    if (!parties.length) return null;
    return parties.reduce((s, x) => s + (x.avg as number) * x.coeff, 0) / parties.reduce((s, x) => s + x.coeff, 0);
  };

  const bulletinFilename = (e: Eleve) => `bulletin-${e.nom}-${e.prenom}-T${selectedTrimestre}.pdf`.replace(/\s+/g, '_');

  const handleDownloadPdf = async () => {
    if (!bulletinRef.current || !viewEleveObj || exporting) return;
    setExporting(true);
    try {
      await downloadElementAsPdf(bulletinRef.current, bulletinFilename(viewEleveObj));
    } finally {
      setExporting(false);
    }
  };

  const handleQuickDownload = (eleveId: string) => {
    setViewEleve(eleveId);
    setTimeout(async () => {
      const el = bulletinRef.current;
      const e = eleves.find(x => x.id === eleveId);
      if (!el || !e) return;
      setExporting(true);
      try {
        await downloadElementAsPdf(el, bulletinFilename(e));
      } finally {
        setExporting(false);
      }
    }, 150);
  };

  const handleDownloadAllPdf = async () => {
    if (exporting) return;
    const elements = classeEleves.map(e => allBulletinRefs.current[e.id]).filter((el): el is HTMLDivElement => !!el);
    if (!elements.length) return;
    setExporting(true);
    try {
      await downloadElementsAsPdf(elements, `bulletins-${classeObj?.nom || 'classe'}-T${selectedTrimestre}.pdf`.replace(/\s+/g, '_'));
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Chargement...</div>;
  if (error) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>{error}</div>;

  const viewEleveObj = viewEleve ? eleves.find(e => e.id === viewEleve) : undefined;

  return (
    <div>
      <div className="no-print">
        <div className="page-header">
          <div className="flex items-center justify-between">
            <div><div className="page-title">Bulletins scolaires</div><div className="page-subtitle">Liste par classe — consultation et téléchargement</div></div>
            {classeEleves.length > 0 && (
              <button className="btn btn-accent" onClick={() => setTimeout(() => setViewAllClasse(true), 0)}>
                <Download size={14} /> Télécharger tous les bulletins ({classeEleves.length})
              </button>
            )}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label className="form-label">Classe</label>
              <select className="form-control" value={selectedClasse} onChange={e => setSelectedClasse(e.target.value)}>
                {classes.map(c => <option key={c.id} value={c.id}>{c.nom} — {c.niveau}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Trimestre</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {([1, 2, 3] as const).map(t => <button key={t} className={`btn ${selectedTrimestre === t ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSelectedTrimestre(t)}>T{t}</button>)}
              </div>
            </div>
          </div>
        </div>

        {/* Liste des élèves de la classe */}
        <div className="card">
          <div className="card-header">
            <span style={{ fontWeight: 700 }}>{classeObj?.nom} — {classeEleves.length} élève{classeEleves.length > 1 ? 's' : ''}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Élève</th>
                  <th>Moyenne générale</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {classeEleves.length === 0 ? (
                  <tr><td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Aucun élève dans cette classe</td></tr>
                ) : classeEleves.map(e => {
                  const moy = moyenneEleve(e.id);
                  return (
                    <tr key={e.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="avatar avatar-sm" style={{ background: 'var(--primary-pale)', color: 'var(--primary-light)', fontWeight: 700 }}>{e.prenom[0]}{e.nom[0]}</div>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{e.prenom} {e.nom}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge badge-${moy === null ? 'neutral' : moy >= 14 ? 'success' : moy >= 10 ? 'warning' : 'danger'}`}>
                          {moy !== null ? moy.toFixed(2) + '/20' : '—'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setViewEleve(e.id)}>Voir le bulletin</button>
                        <button className="btn btn-accent btn-sm" onClick={() => handleQuickDownload(e.id)} disabled={exporting}><Download size={12} /> PDF</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Aperçu du bulletin sélectionné */}
      {viewEleve && viewEleveObj && (
        <div className="modal-overlay bulletin-modal-overlay" onClick={() => setViewEleve(null)}>
          <div className="modal bulletin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 760 }}>
            <div className="modal-header no-print">
              <div className="modal-title">Aperçu du bulletin</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-accent btn-sm" onClick={handleDownloadPdf} disabled={exporting}><Download size={13} /> {exporting ? 'Génération...' : 'Télécharger PDF'}</button>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setViewEleve(null)}><X size={16} /></button>
              </div>
            </div>
            <div className="modal-body" style={{ background: 'var(--surface2)' }}>
              <div ref={bulletinRef}>
                <BulletinPreview eleve={viewEleveObj} classes={classes} matieres={matieres} notes={notes} eleves={eleves} professeurs={professeurs} trimestre={selectedTrimestre} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tous les bulletins de la classe, un par page dans un seul PDF */}
      {viewAllClasse && (
        <div className="modal-overlay bulletin-modal-overlay" onClick={() => setViewAllClasse(false)}>
          <div className="modal bulletin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 760 }}>
            <div className="modal-header no-print">
              <div className="modal-title">Tous les bulletins — {classeObj?.nom} ({classeEleves.length})</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-accent btn-sm" onClick={handleDownloadAllPdf} disabled={exporting}><Download size={13} /> {exporting ? 'Génération...' : 'Télécharger PDF (tout)'}</button>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setViewAllClasse(false)}><X size={16} /></button>
              </div>
            </div>
            <div className="modal-body" style={{ background: 'var(--surface2)', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {classeEleves.map(e => (
                <div key={e.id} className="bulletin-page-break" ref={el => { allBulletinRefs.current[e.id] = el; }}>
                  <BulletinPreview eleve={e} classes={classes} matieres={matieres} notes={notes} eleves={eleves} professeurs={professeurs} trimestre={selectedTrimestre} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ===== SETTINGS =====
export const SettingsPage: React.FC = () => {
  const { settings, updateSettings, t } = useSettings();
  const [tab, setTab] = useState<'general' | 'notifications' | 'securite' | 'apparence'>('general');
  const [draft, setDraft] = useState(settings);
  const [saved, setSaved] = useState(false);
  const [pwd, setPwd] = useState({ actuel: '', nouveau: '', confirmer: '' });
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const tabs: { id: typeof tab; labelKey: string }[] = [
    { id: 'general', labelKey: 'settings.tab.general' },
    { id: 'notifications', labelKey: 'settings.tab.notifications' },
    { id: 'securite', labelKey: 'settings.tab.securite' },
    { id: 'apparence', labelKey: 'settings.tab.apparence' },
  ];

  const handleSaveGeneral = () => {
    updateSettings(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleChangePwd = () => {
    if (!pwd.actuel || pwd.nouveau.length < 6 || pwd.nouveau !== pwd.confirmer) {
      setPwdMsg({ ok: false, text: t('settings.erreurMotDePasse') });
      return;
    }
    setPwdMsg({ ok: true, text: t('settings.motDePasseChange') });
    setPwd({ actuel: '', nouveau: '', confirmer: '' });
    setTimeout(() => setPwdMsg(null), 3000);
  };

  return (
    <div>
      <div className="page-header"><div className="page-title">{t('settings.title')}</div><div className="page-subtitle">{t('settings.subtitle')}</div></div>
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 24 }}>
        <div className="card" style={{ padding: 0, alignSelf: 'start' }}>
          {tabs.map(item => (
            <div key={item.id} onClick={() => setTab(item.id)}
              style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: tab === item.id ? 'var(--primary-pale)' : 'transparent', color: tab === item.id ? 'var(--primary-light)' : 'var(--text)', borderRadius: tab === item.id ? 'var(--radius-sm)' : 0, margin: 4 }}>
              {t(item.labelKey)}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {tab === 'general' && (
            <div className="card">
              <div className="card-header"><span style={{ fontWeight: 700 }}>{t('settings.etablissement')}</span></div>
              <div className="card-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{t('settings.nom')}</label>
                    <input className="form-control" value={draft.nomEcole} onChange={e => setDraft(d => ({ ...d, nomEcole: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('settings.annee')}</label>
                    <input className="form-control" value={draft.anneeScolaire} onChange={e => setDraft(d => ({ ...d, anneeScolaire: e.target.value }))} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{t('settings.ville')}</label>
                    <input className="form-control" value={draft.ville} onChange={e => setDraft(d => ({ ...d, ville: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('settings.pays')}</label>
                    <input className="form-control" value={draft.pays} onChange={e => setDraft(d => ({ ...d, pays: e.target.value }))} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Boîte postale (B.P.)</label>
                    <input className="form-control" value={draft.bp} onChange={e => setDraft(d => ({ ...d, bp: e.target.value }))} placeholder="5090" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Téléphone(s)</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="form-control" value={draft.telephone1} onChange={e => setDraft(d => ({ ...d, telephone1: e.target.value }))} placeholder="90 84 18 10" />
                      <input className="form-control" value={draft.telephone2} onChange={e => setDraft(d => ({ ...d, telephone2: e.target.value }))} placeholder="91 99 36 29" />
                    </div>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Ministère (en-tête bulletin)</label>
                    <input className="form-control" value={draft.ministere} onChange={e => setDraft(d => ({ ...d, ministere: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">République / devise nationale</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="form-control" value={draft.republique} onChange={e => setDraft(d => ({ ...d, republique: e.target.value }))} />
                      <input className="form-control" value={draft.deviseNationale} onChange={e => setDraft(d => ({ ...d, deviseNationale: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Couleur du bulletin de notes</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="color" value={draft.couleurBulletin} onChange={e => setDraft(d => ({ ...d, couleurBulletin: e.target.value }))} style={{ width: 44, height: 38, padding: 2, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }} />
                      <input className="form-control" value={draft.couleurBulletin} onChange={e => setDraft(d => ({ ...d, couleurBulletin: e.target.value }))} placeholder="#2563a8" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Couleur de fond du bulletin</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="color" value={draft.couleurFondBulletin} onChange={e => setDraft(d => ({ ...d, couleurFondBulletin: e.target.value }))} style={{ width: 44, height: 38, padding: 2, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }} />
                      <input className="form-control" value={draft.couleurFondBulletin} onChange={e => setDraft(d => ({ ...d, couleurFondBulletin: e.target.value }))} placeholder="#ffffff" />
                    </div>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{t('settings.devise')}</label>
                    <select className="form-control" value={draft.devise} onChange={e => setDraft(d => ({ ...d, devise: e.target.value }))}>
                      <option value="FCFA">FCFA</option>
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('settings.langue')}</label>
                    <select className="form-control" value={draft.langue} onChange={e => setDraft(d => ({ ...d, langue: e.target.value as 'fr' | 'en' }))}>
                      <option value="fr">Français</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
                  {saved && <span style={{ color: 'var(--success)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={14} /> {t('settings.enregistre')}</span>}
                  <button className="btn btn-primary" onClick={handleSaveGeneral}><Save size={14} /> {t('settings.enregistrer')}</button>
                </div>
              </div>
            </div>
          )}

          {tab === 'notifications' && (
            <div className="card">
              <div className="card-header"><span style={{ fontWeight: 700 }}>{t('settings.tab.notifications')}</span></div>
              <div className="card-body">
                {[
                  { label: t('settings.notifEmail'), key: 'emailNotif' as const, desc: t('settings.notifEmailDesc') },
                  { label: t('settings.notifSms'), key: 'smsNotif' as const, desc: t('settings.notifSmsDesc') },
                ].map(item => (
                  <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{item.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.desc}</div>
                    </div>
                    <button onClick={() => updateSettings({ [item.key]: !settings[item.key] })}
                      style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: settings[item.key] ? 'var(--success)' : 'var(--border)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                      <div style={{ position: 'absolute', top: 3, left: settings[item.key] ? 22 : 2, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'securite' && (
            <div className="card">
              <div className="card-header"><span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><Lock size={15} /> {t('settings.tab.securite')}</span></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">{t('settings.motDePasseActuel')}</label>
                  <input className="form-control" type="password" value={pwd.actuel} onChange={e => setPwd(p => ({ ...p, actuel: e.target.value }))} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{t('settings.nouveauMotDePasse')}</label>
                    <input className="form-control" type="password" value={pwd.nouveau} onChange={e => setPwd(p => ({ ...p, nouveau: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('settings.confirmerMotDePasse')}</label>
                    <input className="form-control" type="password" value={pwd.confirmer} onChange={e => setPwd(p => ({ ...p, confirmer: e.target.value }))} />
                  </div>
                </div>
                {pwdMsg && (
                  <div style={{ background: pwdMsg.ok ? 'var(--success-pale)' : 'var(--danger-pale)', color: pwdMsg.ok ? 'var(--success)' : 'var(--danger)', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
                    {pwdMsg.text}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={handleChangePwd}>{t('settings.changerMotDePasse')}</button>
                </div>
              </div>
            </div>
          )}

          {tab === 'apparence' && (
            <div className="card">
              <div className="card-header"><span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><Palette size={15} /> {t('settings.theme')}</span></div>
              <div className="card-body">
                <div style={{ display: 'flex', gap: 12 }}>
                  {(['clair', 'sombre'] as const).map(th => (
                    <button key={th} onClick={() => updateSettings({ theme: th })}
                      className={`btn ${settings.theme === th ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ flex: 1, justifyContent: 'center', padding: '14px', border: settings.theme === th ? 'none' : '1px solid var(--border)' }}>
                      {th === 'clair' ? t('settings.themeClair') : t('settings.themeSombre')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

// ===== TITULAIRE (professeur) =====
const getColorTitulaire = (v: number) => v >= 14 ? 'note-high' : v >= 10 ? 'note-mid' : 'note-low';

export const TitulairePage: React.FC = () => {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Classe[]>([]);
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [professeurs, setProfesseurs] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClasse, setSelectedClasse] = useState('');
  const [selectedTrimestre, setSelectedTrimestre] = useState<1 | 2 | 3>(1);
  const [viewEleve, setViewEleve] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const bulletinRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchClasses(), fetchMatieres(), fetchEleves(), fetchNotes(), fetchPaiements(), fetchUsersByRole('professeur').catch(() => [] as User[])])
      .then(([c, m, e, n, p, prof]) => {
        if (cancelled) return;
        setClasses(c); setMatieres(m); setEleves(e); setNotes(n); setPaiements(p); setProfesseurs(prof);
        const mine = c.filter(cl => cl.professeurPrincipalId === user?.id);
        setSelectedClasse(prev => prev || mine[0]?.id || '');
      })
      .catch(err => { if (!cancelled) setError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (loading) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Chargement...</div>;
  if (error) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>{error}</div>;

  const mesClasses = classes.filter(c => c.professeurPrincipalId === user?.id);

  if (!mesClasses.length) {
    return (
      <div>
        <div className="page-header"><div className="page-title">Classe titulaire</div><div className="page-subtitle">Vue d'ensemble de votre classe</div></div>
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Vous n'êtes titulaire d'aucune classe pour le moment.
        </div>
      </div>
    );
  }

  const classeObj = classes.find(c => c.id === selectedClasse) || mesClasses[0];
  const classeEleves = eleves.filter(e => e.classe === classeObj.nom);
  const classeMatieres = matieres.filter(m => m.classeId === classeObj.id);

  const avgFor = (eleveId: string, matiereId: string) => {
    const ns = notes.filter(n => n.eleveId === eleveId && n.matiereId === matiereId && n.trimestre === selectedTrimestre);
    return ns.length ? ns.reduce((s, n) => s + n.valeur, 0) / ns.length : null;
  };
  const moyenneGeneraleEleve = (eleveId: string) => {
    const parties = classeMatieres.map(m => ({ avg: avgFor(eleveId, m.id), coeff: m.coefficient })).filter(x => x.avg !== null);
    if (!parties.length) return null;
    return parties.reduce((s, x) => s + (x.avg as number) * x.coeff, 0) / parties.reduce((s, x) => s + x.coeff, 0);
  };

  const paiementsClasse = paiements.filter(p => classeEleves.some(e => e.id === p.eleveId));
  const tauxPaiement = paiementsClasse.length
    ? Math.round((paiementsClasse.filter(p => p.status === 'payé').length / paiementsClasse.length) * 100)
    : 0;
  const moyennesValides = classeEleves.map(e => moyenneGeneraleEleve(e.id)).filter((v): v is number => v !== null);
  const moyenneClasse = moyennesValides.length ? moyennesValides.reduce((s, v) => s + v, 0) / moyennesValides.length : null;

  const viewEleveObj = viewEleve ? eleves.find(e => e.id === viewEleve) : undefined;

  const handleDownloadPdf = async () => {
    if (!bulletinRef.current || !viewEleveObj || exporting) return;
    setExporting(true);
    try {
      await downloadElementAsPdf(bulletinRef.current, `bulletin-${viewEleveObj.nom}-${viewEleveObj.prenom}-T${selectedTrimestre}.pdf`.replace(/\s+/g, '_'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Classe titulaire — {classeObj.nom}</div><div className="page-subtitle">Vue complète : toutes les matières, tous les élèves</div></div>
      </div>

      <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {mesClasses.length > 1 && (
            <div style={{ minWidth: 200 }}>
              <label className="form-label">Classe (dont vous êtes titulaire)</label>
              <select className="form-control" value={selectedClasse} onChange={e => setSelectedClasse(e.target.value)}>
                {mesClasses.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="form-label">Trimestre</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {([1, 2, 3] as const).map(t => <button key={t} className={`btn ${selectedTrimestre === t ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSelectedTrimestre(t)}>T{t}</button>)}
            </div>
          </div>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        {[
          { label: 'Effectif', value: classeEleves.length },
          { label: 'Moyenne de la classe', value: moyenneClasse !== null ? moyenneClasse.toFixed(2) + '/20' : '—' },
          { label: 'Taux de paiement', value: tauxPaiement + '%' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ flexDirection: 'column', gap: 4 }}>
            <div className="stat-label">{s.label}</div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header"><span style={{ fontWeight: 700 }}>Notes de tous les élèves, toutes matières</span></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Élève</th>
                {classeMatieres.map(m => (
                  <th key={m.id} style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.couleur }} />
                      {m.nom}
                    </div>
                  </th>
                ))}
                <th style={{ textAlign: 'center' }}>Moy. générale</th>
                <th style={{ textAlign: 'right' }}>Bulletin</th>
              </tr>
            </thead>
            <tbody>
              {classeEleves.map(e => {
                const moyGen = moyenneGeneraleEleve(e.id);
                return (
                  <tr key={e.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="avatar avatar-sm" style={{ background: 'var(--primary-pale)', color: 'var(--primary-light)', fontWeight: 700 }}>{e.prenom[0]}{e.nom[0]}</div>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{e.prenom} {e.nom}</span>
                      </div>
                    </td>
                    {classeMatieres.map(m => {
                      const avg = avgFor(e.id, m.id);
                      return (
                        <td key={m.id} style={{ textAlign: 'center' }}>
                          <span className={avg !== null ? `${getColorTitulaire(avg)} font-bold` : ''} style={{ fontSize: 13, color: avg === null ? 'var(--text-light)' : undefined }}>
                            {avg !== null ? avg.toFixed(1) : '—'}
                          </span>
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge badge-${moyGen === null ? 'neutral' : moyGen >= 14 ? 'success' : moyGen >= 10 ? 'warning' : 'danger'}`}>
                        {moyGen !== null ? moyGen.toFixed(2) + '/20' : '—'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setViewEleve(e.id)}>Voir</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {viewEleve && viewEleveObj && (
        <div className="modal-overlay bulletin-modal-overlay" onClick={() => setViewEleve(null)}>
          <div className="modal bulletin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 760 }}>
            <div className="modal-header no-print">
              <div className="modal-title">Bulletin</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-accent btn-sm" onClick={handleDownloadPdf} disabled={exporting}><Download size={13} /> {exporting ? 'Génération...' : 'Télécharger PDF'}</button>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setViewEleve(null)}><X size={16} /></button>
              </div>
            </div>
            <div className="modal-body" style={{ background: 'var(--surface2)' }}>
              <div ref={bulletinRef}>
                <BulletinPreview eleve={viewEleveObj} classes={classes} matieres={matieres} notes={notes} eleves={eleves} professeurs={professeurs} trimestre={selectedTrimestre} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
