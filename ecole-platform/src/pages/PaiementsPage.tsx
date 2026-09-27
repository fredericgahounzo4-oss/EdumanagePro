import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Download, CreditCard, AlertCircle, CheckCircle, ChevronRight } from 'lucide-react';
import { Paiement, Eleve, Classe } from '../types';
import { useAuth } from '../context/AuthContext';
import { useConnectivity } from '../context/ConnectivityContext';
import { fetchPaiements, fetchEleves, fetchClasses, createPaiement, updatePaiementStatus } from '../api/resources';
import { errorMessage } from '../api/client';
import { ReceiptPreview } from './OtherPages';
import { downloadElementAsPdf } from '../utils/pdfExport';

const ALL = '__all__';

interface PaiementsData {
  eleves: Eleve[];
  classes: Classe[];
  paiements: Paiement[];
  onPaiementCreated: (p: Paiement) => void;
  onPaiementUpdated: (p: { id: string; status: string; pending?: boolean }) => void;
}

// ============================================================
// VUE PARENT — uniquement son/ses enfant(s)
// ============================================================
const PaiementsParent: React.FC<PaiementsData> = ({ eleves, paiements }) => {
  const { user } = useAuth();
  const [detailEleve, setDetailEleve] = useState<string | null>(null);
  const [receiptPaiement, setReceiptPaiement] = useState<string | null>(null);
  const [exportingReceipt, setExportingReceipt] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const handleDownloadReceiptPdf = async (reference: string) => {
    if (!receiptRef.current || exportingReceipt) return;
    setExportingReceipt(true);
    try {
      await downloadElementAsPdf(receiptRef.current, `recu-${reference}.pdf`.replace(/\s+/g, '_'));
    } finally {
      setExportingReceipt(false);
    }
  };

  const mesEnfants = eleves.filter(e => e.parentId === user?.id);

  const totalDuEleve = (eleveId: string) => paiements.filter(p => p.eleveId === eleveId).reduce((s, p) => s + p.montant, 0);
  const totalPayeEleve = (eleveId: string) => paiements.filter(p => p.eleveId === eleveId && p.status === 'payé').reduce((s, p) => s + p.montant, 0);
  const statutGlobal = (eleveId: string): 'payé' | 'impayé' | 'partiel' | 'aucun' => {
    const ps = paiements.filter(p => p.eleveId === eleveId);
    if (!ps.length) return 'aucun';
    if (ps.some(p => p.status === 'impayé')) return 'impayé';
    if (ps.some(p => p.status === 'partiel')) return 'partiel';
    return 'payé';
  };

  const eleveDetail = detailEleve ? mesEnfants.find(e => e.id === detailEleve) : undefined;
  const paiementsDetail = detailEleve ? paiements.filter(p => p.eleveId === detailEleve) : [];

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Paiements</div><div className="page-subtitle">Suivi des frais de scolarité de {mesEnfants.length > 1 ? 'vos enfants' : 'votre enfant'}</div></div>
      </div>

      {mesEnfants.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Aucun enfant associé à votre compte.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {mesEnfants.map(e => {
            const statut = statutGlobal(e.id);
            return (
              <div key={e.id} className="card">
                <div className="card-header">
                  <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="avatar avatar-sm" style={{ background: 'var(--primary-pale)', color: 'var(--primary-light)', fontWeight: 700 }}>{e.prenom[0]}{e.nom[0]}</div>
                    {e.prenom} {e.nom} — {e.classe}
                  </span>
                  <span className={`badge badge-${statut === 'payé' ? 'success' : statut === 'impayé' ? 'danger' : statut === 'partiel' ? 'warning' : 'neutral'}`}>
                    {statut === 'aucun' ? 'Aucun paiement' : statut}
                  </span>
                </div>
                <div className="card-body" style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <div><div className="stat-label">Total dû</div><div style={{ fontWeight: 800, fontSize: 18 }}>{totalDuEleve(e.id).toLocaleString('fr-FR')} FCFA</div></div>
                  <div><div className="stat-label">Total payé</div><div style={{ fontWeight: 800, fontSize: 18, color: 'var(--success)' }}>{totalPayeEleve(e.id).toLocaleString('fr-FR')} FCFA</div></div>
                  <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', alignSelf: 'center' }} onClick={() => setDetailEleve(e.id)}>Voir le détail <ChevronRight size={12} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {eleveDetail && (
        <div className="modal-overlay" onClick={() => setDetailEleve(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{eleveDetail.prenom} {eleveDetail.nom} — {eleveDetail.classe}</div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDetailEleve(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {paiementsDetail.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Aucun paiement enregistré.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 12, color: 'var(--text-muted)' }}>Type</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 12, color: 'var(--text-muted)' }}>Période</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 12, color: 'var(--text-muted)' }}>Montant</th>
                      <th style={{ textAlign: 'center', padding: '6px 8px', fontSize: 12, color: 'var(--text-muted)' }}>Statut</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 12, color: 'var(--text-muted)' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paiementsDetail.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px' }}><span className="badge badge-primary">{p.type}</span></td>
                        <td style={{ padding: '8px', fontSize: 12, color: 'var(--text-muted)' }}>{p.mois || new Date(p.date).toLocaleDateString('fr-FR')}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }} className="mono">{p.montant.toLocaleString('fr-FR')}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <span className={`badge badge-${p.status === 'payé' ? 'success' : p.status === 'impayé' ? 'danger' : 'warning'}`} style={p.pending ? { opacity: 0.6, border: '1px dashed currentColor' } : undefined} title={p.pending ? 'En attente de synchronisation' : undefined}>{p.status}{p.pending ? ' ⏳' : ''}</span>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>
                          {p.status === 'payé' && <button className="btn btn-ghost btn-sm" onClick={() => setReceiptPaiement(p.id)}><Download size={12} /> Reçu</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDetailEleve(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {receiptPaiement && (() => {
        const p = paiements.find(x => x.id === receiptPaiement);
        if (!p) return null;
        const e = eleves.find(x => x.id === p.eleveId);
        return (
          <div className="modal-overlay bulletin-modal-overlay" onClick={() => setReceiptPaiement(null)}>
            <div className="modal bulletin-modal" onClick={ev => ev.stopPropagation()} style={{ maxWidth: 560 }}>
              <div className="modal-header no-print">
                <div className="modal-title">Reçu de paiement</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-accent btn-sm" onClick={() => handleDownloadReceiptPdf(p.reference)} disabled={exportingReceipt}><Download size={13} /> {exportingReceipt ? 'Génération...' : 'Télécharger PDF'}</button>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setReceiptPaiement(null)}><X size={16} /></button>
                </div>
              </div>
              <div className="modal-body" style={{ background: 'var(--surface2)' }}>
                <div ref={receiptRef}>
                  <ReceiptPreview paiement={p} eleve={e} />
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ============================================================
// VUE ADMIN — toutes les classes
// ============================================================
const PaiementsAdmin: React.FC<PaiementsData> = ({ eleves, classes, paiements, onPaiementCreated, onPaiementUpdated }) => {
  const [selectedClasse, setSelectedClasse] = useState(ALL);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [detailEleve, setDetailEleve] = useState<string | null>(null);
  const [receiptPaiement, setReceiptPaiement] = useState<string | null>(null);
  const [exportingReceipt, setExportingReceipt] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const handleDownloadReceiptPdf = async (reference: string) => {
    if (!receiptRef.current || exportingReceipt) return;
    setExportingReceipt(true);
    try {
      await downloadElementAsPdf(receiptRef.current, `recu-${reference}.pdf`.replace(/\s+/g, '_'));
    } finally {
      setExportingReceipt(false);
    }
  };
  const [form, setForm] = useState({ eleveId: eleves[0]?.id || '', montant: '', type: 'mensualite', status: 'impayé', date: new Date().toISOString().split('T')[0], mois: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const classeObj = classes.find(c => c.id === selectedClasse);
  const elevesVisibles = classeObj ? eleves.filter(e => e.classe === classeObj.nom) : eleves;

  const filtered = paiements.filter(p => {
    const eleve = eleves.find(e => e.id === p.eleveId);
    const matchC = !classeObj || eleve?.classe === classeObj.nom;
    const matchS = !filterStatus || p.status === filterStatus;
    const matchT = !filterType || p.type === filterType;
    return matchC && matchS && matchT;
  });

  const totalPaye = filtered.filter(p => p.status === 'payé').reduce((s, p) => s + p.montant, 0);
  const totalImpaye = filtered.filter(p => p.status === 'impayé').reduce((s, p) => s + p.montant, 0);
  const totalPartiel = filtered.filter(p => p.status === 'partiel').reduce((s, p) => s + p.montant, 0);

  const handleSave = async () => {
    if (!form.montant || !form.eleveId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const created = await createPaiement({
        eleveId: form.eleveId, montant: parseFloat(form.montant), type: form.type, status: form.status,
        date: form.date, reference: 'REF-' + Date.now(), mois: form.mois || undefined,
      });
      onPaiementCreated(created);
      setShowModal(false);
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const markPaid = async (id: string) => {
    try {
      const updated = await updatePaiementStatus(id, 'payé');
      onPaiementUpdated(updated);
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const statutGlobal = (eleveId: string): 'payé' | 'impayé' | 'partiel' | 'aucun' => {
    const ps = paiements.filter(p => p.eleveId === eleveId);
    if (!ps.length) return 'aucun';
    if (ps.some(p => p.status === 'impayé')) return 'impayé';
    if (ps.some(p => p.status === 'partiel')) return 'partiel';
    return 'payé';
  };

  const totalDuEleve = (eleveId: string) => paiements.filter(p => p.eleveId === eleveId).reduce((s, p) => s + p.montant, 0);
  const totalPayeEleve = (eleveId: string) => paiements.filter(p => p.eleveId === eleveId && p.status === 'payé').reduce((s, p) => s + p.montant, 0);

  const eleveDetail = detailEleve ? eleves.find(e => e.id === detailEleve) : undefined;
  const paiementsDetail = detailEleve ? paiements.filter(p => p.eleveId === detailEleve) : [];

  const openModalFor = (eleveId?: string) => {
    setForm(f => ({ ...f, eleveId: eleveId || elevesVisibles[0]?.id || eleves[0]?.id || '' }));
    setSaveError(null);
    setShowModal(true);
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <div className="page-title">Gestion des paiements</div>
            <div className="page-subtitle">Frais de scolarité, inscriptions et mensualités — par classe</div>
          </div>
          <button className="btn btn-primary" onClick={() => openModalFor()}><Plus size={14} /> Nouveau paiement</button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        {[
          { label: 'Total encaissé', value: totalPaye.toLocaleString('fr-FR') + ' FCFA', icon: <CheckCircle size={20} />, color: '#16a34a', bg: 'var(--success-pale)' },
          { label: 'Impayés', value: totalImpaye.toLocaleString('fr-FR') + ' FCFA', icon: <AlertCircle size={20} />, color: '#dc2626', bg: 'var(--danger-pale)' },
          { label: 'Partiels', value: totalPartiel.toLocaleString('fr-FR') + ' FCFA', icon: <CreditCard size={20} />, color: '#d97706', bg: 'var(--warning-pale)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
            <div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ fontSize: 18, color: s.color }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <select className="form-control" style={{ width: 180 }} value={selectedClasse} onChange={e => setSelectedClasse(e.target.value)}>
            <option value={ALL}>Toutes les classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <select className="form-control" style={{ width: 160 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Tous les statuts</option>
            <option value="payé">Payé</option>
            <option value="impayé">Impayé</option>
            <option value="partiel">Partiel</option>
          </select>
          <select className="form-control" style={{ width: 160 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">Tous les types</option>
            <option value="inscription">Inscription</option>
            <option value="mensualite">Mensualité</option>
            <option value="transport">Transport</option>
            <option value="cantine">Cantine</option>
          </select>
          {(filterStatus || filterType || selectedClasse !== ALL) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setFilterStatus(''); setFilterType(''); setSelectedClasse(ALL); }}>
              <X size={12} /> Effacer les filtres
            </button>
          )}
        </div>
      </div>

      {classeObj ? (
        // ===== Vue par classe : un élève par ligne, avec résumé de sa situation =====
        <div className="card">
          <div className="card-header">
            <span style={{ fontWeight: 700 }}>{classeObj.nom} — {elevesVisibles.length} élève{elevesVisibles.length > 1 ? 's' : ''}</span>
            <button className="btn btn-ghost btn-sm"><Download size={13} /> Exporter</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Élève</th>
                  <th>Total dû (FCFA)</th>
                  <th>Total payé (FCFA)</th>
                  <th>Statut</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {elevesVisibles.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Aucun élève dans cette classe</td></tr>
                ) : elevesVisibles.map(e => {
                  const statut = statutGlobal(e.id);
                  return (
                    <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => setDetailEleve(e.id)}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="avatar avatar-sm" style={{ background: 'var(--primary-pale)', color: 'var(--primary-light)', fontWeight: 700 }}>{e.prenom[0]}{e.nom[0]}</div>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{e.prenom} {e.nom}</span>
                        </div>
                      </td>
                      <td className="mono">{totalDuEleve(e.id).toLocaleString('fr-FR')}</td>
                      <td className="mono">{totalPayeEleve(e.id).toLocaleString('fr-FR')}</td>
                      <td>
                        <span className={`badge badge-${statut === 'payé' ? 'success' : statut === 'impayé' ? 'danger' : statut === 'partiel' ? 'warning' : 'neutral'}`}>
                          {statut === 'aucun' ? 'Aucun paiement' : statut}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-ghost btn-sm">Détails <ChevronRight size={12} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // ===== Vue "toutes les classes" : liste plate de tous les paiements =====
        <div className="card">
          <div className="card-header">
            <span style={{ fontWeight: 700 }}>Liste des paiements ({filtered.length})</span>
            <button className="btn btn-ghost btn-sm"><Download size={13} /> Exporter</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Élève</th>
                  <th>Type</th>
                  <th>Période</th>
                  <th>Montant (FCFA)</th>
                  <th>Date</th>
                  <th>Statut</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Aucun paiement trouvé</td></tr>
                ) : filtered.map(p => {
                  const eleve = eleves.find(e => e.id === p.eleveId);
                  return (
                    <tr key={p.id}>
                      <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.reference}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="avatar avatar-sm" style={{ background: 'var(--primary-pale)', color: 'var(--primary-light)', fontWeight: 700 }}>
                            {eleve?.prenom[0]}{eleve?.nom[0]}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{eleve?.prenom} {eleve?.nom}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{eleve?.classe}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className="badge badge-primary">{p.type}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.mois || '—'}</td>
                      <td className="mono" style={{ fontWeight: 700 }}>{p.montant.toLocaleString('fr-FR')}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(p.date).toLocaleDateString('fr-FR')}</td>
                      <td><span className={`badge badge-${p.status === 'payé' ? 'success' : p.status === 'impayé' ? 'danger' : 'warning'}`} style={p.pending ? { opacity: 0.6, border: '1px dashed currentColor' } : undefined} title={p.pending ? 'En attente de synchronisation' : undefined}>{p.status}{p.pending ? ' ⏳' : ''}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        {p.status !== 'payé' && (
                          <button className="btn btn-success btn-sm" onClick={() => markPaid(p.id)}>
                            <CheckCircle size={12} /> Marquer payé
                          </button>
                        )}
                        {p.status === 'payé' && (
                          <button className="btn btn-ghost btn-sm" onClick={() => setReceiptPaiement(p.id)}><Download size={12} /> Reçu</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Détail des paiements d'un élève (vue par classe) */}
      {eleveDetail && (
        <div className="modal-overlay" onClick={() => setDetailEleve(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{eleveDetail.prenom} {eleveDetail.nom} — {eleveDetail.classe}</div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDetailEleve(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {paiementsDetail.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Aucun paiement enregistré pour cet élève.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 12, color: 'var(--text-muted)' }}>Type</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 12, color: 'var(--text-muted)' }}>Période</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 12, color: 'var(--text-muted)' }}>Montant</th>
                      <th style={{ textAlign: 'center', padding: '6px 8px', fontSize: 12, color: 'var(--text-muted)' }}>Statut</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 12, color: 'var(--text-muted)' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paiementsDetail.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px' }}><span className="badge badge-primary">{p.type}</span></td>
                        <td style={{ padding: '8px', fontSize: 12, color: 'var(--text-muted)' }}>{p.mois || new Date(p.date).toLocaleDateString('fr-FR')}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }} className="mono">{p.montant.toLocaleString('fr-FR')}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <span className={`badge badge-${p.status === 'payé' ? 'success' : p.status === 'impayé' ? 'danger' : 'warning'}`} style={p.pending ? { opacity: 0.6, border: '1px dashed currentColor' } : undefined} title={p.pending ? 'En attente de synchronisation' : undefined}>{p.status}{p.pending ? ' ⏳' : ''}</span>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>
                          {p.status !== 'payé' && <button className="btn btn-success btn-sm" onClick={() => markPaid(p.id)}>Marquer payé</button>}
                          {p.status === 'payé' && <button className="btn btn-ghost btn-sm" onClick={() => setReceiptPaiement(p.id)}><Download size={12} /> Reçu</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDetailEleve(null)}>Fermer</button>
              <button className="btn btn-primary" onClick={() => { openModalFor(eleveDetail.id); setDetailEleve(null); }}><Plus size={14} /> Nouveau paiement</button>
            </div>
          </div>
        </div>
      )}

      {receiptPaiement && (() => {
        const p = paiements.find(x => x.id === receiptPaiement);
        if (!p) return null;
        const e = eleves.find(x => x.id === p.eleveId);
        return (
          <div className="modal-overlay bulletin-modal-overlay" onClick={() => setReceiptPaiement(null)}>
            <div className="modal bulletin-modal" onClick={ev => ev.stopPropagation()} style={{ maxWidth: 560 }}>
              <div className="modal-header no-print">
                <div className="modal-title">Reçu de paiement</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-accent btn-sm" onClick={() => handleDownloadReceiptPdf(p.reference)} disabled={exportingReceipt}><Download size={13} /> {exportingReceipt ? 'Génération...' : 'Télécharger PDF'}</button>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setReceiptPaiement(null)}><X size={16} /></button>
                </div>
              </div>
              <div className="modal-body" style={{ background: 'var(--surface2)' }}>
                <div ref={receiptRef}>
                  <ReceiptPreview paiement={p} eleve={e} />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Enregistrer un paiement</div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {saveError && <div style={{ background: 'var(--danger-pale)', color: 'var(--danger)', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{saveError}</div>}
              <div className="form-group">
                <label className="form-label">Élève *</label>
                <select className="form-control" value={form.eleveId} onChange={e => setForm(f => ({ ...f, eleveId: e.target.value }))}>
                  {eleves.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom} — {e.classe}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Type *</label>
                  <select className="form-control" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="inscription">Inscription</option>
                    <option value="mensualite">Mensualité</option>
                    <option value="transport">Transport</option>
                    <option value="cantine">Cantine</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Montant (FCFA) *</label>
                  <input className="form-control" type="number" value={form.montant} onChange={e => setForm(f => ({ ...f, montant: e.target.value }))} placeholder="25000" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Statut</label>
                  <select className="form-control" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="payé">Payé</option>
                    <option value="impayé">Impayé</option>
                    <option value="partiel">Partiel</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input className="form-control" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Mois concerné</label>
                <input className="form-control" value={form.mois} onChange={e => setForm(f => ({ ...f, mois: e.target.value }))} placeholder="ex: Novembre 2024" />
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
const PaiementsPage: React.FC = () => {
  const { user } = useAuth();
  const { reconnectedAt } = useConnectivity();
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([fetchEleves(), fetchClasses(), fetchPaiements()])
      .then(([e, c, p]) => { if (!cancelled) { setEleves(e); setClasses(c); setPaiements(p); } })
      .catch(err => { if (!cancelled) setError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Retour de connexion : remplace silencieusement les paiements "en attente"
  // par les vraies données synchronisées.
  useEffect(() => {
    if (reconnectedAt === 0) return;
    fetchPaiements().then(setPaiements).catch(() => { /* échec silencieux */ });
  }, [reconnectedAt]);

  if (loading) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Chargement...</div>;
  if (error) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>{error}</div>;

  const data: PaiementsData = {
    eleves, classes, paiements,
    onPaiementCreated: (p) => setPaiements(prev => [...prev, p]),
    onPaiementUpdated: (p) => setPaiements(prev => prev.map(x => x.id === p.id ? { ...x, status: p.status as Paiement['status'], pending: p.pending } : x)),
  };

  if (user?.role === 'parent') return <PaiementsParent {...data} />;
  return <PaiementsAdmin {...data} />;
};

export default PaiementsPage;
