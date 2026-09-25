import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useMesClasses } from "../lib/hooks";

const NIVEAUX_CLASSES = {
  Primaire: ["CP1", "CP2", "CE1", "CE2", "CM1", "CM2"],
  College: ["6ème", "5ème", "4ème", "3ème"],
  Lycee: ["Seconde", "Première", "Terminale"],
};
const SERIES = ["A4", "C", "D", "S", "G1", "G2", "G3", "G4", "F1", "F2", "F3", "F4"];

export default function Results() {
  const { user } = useAuth();
  const { titulaireDe } = useMesClasses(user);
  const peutImprimer = (n, c, sr) => titulaireDe(n, c, sr);
  const [settings, setSettings] = useState(null);
  const [niveau, setNiveau] = useState("");
  const [classe, setClasse] = useState("");
  const [serie, setSerie] = useState("");
  const [periode, setPeriode] = useState("");
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => { api.getSettings().then((s) => { setSettings(s); setPeriode(s.PeriodeActuelle); }); }, []);

  useEffect(() => {
    if (!periode) return;
    const params = { periode };
    if (niveau) params.niveau = niveau;
    if (classe) params.classe = classe;
    if (niveau === "Lycee" && classe && serie) params.serie = serie;
    api.getResults(params).then((data) => setRows(data.resultats)).catch((e) => setError(e.message));
  }, [niveau, classe, serie, periode]);

  if (!settings) return <p className="loading">Chargement…</p>;

  return (
    <div>
      <header className="page-header">
        <div className="page-eyebrow">Modules 5 & 6 — Résultats</div>
        <h1 className="page-title">Classement automatique</h1>
        <p className="page-subtitle">Moyennes, rang et mentions, calculés en temps réel pour la période choisie.</p>
      </header>

      <div className="toolbar">
        <select value={periode} onChange={(e) => setPeriode(e.target.value)}>
          {settings.PeriodesDisponibles.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={niveau} onChange={(e) => { setNiveau(e.target.value); setClasse(""); setSerie(""); }}>
          <option value="">Tous niveaux</option>
          {Object.keys(NIVEAUX_CLASSES).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={classe} onChange={(e) => { setClasse(e.target.value); setSerie(""); }} disabled={!niveau}>
          <option value="">Toutes classes</option>
          {(NIVEAUX_CLASSES[niveau] || []).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {niveau === "Lycee" && classe && (
          <select value={serie} onChange={(e) => setSerie(e.target.value)}>
            <option value="">Toutes séries</option>
            {SERIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      {niveau && classe && rows.length > 0 && (
        <p style={{ marginTop: -6, marginBottom: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {peutImprimer(niveau, classe, serie) && (
            <a className="btn btn-brass btn-sm" style={{ textDecoration: "none" }} target="_blank" rel="noreferrer"
              href={api.bulletinsLotUrl({ niveau, classe, serie: serie || "", periode })}>
              🖨 Bulletins de la classe{serie ? ` (série ${serie})` : ""} — par ordre de mérite
            </a>
          )}
          {user.role === "Administrateur" && (
            <a className="btn btn-ghost btn-sm" style={{ textDecoration: "none" }} target="_blank" rel="noreferrer"
              href={api.bulletinsLotUrl({ niveau, periode })}>
              🖨 Tout le niveau {niveau} (classe par classe, série par série)
            </a>
          )}
          {user.role === "Administrateur" && (
            <a className="btn btn-ghost btn-sm" style={{ textDecoration: "none" }} target="_blank" rel="noreferrer"
              href={api.bulletinsLotUrl({ periode })}>
              🖨 Toute l'école
            </a>
          )}
          {user.role === "Administrateur" && (
            <a className="btn btn-ghost btn-sm" style={{ textDecoration: "none" }} href={api.cartesClasseUrl({ niveau, classe, serie: serie || "" })} target="_blank" rel="noreferrer">
              🪪 Imprimer les cartes scolaires de la classe
            </a>
          )}
        </p>
      )}

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <div className="empty-state">Aucun élève ne correspond à ces critères.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Rang</th><th>Élève</th><th>Classe</th><th>Moyenne</th><th>Mention</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ID}>
                  <td><div className="rank-seal" style={{ width: 30, height: 30, fontSize: "0.85rem" }}>{r.rang}</div></td>
                  <td>{r.Nom} {r.Prenom}</td>
                  <td>{r.Classe}{r.Serie ? ` (${r.Serie})` : ""}</td>
                  <td className="mono">{r.moyenne} / 20</td>
                  <td><span className="badge badge-brass">{r.mention}</span></td>
                  <td><Link to={`/eleves/${r.ID}`} className="btn btn-ghost btn-sm">Ouvrir</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
