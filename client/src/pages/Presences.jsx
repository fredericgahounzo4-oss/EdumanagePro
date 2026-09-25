import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { UserCheck, CheckCheck, Save, AlertCircle, Users } from "lucide-react";
import { api } from "../api";
import { usePrefs } from "../PrefsContext";
import { dateLocaleISO, libelleClasse, formatDateCourte } from "../lib/format";
import { tooltipProps, axisTick, gridStroke } from "../lib/chart";
import { PageHeader, Panel, EmptyState, KpiCard, Skeleton, Avatar } from "../components/ui";

const STATUTS = [
  { id: "Présent", cls: "on-present", key: "att.present", court: "P" },
  { id: "Absent", cls: "on-absent", key: "att.absent", court: "A" },
  { id: "Retard", cls: "on-retard", key: "att.late", court: "R" },
];
const cleClasse = (c) => `${c.Niveau}|${c.Classe}|${c.Serie || ""}`;

function SelecteurClasse({ classes, valeur, onChange, t, avecTous }) {
  return (
    <select value={valeur} onChange={(e) => onChange(e.target.value)} aria-label={t("common.class")} style={{ minWidth: 200 }}>
      {avecTous ? <option value="">{t("att.filterAll")}</option> : <option value="" disabled>{t("att.pickClass")}</option>}
      {["Primaire", "College", "Lycee"].map((n) => {
        const liste = classes.filter((c) => c.Niveau === n);
        return liste.length > 0 && (
          <optgroup key={n} label={t(`cls.level.${n}`)}>
            {liste.map((c) => <option key={cleClasse(c)} value={cleClasse(c)}>{libelleClasse(c)} ({c.Effectif})</option>)}
          </optgroup>
        );
      })}
    </select>
  );
}

// ------------------------------- Appel de classe -------------------------------

