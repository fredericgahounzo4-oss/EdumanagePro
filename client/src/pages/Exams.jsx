import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

const NIVEAUX_CLASSES = {
  Primaire: ["CP1", "CP2", "CE1", "CE2", "CM1", "CM2"],
  College: ["6ème", "5ème", "4ème", "3ème"],
  Lycee: ["Seconde", "Première", "Terminale"],
};
const TYPES = ["Interrogation", "Devoir", "Composition", "Examen officiel"];
const STATUTS = ["Planifié", "En cours", "Terminé"];

const EMPTY = {
  Nom: "", Type: "Composition", DateDebut: "", DateFin: "",
  Niveau: "", Classe: "", Serie: "", Statut: "Planifié",
};

export default function Exams() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Administrateur";
  const [exams, setExams] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");

  function load() {
    api.getExams().then(setExams).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function submit(e) {
    e.preventDefault();
    try {
      await api.createExam(form);
      setForm(EMPTY);
      setModalOpen(false);
      load();
    } catch (err) { alert(err.message); }
  }

  async function updateStatut(exam, Statut) {
    await api.updateExam(exam.ID, { Statut });
    load();
  }

  async function remove(id) {
    if (!confirm("Supprimer cet examen ?")) return;
    await api.deleteExam(id);
    load();
  }

  const badgeClass = { "Planifié": "badge-sage", "En cours": "badge-brass", "Terminé": "badge-alert" };

  return (
    <div>
      <header className="page-header">
        <div className="page-eyebrow">Organisation</div>
        <h1 className="page-title">Gestion des examens</h1>
        <p className="page-subtitle">{exams.length} examen(s) planifié(s) ou en cours.</p>
      </header>

      {isAdmin && (
        <div className="toolbar">
          <button className="btn btn-primary" style={{ marginLeft: "auto" }} onClick={() => setModalOpen(true)}>
            + Planifier un examen
          </button>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {exams.length === 0 ? (
          <div className="empty-state">Aucun examen planifié.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Nom</th><th>Type</th><th>Dates</th><th>Concerné</th><th>Statut</th>{isAdmin && <th></th>}</tr>
            </thead>
            <tbody>
              {exams.map((ex) => (
                <tr key={ex.ID}>
                  <td>{ex.Nom}</td>
                  <td>{ex.Type}</td>
                  <td className="mono">{ex.DateDebut}{ex.DateFin && ex.DateFin !== ex.DateDebut ? ` → ${ex.DateFin}` : ""}</td>
                  <td>{[ex.Niveau, ex.Classe, ex.Serie].filter(Boolean).join(" · ") || "Tous"}</td>
                  <td>
                    {isAdmin ? (
                      <select value={ex.Statut} onChange={(e) => updateStatut(ex, e.target.value)}>
                        {STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <span className={`badge ${badgeClass[ex.Statut] || "badge-sage"}`}>{ex.Statut}</span>
                    )}
                  </td>
                  {isAdmin && <td><button className="btn btn-danger btn-sm" onClick={() => remove(ex.ID)}>×</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Planifier un examen</h3>
            <form onSubmit={submit}>
              <div className="form-grid">
                <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                  <label>Nom de l'examen</label>
                  <input required value={form.Nom} onChange={(e) => setForm({ ...form, Nom: e.target.value })} placeholder="Ex: Composition du 2ème trimestre" />
                </div>
                <div className="form-field">
                  <label>Type</label>
                  <select value={form.Type} onChange={(e) => setForm({ ...form, Type: e.target.value })}>
                    {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Niveau</label>
                  <select value={form.Niveau} onChange={(e) => setForm({ ...form, Niveau: e.target.value, Classe: "" })}>
                    <option value="">Tous niveaux</option>
                    {Object.keys(NIVEAUX_CLASSES).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Classe</label>
                  <select value={form.Classe} onChange={(e) => setForm({ ...form, Classe: e.target.value })} disabled={!form.Niveau}>
                    <option value="">Toutes classes</option>
                    {(NIVEAUX_CLASSES[form.Niveau] || []).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Date de début</label>
                  <input type="date" required value={form.DateDebut} onChange={(e) => setForm({ ...form, DateDebut: e.target.value })} />
                </div>
                <div className="form-field">
                  <label>Date de fin</label>
                  <input type="date" value={form.DateFin} onChange={(e) => setForm({ ...form, DateFin: e.target.value })} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">Planifier</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
