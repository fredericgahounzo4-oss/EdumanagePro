import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

const NIVEAUX_CLASSES = {
  Primaire: ["CP1", "CP2", "CE1", "CE2", "CM1", "CM2"],
  College: ["6ème", "5ème", "4ème", "3ème"],
  Lycee: ["Seconde", "Première", "Terminale"],
};

function fmt(n) {
  return Number(n || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export default function Ecolage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Administrateur";
  const [onglet, setOnglet] = useState("encaissement");
  const [situations, setSituations] = useState([]);
  const [synthese, setSynthese] = useState(null);
  const [baremes, setBaremes] = useState([]);
  const [devise, setDevise] = useState("FCFA");
  const [filtres, setFiltres] = useState({ niveau: "", classe: "", statut: "" });
  const [selection, setSelection] = useState(null);
  const [detail, setDetail] = useState(null);
  const [montant, setMontant] = useState("");
  const [mode, setMode] = useState("Espèces");
  const [motif, setMotif] = useState("Écolage");
  const [dernierRecu, setDernierRecu] = useState(null);
  const [baremeForm, setBaremeForm] = useState({ Niveau: "Lycee", Classe: "", Serie: "", MontantTotal: "" });
  const [error, setError] = useState("");

  function load() {
    const p = {};
    if (filtres.niveau) p.niveau = filtres.niveau;
    if (filtres.classe) p.classe = filtres.classe;
    if (filtres.statut) p.statut = filtres.statut;
    api.getSituations(p).then(setSituations).catch((e) => setError(e.message));
    api.getSyntheseEcolage().then(setSynthese).catch(() => {});
  }
  useEffect(load, [filtres]);
  useEffect(() => {
    api.getBaremes().then(setBaremes).catch(() => {});
    api.getSettings().then((s) => setDevise(s.Devise || "FCFA")).catch(() => {});
  }, []);

  async function ouvrirEleve(s) {
    setSelection(s);
    setDernierRecu(null);
    setMontant("");
    const d = await api.getSituationEleve(s.ID);
    setDetail(d);
  }

  async function encaisser(e) {
    e.preventDefault();
    if (!montant || Number(montant) <= 0) return;
    try {
      const res = await api.createPaiement({ IDEleve: selection.ID, Montant: Number(montant), Mode: mode, Motif: motif });
      setDernierRecu(res);
      setMontant("");
      const d = await api.getSituationEleve(selection.ID);
      setDetail(d);
      load();
    } catch (err) { alert(err.message); }
  }

  async function ajouterBareme(e) {
    e.preventDefault();
    try {
      await api.createBareme({ ...baremeForm, MontantTotal: Number(baremeForm.MontantTotal) });
      setBaremeForm({ Niveau: "Lycee", Classe: "", Serie: "", MontantTotal: "" });
      api.getBaremes().then(setBaremes);
      load();
    } catch (err) { alert(err.message); }
  }

  async function supprimerBareme(id) {
    if (!confirm("Supprimer ce barème ?")) return;
    await api.deleteBareme(id);
    api.getBaremes().then(setBaremes);
    load();
  }

  return (
    <div>
      <header className="page-header">
        <div className="page-eyebrow">Caisse — Frais de scolarité</div>
        <h1 className="page-title">Écolage</h1>
        <p className="page-subtitle">Encaissements, reçus imprimables et suivi des impayés.</p>
      </header>

      {synthese && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">Total attendu</div>
            <div className="stat-value" style={{ fontSize: "1.4rem" }}>{fmt(synthese.totalAttendu)} {devise}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Encaissé</div>
            <div className="stat-value" style={{ fontSize: "1.4rem" }}>{fmt(synthese.totalPaye)} {devise}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Reste à recouvrer</div>
            <div className="stat-value" style={{ fontSize: "1.4rem" }}>{fmt(synthese.reste)} {devise}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Taux de recouvrement</div>
            <div className="stat-value">{synthese.tauxRecouvrement}%</div>
          </div>
        </div>
      )}

      <div className="toolbar">
        <button className={`btn btn-sm ${onglet === "encaissement" ? "btn-primary" : "btn-ghost"}`} onClick={() => setOnglet("encaissement")}>Encaissements</button>
        {isAdmin && (
          <button className={`btn btn-sm ${onglet === "baremes" ? "btn-primary" : "btn-ghost"}`} onClick={() => setOnglet("baremes")}>Barèmes d'écolage</button>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      {onglet === "baremes" && isAdmin && (
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20, alignItems: "start" }}>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {baremes.length === 0 ? (
              <div className="empty-state">Aucun barème défini. L'écolage des élèves restera à 0 tant qu'aucun barème n'existe.</div>
            ) : (
              <table>
                <thead><tr><th>Niveau</th><th>Classe</th><th>Série</th><th>Montant</th><th></th></tr></thead>
                <tbody>
                  {baremes.map((b) => (
                    <tr key={b.ID}>
                      <td>{b.Niveau}</td>
                      <td>{b.Classe || <span style={{ color: "var(--text-soft)" }}>toutes</span>}</td>
                      <td>{b.Serie || <span style={{ color: "var(--text-soft)" }}>toutes</span>}</td>
                      <td className="mono">{fmt(b.MontantTotal)} {devise}</td>
                      <td><button className="btn btn-danger btn-sm" onClick={() => supprimerBareme(b.ID)}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="card">
            <h3 style={{ fontFamily: "var(--font-display)", marginTop: 0 }}>Ajouter un barème</h3>
            <p style={{ fontSize: "0.78rem", color: "var(--text-soft)", marginBottom: 12 }}>
              Laissez classe et série vides pour appliquer à tout le niveau. La règle la plus précise s'applique à l'élève.
            </p>
            <form onSubmit={ajouterBareme}>
              <div className="form-field" style={{ marginBottom: 10 }}>
                <label>Niveau</label>
                <select value={baremeForm.Niveau} onChange={(e) => setBaremeForm({ ...baremeForm, Niveau: e.target.value, Classe: "" })}>
                  {Object.keys(NIVEAUX_CLASSES).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="form-field" style={{ marginBottom: 10 }}>
                <label>Classe (facultatif)</label>
                <select value={baremeForm.Classe} onChange={(e) => setBaremeForm({ ...baremeForm, Classe: e.target.value })}>
                  <option value="">Toutes les classes</option>
                  {NIVEAUX_CLASSES[baremeForm.Niveau].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {baremeForm.Niveau === "Lycee" && (
                <div className="form-field" style={{ marginBottom: 10 }}>
                  <label>Série (facultatif)</label>
                  <input value={baremeForm.Serie} onChange={(e) => setBaremeForm({ ...baremeForm, Serie: e.target.value })} placeholder="Ex : D" />
                </div>
              )}
              <div className="form-field" style={{ marginBottom: 16 }}>
                <label>Montant total ({devise})</label>
                <input type="number" required min="0" value={baremeForm.MontantTotal} onChange={(e) => setBaremeForm({ ...baremeForm, MontantTotal: e.target.value })} />
              </div>
              <button className="btn btn-primary" type="submit" style={{ width: "100%" }}>Ajouter</button>
            </form>
          </div>
        </div>
      )}

      {onglet === "encaissement" && (
        <>
          <div className="toolbar">
            <select value={filtres.niveau} onChange={(e) => setFiltres({ ...filtres, niveau: e.target.value, classe: "" })}>
              <option value="">Tous niveaux</option>
              {Object.keys(NIVEAUX_CLASSES).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <select value={filtres.classe} onChange={(e) => setFiltres({ ...filtres, classe: e.target.value })} disabled={!filtres.niveau}>
              <option value="">Toutes classes</option>
              {(NIVEAUX_CLASSES[filtres.niveau] || []).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filtres.statut} onChange={(e) => setFiltres({ ...filtres, statut: e.target.value })}>
              <option value="">Tous</option>
              <option value="retard">Impayés seulement</option>
              <option value="solde">Soldés seulement</option>
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: selection ? "1.3fr 1fr" : "1fr", gap: 20, alignItems: "start" }}>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {situations.length === 0 ? (
                <div className="empty-state">Aucun élève pour ces critères.</div>
              ) : (
                <table>
                  <thead><tr><th>Élève</th><th>Classe</th><th>Total</th><th>Payé</th><th>Reste</th><th></th></tr></thead>
                  <tbody>
                    {situations.map((s) => (
                      <tr key={s.ID}>
                        <td>{s.Nom} {s.Prenom}</td>
                        <td>{s.Classe}{s.Serie ? ` ${s.Serie}` : ""}</td>
                        <td className="mono">{fmt(s.total)}</td>
                        <td className="mono">{fmt(s.paye)}</td>
                        <td>
                          {s.solde
                            ? <span className="badge badge-sage">Soldé</span>
                            : <span className="badge badge-alert">{fmt(s.reste)}</span>}
                        </td>
                        <td><button className="btn btn-ghost btn-sm" onClick={() => ouvrirEleve(s)}>Encaisser</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {selection && detail && (
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <h3 style={{ fontFamily: "var(--font-display)", marginTop: 0 }}>{detail.eleve.Nom} {detail.eleve.Prenom}</h3>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setSelection(null); setDetail(null); }}>Fermer</button>
                </div>
                <div style={{ display: "flex", gap: 16, margin: "8px 0 16px", flexWrap: "wrap" }}>
                  <span className="badge badge-brass">Total {fmt(detail.total)}</span>
                  <span className="badge badge-sage">Payé {fmt(detail.paye)}</span>
                  <span className="badge badge-alert">Reste {fmt(detail.reste)}</span>
                </div>

                <form onSubmit={encaisser} style={{ marginBottom: 16 }}>
                  <div className="form-field" style={{ marginBottom: 8 }}>
                    <label>Montant versé ({devise})</label>
                    <input type="number" min="1" required value={montant} onChange={(e) => setMontant(e.target.value)} />
                  </div>
                  <div className="form-grid" style={{ marginBottom: 12 }}>
                    <div className="form-field">
                      <label>Mode</label>
                      <select value={mode} onChange={(e) => setMode(e.target.value)}>
                        <option>Espèces</option><option>Mobile Money</option><option>Virement</option><option>Chèque</option>
                      </select>
                    </div>
                    <div className="form-field">
                      <label>Motif</label>
                      <input value={motif} onChange={(e) => setMotif(e.target.value)} />
                    </div>
                  </div>
                  <button className="btn btn-primary" type="submit" style={{ width: "100%" }}>Enregistrer le paiement</button>
                </form>

                {dernierRecu && (
                  <div style={{ background: "var(--paper-alt)", borderRadius: 6, padding: 12, marginBottom: 14 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Paiement enregistré — reçu {dernierRecu.NumeroRecu}</div>
                    <a className="btn btn-brass btn-sm" href={api.recuUrl(dernierRecu.ID)} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                      🖨 Imprimer le reçu
                    </a>
                  </div>
                )}

                <h4 style={{ fontSize: "0.85rem", marginBottom: 6 }}>Historique</h4>
                {detail.paiements.length === 0 ? (
                  <p style={{ color: "var(--text-soft)", fontSize: "0.84rem" }}>Aucun paiement enregistré.</p>
                ) : (
                  <table>
                    <tbody>
                      {detail.paiements.map((p) => (
                        <tr key={p.ID}>
                          <td className="mono" style={{ fontSize: "0.78rem" }}>{new Date(p.DatePaiement).toLocaleDateString("fr-FR")}</td>
                          <td className="mono">{fmt(p.Montant)}</td>
                          <td style={{ fontSize: "0.78rem" }}>{p.NumeroRecu}</td>
                          <td>
                            <a className="btn btn-ghost btn-sm" href={api.recuUrl(p.ID)} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>🖨</a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
