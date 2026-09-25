import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

const NIVEAUX_CLASSES = {
  Primaire: ["CP1", "CP2", "CE1", "CE2", "CM1", "CM2"],
  College: ["6ème", "5ème", "4ème", "3ème"],
  Lycee: ["Seconde", "Première", "Terminale"],
};
const SERIES = ["A4", "C", "D", "S", "G1", "G2", "G3", "G4", "F1", "F2", "F3", "F4"];

const EMPTY_TEACHER = { Nom: "", Prenom: "", Telephone: "", Email: "" };
const EMPTY_AFF = { Niveau: "Lycee", Classe: "Première", Serie: "D", Matiere: "" };

export default function Teachers() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Administrateur";
  const [teachers, setTeachers] = useState([]);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_TEACHER);

  // Panneau des affectations pour un enseignant donné
  const [detailTeacher, setDetailTeacher] = useState(null);
  const [affForm, setAffForm] = useState(EMPTY_AFF);

  function load() {
    api.getTeachers().then(setTeachers).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  function openCreate() { setEditing(null); setForm(EMPTY_TEACHER); setModalOpen(true); }
  function openEdit(t) { setEditing(t); setForm({ ...EMPTY_TEACHER, ...t }); setModalOpen(true); }

  async function submit(e) {
    e.preventDefault();
    try {
      if (editing) await api.updateTeacher(editing.ID, form);
      else await api.createTeacher(form);
      setModalOpen(false);
      load();
    } catch (err) { alert(err.message); }
  }

  async function remove(id) {
    if (!confirm("Supprimer cet enseignant et toutes ses affectations ?")) return;
    await api.deleteTeacher(id);
    load();
    if (detailTeacher?.ID === id) setDetailTeacher(null);
  }

  function openDetail(t) {
    setDetailTeacher(t);
    const isPrimaire = t.affectations?.[0]?.Niveau === "Primaire";
    setAffForm(EMPTY_AFF);
  }

  async function addAffectation(e) {
    e.preventDefault();
    try {
      const payload = { ...affForm };
      if (payload.Niveau !== "Lycee") payload.Serie = "";
      if (payload.Niveau === "Primaire") payload.Matiere = ""; // le prof de primaire enseigne toutes les matières
      await api.addAffectation(detailTeacher.ID, payload);
      load();
      // Rafraîchit le panneau détail avec les données à jour
      const refreshed = await api.getTeachers();
      setTeachers(refreshed);
      setDetailTeacher(refreshed.find((t) => t.ID === detailTeacher.ID));
    } catch (err) { alert(err.message); }
  }

  async function removeAffectation(affId) {
    await api.removeAffectation(affId);
    const refreshed = await api.getTeachers();
    setTeachers(refreshed);
    setDetailTeacher(refreshed.find((t) => t.ID === detailTeacher.ID));
  }

  function affLabel(a) {
    const parts = [a.Niveau, a.Classe];
    if (a.Serie) parts.push(a.Serie);
    return parts.join(" · ") + (a.Matiere ? ` — ${a.Matiere}` : " — Toutes matières");
  }

  return (
    <div>
      <header className="page-header">
        <div className="page-eyebrow">Personnel</div>
        <h1 className="page-title">Gestion des enseignants</h1>
        <p className="page-subtitle">
          {teachers.length} enseignant(s). Chaque enseignant peut être affecté à plusieurs classes/matières
          (ex : SVT en Première D, Physique-Chimie en Terminale D).
        </p>
      </header>

      {isAdmin && (
        <div className="toolbar">
          <button className="btn btn-primary" style={{ marginLeft: "auto" }} onClick={openCreate}>
            + Ajouter un enseignant
          </button>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: detailTeacher ? "1.2fr 1fr" : "1fr", gap: 20, alignItems: "start" }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {teachers.length === 0 ? (
            <div className="empty-state">Aucun enseignant enregistré.</div>
          ) : (
            <table>
              <thead>
                <tr><th>Nom</th><th>Prénom</th><th>Affectations</th><th>Contact</th><th></th></tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.ID}>
                    <td>{t.Nom}</td>
                    <td>{t.Prenom}</td>
                    <td>
                      {t.affectations.length === 0 ? (
                        <span style={{ color: "var(--text-soft)", fontSize: "0.82rem" }}>Aucune</span>
                      ) : (
                        <span className="badge badge-sage">{t.affectations.length} classe(s)/matière(s)</span>
                      )}
                      {(t.titulaireDe || []).map((c) => (
                        <span key={`${c.Classe}${c.Serie}`} className="badge badge-warn" style={{ marginLeft: 6 }} title="Professeur titulaire : accès à toutes les matières de cette classe">
                          Titulaire {c.Classe}{c.Serie ? ` ${c.Serie}` : ""}
                        </span>
                      ))}
                    </td>
                    <td className="mono" style={{ fontSize: "0.8rem" }}>{t.Telephone || t.Email || "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openDetail(t)}>Affectations</button>{" "}
                      {isAdmin && (
                        <>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(t)}>Modifier</button>{" "}
                          <button className="btn btn-danger btn-sm" onClick={() => remove(t.ID)}>Supprimer</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {detailTeacher && (
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <h3 style={{ fontFamily: "var(--font-display)", marginTop: 0 }}>
                {detailTeacher.Nom} {detailTeacher.Prenom}
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setDetailTeacher(null)}>Fermer</button>
            </div>

            {detailTeacher.affectations.length === 0 ? (
              <p style={{ color: "var(--text-soft)", fontSize: "0.88rem" }}>Aucune affectation pour le moment.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 18px" }}>
                {detailTeacher.affectations.map((a) => (
                  <li key={a.ID} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 10px", background: "var(--paper-alt)", borderRadius: 6, marginBottom: 6, fontSize: "0.86rem",
                  }}>
                    <span>{affLabel(a)}</span>
                    {isAdmin && (
                      <button className="btn btn-danger btn-sm" onClick={() => removeAffectation(a.ID)}>×</button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {isAdmin && (
              <form onSubmit={addAffectation}>
                <p style={{ fontSize: "0.8rem", color: "var(--text-soft)", marginBottom: 8 }}>
                  Ajouter une affectation (classe + matière). Laisser la matière vide pour le primaire (toutes matières).
                </p>
                <div className="form-grid">
                  <div className="form-field">
                    <label>Niveau</label>
                    <select
                      value={affForm.Niveau}
                      onChange={(e) => {
                        const niveau = e.target.value;
                        setAffForm({ ...affForm, Niveau: niveau, Classe: NIVEAUX_CLASSES[niveau][0], Serie: niveau === "Lycee" ? "D" : "" });
                      }}
                    >
                      {Object.keys(NIVEAUX_CLASSES).map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Classe</label>
                    <select value={affForm.Classe} onChange={(e) => setAffForm({ ...affForm, Classe: e.target.value })}>
                      {NIVEAUX_CLASSES[affForm.Niveau].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  {affForm.Niveau === "Lycee" && (
                    <div className="form-field">
                      <label>Série</label>
                      <select value={affForm.Serie} onChange={(e) => setAffForm({ ...affForm, Serie: e.target.value })}>
                        {SERIES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  )}
                  {affForm.Niveau !== "Primaire" && (
                    <div className="form-field">
                      <label>Matière</label>
                      <input
                        value={affForm.Matiere}
                        onChange={(e) => setAffForm({ ...affForm, Matiere: e.target.value })}
                        placeholder="Ex : SVT"
                      />
                    </div>
                  )}
                </div>
                <button className="btn btn-primary btn-sm" type="submit" style={{ marginTop: 10 }}>
                  + Ajouter l'affectation
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? "Modifier l'enseignant" : "Ajouter un enseignant"}</h3>
            <form onSubmit={submit}>
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
                  <label>Téléphone</label>
                  <input value={form.Telephone} onChange={(e) => setForm({ ...form, Telephone: e.target.value })} />
                </div>
                <div className="form-field">
                  <label>Email</label>
                  <input type="email" value={form.Email} onChange={(e) => setForm({ ...form, Email: e.target.value })} />
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
    </div>
  );
}
