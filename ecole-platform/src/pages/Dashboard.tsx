import React, { useState, useEffect } from 'react';
import { Users, CreditCard, TrendingUp, BookOpen, AlertCircle, Clock, UserX, CheckCircle2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Eleve, Paiement, Note, Classe, Matiere, Notification, CreneauEDT, Presence } from '../types';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { fetchEleves, fetchPaiements, fetchNotes, fetchClasses, fetchMatieres, fetchNotifications, fetchEmploiDuTemps, fetchPresences } from '../api/resources';
import { errorMessage } from '../api/client';
import { classesDuProfesseur, elevesDuProfesseur } from '../utils/permissions';

const MOIS_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const JOURS_SEMAINE = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const computePerformanceData = (notes: Note[]) =>
  MOIS_LABELS.map((label, idx) => {
    const ns = notes.filter(n => new Date(n.date).getMonth() === idx);
    return { mois: label, moyenne: ns.length ? parseFloat((ns.reduce((s, n) => s + n.valeur, 0) / ns.length).toFixed(1)) : null };
  }).filter(row => row.moyenne !== null);

const computePaiementStats = (paiements: Paiement[]) => {
  if (!paiements.length) return [];
  const payé = paiements.filter(p => p.status === 'payé').length;
  const impayé = paiements.filter(p => p.status === 'impayé').length;
  const partiel = paiements.filter(p => p.status === 'partiel').length;
  const total = paiements.length;
  return [
    { name: 'Payé', value: Math.round((payé / total) * 100), color: '#16a34a' },
    { name: 'Impayé', value: Math.round((impayé / total) * 100), color: '#dc2626' },
    { name: 'Partiel', value: Math.round((partiel / total) * 100), color: '#d97706' },
  ].filter(x => x.value > 0);
};

