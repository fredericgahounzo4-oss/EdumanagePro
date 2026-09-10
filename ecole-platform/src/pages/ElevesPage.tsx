import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, Eye, X } from 'lucide-react';
import { Eleve, Classe, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { fetchEleves, fetchClasses, fetchUsersByRole, createEleve, updateEleve, deleteEleve } from '../api/resources';
import { errorMessage } from '../api/client';

const ElevesPage: React.FC = () => {
  const { user } = useAuth();
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [parents, setParents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canManage = user?.role === 'admin';

  // L'API renvoie déjà les données filtrées selon le rôle (élèves de mes classes
  // pour un prof, mes enfants pour un parent) — pas besoin de refiltrer ici.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchEleves(), fetchClasses(), canManage ? fetchUsersByRole('parent') : Promise.resolve([])])
      .then(([e, c, p]) => { if (!cancelled) { setEleves(e); setClasses(c); setParents(p); } })
      .catch(err => { if (!cancelled) setError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [canManage]);

  const [search, setSearch] = useState('');
  const [filterClasse, setFilterClasse] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState<Eleve | null>(null);
  const [editEleve, setEditEleve] = useState<Eleve | null>(null);
  const [form, setForm] = useState({ nom: '', prenom: '', dateNaissance: '', classeId: '', adresse: '', telephone: '', parentId: '' });

  const filtered = useMemo(() => eleves.filter(e => {
    const q = search.toLowerCase();
    const matchQ = !q || e.nom.toLowerCase().includes(q) || e.prenom.toLowerCase().includes(q);
    const matchC = !filterClasse || e.classe === filterClasse;
    const matchS = !filterStatus || e.status === filterStatus;
    return matchQ && matchC && matchS;
  }), [eleves, search, filterClasse, filterStatus]);

  const openAdd = () => {
    setEditEleve(null);
    setForm({ nom: '', prenom: '', dateNaissance: '', classeId: classes[0]?.id || '', adresse: '', telephone: '', parentId: parents[0]?.id || '' });
    setError(null);
    setShowModal(true);
  };
  const openEdit = (e: Eleve) => {
    setEditEleve(e);
    const classeObj = classes.find(c => c.nom === e.classe);
    setForm({ nom: e.nom, prenom: e.prenom, dateNaissance: e.dateNaissance, classeId: classeObj?.id || '', adresse: e.adresse, telephone: e.telephone, parentId: e.parentId });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.nom || !form.prenom || !form.classeId) return;
    setSaving(true);
    setError(null);
    try {
      if (editEleve) {
        const updated = await updateEleve(editEleve.id, {
          nom: form.nom, prenom: form.prenom, date_naissance: form.dateNaissance,
          classe: Number(form.classeId), adresse: form.adresse, telephone: form.telephone,
          parent: form.parentId ? Number(form.parentId) : null,
        });
        setEleves(prev => prev.map(e => e.id === editEleve.id ? updated : e));
      } else {
        const created = await createEleve({
          nom: form.nom, prenom: form.prenom, dateNaissance: form.dateNaissance, classeId: form.classeId,
          parentId: form.parentId || undefined, status: 'actif', adresse: form.adresse, telephone: form.telephone,
        });
        setEleves(prev => [...prev, created]);
      }
      setShowModal(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer cet élève ?')) return;
    try {
      await deleteEleve(id);
      setEleves(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const getInitialsColor = (nom: string) => {
    const colors = ['#2563a8','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2'];
    return colors[nom.charCodeAt(0) % colors.length];
  };

  if (loading) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Chargement...</div>;
  if (error && eleves.length === 0) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>{error}</div>;

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <div className="page-title">{user?.role === 'professeur' ? 'Mes élèves' : 'Gestion des élèves'}</div>
            <div className="page-subtitle">{eleves.filter(e => e.status === 'actif').length} élèves actifs {user?.role === 'professeur' ? 'dans vos classes' : 'au total'}</div>
          </div>
          {canManage && <button className="btn btn-primary" onClick={openAdd}><Plus size={14} /> Nouvel élève</button>}
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
            <Search size={14} color="var(--text-light)" />
            <input placeholder="Rechercher un élève..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: 0 }}><X size={14} /></button>}
          </div>
          <select className="form-control" style={{ width: 160 }} value={filterClasse} onChange={e => setFilterClasse(e.target.value)}>
            <option value="">Toutes les classes</option>
            {classes.map(c => <option key={c.id} value={c.nom}>{c.nom}</option>)}
          </select>
          <select className="form-control" style={{ width: 140 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Tous les statuts</option>
            <option value="actif">Actif</option>
            <option value="inactif">Inactif</option>
          </select>
          {(filterClasse || filterStatus) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setFilterClasse(''); setFilterStatus(''); }}>
              <X size={12} /> Effacer
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Élève</th>
                <th>Classe</th>
                <th>Date de naissance</th>
                <th>Téléphone</th>
                <th>Statut</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Aucun élève trouvé</td></tr>
              ) : filtered.map(e => (
                <tr key={e.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar" style={{ background: getInitialsColor(e.nom) + '22', color: getInitialsColor(e.nom), fontWeight: 700 }}>
                        {e.prenom[0]}{e.nom[0]}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{e.prenom} {e.nom}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.adresse}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="badge badge-primary">{e.classe}</span></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {e.dateNaissance ? new Date(e.dateNaissance).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{e.telephone}</td>
                  <td><span className={`badge badge-${e.status === 'actif' ? 'success' : 'neutral'}`}>{e.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowDetail(e)} title="Voir le profil"><Eye size={14} /></button>
                      {canManage && <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(e)} title="Modifier"><Edit2 size={14} /></button>}
                      {canManage && <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(e.id)} title="Supprimer"><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12 }}>
          {filtered.length} résultat{filtered.length > 1 ? 's' : ''} sur {eleves.length} élève{eleves.length > 1 ? 's' : ''}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editEleve ? 'Modifier l\'élève' : 'Ajouter un élève'}</div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {error && <div style={{ background: 'var(--danger-pale)', color: 'var(--danger)', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Prénom *</label>
                  <input className="form-control" value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} placeholder="Koffi" />
                </div>
                <div className="form-group">
                  <label className="form-label">Nom *</label>
                  <input className="form-control" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Amedegnato" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Date de naissance</label>
                  <input className="form-control" type="date" value={form.dateNaissance} onChange={e => setForm(f => ({ ...f, dateNaissance: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Classe *</label>
                  <select className="form-control" value={form.classeId} onChange={e => setForm(f => ({ ...f, classeId: e.target.value }))}>
                    <option value="">Sélectionner</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Parent</label>
                <select className="form-control" value={form.parentId} onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))}>
                  <option value="">Aucun</option>
                  {parents.map(p => <option key={p.id} value={p.id}>{p.prenom} {p.nom} — {p.email}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Adresse</label>
                <input className="form-control" value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))} placeholder="Lomé, Quartier..." />
              </div>
              <div className="form-group">
                <label className="form-label">Téléphone parent</label>
                <input className="form-control" value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} placeholder="+228 90 00 00 00" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Enregistrement...' : editEleve ? 'Enregistrer' : 'Ajouter'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && (
        <div className="modal-overlay" onClick={() => setShowDetail(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Profil de l'élève</div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowDetail(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <div className="avatar avatar-lg" style={{ background: getInitialsColor(showDetail.nom) + '22', color: getInitialsColor(showDetail.nom), fontWeight: 700, fontSize: 20 }}>
                  {showDetail.prenom[0]}{showDetail.nom[0]}
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{showDetail.prenom} {showDetail.nom}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>{showDetail.classe}</div>
                  <span className={`badge badge-${showDetail.status === 'actif' ? 'success' : 'neutral'}`} style={{ marginTop: 6 }}>{showDetail.status}</span>
                </div>
              </div>
              {[
                { label: 'Date de naissance', value: showDetail.dateNaissance ? new Date(showDetail.dateNaissance).toLocaleDateString('fr-FR') : '—' },
                { label: 'Adresse', value: showDetail.adresse || '—' },
                { label: 'Téléphone', value: showDetail.telephone || '—' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{row.label}</span>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{row.value}</span>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowDetail(null)}>Fermer</button>
              {canManage && <button className="btn btn-primary" onClick={() => { openEdit(showDetail); setShowDetail(null); }}>Modifier</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ElevesPage;
