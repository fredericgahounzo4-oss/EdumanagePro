import React, { useState, useEffect, useMemo } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';
import { CreneauEDT, Classe, Matiere, Eleve, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { classesDuProfesseur } from '../utils/permissions';
import { fetchClasses, fetchMatieres, fetchEleves, fetchEmploiDuTemps, upsertCreneau, deleteCreneau, createMatiere, fetchUsersByRole } from '../api/resources';
import { errorMessage } from '../api/client';

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'] as const;
// Créneaux proposés par défaut au premier chargement — l'admin peut en créer
// d'autres librement (ex: 07:00-07:55) via "Nouveau créneau horaire".
const DEFAULT_SLOTS: { debut: string; fin: string }[] = [
  { debut: '07:30', fin: '09:30' },
  { debut: '09:30', fin: '11:30' },
  { debut: '13:00', fin: '15:00' },
  { debut: '15:00', fin: '17:00' },
];

const NEW_MATIERE = '__new_matiere__';

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const emptyForm = (jour: string, debut = '', fin = '') => ({ jour, heureDebut: debut, heureFin: fin, matiereId: '', salle: '' });

const EmploiDuTempsPage: React.FC = () => {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin';

  const [classes, setClasses] = useState<Classe[]>([]);
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [emploiDuTemps, setEmploiDuTemps] = useState<CreneauEDT[]>([]);
  const [professeurs, setProfesseurs] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([fetchClasses(), fetchMatieres(), fetchEleves(), fetchEmploiDuTemps(), canEdit ? fetchUsersByRole('professeur') : Promise.resolve([])])
      .then(([c, m, e, edt, profs]) => { if (!cancelled) { setClasses(c); setMatieres(m); setEleves(e); setEmploiDuTemps(edt); setProfesseurs(profs); } })
      .catch(err => { if (!cancelled) setError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [canEdit]);

  // Classes visibles selon le rôle : admin/surveillant voient tout, un prof ne voit que ses classes,
  // un parent ne voit que la ou les classes de son/ses enfant(s).
  const classesVisibles = (() => {
    if (user?.role === 'professeur') return classesDuProfesseur(user.id, classes, matieres);
    if (user?.role === 'parent') {
      const nomsClasses = new Set(eleves.filter(e => e.parentId === user.id).map(e => e.classe));
      return classes.filter(c => nomsClasses.has(c.nom));
    }
    return classes;
  })();

  const [selectedClasse, setSelectedClasse] = useState('');
  const [editSlot, setEditSlot] = useState<{ existing?: CreneauEDT } | null>(null);
  const [form, setForm] = useState(emptyForm(JOURS[0]));
  const [showNewMatiere, setShowNewMatiere] = useState(false);
  const [newMatiereForm, setNewMatiereForm] = useState({ nom: '', coefficient: '2', couleur: '#2563a8', professeurId: '' });
  const [creatingMatiere, setCreatingMatiere] = useState(false);
  const [matiereError, setMatiereError] = useState<string | null>(null);

  useEffect(() => {
    if (classesVisibles.length && !classesVisibles.some(c => c.id === selectedClasse)) {
      setSelectedClasse(classesVisibles[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classesVisibles.length]);

  // Les lignes de la grille sont dynamiques : les 4 créneaux par défaut + tout
  // créneau horaire personnalisé déjà créé (ex: 07:00-07:55), toutes classes
  // confondues. Une seule ligne par heure de début, même si des cours qui y
  // démarrent ont des durées différentes selon le jour : chaque cellule
  // affiche et utilise l'horaire propre du cours qu'elle contient (voir
  // getCoursForSlot / openSlot ci-dessous), jamais un horaire "de ligne"
  // partagé — c'est ce qui évitait une ligne par durée sans recréer le bug
  // où l'un écrasait l'heure de fin affichée de l'autre.
  const creneauxRows = useMemo(() => {
    const byDebut = new Map<string, { debut: string; fin: string }>();
    DEFAULT_SLOTS.forEach(s => byDebut.set(s.debut, s));
    emploiDuTemps.forEach(c => byDebut.set(c.heureDebut, { debut: c.heureDebut, fin: c.heureFin }));
    return Array.from(byDebut.values()).sort((a, b) => toMinutes(a.debut) - toMinutes(b.debut));
  }, [emploiDuTemps]);

  const getCoursForSlot = (jour: string, debut: string) =>
    emploiDuTemps.find(e => e.jour === jour && e.heureDebut === debut && e.classeId === selectedClasse);

  const getMatiereById = (id: string) => matieres.find(m => m.id === id);
  const matieresDeLaClasse = matieres.filter(m => m.classeId === selectedClasse);

  const lightenColor = (hex: string, opacity: number = 0.15) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${opacity})`;
  };

  const resetMatiereForm = () => {
    setShowNewMatiere(false);
    setNewMatiereForm({ nom: '', coefficient: '2', couleur: '#2563a8', professeurId: '' });
    setMatiereError(null);
  };

  // fin: l'heure de fin propre au cours déjà présent dans la cellule, si elle
  // existe — sinon l'heure de fin par défaut de la ligne, pour la création
  // d'un nouveau cours. Ne jamais utiliser l'heure "de ligne" pour modifier
  // un cours existant, au risque de raccourcir/allonger un cours sans le vouloir.
  const openSlot = (jour: string, debut: string, fin: string) => {
    if (!canEdit) return;
    const existing = getCoursForSlot(jour, debut);
    const finReelle = existing?.heureFin || fin;
    setForm({ jour, heureDebut: debut, heureFin: finReelle, matiereId: existing?.matiereId || '', salle: existing?.salle || '' });
    setSaveError(null);
    resetMatiereForm();
    setEditSlot({ existing });
  };

  const openNewSlot = () => {
    setForm(emptyForm(JOURS[0]));
    setSaveError(null);
    resetMatiereForm();
    setEditSlot({ existing: undefined });
  };

  const handleMatiereSelectChange = (value: string) => {
    if (value === NEW_MATIERE) {
      setShowNewMatiere(true);
      setMatiereError(null);
    } else {
      setForm(f => ({ ...f, matiereId: value }));
    }
  };

  const handleCreateMatiere = async () => {
    if (!newMatiereForm.nom.trim()) return;
    setCreatingMatiere(true);
    setMatiereError(null);
    try {
      const created = await createMatiere({
        nom: newMatiereForm.nom.trim(), coefficient: parseInt(newMatiereForm.coefficient) || 1,
        classeId: selectedClasse, couleur: newMatiereForm.couleur,
        professeurId: newMatiereForm.professeurId || undefined,
      });
      setMatieres(prev => [...prev, created]);
      setForm(f => ({ ...f, matiereId: created.id }));
      resetMatiereForm();
    } catch (err) {
      setMatiereError(errorMessage(err));
    } finally {
      setCreatingMatiere(false);
    }
  };

  const handleSaveSlot = async () => {
    if (!editSlot || !form.matiereId || !form.salle || !form.heureDebut || !form.heureFin) return;
    if (toMinutes(form.heureFin) <= toMinutes(form.heureDebut)) {
      setSaveError("L'heure de fin doit être après l'heure de début.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await upsertCreneau({
        id: editSlot.existing?.id, jour: form.jour, heureDebut: form.heureDebut, heureFin: form.heureFin,
        matiereId: form.matiereId, classeId: selectedClasse, salle: form.salle,
      });
      setEmploiDuTemps(prev => {
        const withoutOld = prev.filter(e => e.id !== editSlot.existing?.id);
        return [...withoutOld, saved];
      });
      setEditSlot(null);
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSlot = async () => {
    if (!editSlot?.existing) return;
    try {
      await deleteCreneau(editSlot.existing.id);
      setEmploiDuTemps(prev => prev.filter(e => e.id !== editSlot.existing!.id));
      setEditSlot(null);
    } catch (err) {
      setSaveError(errorMessage(err));
    }
  };

  if (loading) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Chargement...</div>;
  if (error) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>{error}</div>;

  if (!classesVisibles.length) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        Aucune classe à afficher pour le moment.
      </div>
    );
  }

  const creneauxClasse = emploiDuTemps.filter(e => e.classeId === selectedClasse);
  const totalMinutes = creneauxClasse.reduce((s, c) => s + (toMinutes(c.heureFin) - toMinutes(c.heureDebut)), 0);

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <div className="page-title">Emploi du temps{classesVisibles.length === 1 ? ` — ${classesVisibles[0].nom}` : ''}</div>
            <div className="page-subtitle">{canEdit ? 'Cliquez sur un créneau pour le créer ou le modifier' : 'Planning hebdomadaire par classe'}</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {classesVisibles.length > 1 && (
              <select className="form-control" style={{ width: 180 }} value={selectedClasse} onChange={e => setSelectedClasse(e.target.value)}>
                {classesVisibles.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            )}
            {canEdit && (
              <button className="btn btn-primary" onClick={openNewSlot}><Plus size={14} /> Nouveau créneau horaire</button>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="card" style={{ marginBottom: 20, padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Matières :</span>
          {matieresDeLaClasse.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-light)' }}>Aucune matière pour cette classe pour le moment</span>}
          {matieresDeLaClasse.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: m.couleur }} />
              <span>{m.nom}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 700 }}>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '90px repeat(5, 1fr)', borderBottom: '2px solid var(--border)' }}>
              <div style={{ padding: '12px 10px', background: 'var(--surface2)', borderRight: '1px solid var(--border)' }} />
              {JOURS.map(j => (
                <div key={j} style={{ padding: '12px 10px', background: 'var(--surface2)', borderRight: '1px solid var(--border)', textAlign: 'center', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{j}</div>
              ))}
            </div>

            {/* Time rows */}
            {creneauxRows.map((slot, ci) => (
              <div key={slot.debut} style={{ display: 'grid', gridTemplateColumns: '90px repeat(5, 1fr)', borderBottom: ci < creneauxRows.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ padding: '16px 10px', background: 'var(--surface2)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{slot.debut}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{slot.fin}</div>
                </div>
                {JOURS.map(jour => {
                  const cours = getCoursForSlot(jour, slot.debut);
                  const matiere = cours ? getMatiereById(cours.matiereId) : null;

                  return (
                    <div key={jour} onClick={() => openSlot(jour, slot.debut, slot.fin)} style={{ padding: 8, borderRight: '1px solid var(--border)', minHeight: 80, cursor: canEdit ? 'pointer' : 'default' }}>
                      {cours && matiere ? (
                        <div style={{ height: '100%', background: lightenColor(matiere.couleur, 0.12), border: `1.5px solid ${matiere.couleur}40`, borderLeft: `3px solid ${matiere.couleur}`, borderRadius: 8, padding: '8px 10px', transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = lightenColor(matiere.couleur, 0.22); }}
                          onMouseLeave={e => { e.currentTarget.style.background = lightenColor(matiere.couleur, 0.12); }}>
                          <div style={{ fontWeight: 700, fontSize: 12, color: matiere.couleur, marginBottom: 2 }}>{matiere.nom}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cours.salle}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 4 }}>Coeff. {matiere.coefficient}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 2 }}>{cours.heureDebut} - {cours.heureFin}</div>
                        </div>
                      ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 64, borderRadius: 8, border: canEdit ? '1.5px dashed var(--border)' : 'none' }}
                          onMouseEnter={e => { if (canEdit) e.currentTarget.style.background = 'var(--surface2)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                          {canEdit ? <Plus size={14} color="var(--text-light)" /> : <span style={{ fontSize: 11, color: 'var(--border)', userSelect: 'none' }}>—</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats summary */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: 20 }}>
        {[
          { label: 'Cours/semaine', value: creneauxClasse.length },
          { label: 'Matières', value: Array.from(new Set(creneauxClasse.map(e => e.matiereId))).length },
          { label: 'Heures/semaine', value: (totalMinutes / 60).toFixed(1).replace(/\.0$/, '') + 'h' },
          { label: 'Classe', value: classes.find(c => c.id === selectedClasse)?.nom || '—' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ flexDirection: 'column', gap: 4 }}>
            <div className="stat-label">{s.label}</div>
            <div style={{ fontWeight: 800, fontSize: 22 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Modal création / édition de créneau */}
      {editSlot && (
        <div className="modal-overlay" onClick={() => setEditSlot(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editSlot.existing ? 'Modifier le créneau' : 'Ajouter un cours'}</div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditSlot(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {saveError && <div style={{ background: 'var(--danger-pale)', color: 'var(--danger)', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{saveError}</div>}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Jour *</label>
                  <select className="form-control" value={form.jour} onChange={e => setForm(f => ({ ...f, jour: e.target.value }))}>
                    {JOURS.map(j => <option key={j} value={j}>{j}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Heure de début *</label>
                  <input className="form-control" type="time" value={form.heureDebut} onChange={e => setForm(f => ({ ...f, heureDebut: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Heure de fin *</label>
                  <input className="form-control" type="time" value={form.heureFin} onChange={e => setForm(f => ({ ...f, heureFin: e.target.value }))} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -8, marginBottom: 14 }}>
                Les horaires sont libres — par exemple 07:00 à 07:55 pour un cours court.
              </div>

              <div className="form-group">
                <label className="form-label">Matière *</label>
                <select className="form-control" value={form.matiereId} onChange={e => handleMatiereSelectChange(e.target.value)}>
                  <option value="">Sélectionner...</option>
                  {matieresDeLaClasse.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                  <option value={NEW_MATIERE}>+ Nouvelle matière...</option>
                </select>
              </div>

              {showNewMatiere && (
                <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Nouvelle matière pour {classes.find(c => c.id === selectedClasse)?.nom}</div>
                  {matiereError && <div style={{ background: 'var(--danger-pale)', color: 'var(--danger)', padding: '6px 10px', borderRadius: 6, fontSize: 12, marginBottom: 10 }}>{matiereError}</div>}
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Nom *</label>
                      <input className="form-control" value={newMatiereForm.nom} onChange={e => setNewMatiereForm(f => ({ ...f, nom: e.target.value }))} placeholder="ex: Philosophie" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Coefficient</label>
                      <input className="form-control" type="number" min="1" max="10" value={newMatiereForm.coefficient} onChange={e => setNewMatiereForm(f => ({ ...f, coefficient: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Professeur</label>
                      <select className="form-control" value={newMatiereForm.professeurId} onChange={e => setNewMatiereForm(f => ({ ...f, professeurId: e.target.value }))}>
                        <option value="">Aucun (à assigner plus tard)</option>
                        {professeurs.map(p => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Couleur</label>
                      <input className="form-control" type="color" value={newMatiereForm.couleur} onChange={e => setNewMatiereForm(f => ({ ...f, couleur: e.target.value }))} style={{ height: 38, padding: 4 }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={resetMatiereForm}>Annuler</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={handleCreateMatiere} disabled={!newMatiereForm.nom.trim() || creatingMatiere}>
                      {creatingMatiere ? 'Création...' : 'Créer la matière'}
                    </button>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Salle *</label>
                <input className="form-control" value={form.salle} onChange={e => setForm(f => ({ ...f, salle: e.target.value }))} placeholder="ex: Salle 101" />
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: editSlot.existing ? 'space-between' : 'flex-end' }}>
              {editSlot.existing && (
                <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={handleDeleteSlot}><Trash2 size={14} /> Supprimer</button>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => setEditSlot(null)}>Annuler</button>
                <button className="btn btn-primary" onClick={handleSaveSlot} disabled={!form.matiereId || !form.salle || !form.heureDebut || !form.heureFin || saving}>
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmploiDuTempsPage;