function Appel({ classes, t, initial }) {
  const [cle, setCle] = useState(initial);
  const [date, setDate] = useState(dateLocaleISO());
  const [heure, setHeure] = useState("");
  const [eleves, setEleves] = useState(null);     // [{ID, Nom, Prenom, Statut}]
  const [dejaFait, setDejaFait] = useState(false);
  const [modifie, setModifie] = useState(false);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const classe = useMemo(() => classes.find((c) => cleClasse(c) === cle), [classes, cle]);

  const charger = useCallback(() => {
    if (!classe) { setEleves(null); return; }
    setEleves(null); setErreur(""); setMessage(""); setModifie(false);
    api.getAppel({ niveau: classe.Niveau, classe: classe.Classe, serie: classe.Serie || "", date })
      .then((r) => { setEleves(r.Eleves); setDejaFait(r.AppelFait); setHeure(r.Heure || ""); })
      .catch((e) => setErreur(e.message));
  }, [classe, date]);
  useEffect(charger, [charger]);

  const compte = useMemo(() => {
    const c = { Présent: 0, Absent: 0, Retard: 0, vide: 0 };
    (eleves || []).forEach((e) => { if (e.Statut) c[e.Statut] += 1; else c.vide += 1; });
    return c;
  }, [eleves]);

  function marquer(id, statut) {
    setEleves((l) => l.map((e) => (e.ID === id ? { ...e, Statut: statut } : e)));
    setModifie(true); setMessage("");
  }
  function tousPresents() {
    setEleves((l) => l.map((e) => ({ ...e, Statut: "Présent" })));
    setModifie(true); setMessage("");
  }

  async function enregistrer() {
    setEnvoi(true); setErreur(""); setMessage("");
    try {
      // Un élève non renseigné est enregistré comme présent (appel classique : on ne note que les exceptions)
      const Statuts = eleves.map((e) => ({ IDEleve: e.ID, Statut: e.Statut || "Présent" }));
      const r = await api.saveAppel({ Date: date, Heure: heure, Niveau: classe.Niveau, Classe: classe.Classe, Serie: classe.Serie || "", Statuts });
      if (r.differe) {
        setMessage(r.message);
      } else {
        setMessage(t("att.saved", { p: r.presents, a: r.absents, l: r.retards }));
        setDejaFait(true);
      }
      setEleves((l) => l.map((e) => ({ ...e, Statut: e.Statut || "Présent" })));
      setModifie(false);
    } catch (e) { setErreur(e.message); } finally { setEnvoi(false); }
  }

  if (classes.length === 0) return <div className="card"><EmptyState icon={Users} text={t("att.noClass")} /></div>;

  return (
    <div>
      <div className="toolbar no-print">
        <SelecteurClasse classes={classes} valeur={cle} onChange={setCle} t={t} />
        <input type="date" value={date} max={dateLocaleISO()} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label={t("common.date")} />
        <input type="time" value={heure} onChange={(e) => { setHeure(e.target.value); setModifie(true); }} aria-label={t("att.time")} title={t("att.time")} />
      </div>

      {!classe && <div className="card"><EmptyState icon={UserCheck} text={t("att.pickClass")} /></div>}
      {erreur && <p className="error-text">{erreur}</p>}
      {classe && !eleves && !erreur && <div className="card">{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={40} style={{ marginBottom: 8 }} />)}</div>}

      {classe && eleves && (
        <Panel title={`${libelleClasse(classe)} — ${eleves.length} ${t("common.students")}`}
          action={<button className="btn btn-ghost btn-sm" onClick={tousPresents}><CheckCheck size={15} aria-hidden="true" /> {t("att.markAllPresent")}</button>}>
          {dejaFait && !modifie && !message && (
            <div className="alert-strip info" style={{ margin: "12px 16px 0" }}><AlertCircle size={16} aria-hidden="true" /><span>{t("att.alreadyDone")}</span></div>
          )}
          {eleves.length === 0 ? <EmptyState icon={Users} text={t("att.noClass")} /> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th style={{ width: 40 }}>#</th><th>{t("cls.student")}</th><th style={{ textAlign: "right" }}>{t("common.date")}: {date}</th></tr></thead>
                <tbody>
                  {eleves.map((e, i) => (
                    <tr key={e.ID}>
                      <td className="mono muted">{i + 1}</td>
                      <td><div className="row-flex"><Avatar nom={e.Nom} prenom={e.Prenom} small /><b>{e.Nom}</b> {e.Prenom}</div></td>
                      <td style={{ textAlign: "right" }}>
                        <div className="seg" role="group" aria-label={`${e.Nom} ${e.Prenom}`}>
                          {STATUTS.map((s) => (
                            <button key={s.id} type="button" className={e.Statut === s.id ? s.cls : ""} aria-pressed={e.Statut === s.id} onClick={() => marquer(e.ID, s.id)}>
                              <span className="mono">{s.court}</span><span className="hide-sm-text"> {t(s.key)}</span>
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="card-body no-print" style={{ borderTop: "1px solid var(--line-soft)", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", position: "sticky", bottom: 0, background: "var(--surface)" }}>
            <div className="legend">
              <span><i style={{ background: "var(--success)" }} />{t("dash.present")} <b className="mono">{compte.Présent}</b></span>
              <span><i style={{ background: "var(--alert)" }} />{t("dash.absent")} <b className="mono">{compte.Absent}</b></span>
              <span><i style={{ background: "var(--brass)" }} />{t("dash.late")} <b className="mono">{compte.Retard}</b></span>
              {compte.vide > 0 && <span><i style={{ background: "var(--line)" }} />{t("att.notMarked")} <b className="mono">{compte.vide}</b></span>}
            </div>
            <span className="spacer" />
            {modifie && <span className="chip">{t("att.unsaved")}</span>}
            <button className="btn btn-primary" onClick={enregistrer} disabled={envoi || eleves.length === 0}>
              <Save size={16} aria-hidden="true" /> {envoi ? t("att.saving") : t("att.save")}
            </button>
          </div>
          {message && <div className="alert-strip info" role="status" style={{ margin: "0 16px 16px" }}><span>{message}</span></div>}
          {compte.vide > 0 && <p className="muted" style={{ fontSize: "0.78rem", margin: "0 20px 14px" }}>{t("att.pending", { n: compte.vide })}</p>}
          <p className="muted" style={{ fontSize: "0.78rem", margin: "0 20px 16px" }}>{t("att.parentsNotified")}</p>
        </Panel>
      )}
    </div>
  );
}

// -------------------------------- Historique --------------------------------

function Historique({ classes, t, locale }) {
  const [cle, setCle] = useState("");
  const [jours, setJours] = useState(30);
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    setData(null); setErreur("");
    const c = classes.find((x) => cleClasse(x) === cle);
    const params = { jours };
    if (c) Object.assign(params, { niveau: c.Niveau, classe: c.Classe, serie: c.Serie || "" });
    api.getSyntheseAppel(params).then(setData).catch((e) => setErreur(e.message));
  }, [cle, jours, classes]);

  const serie = (data?.parJour || []).map((j) => ({ ...j, label: formatDateCourte(j.date, locale) }));

  return (
    <div>
      <div className="toolbar no-print">
        <SelecteurClasse classes={classes} valeur={cle} onChange={setCle} t={t} avecTous />
        <select value={jours} onChange={(e) => setJours(Number(e.target.value))} aria-label={t("att.days", { n: "" })}>
          {[7, 30, 90].map((n) => <option key={n} value={n}>{t("att.days", { n })}</option>)}
        </select>
      </div>
      {erreur && <p className="error-text">{erreur}</p>}
      {!data && !erreur && <Skeleton height={260} />}
      {data && (
        <>
          <div className="kpi-grid">
            <KpiCard icon={UserCheck} tone="green" label={t("att.rate")} value={data.tauxPresence === null ? "—" : `${data.tauxPresence}%`} hint={t("att.days", { n: data.jours })} />
          </div>
          <div className="grid-main">
            <Panel title={t("att.tabHistory")}>
              {serie.length === 0 ? <p className="muted" style={{ padding: 40, textAlign: "center", margin: 0 }}>{t("att.noHistory")}</p> : (
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={serie}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                      <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: gridStroke }} />
                      <YAxis tick={axisTick} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                      <Tooltip {...tooltipProps} />
                      <Bar dataKey="presents" name={t("dash.present")} stackId="a" fill="var(--success)" />
                      <Bar dataKey="retards" name={t("dash.late")} stackId="a" fill="var(--brass)" />
                      <Bar dataKey="absents" name={t("dash.absent")} stackId="a" fill="var(--alert)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
            <Panel title={t("att.topAbsent")}>
              {data.topAbsents.length === 0 ? <EmptyState icon={UserCheck} text={t("stats.nothing")} /> : data.topAbsents.map((e) => (
                <div className="list-row" key={e.ID}>
                  <Avatar nom={e.Nom} prenom={e.Prenom} small />
                  <div className="grow"><div className="primary">{e.Nom} {e.Prenom}</div><div className="secondary">{e.Classe}</div></div>
                  <span className="badge badge-alert">{e.Absences} {t("att.absences")}</span>
                  {e.Retards > 0 && <span className="badge badge-warn">{e.Retards} {t("att.lates")}</span>}
                </div>
              ))}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

export default function Presences() {
  const { t, locale } = usePrefs();
  const [params] = useSearchParams();
  const [onglet, setOnglet] = useState("appel");
  const [classes, setClasses] = useState(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    api.getClasses().then((r) => setClasses(r.classes)).catch((e) => setErreur(e.message));
  }, []);

  // Lien direct depuis le tableau de bord ou la page Classes : ?niveau=&classe=&serie=
  const initial = useMemo(() => {
    const n = params.get("niveau"), c = params.get("classe");
    return n && c ? `${n}|${c}|${params.get("serie") || ""}` : "";
  }, [params]);

  return (
    <div>
      <PageHeader eyebrow={t("section.gestion")} title={t("att.title")} subtitle={t("att.subtitle")} />
      <div className="tabs no-print" role="tablist">
        {[["appel", t("att.tabRoll")], ["historique", t("att.tabHistory")]].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={onglet === id} className={"tab" + (onglet === id ? " active" : "")} onClick={() => setOnglet(id)}>{label}</button>
        ))}
      </div>
      {erreur && <p className="error-text">{erreur}</p>}
      {!classes && !erreur && <Skeleton height={200} />}
      {classes && (onglet === "appel" ? <Appel classes={classes} t={t} initial={initial} /> : <Historique classes={classes} t={t} locale={locale} />)}
    </div>
  );
}
