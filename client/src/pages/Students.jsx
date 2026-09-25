import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";

const NIVEAUX_CLASSES = {
  Primaire: ["CP1", "CP2", "CE1", "CE2", "CM1", "CM2"],
  College: ["6ème", "5ème", "4ème", "3ème"],
  Lycee: ["Seconde", "Première", "Terminale"],
};
const SERIES = ["A4", "C", "D", "S", "G1", "G2", "G3", "G4", "F1", "F2", "F3", "F4"];

const EMPTY = { Nom: "", Prenom: "", Niveau: "Lycee", Classe: "Terminale", Serie: "D", Annee: "2025-2026", Sexe: "", Statut: "" };

export default function Students() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Administrateur";
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [niveauFilter, setNiveauFilter] = useState("");
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [credentials, setCredentials] = useState(null); // identifiants générés à afficher après création/réinitialisation

  function load() {
    const params = {};
    if (search) params.search = search;
    if (niveauFilter) params.niveau = niveauFilter;
    api.getStudents(params).then(setStudents).catch((e) => setError(e.message));
  }
  useEffect(load, [search, niveauFilter]);

  function openCreate() { setEditing(null); setForm(EMPTY); setModalOpen(true); }
  function openEdit(s) { setEditing(s); setForm({ ...EMPTY, ...s }); setModalOpen(true); }

  async function submitForm(e) {
    e.preventDefault();
    try {
      if (editing) {
        await api.updateStudent(editing.ID, form);
      } else {
        const res = await api.createStudent(form);
        if (res.compte) setCredentials({ nom: `${form.Nom} ${form.Prenom}`, ...res.compte });
      }
      setModalOpen(false);
      load();
    } catch (err) { alert(err.message); }
  }

  async function confirmAndDelete() {
    try {
      await api.deleteStudent(confirmDelete.ID);
      setConfirmDelete(null);
      load();
    } catch (err) { alert(err.message); }
  }

  async function reinitialiserCompte(s) {
    if (!confirm(`Générer un nouveau mot de passe pour ${s.Nom} ${s.Prenom} ?`)) return;
    try {
      const res = await api.reinitialiserCompteEleve(s.ID);
      setCredentials({ nom: `${s.Nom} ${s.Prenom}`, ...res });
    } catch (err) { alert(err.message); }
  }

  return (
    <div>
      <header className="page-header">
        <div className="page-eyebrow">Module 1 — Élèves</div>
        <h1 className="page-title">Gestion des élèves</h1>
        <p className="page-subtitle">{students.length} élève(s) — classés par nom et prénom. Un compte d'accès (notes, examens) est créé automatiquement pour chaque élève inscrit.</p>
      </header>

      <div className="toolbar">
        <input placeholder="Rechercher un nom ou prénom…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 240 }} />
        <select value={niveauFilter} onChange={(e) => setNiveauFilter(e.target.value)}>
          <option value="">Tous niveaux</option>
          {Object.keys(NIVEAUX_CLASSES).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        {isAdmin && (
          <button className="btn btn-primary" style={{ marginLeft: "auto" }} onClick={openCreate}>
            + Ajouter un élève
          </button>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {students.length === 0 ? (
          <div className="empty-state">Aucun élève. Commencez par en ajouter un.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nom</th><th>Prénom</th><th>Niveau</th><th>Classe</th><th>Série</th><th></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.ID}>
                  <td>{s.Nom}</td>
                  <td>{s.Prenom}</td>
                  <td>{s.Niveau}</td>
                  <td>{s.Classe}</td>
                  <td>{s.Serie || "—"}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <Link to={`/eleves/${s.ID}`} className="btn btn-ghost btn-sm">Ouvrir</Link>{" "}
                    {isAdmin && (
                      <>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(s)}>Modifier</button>{" "}
                        <button className="btn btn-ghost btn-sm" onClick={() => reinitialiserCompte(s)}>Identifiants</button>{" "}
                        <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(s)}>Supprimer</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? "Modifier l'élève" : "Ajouter un élève"}</h3>
            <form onSubmit={submitForm}>
              <div className="form-grid">
                <div className="form-field">
                  <label>Nom</label>
                  <input required value={form.Nom} onChange={(e) => setForm({ ...form, Nom: e.target.value })} />
                </div>
                <div className="form-field">
                  <label>Prénom</label>
                  <input required value={form.Prenom} onChange={(e) => setForm({ ...form, Prenom: e.target.value })} />
                </div>
                <div className="form-field">
                  <label>Niveau</label>
                  <select
                    value={form.Niveau}
                    onChange={(e) => {
                      const niveau = e.target.value;
                      setForm({ ...form, Niveau: niveau, Classe: NIVEAUX_CLASSES[niveau][0] });
                    }}
                  >
                    {Object.keys(NIVEAUX_CLASSES).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Classe</label>
                  <select value={form.Classe} onChange={(e) => setForm({ ...form, Classe: e.target.value })}>
                    {NIVEAUX_CLASSES[form.Niveau].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {form.Niveau === "Lycee" && (
                  <div className="form-field">
                    <label>Série</label>
                    <select value={form.Serie} onChange={(e) => setForm({ ...form, Serie: e.target.value })}>
                      {SERIES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-field">
                  <label>Année scolaire</label>
                  <input value={form.Annee} onChange={(e) => setForm({ ...form, Annee: e.target.value })} />
                </div>
                <div className="form-field">
                  <label>Sexe (imprimé sur le bulletin)</label>
                  <select value={form.Sexe || ""} onChange={(e) => setForm({ ...form, Sexe: e.target.value })}>
                    <option value="">—</option>
                    <option value="M">Masculin</option>
                    <option value="F">Féminin</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Statut</label>
                  <select value={form.Statut || ""} onChange={(e) => setForm({ ...form, Statut: e.target.value })}>
                    <option value="">—</option>
                    <option value="N">Nouveau (N)</option>
                    <option value="R">Redoublant (R)</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">{editing ? "Enregistrer" : "Ajouter"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="modal" style={{ width: 380 }} onClick={(e) => e.stopPropagation()}>
            <h3>Confirmer la suppression</h3>
            <p>Supprimer définitivement <strong>{confirmDelete.Nom} {confirmDelete.Prenom}</strong>, ses notes, présences et son compte d'accès ? Cette action est irréversible.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Annuler</button>
              <button className="btn btn-danger" onClick={confirmAndDelete}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {credentials && (
        <div className="modal-backdrop" onClick={() => setCredentials(null)}>
          <div className="modal" style={{ width: 400 }} onClick={(e) => e.stopPropagation()}>
            <h3>Identifiants de connexion</h3>
            <p style={{ fontSize: "0.86rem", color: "var(--text-soft)" }}>
              Pour <strong>{credentials.nom}</strong> — notez ou communiquez ces identifiants dès maintenant, le mot de passe ne sera plus jamais affiché.
            </p>
            <div style={{ background: "var(--paper-alt)", borderRadius: 6, padding: 14, margin: "12px 0" }}>
              <div className="mono" style={{ marginBottom: 6 }}>Identifiant : <strong>{credentials.identifiant}</strong></div>
              <div className="mono">Mot de passe : <strong>{credentials.motDePasse}</strong></div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-primary" onClick={() => setCredentials(null)}>J'ai noté</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
