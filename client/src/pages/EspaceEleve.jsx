import { useEffect, useState } from "react";
import { api } from "../api";

export default function EspaceEleve() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { api.getMonEspace().then(setData).catch((e) => setError(e.message)); }, []);

  if (error) return <p className="error-text">{error}</p>;
  if (!data) return <p className="loading">Chargement…</p>;

  return (
    <div>
      <header className="page-header">
        <div className="page-eyebrow">{data.etablissementNom} — {data.periode}</div>
        <h1 className="page-title">Bonjour {data.eleve.Prenom}</h1>
        <p className="page-subtitle">{data.eleve.Classe}{data.eleve.Serie ? ` ${data.eleve.Serie}` : ""} · {data.eleve.Niveau}</p>
      </header>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Moyenne ({data.periode})</div>
          <div className="stat-value">{data.moyenne} / 20</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Mention</div>
          <div className="stat-value" style={{ fontSize: "1.3rem" }}>{data.mention}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Taux de présence</div>
          <div className="stat-value">{data.tauxPresence}%</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20, alignItems: "start" }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <h3 style={{ fontFamily: "var(--font-display)", margin: "18px 20px 10px" }}>Mes notes</h3>
          {data.notes.length === 0 ? (
            <div className="empty-state">Aucune note enregistrée pour cette période.</div>
          ) : (
            <table>
              <thead><tr><th>Matière</th><th>Interro</th><th>Devoir</th><th>Compo</th><th>Moy.</th></tr></thead>
              <tbody>
                {data.notes.map((n) => (
                  <tr key={n.Matiere}>
                    <td>{n.Matiere}</td>
                    <td className="mono">{n.Interro}</td>
                    <td className="mono">{n.Devoir}</td>
                    <td className="mono">{n.Composition}</td>
                    <td className="mono" style={{ fontWeight: 600 }}>{n.NoteGenerale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h3 style={{ fontFamily: "var(--font-display)", marginTop: 0 }}>Évaluations à venir</h3>
          {data.examensAVenir.length === 0 ? (
            <p style={{ color: "var(--text-soft)", fontSize: "0.86rem" }}>Aucune évaluation planifiée pour le moment.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {data.examensAVenir.map((ex, i) => (
                <li key={i} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ fontWeight: 600 }}>{ex.Nom}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-soft)" }}>
                    {ex.Type} · {ex.DateDebut}{ex.DateFin && ex.DateFin !== ex.DateDebut ? ` → ${ex.DateFin}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
