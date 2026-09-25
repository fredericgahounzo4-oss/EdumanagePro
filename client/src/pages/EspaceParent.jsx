import { useEffect, useState } from "react";
import { api } from "../api";

function fmt(n) {
  return Number(n || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export default function EspaceParent() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [actif, setActif] = useState(0);

  useEffect(() => { api.getMesEnfants().then(setData).catch((e) => setError(e.message)); }, []);

  if (error) return <p className="error-text">{error}</p>;
  if (!data) return <p className="loading">Chargement…</p>;
  if (data.enfants.length === 0) {
    return (
      <div className="card"><div className="empty-state">Aucun enfant rattaché à ce compte. Contactez l'administration de l'établissement.</div></div>
    );
  }

  const enfant = data.enfants[actif];

  return (
    <div>
      <header className="page-header">
        <div className="page-eyebrow">{data.etablissementNom} — {data.periode}</div>
        <h1 className="page-title">Suivi de mes enfants</h1>
      </header>

      {data.enfants.length > 1 && (
        <div className="toolbar">
          {data.enfants.map((e, i) => (
            <button key={e.eleve.ID} className={`btn btn-sm ${i === actif ? "btn-primary" : "btn-ghost"}`} onClick={() => setActif(i)}>
              {e.eleve.Prenom} {e.eleve.Nom}
            </button>
          ))}
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontFamily: "var(--font-display)", marginTop: 0 }}>
          {enfant.eleve.Nom} {enfant.eleve.Prenom}
        </h3>
        <p style={{ color: "var(--text-soft)", fontSize: "0.85rem", marginTop: 2 }}>
          {enfant.eleve.Classe}{enfant.eleve.Serie ? ` ${enfant.eleve.Serie}` : ""} · {enfant.eleve.Niveau}
        </p>
        <div style={{ display: "flex", gap: 28, marginTop: 14, flexWrap: "wrap" }}>
          <div>
            <div className="mono" style={{ fontSize: "1.5rem", fontWeight: 600 }}>{enfant.moyenne} / 20</div>
            <div style={{ color: "var(--text-soft)", fontSize: "0.8rem" }}>Moyenne — {enfant.mention}</div>
          </div>
          <div>
            <div className="mono" style={{ fontSize: "1.5rem", fontWeight: 600 }}>{enfant.presences.taux}%</div>
            <div style={{ color: "var(--text-soft)", fontSize: "0.8rem" }}>Présence ({enfant.presences.absences} absence(s))</div>
          </div>
          <div>
            <div className="mono" style={{ fontSize: "1.5rem", fontWeight: 600, color: enfant.ecolage.reste > 0 ? "var(--alert)" : "var(--ink)" }}>
              {fmt(enfant.ecolage.reste)}
            </div>
            <div style={{ color: "var(--text-soft)", fontSize: "0.8rem" }}>
              Reste à payer (sur {fmt(enfant.ecolage.total)})
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20, alignItems: "start" }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <h3 style={{ fontFamily: "var(--font-display)", margin: "18px 20px 10px" }}>Notes du {data.periode}</h3>
          {enfant.notes.length === 0 ? (
            <div className="empty-state">Aucune note publiée pour cette période.</div>
          ) : (
            <table>
              <thead><tr><th>Matière</th><th>Interro</th><th>Devoir</th><th>Compo</th><th>Moy.</th></tr></thead>
              <tbody>
                {enfant.notes.map((n) => (
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
          {enfant.examensAVenir.length === 0 ? (
            <p style={{ color: "var(--text-soft)", fontSize: "0.86rem" }}>Aucune évaluation planifiée.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {enfant.examensAVenir.map((ex, i) => (
                <li key={i} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ fontWeight: 600 }}>{ex.Nom}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-soft)" }}>{ex.Type} · {ex.DateDebut}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
