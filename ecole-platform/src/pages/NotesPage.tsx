import React, { useState, useMemo, useEffect } from 'react';
import { Plus, X, Download, Lock } from 'lucide-react';
import { Note, Classe, Matiere, Eleve } from '../types';
import { useAuth } from '../context/AuthContext';
import { useConnectivity } from '../context/ConnectivityContext';
import { getClasseOfEleve, isTitulaireDeClasse, matieresVisibles, matieresEnseigneesParProf, elevesDuProfesseur, classesDuProfesseur } from '../utils/permissions';
import { fetchClasses, fetchMatieres, fetchEleves, fetchNotes, createNote } from '../api/resources';
import { errorMessage } from '../api/client';

const getColor = (v: number) => v >= 14 ? 'note-high' : v >= 10 ? 'note-mid' : 'note-low';
const appreciationOf = (avg: number | null) => avg === null ? '—' : avg >= 16 ? 'Très bien' : avg >= 14 ? 'Bien' : avg >= 12 ? 'Assez bien' : avg >= 10 ? 'Passable' : 'Insuffisant';
const typeLabel: Record<string, string> = { devoir: 'Devoir', examen: 'Examen', interrogation: 'Interrogation' };

const emptyForm = () => ({ eleveId: '', matiereId: '', valeur: '', type: 'devoir', trimestre: '1', date: new Date().toISOString().split('T')[0], commentaire: '' });

interface NotesData {
  classes: Classe[];
  matieres: Matiere[];
  eleves: Eleve[];
  notes: Note[];
  onNoteCreated: (n: Note) => void;
}

