import React, { useState, useEffect, useMemo } from 'react';
import { Send, Plus, X, MessageCircle } from 'lucide-react';
import { Conversation, Message, Eleve, Classe, Matiere } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  fetchConversations, fetchMessages, sendReply, marquerConversationLue,
  createConversationForEleve, createConversationForClasse, fetchEleves, fetchClasses, fetchMatieres,
} from '../api/resources';
import { errorMessage } from '../api/client';
import { classesDuProfesseur, elevesDuProfesseur } from '../utils/permissions';

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
};

const MessagesPage: React.FC = () => {
  const { user } = useAuth();
  const canCompose = user?.role === 'admin' || user?.role === 'professeur';

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const [showCompose, setShowCompose] = useState(false);
  const [composeTarget, setComposeTarget] = useState<'eleve' | 'classe'>('eleve');
  const [composeEleveId, setComposeEleveId] = useState('');
  const [composeClasseId, setComposeClasseId] = useState('');
  const [composeText, setComposeText] = useState('');
  const [composing, setComposing] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [composeResult, setComposeResult] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchConversations(),
      canCompose ? fetchEleves() : Promise.resolve([]),
      canCompose ? fetchClasses() : Promise.resolve([]),
      canCompose ? fetchMatieres() : Promise.resolve([]),
    ])
      .then(([convs, e, c, m]) => { setConversations(convs); setEleves(e); setClasses(c); setMatieres(m); })
      .catch(err => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [canCompose]);

  // Mes cibles disponibles pour composer un message : un prof est limité à ses classes/élèves.
  const mesClasses = useMemo(() => {
    if (!user) return [];
    if (user.role === 'professeur') return classesDuProfesseur(user.id, classes, matieres);
    return classes;
  }, [user, classes, matieres]);

  const mesEleves = useMemo(() => {
    if (!user) return [];
    if (user.role === 'professeur') return elevesDuProfesseur(user.id, eleves, classes, matieres);
    return eleves.filter(e => e.parentId); // seuls les élèves avec un parent associé ont un intérêt ici
  }, [user, eleves, classes, matieres]);

  const openConversation = async (conv: Conversation) => {
    setSelectedId(conv.id);
    setLoadingThread(true);
    try {
      const msgs = await fetchMessages(conv.id);
      setMessages(msgs);
      if (conv.nonLus > 0) {
        await marquerConversationLue(conv.id);
        setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, nonLus: 0 } : c));
      }
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setLoadingThread(false);
    }
  };

  const handleReply = async () => {
    if (!selectedId || !replyText.trim()) return;
    setSending(true);
    try {
      const msg = await sendReply(selectedId, replyText.trim());
      setMessages(prev => [...prev, msg]);
      setReplyText('');
      setConversations(prev => prev.map(c => c.id === selectedId
        ? { ...c, dernierMessage: msg }
        : c));
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const openCompose = () => {
    setComposeTarget('eleve');
    setComposeEleveId(mesEleves[0]?.id || '');
    setComposeClasseId(mesClasses[0]?.id || '');
    setComposeText('');
    setComposeError(null);
    setComposeResult(null);
    setShowCompose(true);
  };

  const handleCompose = async () => {
    if (!composeText.trim()) return;
    setComposing(true);
    setComposeError(null);
    setComposeResult(null);
    try {
      if (composeTarget === 'eleve') {
        if (!composeEleveId) return;
        const conv = await createConversationForEleve(composeEleveId, composeText.trim());
        setConversations(prev => {
          const exists = prev.some(c => c.id === conv.id);
          return exists ? prev.map(c => c.id === conv.id ? conv : c) : [conv, ...prev];
        });
        setShowCompose(false);
      } else {
        if (!composeClasseId) return;
        const res = await createConversationForClasse(composeClasseId, composeText.trim());
        setComposeResult(`Message envoyé aux parents de ${res.created} élève${res.created > 1 ? 's' : ''}.`);
        load(); // recharge la liste complète des conversations
        setTimeout(() => setShowCompose(false), 1400);
      }
    } catch (err) {
      setComposeError(errorMessage(err));
    } finally {
      setComposing(false);
    }
  };

  if (loading) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Chargement...</div>;
  if (error) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>{error}</div>;

  const selected = conversations.find(c => c.id === selectedId) || null;
  const otherPartyName = (c: Conversation) => user?.role === 'parent' ? c.staffNom : c.parentNom;

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <div className="page-title">Messages</div>
            <div className="page-subtitle">
              {user?.role === 'parent' ? "Vos échanges avec l'établissement" : 'Conversations avec les parents'}
            </div>
          </div>
          {canCompose && <button className="btn btn-primary" onClick={openCompose}><Plus size={14} /> Nouveau message</button>}
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', minHeight: 520, overflow: 'hidden' }}>
        {/* Liste des conversations */}
        <div style={{ borderRight: '1px solid var(--border)', overflowY: 'auto' }}>
          {conversations.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Aucune conversation pour le moment.
            </div>
          ) : conversations
            .slice()
            .sort((a, b) => new Date(b.dernierMessage?.date || b.createdAt).getTime() - new Date(a.dernierMessage?.date || a.createdAt).getTime())
            .map(c => (
              <div key={c.id} onClick={() => openConversation(c)}
                style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: selectedId === c.id ? 'var(--primary-pale)' : 'transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{otherPartyName(c)}</span>
                  {c.dernierMessage && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(c.dernierMessage.date)}</span>}
                </div>
                {c.eleveNom && <div style={{ fontSize: 11, color: 'var(--text-light)', marginBottom: 2 }}>à propos de {c.eleveNom}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>
                    {c.dernierMessage?.contenu || '—'}
                  </span>
                  {c.nonLus > 0 && (
                    <span style={{ background: 'var(--primary)', color: 'white', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '2px 6px', flexShrink: 0 }}>
                      {c.nonLus}
                    </span>
                  )}
                </div>
              </div>
            ))}
        </div>

        {/* Fil de discussion */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {!selected ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: 8 }}>
              <MessageCircle size={32} color="var(--text-light)" />
              <span style={{ fontSize: 13 }}>Sélectionnez une conversation</span>
            </div>
          ) : (
            <>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{otherPartyName(selected)}</div>
                {selected.eleveNom && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>à propos de {selected.eleveNom}</div>}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {loadingThread ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Chargement...</div>
                ) : messages.map(m => {
                  const mine = m.auteurId === user?.id;
                  return (
                    <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                      {!mine && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2, marginLeft: 4 }}>{m.auteurNom}</div>}
                      <div style={{
                        background: mine ? 'var(--primary)' : 'var(--surface2)', color: mine ? 'white' : 'var(--text)',
                        borderRadius: 12, padding: '10px 14px', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                      }}>
                        {m.contenu}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 2, textAlign: mine ? 'right' : 'left' }}>{formatDate(m.date)}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ padding: 14, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                <input
                  className="form-control" placeholder="Écrire un message..." value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
                />
                <button className="btn btn-primary btn-icon" onClick={handleReply} disabled={!replyText.trim() || sending}>
                  <Send size={15} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal composer */}
      {showCompose && (
        <div className="modal-overlay" onClick={() => setShowCompose(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Nouveau message</div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowCompose(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {composeError && <div style={{ background: 'var(--danger-pale)', color: 'var(--danger)', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{composeError}</div>}
              {composeResult && <div style={{ background: 'var(--success-pale)', color: 'var(--success)', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{composeResult}</div>}

              <div className="form-group">
                <label className="form-label">Destinataire</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className={`btn ${composeTarget === 'eleve' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flex: 1, justifyContent: 'center', border: composeTarget === 'eleve' ? 'none' : '1px solid var(--border)' }}
                    onClick={() => setComposeTarget('eleve')}>
                    Un élève précis
                  </button>
                  <button type="button" className={`btn ${composeTarget === 'classe' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flex: 1, justifyContent: 'center', border: composeTarget === 'classe' ? 'none' : '1px solid var(--border)' }}
                    onClick={() => setComposeTarget('classe')}>
                    Toute une classe
                  </button>
                </div>
              </div>

              {composeTarget === 'eleve' ? (
                <div className="form-group">
                  <label className="form-label">Élève (message envoyé à son parent)</label>
                  <select className="form-control" value={composeEleveId} onChange={e => setComposeEleveId(e.target.value)}>
                    {mesEleves.length === 0
                      ? <option value="">Aucun élève disponible</option>
                      : mesEleves.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom} — {e.classe}</option>)}
                  </select>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Classe (message envoyé à tous les parents)</label>
                  <select className="form-control" value={composeClasseId} onChange={e => setComposeClasseId(e.target.value)}>
                    {mesClasses.length === 0
                      ? <option value="">Aucune classe disponible</option>
                      : mesClasses.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Message *</label>
                <textarea className="form-control" rows={4} value={composeText} onChange={e => setComposeText(e.target.value)} placeholder="Votre message..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowCompose(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleCompose}
                disabled={!composeText.trim() || composing || (composeTarget === 'eleve' ? !composeEleveId : !composeClasseId)}>
                {composing ? 'Envoi...' : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagesPage;
