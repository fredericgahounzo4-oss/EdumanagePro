import { useEffect, useMemo, useState, useCallback } from "react";
import { Save, Trash2, Info } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useEcole } from "../EcoleContext";
import { calculer, fmt, lireNote } from "../lib/notes";
import { PageHeader, Panel, EmptyState, Skeleton } from "../components/ui";

const TYPES = [
  { id: "Interro", cle: "Interros", libelle: "Interrogation" },
  { id: "Devoir", cle: "Devoirs", libelle: "Devoir" },
  { id: "Composition", cle: "Compositions", libelle: "Composition" },
];
const cleClasse = (c) => `${c.Niveau}|${c.Classe}|${c.Serie || ""}`;

export default function FeuilleNotes() {
  const { user } = useAuth();
  const { ecole } = useEcole();
  const [mes, setMes] = useState(null);
  const [cle, setCle] = useState("");
  const [matiere, setMatiere] = useState("");
  const [periode, setPeriode] = useState("");
  const [champ, setChamp] = useState("Interro");
  const [index, setIndex] = useState(1);
  const [data, setData] = useState(null);
  const [saisies, setSaisies] = useState({});
  const [professeur, setProfesseur] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => { api.getMesClassesNotes().then((r) => setMes(r.classes)).catch((e) => setErr(e.message)); }, []);
  useEffect(() => { if (ecole?.periode && !periode) setPeriode(ecole.periode); }, [ecole, periode]);

  const classe = useMemo(() => (mes || []).find((c) => cleClasse(c) === cle), [mes, cle]);
  const primaire = classe?.Niveau === "Primaire";

  // Sélection par défaut : première classe et première matière autorisées
  useEffect(() => { if (mes && mes.length && !cle) setCle(cleClasse(mes[0])); }, [mes, cle]);
  useEffect(() => { if (classe && !classe.Matieres.includes(matiere)) setMatiere(classe.Matieres[0] || ""); }, [classe, matiere]);
  useEffect(() => { if (primaire) setChamp("Interro"); }, [primaire]);

  const charger = useCallback(() => {
    if (!classe || !matiere || !periode) return Promise.resolve();
    setErr("");
    return api.getFeuilleNotes({ niveau: classe.Niveau, classe: classe.Classe, serie: classe.Serie || "", matiere, periode })
      .then((d) => { setData(d); setSaisies({}); })
      .catch((e) => { setData(null); setErr(e.message); });
  }, [classe, matiere, periode]);
  useEffect(() => { setData(null); setMsg(""); charger(); }, [charger]);
  useEffect(() => { setSaisies({}); }, [champ, index]);

  const type = TYPES.find((t) => t.id === champ);
  const nb = data ? data.nombre[champ] : 0;
  const options = Array.from({ length: Math.min(nb + 1, 20) }, (_, i) => i + 1);
  useEffect(() => { if (index > nb + 1) setIndex(1); }, [nb, index]);

  const valeurActuelle = (e) => { const l = e[type.cle]; return l[index - 1] === undefined || l[index - 1] === null ? "" : String(l[index - 1]); };
  const texteSaisi = (e) => (saisies[e.ID] !== undefined ? saisies[e.ID] : valeurActuelle(e));

  // Aperçu du calcul avec la valeur en cours de saisie
  const apercu = (e) => {
    const listes = { Interros: [...e.Interros], Devoirs: [...e.Devoirs], Compositions: [...e.Compositions] };
    const l = listes[type.cle];
    const longueur = Math.max(l.length, index, nb);
    while (l.length < longueur) l.push(null);
    const v = lireNote(texteSaisi(e));
    l[index - 1] = v === "" || Number.isNaN(v) ? (e[type.cle][index - 1] ?? null) : v;
    return calculer({ interros: listes.Interros, devoirs: listes.Devoirs, compositions: listes.Compositions, niveau: classe?.Niveau });
  };

  const invalides = data ? data.eleves.filter((e) => saisies[e.ID] !== undefined && Number.isNaN(lireNote(saisies[e.ID]))).length : 0;
  const aEnregistrer = Object.entries(saisies).filter(([, v]) => String(v).trim() !== "").length;

  async function enregistrer() {
    setEnvoi(true); setErr(""); setMsg("");
    try {
      const Valeurs = Object.entries(saisies).filter(([, v]) => String(v).trim() !== "").map(([id, v]) => ({ idEleve: Number(id), valeur: lireNote(v) }));
      const r = await api.saveFeuilleNotes({ Niveau: classe.Niveau, Classe: classe.Classe, Serie: classe.Serie || "", Matiere: matiere, Periode: periode, Champ: champ, Index: index, Professeur: professeur, Valeurs });
      if (r.differe) setMsg(r.message); else { setMsg(`${r.count} note(s) enregistrée(s) — ${type.libelle} ${index}.`); await charger(); }
    } catch (e) { setErr(e.message); } finally { setEnvoi(false); }
  }

  async function supprimer() {
    if (!window.confirm(`Supprimer « ${type.libelle} ${index} » pour toute la classe ? Les moyennes seront recalculées.`)) return;
    setEnvoi(true); setErr(""); setMsg("");
    try {
      await api.saveFeuilleNotes({ Niveau: classe.Niveau, Classe: classe.Classe, Serie: classe.Serie || "", Matiere: matiere, Periode: periode, Champ: champ, Index: index, Action: "supprimer" });
      setMsg(`${type.libelle} ${index} supprimé(e).`); setIndex(1); await charger();
    } catch (e) { setErr(e.message); } finally { setEnvoi(false); }
  }

  if (!mes && !err) return <Skeleton height={260} />;
  if (mes && mes.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Mon espace" title="Feuille de notes" />
        <div className="card"><EmptyState icon={Info} title="Aucune classe attribuée" text="L'administration doit d'abord vous affecter à une classe et à une matière." /></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="Mon espace" title="Feuille de notes" subtitle="Saisissez les notes d'une classe entière, évaluation par évaluation." />

      <div className="formule">
        <b>Comment la note est calculée :</b> moyenne des interros = somme des interros ÷ nombre d'interros · note de classe = (moyenne des interros + devoir) ÷ 2 · <b>moyenne générale = (note de classe + composition) ÷ 2</b>.
        Une interro manquée compte pour 0.
      </div>

      <div className="toolbar">
        <select value={cle} onChange={(e) => setCle(e.target.value)} aria-label="Classe">
          {(mes || []).map((c) => <option key={cleClasse(c)} value={cleClasse(c)}>{c.Classe}{c.Serie ? ` ${c.Serie}` : ""}{c.Titulaire ? " — titulaire" : ""}</option>)}
        </select>
        <select value={matiere} onChange={(e) => setMatiere(e.target.value)} aria-label="Matière">
          {(classe?.Matieres || []).map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={periode} onChange={(e) => setPeriode(e.target.value)} aria-label="Période">
          {(ecole?.periodes || []).map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {err && <p className="error-text">{err}</p>}
      {!data && !err && <Skeleton height={260} />}

      {data && (
        <Panel title={`${matiere} — ${classe.Classe}${classe.Serie ? " " + classe.Serie : ""} · coefficient ${data.matiere.Coefficient}`}
          subtitle={`${data.eleves.length} élève(s) · ${periode}`}>
          <div className="card-body" style={{ borderBottom: "1px solid var(--line-soft)", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            {!primaire && (
              <div className="seg" role="group" aria-label="Type d'évaluation">
                {TYPES.map((t) => <button key={t.id} type="button" className={champ === t.id ? "on-present" : ""} onClick={() => { setChamp(t.id); setIndex(1); }}>{t.libelle}</button>)}
              </div>
            )}
            <select value={index} onChange={(e) => setIndex(Number(e.target.value))} aria-label="Numéro de l'évaluation">
              {options.map((n) => (
                <option key={n} value={n}>
                  {primaire ? "Note" : type.libelle} {n}{n > nb ? " — nouvelle" : ""}{n > nb && champ !== "Interro" && n > 1 && !primaire ? " (exceptionnel)" : ""}
                </option>
              ))}
            </select>
            <input value={professeur} onChange={(e) => setProfesseur(e.target.value)} placeholder="Nom du professeur (optionnel)" style={{ minWidth: 200 }} aria-label="Nom du professeur" />
            <span className="spacer" />
            {index <= nb && (
              <button type="button" className="btn btn-danger btn-sm" onClick={supprimer} disabled={envoi}><Trash2 size={14} aria-hidden="true" /> Supprimer cette évaluation</button>
            )}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Élève</th>
                  <th style={{ textAlign: "center" }}>{primaire ? "Note" : type.libelle} {index} /20</th>
                  {primaire ? <th>Notes saisies</th> : <><th>Interros</th><th>Devoir</th><th>Compo</th><th>Note de classe</th></>}
                  <th>Moyenne</th>
                </tr>
              </thead>
              <tbody>
                {data.eleves.map((e) => {
                  const v = lireNote(texteSaisi(e));
                  const c = apercu(e);
                  return (
                    <tr key={e.ID}>
                      <td><b>{e.Nom}</b> {e.Prenom}</td>
                      <td style={{ textAlign: "center" }}>
                        <input className={"eval-input" + (Number.isNaN(v) ? " invalid" : "")} type="text" inputMode="decimal" value={texteSaisi(e)}
                          aria-label={`Note de ${e.Nom} ${e.Prenom}`} placeholder="—"
                          onChange={(ev) => setSaisies({ ...saisies, [e.ID]: ev.target.value })} />
                      </td>
                      {primaire ? (
                        <td><span className="chips">{e.Interros.map((x, i) => <span key={i} className={"chip-note" + (x === null ? " absent" : "")}>{x === null ? "abs" : fmt(x)}</span>)}</span></td>
                      ) : (
                        <>
                          <td><span className="chips">{e.Interros.length ? e.Interros.map((x, i) => <span key={i} className={"chip-note" + (x === null ? " absent" : "")}>{x === null ? "abs" : fmt(x)}</span>) : "—"}</span></td>
                          <td className="mono">{e.Devoirs.length ? e.Devoirs.map((x) => fmt(x)).join(" · ") : "—"}</td>
                          <td className="mono">{e.Compositions.length ? e.Compositions.map((x) => fmt(x)).join(" · ") : "—"}</td>
                          <td className="mono">{fmt(c.noteClasse)}</td>
                        </>
                      )}
                      <td><b className="mono" style={{ color: c.noteGenerale >= 10 ? "var(--success)" : "var(--alert)" }}>{fmt(c.noteGenerale)}</b></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="card-body no-print" style={{ borderTop: "1px solid var(--line-soft)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              {invalides > 0 ? <span className="error-text">{invalides} note(s) invalide(s) : entrez un nombre entre 0 et 20.</span> : aEnregistrer > 0 ? `${aEnregistrer} note(s) à enregistrer.` : "Laissez vide un élève absent : sa note comptera pour 0."}
            </span>
            <span className="spacer" />
            <button className="btn btn-primary" onClick={enregistrer} disabled={envoi || invalides > 0 || aEnregistrer === 0}>
              <Save size={16} aria-hidden="true" /> {envoi ? "Enregistrement…" : "Enregistrer les notes"}
            </button>
          </div>
          {msg && <div className="alert-strip info" role="status" style={{ margin: "0 16px 16px" }}>{msg}</div>}
        </Panel>
      )}
    </div>
  );
}
