import { useEffect, useState } from "react";
import { api } from "../api";

const NIVEAUX_CLASSES = {
  Primaire: ["CP1", "CP2", "CE1", "CE2", "CM1", "CM2"],
  College: ["6ème", "5ème", "4ème", "3ème"],
  Lycee: ["Seconde", "Première", "Terminale"],
};
const SERIES = ["A4", "C", "D", "S", "G1", "G2", "G3", "G4", "F1", "F2", "F3", "F4"];

const EMPTY = { Categorie: "", Nom: "", Coefficient: 2 };

export default function Matieres() {
  const [niveau, setNiveau] = useState("Lycee");
  const [classe, setClasse] = useState("Terminale");
  const [serie, setSerie] = useState("D");
  const [matieres, setMatieres] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");

  const isLycee = niveau === "Lycee";

  function load() {
    const params = { niveau, classe };
    if (isLycee) params.serie = serie;
    api.getMatieres(params).then(setMatieres).catch((e) => setError(e.message));
  }
  useEffect(load, [niveau, classe, serie]);

  async function submit(e) {
    e.preventDefault();
    try {
      await api.createMatiere({
        Niveau: niveau,
        // Pour le Lycée, la Classe est laissée vide afin de s'appliquer à Seconde,
        // Première ET Terminale de la série choisie (les matières d'une série sont
        // les mêmes sur les 3 classes du Lycée).
        Classe: isLycee ? "" : classe,
        Serie: isLycee ? serie : "",
        Categorie: form.Categorie,
        Nom: form.Nom,
        Coefficient: form.Coefficient,
      });
      setForm(EMPTY);
      load();
    } catch (err) { alert(err.message); }
  }

  async function remove(id) {
    if (!confirm("Supprimer cette matière ? Les notes déjà saisies pour cette matière ne seront pas affectées.")) return;
    await api.deleteMatiere(id);
    load();
  }

  const categories = [...new Set(matieres.map((m) => m.Categorie))];

  return (
    <div>
      <header className="page-header">
        <div className="page-eyebrow">Module 3 — Matières</div>
        <h1 className="page-title">Gestion des matières</h1>
        <p className="page-subtitle">
          Les matières s'affichent automatiquement selon le niveau, la classe et la série.
          Ajoutez ou supprimez-en ici si besoin — au Lycée, une matière ajoutée pour une série s'applique à la fois en Première et en Terminale.
        </p>
      </header>

      <div className="toolbar">
        <select value={niveau} onChange={(e) => { setNiveau(e.target.value); setClasse(NIVEAUX_CLASSES[e.target.value][0]); }}>
          {Object.keys(NIVEAUX_CLASSES).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={classe} onChange={(e) => setClasse(e.target.value)}>
          {NIVEAUX_CLASSES[niveau].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {isLycee && (
          <select value={serie} onChange={(e) => setSerie(e.target.value)}>
            {SERIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20, alignItems: "start" }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {matieres.length === 0 ? (
            <div className="empty-state">Aucune matière configurée pour cette sélection.</div>
          ) : (
            categories.map((cat) => (
              <div key={cat}>
                <div style={{ padding: "10px 16px", background: "var(--paper-alt)", fontFamily: "var(--font-mono)", fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-soft)" }}>
                  {cat}
                </div>
                <table>
                  <tbody>
                    {matieres.filter((m) => m.Categorie === cat).map((m) => (
                      <tr key={m.ID}>
                        <td>{m.Nom}</td>
                        <td className="mono" style={{ width: 80 }}>Coef {m.Coefficient}</td>
                        <td style={{ width: 40 }}>
                          <button className="btn btn-danger btn-sm" onClick={() => remove(m.ID)}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <h3 style={{ fontFamily: "var(--font-display)", marginTop: 0 }}>Ajouter une matière</h3>
          <p style={{ fontSize: "0.8rem", color: "var(--text-soft)", marginBottom: 12 }}>
            Pour : {niveau} · {classe}{isLycee ? ` · Série ${serie}` : ""}
          </p>
          <form onSubmit={submit}>
            <div className="form-field" style={{ marginBottom: 10 }}>
              <label>Catégorie</label>
              <input
                required
                list="categories-existantes"
                value={form.Categorie}
                onChange={(e) => setForm({ ...form, Categorie: e.target.value })}
                placeholder="Ex : Scientifiques, Littéraires…"
              />
              <datalist id="categories-existantes">
                {categories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="form-field" style={{ marginBottom: 10 }}>
              <label>Nom de la matière</label>
              <input required value={form.Nom} onChange={(e) => setForm({ ...form, Nom: e.target.value })} />
            </div>
            <div className="form-field" style={{ marginBottom: 16 }}>
              <label>Coefficient</label>
              <input type="number" min="1" required value={form.Coefficient} onChange={(e) => setForm({ ...form, Coefficient: e.target.value })} />
            </div>
            <button className="btn btn-primary" type="submit" style={{ width: "100%" }}>+ Ajouter la matière</button>
          </form>
        </div>
      </div>
    </div>
  );
}