// ============================================================
// VUE ADMIN — notes classées par classe
// ============================================================
const NotesParClasse: React.FC<NotesData> = ({ classes, matieres, eleves: allEleves, notes, onNoteCreated }) => {
  const [selectedClasse, setSelectedClasse] = useState(classes[0]?.id || '');
  const [selectedTrimestre, setSelectedTrimestre] = useState<1 | 2 | 3>(1);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [detail, setDetail] = useState<{ eleveId: string; matiereId: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const classeObj = classes.find(c => c.id === selectedClasse);
  const classeEleves = allEleves.filter(e => e.classe === classeObj?.nom);
  const classeMatieres = matieres.filter(m => m.classeId === selectedClasse);

  const notesFor = (eleveId: string, matiereId: string) =>
    notes.filter(n => n.eleveId === eleveId && n.matiereId === matiereId && n.trimestre === selectedTrimestre);

  const avgFor = (eleveId: string, matiereId: string) => {
    const ns = notesFor(eleveId, matiereId);
    return ns.length ? ns.reduce((s, n) => s + n.valeur, 0) / ns.length : null;
  };

  const moyenneGeneraleEleve = (eleveId: string) => {
    const parties = classeMatieres.map(m => ({ avg: avgFor(eleveId, m.id), coeff: m.coefficient })).filter(x => x.avg !== null);
    if (!parties.length) return null;
    return parties.reduce((s, x) => s + (x.avg as number) * x.coeff, 0) / parties.reduce((s, x) => s + x.coeff, 0);
  };

  const openModal = () => {
    setForm({ ...emptyForm(), eleveId: classeEleves[0]?.id || '', matiereId: classeMatieres[0]?.id || '', trimestre: String(selectedTrimestre) });
    setSaveError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.valeur || !form.matiereId || !form.eleveId) return;
    const v = parseFloat(form.valeur);
    if (isNaN(v) || v < 0 || v > 20) return;
    setSaving(true);
    setSaveError(null);
    try {
      const created = await createNote({
        eleveId: form.eleveId, matiereId: form.matiereId, valeur: v, type: form.type,
        date: form.date, trimestre: parseInt(form.trimestre), commentaire: form.commentaire,
      });
      onNoteCreated(created);
      setShowModal(false);
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const detailEleve = detail ? classeEleves.find(e => e.id === detail.eleveId) : undefined;
  const detailMatiere = detail ? classeMatieres.find(m => m.id === detail.matiereId) : undefined;
  const detailNotes = detail ? notesFor(detail.eleveId, detail.matiereId) : [];

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <div className="page-title">Notes & Bulletins</div>
            <div className="page-subtitle">Vue par classe — tous les élèves et toutes leurs évaluations</div>
          </div>
          <button className="btn btn-primary" onClick={openModal}><Plus size={14} /> Saisir une note</button>
        </div>
      </div>

      {/* Selectors */}
      <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 220 }}>
            <label className="form-label">Classe</label>
            <select className="form-control" value={selectedClasse} onChange={e => setSelectedClasse(e.target.value)}>
              {classes.map(c => <option key={c.id} value={c.id}>{c.nom} — {c.niveau}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Trimestre</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {([1, 2, 3] as const).map(t => (
                <button key={t} className={`btn ${selectedTrimestre === t ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSelectedTrimestre(t)}>T{t}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Table classe x matieres */}
      <div className="card">
        <div className="card-header">
          <span style={{ fontWeight: 700 }}>{classeObj?.nom} — {classeEleves.length} élève{classeEleves.length > 1 ? 's' : ''}</span>
          <button className="btn btn-ghost btn-sm"><Download size={13} /> Exporter</button>
        </div>
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
              </tr>
            </thead>
            <tbody>
              {classeEleves.length === 0 ? (
                <tr><td colSpan={classeMatieres.length + 2} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Aucun élève dans cette classe</td></tr>
              ) : classeEleves.map(eleve => {
                const moyGen = moyenneGeneraleEleve(eleve.id);
                return (
                  <tr key={eleve.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="avatar avatar-sm" style={{ background: 'var(--primary-pale)', color: 'var(--primary-light)', fontWeight: 700 }}>{eleve.prenom[0]}{eleve.nom[0]}</div>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{eleve.prenom} {eleve.nom}</span>
                      </div>
                    </td>
                    {classeMatieres.map(m => {
                      const avg = avgFor(eleve.id, m.id);
                      const count = notesFor(eleve.id, m.id).length;
                      return (
                        <td key={m.id} style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => count > 0 && setDetail({ eleveId: eleve.id, matiereId: m.id })}
                            title={count > 0 ? 'Voir toutes les notes' : 'Aucune note'}
                            style={{ background: 'none', border: 'none', cursor: count > 0 ? 'pointer' : 'default', padding: '4px 8px', borderRadius: 6 }}
                            onMouseEnter={e => { if (count > 0) e.currentTarget.style.background = 'var(--surface2)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                            <span className={avg !== null ? `${getColor(avg)} font-bold` : ''} style={{ fontSize: 13, color: avg === null ? 'var(--text-light)' : undefined }}>
                              {avg !== null ? avg.toFixed(1) : '—'}
                            </span>
                            {count > 1 && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 3 }}>({count})</span>}
                          </button>
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge badge-${moyGen === null ? 'neutral' : moyGen >= 14 ? 'success' : moyGen >= 10 ? 'warning' : 'danger'}`}>
                        {moyGen !== null ? moyGen.toFixed(2) + '/20' : '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Détail des notes d'un élève pour une matière */}
      {detail && detailEleve && detailMatiere && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{detailEleve.prenom} {detailEleve.nom} — {detailMatiere.nom}</div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDetail(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 12, color: 'var(--text-muted)' }}>Type</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 12, color: 'var(--text-muted)' }}>Date</th>
                    <th style={{ textAlign: 'center', padding: '6px 8px', fontSize: 12, color: 'var(--text-muted)' }}>Note</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 12, color: 'var(--text-muted)' }}>Commentaire</th>
                  </tr>
                </thead>
                <tbody>
                  {detailNotes.map(n => (
                    <tr key={n.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px' }}><span className="badge badge-neutral">{typeLabel[n.type]}</span></td>
                      <td style={{ padding: '8px', fontSize: 12, color: 'var(--text-muted)' }}>{new Date(n.date).toLocaleDateString('fr-FR')}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}><span className={`${getColor(n.valeur)} font-bold`}>{n.valeur}/20</span></td>
                      <td style={{ padding: '8px', fontSize: 12, color: 'var(--text-muted)' }}>{n.commentaire || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDetail(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Saisir une note — {classeObj?.nom}</div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {saveError && <div style={{ background: 'var(--danger-pale)', color: 'var(--danger)', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{saveError}</div>}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Élève *</label>
                  <select className="form-control" value={form.eleveId} onChange={e => setForm(f => ({ ...f, eleveId: e.target.value }))}>
                    {classeEleves.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Matière *</label>
                  <select className="form-control" value={form.matiereId} onChange={e => setForm(f => ({ ...f, matiereId: e.target.value }))}>
                    {classeMatieres.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Note (sur 20) *</label>
                  <input className="form-control" type="number" min="0" max="20" step="0.5" value={form.valeur} onChange={e => setForm(f => ({ ...f, valeur: e.target.value }))} placeholder="ex: 14.5" />
                </div>
                <div className="form-group">
                  <label className="form-label">Type d'évaluation</label>
                  <select className="form-control" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="devoir">Devoir</option>
                    <option value="examen">Examen</option>
                    <option value="interrogation">Interrogation</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Trimestre</label>
                  <select className="form-control" value={form.trimestre} onChange={e => setForm(f => ({ ...f, trimestre: e.target.value }))}>
                    <option value="1">Trimestre 1</option>
                    <option value="2">Trimestre 2</option>
                    <option value="3">Trimestre 3</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input className="form-control" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Commentaire</label>
                <textarea className="form-control" value={form.commentaire} onChange={e => setForm(f => ({ ...f, commentaire: e.target.value }))} rows={2} placeholder="Observation..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// VUE PROF / PARENT / SURVEILLANT — un élève à la fois, filtré par permissions
// ============================================================
const NotesParEleve: React.FC<NotesData> = ({ classes, matieres, eleves: allEleves, notes, onNoteCreated }) => {
  const { user } = useAuth();

  const displayEleves = useMemo(() => {
    if (!user) return [];
    if (user.role === 'parent') return allEleves.filter(e => e.parentId === user.id);
    if (user.role === 'professeur') return elevesDuProfesseur(user.id, allEleves, classes, matieres);
    return allEleves; // surveillant
  }, [user, allEleves, classes, matieres]);

  const [selectedEleve, setSelectedEleve] = useState(displayEleves[0]?.id || '');
  const [selectedTrimestre, setSelectedTrimestre] = useState<1 | 2 | 3>(1);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (displayEleves.length && !displayEleves.some(e => e.id === selectedEleve)) {
      setSelectedEleve(displayEleves[0].id);
    }
  }, [displayEleves, selectedEleve]);

  const eleve = displayEleves.find(e => e.id === selectedEleve) || displayEleves[0];

  const matieresAutorisees = eleve ? matieresVisibles(user, eleve, classes, matieres) : [];
  const classeEleve = eleve ? getClasseOfEleve(eleve, classes) : undefined;
  const estTitulaire = user?.role === 'professeur' && isTitulaireDeClasse(user, classeEleve);
  const vueRestreinte = user?.role === 'professeur' && !estTitulaire;

  const matieresSaisissables = user?.role === 'professeur' && classeEleve
    ? matieresEnseigneesParProf(user.id, classeEleve.id, matieres)
    : [];

  const elevesNotes = notes.filter(n => n.eleveId === selectedEleve && n.trimestre === selectedTrimestre);

  const notesByMatiere = matieresAutorisees.map(m => {
    const ns = elevesNotes.filter(n => n.matiereId === m.id);
    const avg = ns.length ? ns.reduce((s, n) => s + n.valeur, 0) / ns.length : null;
    return { matiere: m, notes: ns, avg };
  }).filter(x => x.notes.length > 0);

  const moyenneGenerale = notesByMatiere.length
    ? (notesByMatiere.reduce((s, x) => s + (x.avg || 0) * x.matiere.coefficient, 0) /
       notesByMatiere.reduce((s, x) => s + x.matiere.coefficient, 0)).toFixed(2)
    : '—';

  const handleSave = async () => {
    if (!form.valeur || !form.matiereId || !form.eleveId) return;
    const v = parseFloat(form.valeur);
    if (isNaN(v) || v < 0 || v > 20) return;
    setSaving(true);
    setSaveError(null);
    try {
      const created = await createNote({
        eleveId: form.eleveId, matiereId: form.matiereId, valeur: v, type: form.type,
        date: form.date, trimestre: parseInt(form.trimestre), commentaire: form.commentaire,
      });
      onNoteCreated(created);
      setShowModal(false);
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openModal = () => {
    const defaultEleveId = eleve?.id || displayEleves[0]?.id || '';
    const defaultMatiereId = matieresSaisissables[0]?.id || '';
    setForm({ ...emptyForm(), eleveId: defaultEleveId, matiereId: defaultMatiereId, trimestre: String(selectedTrimestre) });
    setSaveError(null);
    setShowModal(true);
  };

  const elevesSaisissables = elevesDuProfesseur(user?.id || '', displayEleves, classes, matieres);
  const formEleve = allEleves.find(e => e.id === form.eleveId);
  const formClasse = formEleve ? getClasseOfEleve(formEleve, classes) : undefined;
  const formMatieresSaisissables = user?.role === 'professeur' && formClasse
    ? matieresEnseigneesParProf(user.id, formClasse.id, matieres)
    : [];

  if (!eleve) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        Aucun élève ne vous est actuellement assigné.
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <div className="page-title">Notes & Bulletins</div>
            <div className="page-subtitle">
              {vueRestreinte
                ? 'Vous ne voyez que la ou les matières que vous enseignez dans cette classe'
                : estTitulaire
                  ? 'Vous êtes titulaire de cette classe — bulletin complet visible'
                  : 'Gestion des évaluations par élève'}
            </div>
          </div>
          {user?.role === 'professeur' && matieresSaisissables.length > 0 && (
            <button className="btn btn-primary" onClick={openModal}><Plus size={14} /> Saisir une note</button>
          )}
        </div>
      </div>

      {/* Selectors */}
      <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label className="form-label">Élève</label>
            <select className="form-control" value={selectedEleve} onChange={e => setSelectedEleve(e.target.value)}>
              {displayEleves.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom} — {e.classe}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Trimestre</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {([1, 2, 3] as const).map(t => (
                <button key={t} className={`btn ${selectedTrimestre === t ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSelectedTrimestre(t)}>
                  T{t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        {[
          { label: 'Élève', value: `${eleve.prenom} ${eleve.nom}` },
          { label: 'Classe', value: eleve.classe },
          { label: 'Trimestre', value: `Trimestre ${selectedTrimestre}` },
          { label: 'Moyenne générale', value: moyenneGenerale !== '—' ? `${moyenneGenerale}/20` : '—' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
            <div className="stat-label">{s.label}</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Notes table */}
      <div className="card">
        <div className="card-header">
          <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            Relevé de notes — Trimestre {selectedTrimestre}
            {vueRestreinte && (
              <span className="badge badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }} title="Vous ne voyez que vos matières">
                <Lock size={11} /> Vos matières uniquement
              </span>
            )}
          </span>
          <button className="btn btn-ghost btn-sm"><Download size={13} /> Exporter PDF</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Matière</th>
                <th>Coeff.</th>
                {user?.role === 'professeur' && <th className="col-hide-mobile">Notes détaillées</th>}
                <th>Moyenne</th>
                <th className="col-hide-mobile">Moy. pondérée</th>
                <th>Appréciation</th>
              </tr>
            </thead>
            <tbody>
              {notesByMatiere.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Aucune note enregistrée pour ce trimestre</td></tr>
              ) : notesByMatiere.map(({ matiere, notes: ns, avg }) => {
                const pond = avg !== null ? (avg * matiere.coefficient).toFixed(2) : '—';
                return (
                  <tr key={matiere.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: matiere.couleur, flexShrink: 0 }} />
                        <span style={{ fontWeight: 600 }}>{matiere.nom}</span>
                      </div>
                    </td>
                    <td><span className="badge badge-neutral">×{matiere.coefficient}</span></td>
                    {user?.role === 'professeur' && (
                      <td className="col-hide-mobile">
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {ns.map(n => (
                            <span key={n.id} title={n.pending ? 'En attente de synchronisation' : n.type}
                              style={{ background: 'var(--surface2)', border: n.pending ? '1px dashed var(--text-light)' : '1px solid var(--border)', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600, opacity: n.pending ? 0.6 : 1 }}>
                              <span className={getColor(n.valeur)}>{n.valeur}</span>{n.pending ? ' ⏳' : ''}
                            </span>
                          ))}
                        </div>
                      </td>
                    )}
                    <td><span className={`${getColor(avg ?? 0)} font-bold`} style={{ fontSize: 15 }}>{avg !== null ? avg.toFixed(2) : '—'}/20</span></td>
                    <td className="col-hide-mobile mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pond}</td>
                    <td>
                      <span className={`badge badge-${avg === null ? 'neutral' : avg >= 14 ? 'success' : avg >= 10 ? 'warning' : 'danger'}`}>
                        {appreciationOf(avg)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {notesByMatiere.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--primary-pale)' }}>
                  <td colSpan={user?.role === 'professeur' ? 4 : 3} style={{ fontWeight: 700, padding: '12px 16px' }}>Moyenne générale</td>
                  <td style={{ padding: '12px 16px' }}><span style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary-light)' }}>{moyenneGenerale}/20</span></td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className={`badge badge-${parseFloat(moyenneGenerale) >= 14 ? 'success' : parseFloat(moyenneGenerale) >= 10 ? 'warning' : 'danger'}`}>
                      {parseFloat(moyenneGenerale) >= 16 ? 'Excellent' : parseFloat(moyenneGenerale) >= 14 ? 'Très bien' : parseFloat(moyenneGenerale) >= 12 ? 'Bien' : parseFloat(moyenneGenerale) >= 10 ? 'Passable' : 'Insuffisant'}
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Add Note Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Saisir une note</div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {saveError && <div style={{ background: 'var(--danger-pale)', color: 'var(--danger)', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{saveError}</div>}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Élève *</label>
                  <select className="form-control" value={form.eleveId} onChange={e => {
                    const newEleveId = e.target.value;
                    const newEleve = allEleves.find(el => el.id === newEleveId);
                    const newClasse = newEleve ? getClasseOfEleve(newEleve, classes) : undefined;
                    const nouvellesMatieres = user?.role === 'professeur' && newClasse
                      ? matieresEnseigneesParProf(user.id, newClasse.id, matieres)
                      : [];
                    setForm(f => ({ ...f, eleveId: newEleveId, matiereId: nouvellesMatieres[0]?.id || '' }));
                  }}>
                    {elevesSaisissables.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom} — {e.classe}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Matière *</label>
                  <select className="form-control" value={form.matiereId} onChange={e => setForm(f => ({ ...f, matiereId: e.target.value }))} disabled={formMatieresSaisissables.length === 0}>
                    {formMatieresSaisissables.length === 0
                      ? <option value="">Aucune matière disponible</option>
                      : formMatieresSaisissables.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                  </select>
                  {formMatieresSaisissables.length === 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Vous n'enseignez aucune matière à cet élève.</div>
                  )}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Note (sur 20) *</label>
                  <input className="form-control" type="number" min="0" max="20" step="0.5" value={form.valeur} onChange={e => setForm(f => ({ ...f, valeur: e.target.value }))} placeholder="ex: 14.5" />
                </div>
                <div className="form-group">
                  <label className="form-label">Type d'évaluation</label>
                  <select className="form-control" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="devoir">Devoir</option>
                    <option value="examen">Examen</option>
                    <option value="interrogation">Interrogation</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Trimestre</label>
                  <select className="form-control" value={form.trimestre} onChange={e => setForm(f => ({ ...f, trimestre: e.target.value }))}>
                    <option value="1">Trimestre 1</option>
                    <option value="2">Trimestre 2</option>
                    <option value="3">Trimestre 3</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input className="form-control" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Commentaire</label>
                <textarea className="form-control" value={form.commentaire} onChange={e => setForm(f => ({ ...f, commentaire: e.target.value }))} rows={2} placeholder="Observation..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// VUE PROFESSEUR — ses classes uniquement, saisie inline par type d'évaluation
// ============================================================
const EVAL_TYPES: { key: string; label: string }[] = [
  { key: 'interrogation', label: 'Interrogation' },
  { key: 'devoir', label: 'Devoir' },
  { key: 'examen', label: 'Composition' },
];

const NoteTypeCell: React.FC<{
  eleveId: string; matiereId: string; type: string; trimestre: 1 | 2 | 3;
  notes: Note[]; onAdd: (valeur: number) => Promise<void>;
}> = ({ eleveId, matiereId, type, trimestre, notes, onAdd }) => {
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const entries = notes.filter(n => n.eleveId === eleveId && n.matiereId === matiereId && n.type === type && n.trimestre === trimestre);

  const submit = async () => {
    const v = parseFloat(input);
    if (!isNaN(v) && v >= 0 && v <= 20) {
      setSubmitting(true);
      try {
        await onAdd(v);
        setInput('');
      } catch (err) {
        alert(errorMessage(err));
      } finally {
        setSubmitting(false);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center', minWidth: 76 }}>
      <input
        type="number" min="0" max="20" step="0.5" value={input} placeholder="—" disabled={submitting}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); }}
        onBlur={() => { if (input) submit(); }}
        style={{ width: 56, textAlign: 'center', padding: '4px 2px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)' }}
      />
      {entries.length > 0 && (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
          {entries.map(n => (
            <span key={n.id} className={getColor(n.valeur)} title={n.pending ? 'En attente de synchronisation' : undefined}
              style={{ fontSize: 10, fontWeight: 700, background: 'var(--surface2)', borderRadius: 4, padding: '1px 4px', opacity: n.pending ? 0.6 : 1, border: n.pending ? '1px dashed var(--text-light)' : 'none' }}>
              {n.valeur}{n.pending ? ' ⏳' : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const NotesParClasseProf: React.FC<NotesData> = ({ classes, matieres, eleves: allEleves, notes, onNoteCreated }) => {
  const { user } = useAuth();
  const [selectedTrimestre, setSelectedTrimestre] = useState<1 | 2 | 3>(1);

  const mesClasses = user ? classesDuProfesseur(user.id, classes, matieres) : [];
  const [selectedClasse, setSelectedClasse] = useState(mesClasses[0]?.id || '');
  const [selectedMatiere, setSelectedMatiere] = useState('');

  useEffect(() => {
    if (mesClasses.length && !mesClasses.some(c => c.id === selectedClasse)) {
      setSelectedClasse(mesClasses[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesClasses.length]);

  const classeObj = classes.find(c => c.id === selectedClasse) || mesClasses[0];
  const mesMatieresClasse = user && classeObj ? matieresEnseigneesParProf(user.id, classeObj.id, matieres) : [];

  useEffect(() => {
    if (mesMatieresClasse.length && !mesMatieresClasse.some(m => m.id === selectedMatiere)) {
      setSelectedMatiere(mesMatieresClasse[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classeObj?.id, mesMatieresClasse.length]);

  if (!mesClasses.length || !classeObj) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        Aucune classe ne vous est assignée pour le moment.
      </div>
    );
  }

  const matiereActuelle = mesMatieresClasse.find(m => m.id === selectedMatiere) || mesMatieresClasse[0];
  const classeEleves = allEleves.filter(e => e.classe === classeObj.nom);

  const addNote = async (eleveId: string, type: string, valeur: number) => {
    const created = await createNote({
      eleveId, matiereId: matiereActuelle!.id, valeur, type,
      trimestre: selectedTrimestre, date: new Date().toISOString().split('T')[0],
    });
    onNoteCreated(created);
  };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Notes & Bulletins</div><div className="page-subtitle">Vos classes uniquement — saisie par type d'évaluation</div></div>
      </div>

      <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 200 }}>
            <label className="form-label">Classe</label>
            <select className="form-control" value={selectedClasse} onChange={e => setSelectedClasse(e.target.value)}>
              {mesClasses.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          {mesMatieresClasse.length > 1 && (
            <div style={{ minWidth: 180 }}>
              <label className="form-label">Matière</label>
              <select className="form-control" value={selectedMatiere} onChange={e => setSelectedMatiere(e.target.value)}>
                {mesMatieresClasse.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="form-label">Trimestre</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {([1, 2, 3] as const).map(t => (
                <button key={t} className={`btn ${selectedTrimestre === t ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSelectedTrimestre(t)}>T{t}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span style={{ fontWeight: 700 }}>{classeObj.nom} — {matiereActuelle?.nom || 'aucune matière'} — {classeEleves.length} élève{classeEleves.length > 1 ? 's' : ''}</span>
        </div>
        {!matiereActuelle ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Vous n'enseignez aucune matière dans cette classe.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Élève</th>
                  {EVAL_TYPES.map(t => <th key={t.key} style={{ textAlign: 'center' }}>{t.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {classeEleves.length === 0 ? (
                  <tr><td colSpan={EVAL_TYPES.length + 1} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Aucun élève dans cette classe</td></tr>
                ) : classeEleves.map(e => (
                  <tr key={e.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="avatar avatar-sm" style={{ background: 'var(--primary-pale)', color: 'var(--primary-light)', fontWeight: 700 }}>{e.prenom[0]}{e.nom[0]}</div>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{e.prenom} {e.nom}</span>
                      </div>
                    </td>
                    {EVAL_TYPES.map(t => (
                      <td key={t.key} style={{ textAlign: 'center' }}>
                        <NoteTypeCell
                          eleveId={e.id} matiereId={matiereActuelle!.id} type={t.key} trimestre={selectedTrimestre}
                          notes={notes} onAdd={(v) => addNote(e.id, t.key, v)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// Wrapper : charge les données depuis l'API (déjà filtrées par rôle côté serveur)
// ============================================================
const NotesPage: React.FC = () => {
  const { user } = useAuth();
  const { reconnectedAt } = useConnectivity();
  const [classes, setClasses] = useState<Classe[]>([]);
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([fetchClasses(), fetchMatieres(), fetchEleves(), fetchNotes()])
      .then(([c, m, e, n]) => { if (!cancelled) { setClasses(c); setMatieres(m); setEleves(e); setNotes(n); } })
      .catch(err => { if (!cancelled) setError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Retour de connexion : rafraîchit silencieusement (sans écran de chargement)
  // pour remplacer les notes "en attente" par les vraies notes synchronisées.
  useEffect(() => {
    if (reconnectedAt === 0) return;
    Promise.all([fetchClasses(), fetchMatieres(), fetchEleves(), fetchNotes()])
      .then(([c, m, e, n]) => { setClasses(c); setMatieres(m); setEleves(e); setNotes(n); })
      .catch(() => { /* échec silencieux, on garde l'affichage actuel */ });
  }, [reconnectedAt]);

  if (loading) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Chargement...</div>;
  if (error) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>{error}</div>;

  const data: NotesData = { classes, matieres, eleves, notes, onNoteCreated: (n) => setNotes(prev => [...prev, n]) };

  if (user?.role === 'admin') return <NotesParClasse {...data} />;
  if (user?.role === 'professeur') return <NotesParClasseProf {...data} />;
  return <NotesParEleve {...data} />;
};

export default NotesPage;
