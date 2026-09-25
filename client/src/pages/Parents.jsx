import { useEffect, useState } from "react";
import { api } from "../api";

export default function Parents() {
  const [parents, setParents] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ Nom: "", Telephone: "", IDEleves: [], Lien: "Parent" });
  const [credentials, setCredentials] = useState(null);
  const [error, setError] = useState("");
  const [recherche, setRecherche] = useState("");

  function load() {
    api.getParents().then(setParents).catch((e) => setError(e.message));
    api.getStudents().then(setEleves).catch(() => {});
  }
  useEffect(load, []);

  function toggleEleve(id) {
    setForm((f) => ({
      ...f,
      IDEleves: f.IDEleves.includes(id) ? f.IDEleves.filter((x) => x !== id) : [...f.IDEleves, id],
    }));
  }

  async function submit(e) {
    e.preventDefault();
    if (form.IDEleves.length === 0) return alert("Sélectionnez au moins un enfant.");
    try {
      const res = await api.createParent(form);
      setCredentials({ nom: form.Nom, ...res.compte });
      setForm({ Nom: "", Telephone: "", IDEleves: [], Lien: "Parent" });
      setModalOpen(false);
      load();
    } catch (err) { alert(err.message); }
  }

  async function reinitialiser(p) {
    if (!confirm(`Générer un nouveau mot de passe pour ${p.Nom} ?`)) return;
    const res = await api.reinitialiserParent(p.ID);
    setCredentials({ nom: p.Nom, ...res });
  }

  async function supprimer(p) {
    if (!confirm(`Supprimer le compte parent de ${p.Nom} ?`)) return;
    await api.deleteParent(p.ID);
    load();
  }

  const elevesFiltres = recherche
    ? eleves.filter((e) => `${e.Nom} ${e.Prenom}`.toLowerCase().includes(recherche.toLowerCase()))
    : eleves;

  return (
    <div>
      <header className="page-header">
        <div className="page-eyebrow">Suivi familial</div>
        <h1 className="page-title">Comptes parents</h1>
        <p className="page-subtitle">
          {parents.length} parent(s). Chaque parent suit les notes, absences et l'écolage de ses enfants,
          et peut échanger des messages avec l'établissement.
        </p>
      </header>

      <div className="toolbar">
        <button className="btn btn-primary" style={{ marginLeft: "auto" }} onClick={() => setModalOpen(true)}>
          + Ajouter un parent
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {parents.length === 0 ? (
          <div className="empty-state">Aucun compte parent pour le moment.</div>
        ) : (
          <table>
            <thead><tr><th>Nom</th><th>Identifiant</th><th>Enfant(s) suivi(s)</th><th></th></tr></thead>
            <tbody>
              {parents.map((p) => (
                <tr key={p.ID}>
                  <td>{p.Nom}</td>
                  <td className="mono">{p.Identifiant}</td>
                  <td style={{ fontSize: "0.84rem" }}>
                    {p.enfants.map((e) => `${e.Nom} ${e.Prenom} (${e.Classe})`).join(", ") || "—"}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => reinitialiser(p)}>Identifiants</button>{" "}
                    <button className="btn btn-danger btn-sm" onClick={() => supprimer(p)}>Supprimer</button>
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
            <h3>Ajouter un compte parent</h3>
            <form onSubmit={submit}>
              <div className="form-grid" style={{ marginBottom: 12 }}>
                <div className="form-field">
                  <label>Nom complet du parent</label>
                  <input required value={form.Nom} onChange={(e) => setForm({ ...form, Nom: e.target.value })} />
                </div>
                <div className="form-field">
                  <label>Lien de parenté</label>
                  <select value={form.Lien} onChange={(e) => setForm({ ...form, Lien: e.target.value })}>
                    <option>Parent</option><option>Père</option><option>Mère</option><option>Tuteur</option>
                  </select>
                </div>
              </div>
              <div className="form-field" style={{ marginBottom: 12 }}>
                <label>Téléphone (facultatif)</label>
                <input value={form.Telephone} onChange={(e) => setForm({ ...form, Telephone: e.target.value })} />
              </div>

              <div className="form-field" style={{ marginBottom: 8 }}>
                <label>Enfant(s) à rattacher — {form.IDEleves.length} sélectionné(s)</label>
                <input placeholder="Rechercher un élève…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
              </div>
              <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 6, padding: 8, marginBottom: 16 }}>
                {elevesFiltres.map((e) => (
                  <label key={e.ID} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 2px", fontSize: "0.86rem", fontWeight: 400 }}>
                    <input type="checkbox" checked={form.IDEleves.includes(e.ID)} onChange={() => toggleEleve(e.ID)} />
                    {e.Nom} {e.Prenom} — {e.Classe}{e.Serie ? ` ${e.Serie}` : ""}
                  </label>
                ))}
                {elevesFiltres.length === 0 && <p style={{ color: "var(--text-soft)", fontSize: "0.84rem" }}>Aucun élève trouvé.</p>}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">Créer le compte</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {credentials && (
        <div className="modal-backdrop" onClick={() => setCredentials(null)}>
          <div className="modal" style={{ width: 400 }} onClick={(e) => e.stopPropagation()}>
            <h3>Identifiants du parent</h3>
            <p style={{ fontSize: "0.86rem", color: "var(--text-soft)" }}>
              Pour <strong>{credentials.nom}</strong> — communiquez-les maintenant, le mot de passe ne sera plus affiché.
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
