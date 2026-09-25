import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

const NIVEAUX_CLASSES = {
  Primaire: ["CP1", "CP2", "CE1", "CE2", "CM1", "CM2"],
  College: ["6ème", "5ème", "4ème", "3ème"],
  Lycee: ["Seconde", "Première", "Terminale"],
};
const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

const EMPTY = {
  Niveau: "Lycee", Classe: "Terminale", Serie: "", Jour: "Lundi",
  HeureDebut: "08:00", HeureFin: "10:00", Matiere: "", IDEnseignant: "", Salle: "",
};

export default function Timetable() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Administrateur";
  const [niveau, setNiveau] = useState("Lycee");
  const [classe, setClasse] = useState("Terminale");
  const [rows, setRows] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");

  function load() {
    api.getTimetable({ niveau, classe }).then(setRows).catch((e) => setError(e.message));
  }
  useEffect(load, [niveau, classe]);
  useEffect(() => { api.getTeachers().then(setTeachers); }, []);

  async function submit(e) {
    e.preventDefault();
    try {
      await api.createTimetableEntry({ ...form, Niveau: niveau, Classe: classe });
      setForm(EMPTY);
      setModalOpen(false);
      load();
    } catch (err) { alert(err.message); }
  }

  async function remove(id) {
    if (!confirm("Supprimer ce créneau ?")) return;
    await api.deleteTimetableEntry(id);
    load();
  }

  return (
    <div>
      <header className="page-header">
        <div className="page-eyebrow">Organisation</div>
        <h1 className="page-title">Emploi du temps</h1>
        <p className="page-subtitle">Créneaux hebdomadaires par classe.</p>
      </header>

      <div className="toolbar">
        <select value={niveau} onChange={(e) => { setNiveau(e.target.value); setClasse(NIVEAUX_CLASSES[e.target.value][0]); }}>
          {Object.keys(NIVEAUX_CLASSES).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={classe} onChange={(e) => setClasse(e.target.value)}>
          {NIVEAUX_CLASSES[niveau].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {isAdmin && (
          <button className="btn btn-primary" style={{ marginLeft: "auto" }} onClick={() => setModalOpen(true)}>
            + Ajouter un créneau
          </button>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <div className="empty-state">Aucun créneau pour cette classe.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Jour</th><th>Horaire</th><th>Matière</th><th>Enseignant</th><th>Salle</th>{isAdmin && <th></th>}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ID}>
                  <td>{r.Jour}</td>
                  <td className="mono">{r.HeureDebut} – {r.HeureFin}</td>
                  <td>{r.Matiere}</td>
                  <td>{r.Enseignant || "—"}</td>
                  <td>{r.Salle || "—"}</td>
                  {isAdmin && <td><button className="btn btn-danger btn-sm" onClick={() => remove(r.ID)}>×</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Ajouter un créneau — {classe}</h3>
            <form onSubmit={submit}>
              <div className="form-grid">
                <div className="form-field">
                  <label>Jour</label>
                  <select value={form.Jour} onChange={(e) => setForm({ ...form, Jour: e.target.value })}>
                    {JOURS.map((j) => <option key={j} value={j}>{j}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Matière</label>
                  <input required value={form.Matiere} onChange={(e) => setForm({ ...form, Matiere: e.target.value })} />
                </div>
                <div className="form-field">
                  <label>Heure de début</label>
                  <input type="time" required value={form.HeureDebut} onChange={(e) => setForm({ ...form, HeureDebut: e.target.value })} />
                </div>
                <div className="form-field">
                  <label>Heure de fin</label>
                  <input type="time" required value={form.HeureFin} onChange={(e) => setForm({ ...form, HeureFin: e.target.value })} />
                </div>
                <div className="form-field">
                  <label>Enseignant</label>
                  <select value={form.IDEnseignant} onChange={(e) => setForm({ ...form, IDEnseignant: e.target.value })}>
                    <option value="">—</option>
                    {teachers.map((t) => <option key={t.ID} value={t.ID}>{t.Nom} {t.Prenom}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Salle</label>
                  <input value={form.Salle} onChange={(e) => setForm({ ...form, Salle: e.target.value })} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">Ajouter</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
