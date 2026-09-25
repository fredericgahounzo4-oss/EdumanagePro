import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useMesClasses } from "../lib/hooks";

const EMPTY_ATT = { Date: new Date().toISOString().slice(0, 10), Heure: "", Statut: "Présent" };

export default function StudentDetail() {
  const { user } = useAuth();
  const isTeacher = user?.role === "Enseignant";
  const isAdmin = user?.role === "Administrateur";
  const { titulaireDe } = useMesClasses(user);
  const { id } = useParams();
  const [student, setStudent] = useState(null);
  const [settings, setSettings] = useState(null);
  const [periode, setPeriode] = useState("");
  const [notes, setNotes] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [stats, setStats] = useState(null);
  const [matieresDisponibles, setMatieresDisponibles] = useState([]);
  const [noteForm, setNoteForm] = useState(null);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [attForm, setAttForm] = useState(EMPTY_ATT);
  const [error, setError] = useState("");

  useEffect(() => { api.getSettings().then(setSettings).catch((e) => setError(e.message)); }, []);

  function load(p) {
    api.getStudent(id, p).then(setStudent).catch((e) => setError(e.message));
    api.getNotes(id, p).then(setNotes).catch(() => setNotes([]));
    api.getAttendance(id).then(setAttendance).catch(() => setAttendance([]));
    api.getAttendanceStats(id).then(setStats).catch(() => setStats(null));
  }

  // 1) À l'ouverture la période n'est pas encore connue : on la demande d'abord au serveur (période en cours de l'école).
  // 2) Dès qu'elle est connue — ou quand on la change — on charge la fiche complète.
  // (Avant : la page attendait la période pour charger l'élève, alors que la période vient de l'élève : elle restait bloquée sur « Chargement… ».)
  useEffect(() => {
    if (!periode) {
      api.getStudent(id).then((s) => setPeriode(s.periode)).catch((e) => setError(e.message));
      return;
    }
    load(periode);
  }, [id, periode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!student) return;
    const params = { niveau: student.Niveau, classe: student.Classe };
    if (student.Serie) params.serie = student.Serie;
    api.getMatieres(params).then(setMatieresDisponibles);
  }, [student]);

  async function addNote(e) {
    e.preventDefault();
    try {
      await api.createNote({ ...noteForm, IDEleve: Number(id), Periode: periode });
      setNoteForm(null);
      load(periode);
    } catch (err) { alert(err.message); }
  }

  async function saveEditNote(n) {
    try {
      await api.updateNote(n.ID, { Interro: n.Interro, Devoir: n.Devoir, Composition: n.Composition });
      setEditingNoteId(null);
      load(periode);
    } catch (err) { alert(err.message); }
  }

  async function removeNote(noteId) { await api.deleteNote(noteId); load(periode); }

  async function addAttendance(e) {
    e.preventDefault();
    try {
      await api.createAttendance({ ...attForm, IDEleve: Number(id) });
      setAttForm(EMPTY_ATT);
      load(periode);
    } catch (err) { alert(err.message); }
  }
  async function removeAttendance(recId) { await api.deleteAttendance(recId); load(periode); }

  if (error) return <p className="error-text">{error}</p>;
  if (!student || !settings) return <p className="loading">Chargement…</p>;

  const isPrimaire = student.Niveau === "Primaire";
  const matieresNonNotees = matieresDisponibles.filter((m) => !notes.some((n) => n.Matiere === m.Nom));

  return (
    <div>
      <header className="page-header">
        <Link to="/eleves" style={{ fontSize: "0.82rem", color: "var(--text-soft)" }}>&larr; Retour à la liste</Link>
        <div className="page-eyebrow">Fiche élève</div>
        <h1 className="page-title">{student.Nom} {student.Prenom}</h1>
        <p className="page-subtitle">
          {student.Niveau} · {student.Classe}{student.Serie ? ` · Série ${student.Serie}` : ""} · Moyenne ({periode}) : <strong>{Math.round(student.moyenne * 100) / 100} / 20</strong>
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
          <select value={periode} onChange={(e) => setPeriode(e.target.value)}>
            {settings.PeriodesDisponibles.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          {(isAdmin || titulaireDe(student.Niveau, student.Classe, student.Serie)) && (
            <a href={api.bulletinUrl(id, periode)} target="_blank" rel="noreferrer" className="btn btn-brass" style={{ textDecoration: "none" }}>
              📄 Générer le bulletin PDF
            </a>
          )}
          {isAdmin && (
            <a href={api.carteEleveUrl(id)} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ textDecoration: "none" }}>
              🪪 Carte scolaire
            </a>
          )}
        </div>
      </header>

      <div className="grid-main" style={{ alignItems: "start" }}>
        {/* Notes */}
        <div className="card">
          <h3 style={{ fontFamily: "var(--font-display)", marginTop: 0 }}>Module 4 — Notes ({periode})</h3>
          {!isTeacher && (
            <p style={{ fontSize: "0.8rem", color: "var(--text-soft)", marginBottom: 12 }}>
              Les notes sont saisies par l'enseignant de la matière. Vous pouvez corriger une note existante.
            </p>
          )}
          <table>
            <thead>
              <tr>
                <th>Matière</th>
                {!isPrimaire && <><th>Interro</th><th>Devoir</th><th>Compo</th></>}
                {isPrimaire && <th>Note</th>}
                <th>Moy.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {notes.map((n) => {
                const editing = editingNoteId === n.ID;
                return (
                  <tr key={n.ID}>
                    <td>{n.Matiere}</td>
                    {!isPrimaire ? (
                      <>
                        <td>{editing ? <input type="number" step="0.25" style={{ width: 60 }} defaultValue={n.Interro} onChange={(e) => (n._Interro = e.target.value)} /> : n.Interro}</td>
                        <td>{editing ? <input type="number" step="0.25" style={{ width: 60 }} defaultValue={n.Devoir} onChange={(e) => (n._Devoir = e.target.value)} /> : n.Devoir}</td>
                        <td>{editing ? <input type="number" step="0.25" style={{ width: 60 }} defaultValue={n.Composition} onChange={(e) => (n._Composition = e.target.value)} /> : n.Composition}</td>
                      </>
                    ) : (
                      <td>{editing ? <input type="number" step="0.25" style={{ width: 60 }} defaultValue={n.Interro} onChange={(e) => (n._Interro = n._Devoir = e.target.value)} /> : n.Interro}</td>
                    )}
                    <td className="mono">{n.NoteGenerale}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {editing ? (
                        <button className="btn btn-primary btn-sm" onClick={() => saveEditNote({ ...n, Interro: n._Interro ?? n.Interro, Devoir: n._Devoir ?? n.Devoir, Composition: n._Composition ?? n.Composition })}>✓</button>
                      ) : (
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingNoteId(n.ID)}>✎</button>
                      )}
                      {" "}
                      <button className="btn btn-danger btn-sm" onClick={() => removeNote(n.ID)}>×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {isTeacher && (
            <div style={{ marginTop: 16 }}>
              {noteForm ? (
                <form onSubmit={addNote} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
                  <div className="form-field" style={{ flex: "1 1 140px" }}>
                    <label>Matière</label>
                    <select required value={noteForm.Matiere} onChange={(e) => setNoteForm({ ...noteForm, Matiere: e.target.value })}>
                      <option value="">— Choisir —</option>
                      {matieresNonNotees.map((m) => <option key={m.ID} value={m.Nom}>{m.Nom}</option>)}
                    </select>
                  </div>
                  {!isPrimaire ? (
                    <>
                      <div className="form-field" style={{ width: 70 }}><label>Interro</label>
                        <input type="number" step="0.25" value={noteForm.Interro} onChange={(e) => setNoteForm({ ...noteForm, Interro: e.target.value })} /></div>
                      <div className="form-field" style={{ width: 70 }}><label>Devoir</label>
                        <input type="number" step="0.25" value={noteForm.Devoir} onChange={(e) => setNoteForm({ ...noteForm, Devoir: e.target.value })} /></div>
                      <div className="form-field" style={{ width: 70 }}><label>Compo</label>
                        <input type="number" step="0.25" value={noteForm.Composition} onChange={(e) => setNoteForm({ ...noteForm, Composition: e.target.value })} /></div>
                    </>
                  ) : (
                    <div className="form-field" style={{ width: 80 }}><label>Note /20</label>
                      <input type="number" step="0.25" value={noteForm.Interro} onChange={(e) => setNoteForm({ ...noteForm, Interro: e.target.value, Devoir: e.target.value })} /></div>
                  )}
                  <div className="form-field" style={{ flex: "1 1 120px" }}>
                    <label>Professeur</label>
                    <input value={noteForm.Professeur} onChange={(e) => setNoteForm({ ...noteForm, Professeur: e.target.value })} />
                  </div>
                  <button className="btn btn-primary btn-sm" type="submit">Ajouter</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNoteForm(null)}>Annuler</button>
                </form>
              ) : (
                matieresNonNotees.length > 0 && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setNoteForm({ Matiere: "", Interro: "", Devoir: "", Composition: "", Coefficient: 1, Professeur: "" })}>
                    + Ajouter une note
                  </button>
                )
              )}
            </div>
          )}
        </div>

        {/* Présences */}
        <div className="card">
          <h3 style={{ fontFamily: "var(--font-display)", marginTop: 0 }}>Module 7 — Présences</h3>
          {stats && (
            <div style={{ display: "flex", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
              <span className="badge badge-sage">{stats.presences} présences</span>
              <span className="badge badge-alert">{stats.absences} absences</span>
              <span className="badge badge-brass">{stats.tauxPresence}% de présence</span>
            </div>
          )}
          <form onSubmit={addAttendance} style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <input type="date" value={attForm.Date} onChange={(e) => setAttForm({ ...attForm, Date: e.target.value })} />
            <select value={attForm.Statut} onChange={(e) => setAttForm({ ...attForm, Statut: e.target.value })}>
              <option>Présent</option><option>Absent</option><option>Retard</option>
            </select>
            <button className="btn btn-primary btn-sm" type="submit">Enregistrer</button>
          </form>
          <table>
            <tbody>
              {attendance.slice(0, 8).map((a) => (
                <tr key={a.ID}>
                  <td className="mono">{a.Date}</td>
                  <td><span className={`badge ${a.Statut === "Absent" ? "badge-alert" : a.Statut === "Retard" ? "badge-brass" : "badge-sage"}`}>{a.Statut}</span></td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => removeAttendance(a.ID)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
