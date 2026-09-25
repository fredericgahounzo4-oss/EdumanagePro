import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Save, Printer, Award, CheckCheck } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useEcole } from "../EcoleContext";
import { PageHeader, Panel, EmptyState, Skeleton, classeMoyenne } from "../components/ui";

const CONDUITES = ["", "Excellente", "Très bonne", "Bonne", "Assez bonne", "Passable", "Médiocre", "Mauvaise"];
const DECISIONS = ["Admis(e) en classe supérieure", "Redouble", "Exclu(e)", "Admis(e) au BAC I", "Admis(e) au BAC II", "Admis(e) au BEPC", "Admis(e) au CEPD"];
const cleClasse = (c) => `${c.Niveau}|${c.Classe}|${c.Serie || ""}`;
const libelle = (c) => `${c.Classe}${c.Serie ? " " + c.Serie : ""}`;

export default function Conseil() {
  const { user } = useAuth();
  const { ecole } = useEcole();
  const [params] = useSearchParams();
  const [classes, setClasses] = useState(null);
  const [cle, setCle] = useState(params.get("niveau") ? `${params.get("niveau")}|${params.get("classe")}|${params.get("serie") || ""}` : "");
  const [periode, setPeriode] = useState("");
  const [data, setData] = useState(null);
  const [infos, setInfos] = useState({});
  const [modifie, setModifie] = useState(false);
  const [plus, setPlus] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [envoi, setEnvoi] = useState(false);

  // Administrateur : toutes les classes ; enseignant : uniquement celles dont il est titulaire
  useEffect(() => {
    api.getClasses().then((r) => setClasses(r.classes.filter((c) => user.role === "Administrateur" || c.SuisTitulaire))).catch((e) => setErr(e.message));
  }, [user]);
  useEffect(() => { if (classes && classes.length && !classes.some((c) => cleClasse(c) === cle)) setCle(cleClasse(classes[0])); }, [classes, cle]);
  useEffect(() => { if (ecole?.periode && !periode) setPeriode(ecole.periode); }, [ecole, periode]);

  const classe = useMemo(() => (classes || []).find((c) => cleClasse(c) === cle), [classes, cle]);

  const charger = useCallback(() => {
    if (!classe || !periode) return;
    setData(null); setErr(""); setMsg(""); setModifie(false);
    api.getConseil({ niveau: classe.Niveau, classe: classe.Classe, serie: classe.Serie || "", periode })
      .then((d) => { setData(d); setInfos(Object.fromEntries(d.Eleves.map((e) => [e.ID, { ...e.Infos }]))); })
      .catch((e) => setErr(e.message));
  }, [classe, periode]);
  useEffect(charger, [charger]);

  const maj = (id, champ, valeur) => { setInfos((x) => ({ ...x, [id]: { ...x[id], [champ]: valeur } })); setModifie(true); setMsg(""); };
  const nombre = (v) => (v === "" || v === null || v === undefined ? "" : v);

  function preremplir() {
    if (!window.confirm("Remplir les décisions VIDES d'après la moyenne (≥ 10 : « Admis(e) en classe supérieure », sinon « Redouble ») ? Vous pourrez ensuite les modifier une à une.")) return;
    setInfos((x) => {
      const y = { ...x };
      data.Eleves.forEach((e) => { if (!y[e.ID].decision && e.Moyenne !== null) y[e.ID] = { ...y[e.ID], decision: e.Moyenne >= 10 ? "Admis(e) en classe supérieure" : "Redouble" }; });
      return y;
    });
    setModifie(true);
  }

  async function enregistrer() {
    setEnvoi(true); setErr(""); setMsg("");
    try {
      const Infos = data.Eleves.map((e) => ({ IDEleve: e.ID, ...infos[e.ID] }));
      const r = await api.saveConseil({ Niveau: classe.Niveau, Classe: classe.Classe, Serie: classe.Serie || "", Periode: periode, Infos });
      setMsg(`${r.enregistres} fiche(s) enregistrée(s). Elles apparaissent sur les bulletins.`); setModifie(false);
    } catch (e) { setErr(e.message); } finally { setEnvoi(false); }
  }

  if (!classes && !err) return <Skeleton height={240} />;
  if (classes && classes.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Gestion" title="Conseil de classe" />
        <div className="card"><EmptyState icon={Award} title="Aucune classe à gérer" text="Seul le professeur titulaire d'une classe (désigné par l'administration) renseigne le conseil de classe." /></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="Gestion" title="Conseil de classe"
        subtitle="Conduite, absences, décision et observations : ces informations s'impriment sur le bulletin de chaque élève." />

      <div className="toolbar no-print">
        <select value={cle} onChange={(e) => setCle(e.target.value)} aria-label="Classe">
          {(classes || []).map((c) => <option key={cleClasse(c)} value={cleClasse(c)}>{libelle(c)}</option>)}
        </select>
        <select value={periode} onChange={(e) => setPeriode(e.target.value)} aria-label="Période">
          {(ecole?.periodes || []).map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <label className="row-flex" style={{ gap: 6, fontSize: "0.85rem" }}>
          <input type="checkbox" checked={plus} onChange={(e) => setPlus(e.target.checked)} /> Champs du bulletin trimestriel
        </label>
        <span className="spacer" />
        {classe && (
          <a className="btn btn-brass btn-sm" target="_blank" rel="noreferrer" href={api.bulletinsLotUrl({ niveau: classe.Niveau, classe: classe.Classe, serie: classe.Serie || "", periode })}>
            <Printer size={15} aria-hidden="true" /> Imprimer les bulletins (par mérite)
          </a>
        )}
      </div>

      {err && <p className="error-text">{err}</p>}
      {!data && !err && <Skeleton height={260} />}

      {data && (
        <Panel title={`${libelle(classe)} — ${data.Eleves.length} élève(s)`} subtitle={`${periode}${data.Titulaire ? " · Titulaire : " + data.Titulaire : ""}`}
          action={<button className="btn btn-ghost btn-sm" onClick={preremplir}><CheckCheck size={14} aria-hidden="true" /> Pré-remplir les décisions</button>}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rang</th><th>Élève</th><th>Moy.</th><th>Retards (h)</th><th>Absences (j)</th><th>Conduite</th><th>Décision du conseil</th><th>Observations</th>
                  {plus && <><th>Punitions</th><th>Exclusion (j)</th><th>Avertissement</th><th>Blâme</th><th>Félicit.</th><th>Encourag.</th><th>Tableau d'honneur</th></>}
                </tr>
              </thead>
              <tbody>
                {data.Eleves.map((e) => {
                  const i = infos[e.ID] || {};
                  return (
                    <tr key={e.ID}>
                      <td className="mono">{e.Rang ?? "—"}</td>
                      <td><b>{e.Nom}</b> {e.Prenom}</td>
                      <td><span className={"badge " + classeMoyenne(e.Moyenne)}>{e.Moyenne === null ? "—" : e.Moyenne}</span></td>
                      <td><input className="eval-input" type="number" min="0" value={nombre(i.retards)} onChange={(ev) => maj(e.ID, "retards", ev.target.value)} aria-label={`Retards de ${e.Nom}`} /></td>
                      <td><input className="eval-input" type="number" min="0" value={nombre(i.absences)} onChange={(ev) => maj(e.ID, "absences", ev.target.value)} aria-label={`Absences de ${e.Nom}`} /></td>
                      <td>
                        <select value={i.conduite || ""} onChange={(ev) => maj(e.ID, "conduite", ev.target.value)} aria-label={`Conduite de ${e.Nom}`}>
                          {CONDUITES.map((c) => <option key={c} value={c}>{c || "—"}</option>)}
                        </select>
                      </td>
                      <td><input list="decisions" value={i.decision || ""} onChange={(ev) => maj(e.ID, "decision", ev.target.value)} style={{ minWidth: 250 }} aria-label={`Décision pour ${e.Nom}`} /></td>
                      <td><input value={i.observations || ""} onChange={(ev) => maj(e.ID, "observations", ev.target.value)} style={{ minWidth: 200 }} aria-label={`Observations pour ${e.Nom}`} /></td>
                      {plus && (
                        <>
                          <td><input className="eval-input" type="number" min="0" value={nombre(i.punitions)} onChange={(ev) => maj(e.ID, "punitions", ev.target.value)} /></td>
                          <td><input className="eval-input" type="number" min="0" value={nombre(i.exclusion)} onChange={(ev) => maj(e.ID, "exclusion", ev.target.value)} /></td>
                          <td><select value={i.avertissement || ""} onChange={(ev) => maj(e.ID, "avertissement", ev.target.value)}><option value="">—</option><option>Travail</option><option>Discipline</option></select></td>
                          <td><select value={i.blame || ""} onChange={(ev) => maj(e.ID, "blame", ev.target.value)}><option value="">—</option><option>Travail</option><option>Discipline</option></select></td>
                          <td style={{ textAlign: "center" }}><input type="checkbox" checked={!!i.felicitations} onChange={(ev) => maj(e.ID, "felicitations", ev.target.checked)} aria-label="Félicitations" /></td>
                          <td style={{ textAlign: "center" }}><input type="checkbox" checked={!!i.encouragements} onChange={(ev) => maj(e.ID, "encouragements", ev.target.checked)} aria-label="Encouragements" /></td>
                          <td style={{ textAlign: "center" }}><input type="checkbox" checked={!!i.tableauHonneur} onChange={(ev) => maj(e.ID, "tableauHonneur", ev.target.checked)} aria-label="Tableau d'honneur" /></td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <datalist id="decisions">{DECISIONS.map((d) => <option key={d} value={d} />)}</datalist>

          <div className="card-body no-print" style={{ borderTop: "1px solid var(--line-soft)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            {modifie && <span className="chip">Modifications non enregistrées</span>}
            <span className="spacer" />
            <button className="btn btn-primary" onClick={enregistrer} disabled={envoi || !modifie}><Save size={16} aria-hidden="true" /> {envoi ? "Enregistrement…" : "Enregistrer"}</button>
          </div>
          {msg && <div className="alert-strip info" role="status" style={{ margin: "0 16px 16px" }}>{msg}</div>}
        </Panel>
      )}
    </div>
  );
}