const Dashboard: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [emploiDuTemps, setEmploiDuTemps] = useState<CreneauEDT[]>([]);
  const [presences, setPresences] = useState<Presence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchEleves(), fetchPaiements(), fetchNotes(), fetchClasses(), fetchMatieres(), fetchNotifications(), fetchEmploiDuTemps(), fetchPresences()])
      .then(([e, p, n, c, m, notifs, edt, pres]) => {
        if (cancelled) return;
        setEleves(e); setPaiements(p); setNotes(n); setClasses(c); setMatieres(m); setNotifications(notifs); setEmploiDuTemps(edt); setPresences(pres);
      })
      .catch(err => { if (!cancelled) setError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Chargement...</div>;
  if (error) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>{error}</div>;

  const performanceData = computePerformanceData(notes);
  const paiementStats = computePaiementStats(paiements);

  const totalEleves = eleves.filter(e => e.status === 'actif').length;
  const totalPaye = paiements.filter(p => p.status === 'payé').reduce((s, p) => s + p.montant, 0);
  const totalImpaye = paiements.filter(p => p.status === 'impayé').reduce((s, p) => s + p.montant, 0);
  const moyenneGlobale = notes.length ? (notes.reduce((s, n) => s + n.valeur, 0) / notes.length).toFixed(1) : '—';
  const unreadNotifs = notifications.filter(n => !n.lu).length;

  const recentPaiements = paiements.slice(0, 5);
  const elevesList = eleves.slice(0, 5);

  // Parent dashboard
  if (user?.role === 'parent') {
    const monEleve = eleves.find(e => e.parentId === user.id) || eleves[0];
    const mesNotes = notes.filter(n => n.eleveId === monEleve?.id);
    const maNotes = mesNotes.length ? (mesNotes.reduce((s, n) => s + n.valeur, 0) / mesNotes.length).toFixed(1) : '—';
    const mesPaiements = paiements.filter(p => p.eleveId === monEleve?.id);
    const impayeParent = mesPaiements.filter(p => p.status === 'impayé').reduce((s, p) => s + p.montant, 0);
    const notifNonLues = notifications.filter(n => !n.lu);
    const mesNotesPerf = computePerformanceData(mesNotes);

    return (
      <div>
        <div className="page-header">
          <div className="flex items-center justify-between">
            <div>
              <div className="page-title">Bonjour, {user.prenom} 👋</div>
              <div className="page-subtitle">Suivi de {monEleve?.prenom} {monEleve?.nom} — {monEleve?.classe}</div>
            </div>
            <span className="badge badge-success">Année {settings.anneeScolaire}</span>
          </div>
        </div>

        <div className="stats-grid">
          {[
            { label: 'Moyenne générale', value: maNotes + '/20', icon: <BookOpen size={20} />, color: '#2563a8', bg: 'var(--primary-pale)' },
            { label: 'Impayés', value: impayeParent.toLocaleString('fr-FR') + ' FCFA', icon: <CreditCard size={20} />, color: impayeParent > 0 ? '#dc2626' : '#16a34a', bg: impayeParent > 0 ? 'var(--danger-pale)' : 'var(--success-pale)' },
            { label: 'Notifications', value: String(notifNonLues.length), icon: <AlertCircle size={20} />, color: '#d97706', bg: 'var(--warning-pale)' },
            { label: 'Notes saisies', value: String(mesNotes.length), icon: <TrendingUp size={20} />, color: '#0891b2', bg: 'var(--info-pale)' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
              <div>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ fontSize: 20, color: s.color }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid-2">
          <div className="card">
            <div className="card-header"><span style={{ fontWeight: 700 }}>Dernières notifications</span></div>
            <div className="card-body" style={{ padding: 0 }}>
              {notifNonLues.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Aucune notification</div>
              ) : notifNonLues.map(n => (
                <div key={n.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div className={`badge badge-${n.type}`} style={{ marginTop: 2, flexShrink: 0 }}>●</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{n.titre}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{n.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span style={{ fontWeight: 700 }}>Évolution des moyennes</span></div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={mesNotesPerf}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="moyenne" stroke="#2563a8" fill="var(--primary-pale)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Prof dashboard
  if (user?.role === 'professeur') {
    const mesClasses = classesDuProfesseur(user.id, classes, matieres);
    const mesEleves = elevesDuProfesseur(user.id, eleves, classes, matieres);
    const mesNotes = notes.filter(n => matieres.find(m => m.id === n.matiereId)?.professeurId === user.id);
    const aujourdHui = JOURS_SEMAINE[new Date().getDay()];
    const coursAujourdhui = emploiDuTemps.filter(c => c.jour === aujourdHui && mesClasses.some(cl => cl.id === c.classeId)).length;
    const mesNotesPerf = computePerformanceData(mesNotes);

    return (
      <div>
        <div className="page-header">
          <div className="flex items-center justify-between">
            <div>
              <div className="page-title">Bonjour, {user.prenom} 👋</div>
              <div className="page-subtitle">Espace Professeur — Année {settings.anneeScolaire}</div>
            </div>
          </div>
        </div>
        <div className="stats-grid">
          {[
            { label: 'Mes classes', value: String(mesClasses.length), icon: <BookOpen size={20} />, color: '#2563a8', bg: 'var(--primary-pale)' },
            { label: 'Élèves total', value: String(mesEleves.length), icon: <Users size={20} />, color: '#16a34a', bg: 'var(--success-pale)' },
            { label: 'Notes saisies', value: String(mesNotes.length), icon: <TrendingUp size={20} />, color: '#0891b2', bg: 'var(--info-pale)' },
            { label: "Cours aujourd'hui", value: String(coursAujourdhui), icon: <Clock size={20} />, color: '#d97706', bg: 'var(--warning-pale)' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
              <div>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ fontSize: 20, color: s.color }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-header"><span style={{ fontWeight: 700 }}>Évolution des performances</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={mesNotesPerf}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="moyenne" stroke="#16a34a" fill="var(--success-pale)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  }

  // Surveillant dashboard
  if (user?.role === 'surveillant') {
    return <SurveillantDashboard eleves={eleves} classes={classes} notes={notes} paiements={paiements} notifications={notifications} presences={presences} onNavigate={onNavigate} />;
  }

  // Admin dashboard
  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <div className="page-title">Tableau de bord</div>
            <div className="page-subtitle">Vue d'ensemble — Année scolaire {settings.anneeScolaire}</div>
          </div>
          <button className="btn btn-primary" onClick={() => onNavigate('eleves')}>
            <Users size={14} /> Gérer les élèves
          </button>
        </div>
      </div>

      <div className="stats-grid">
        {[
          { label: 'Élèves actifs', value: totalEleves, icon: <Users size={20} />, color: '#2563a8', bg: 'var(--primary-pale)' },
          { label: 'Recettes (FCFA)', value: (totalPaye / 1000).toFixed(0) + 'k', icon: <CreditCard size={20} />, color: '#16a34a', bg: 'var(--success-pale)' },
          { label: 'Impayés (FCFA)', value: (totalImpaye / 1000).toFixed(0) + 'k', icon: <AlertCircle size={20} />, color: '#dc2626', bg: 'var(--danger-pale)' },
          { label: 'Moyenne générale', value: moyenneGlobale + '/20', icon: <TrendingUp size={20} />, color: '#0891b2', bg: 'var(--info-pale)' },
          { label: 'Classes', value: classes.length, icon: <BookOpen size={20} />, color: '#7c3aed', bg: '#f3f0ff' },
          { label: 'Notifications', value: unreadNotifs, icon: <AlertCircle size={20} />, color: '#d97706', bg: 'var(--warning-pale)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
            <div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header"><span style={{ fontWeight: 700 }}>Évolution des performances</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => [String(typeof v === "number" ? v.toFixed(1) : v), ""]} />
                <Area type="monotone" dataKey="moyenne" stroke="#2563a8" fill="var(--primary-pale)" strokeWidth={2} dot={{ r: 3, fill: '#2563a8' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span style={{ fontWeight: 700 }}>État des paiements</span></div>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={paiementStats} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {paiementStats.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Legend formatter={(v) => <span style={{ fontSize: 12 }}>{v}</span>} />
                <Tooltip formatter={(v) => [`${v}%`, '']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span style={{ fontWeight: 700 }}>Derniers paiements</span>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('paiements')}>Voir tout</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Élève</th><th>Type</th><th>Montant</th><th>Statut</th></tr></thead>
              <tbody>
                {recentPaiements.map(p => {
                  const eleve = eleves.find(e => e.id === p.eleveId);
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{eleve?.prenom} {eleve?.nom}</td>
                      <td><span className="badge badge-neutral">{p.type}</span></td>
                      <td className="mono" style={{ fontSize: 12 }}>{p.montant.toLocaleString('fr-FR')} FCFA</td>
                      <td><span className={`badge badge-${p.status === 'payé' ? 'success' : p.status === 'impayé' ? 'danger' : 'warning'}`}>{p.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span style={{ fontWeight: 700 }}>Élèves récents</span>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('eleves')}>Voir tout</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nom</th><th>Classe</th><th>Statut</th></tr></thead>
              <tbody>
                {elevesList.map(e => (
                  <tr key={e.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="avatar avatar-sm" style={{ background: 'var(--primary-pale)', color: 'var(--primary-light)', fontWeight: 700 }}>{e.prenom[0]}{e.nom[0]}</div>
                        <span style={{ fontWeight: 600 }}>{e.prenom} {e.nom}</span>
                      </div>
                    </td>
                    <td>{e.classe}</td>
                    <td><span className={`badge badge-${e.status === 'actif' ? 'success' : 'neutral'}`}>{e.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const SurveillantDashboard: React.FC<{
  eleves: Eleve[]; classes: Classe[]; notes: Note[]; paiements: Paiement[]; notifications: Notification[]; presences: Presence[]; onNavigate: (page: string) => void;
}> = ({ eleves, classes, notes, paiements, notifications, presences, onNavigate }) => {
  const today = new Date().toISOString().split('T')[0];
  const presencesToday = presences.filter(p => p.date === today);
  const totalEleves = eleves.filter(e => e.status === 'actif').length;

  const statutOf = (eleveId: string) => presencesToday.find(p => p.eleveId === eleveId)?.statut || 'présent';
  const absents = eleves.filter(e => e.status === 'actif' && statutOf(e.id) === 'absent');
  const retards = eleves.filter(e => e.status === 'actif' && statutOf(e.id) === 'retard');
  const excuses = eleves.filter(e => e.status === 'actif' && statutOf(e.id) === 'excusé');
  const presentsCount = totalEleves - absents.length - retards.length - excuses.length;
  const unreadNotifs = notifications.filter(n => !n.lu).length;

  const alertes = [...absents.map(e => ({ eleve: e, statut: 'absent' as const })), ...retards.map(e => ({ eleve: e, statut: 'retard' as const }))];

  const performanceData = computePerformanceData(notes);
  const paiementStats = computePaiementStats(paiements);

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <div className="page-title">Tableau de bord</div>
            <div className="page-subtitle">Suivi des présences — {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
          <button className="btn btn-primary" onClick={() => onNavigate('presences')}><CheckCircle2 size={14} /> Feuille de présence</button>
        </div>
      </div>

      <div className="stats-grid">
        {[
          { label: 'Élèves actifs', value: totalEleves, icon: <Users size={20} />, color: '#2563a8', bg: 'var(--primary-pale)' },
          { label: 'Présents aujourd\'hui', value: presentsCount, icon: <CheckCircle2 size={20} />, color: '#16a34a', bg: 'var(--success-pale)' },
          { label: 'Absents aujourd\'hui', value: absents.length, icon: <UserX size={20} />, color: '#dc2626', bg: 'var(--danger-pale)' },
          { label: 'Retards aujourd\'hui', value: retards.length, icon: <Clock size={20} />, color: '#d97706', bg: 'var(--warning-pale)' },
          { label: 'Classes', value: classes.length, icon: <BookOpen size={20} />, color: '#7c3aed', bg: '#f3f0ff' },
          { label: 'Notifications', value: unreadNotifs, icon: <AlertCircle size={20} />, color: '#0891b2', bg: 'var(--info-pale)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
            <div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header"><span style={{ fontWeight: 700 }}>Évolution des performances</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => [String(typeof v === "number" ? v.toFixed(1) : v), ""]} />
                <Area type="monotone" dataKey="moyenne" stroke="#2563a8" fill="var(--primary-pale)" strokeWidth={2} dot={{ r: 3, fill: '#2563a8' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span style={{ fontWeight: 700 }}>État des paiements</span></div>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={paiementStats} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {paiementStats.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Legend formatter={(v) => <span style={{ fontSize: 12 }}>{v}</span>} />
                <Tooltip formatter={(v) => [`${v}%`, '']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span style={{ fontWeight: 700 }}>Absences et retards du jour</span>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('presences')}>Voir tout</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Élève</th><th>Classe</th><th>Statut</th></tr></thead>
            <tbody>
              {alertes.length === 0 ? (
                <tr><td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Aucune absence ni retard signalé aujourd'hui 🎉</td></tr>
              ) : alertes.map(({ eleve, statut }) => (
                <tr key={eleve.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="avatar avatar-sm" style={{ background: 'var(--primary-pale)', color: 'var(--primary-light)', fontWeight: 700 }}>{eleve.prenom[0]}{eleve.nom[0]}</div>
                      <span style={{ fontWeight: 600 }}>{eleve.prenom} {eleve.nom}</span>
                    </div>
                  </td>
                  <td><span className="badge badge-primary">{eleve.classe}</span></td>
                  <td><span className={`badge badge-${statut === 'absent' ? 'danger' : 'warning'}`}>{statut}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
