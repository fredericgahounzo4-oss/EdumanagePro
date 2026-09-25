import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { School, Search, X, UserCheck, FileText, CreditCard, Award } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { usePrefs } from "../PrefsContext";
import { useEcole } from "../EcoleContext";
import { libelleClasse } from "../lib/format";
import { NIVEAU_COLORS } from "../lib/chart";
import { PageHeader, Panel, EmptyState, Skeleton, ProgressBar, KpiCard, Avatar, classeMoyenne } from "../components/ui";

const NIVEAUX = ["Primaire", "College", "Lycee"];

function Enseignants({ liste, t, max = 3 }) {
  if (!liste.length) return <span className="muted" style={{ fontSize: "0.8rem" }}>{t("cls.noTeacher")}</span>;
  const uniques = [...new Map(liste.map((e) => [e.ID, e])).values()];
  return (
    <div className="row-flex" style={{ gap: 6 }}>
      {uniques.slice(0, max).map((e) => (
        <span key={e.ID} className="row-flex" style={{ gap: 6 }} title={liste.filter((x) => x.ID === e.ID).map((x) => x.Matiere).filter(Boolean).join(", ")}>
          <Avatar nom={e.Nom.split(" ").slice(-1)[0]} prenom={e.Nom.split(" ")[0]} small />
        </span>
      ))}
      {uniques.length > max && <span className="badge badge-neutral">+{uniques.length - max}</span>}
      <span className="muted" style={{ fontSize: "0.78rem" }}>{uniques.slice(0, 2).map((e) => e.Nom).join(", ")}{uniques.length > 2 ? "…" : ""}</span>
    </div>
  );
}

function CarteClasse({ c, t, onOpen, admin }) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="row-flex" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ fontFamily: "var(--font-display)", margin: 0, fontSize: "1.25rem" }}>{libelleClasse(c)}</h3>
          <div className="muted" style={{ fontSize: "0.8rem", marginTop: 2 }}><b className="mono">{c.Effectif}</b> {t("common.students")}</div>
        </div>
        <span className={"badge " + classeMoyenne(c.MoyenneClasse)} title={t("cls.avg")}>{c.MoyenneClasse === null ? t("cls.noGrades") : `${c.MoyenneClasse} / 20`}</span>
      </div>

      <div>
        <div className="row-flex" style={{ justifyContent: "space-between", fontSize: "0.78rem", marginBottom: 4 }}>
          <span className="muted">{t("cls.attendance")}</span><b className="mono">{c.TauxPresence === null ? "—" : `${c.TauxPresence}%`}</b>
        </div>
        <ProgressBar value={c.TauxPresence ?? 0} color={c.TauxPresence !== null && c.TauxPresence < 80 ? "var(--alert)" : undefined} />
      </div>
      <div>
        <div className="row-flex" style={{ justifyContent: "space-between", fontSize: "0.78rem", marginBottom: 4 }}>
          <span className="muted">{t("cls.success")}</span><b className="mono">{c.TauxReussite === null ? "—" : `${c.TauxReussite}%`}</b>
        </div>
        <ProgressBar value={c.TauxReussite ?? 0} color="var(--brass)" />
      </div>

      <div className="row-flex" style={{ gap: 6 }}>
        {c.Titulaire && <span className="badge badge-warn" title="Professeur titulaire : accès à toutes les matières de la classe">Titulaire : {c.Titulaire.Nom}</span>}
        {!c.Titulaire && admin && <span className="badge badge-neutral">Sans titulaire</span>}
        {c.SuisTitulaire && <span className="badge badge-success">Vous êtes titulaire</span>}
      </div>
      <Enseignants liste={c.Enseignants} t={t} />
      <button className="btn btn-ghost btn-sm" onClick={onOpen} style={{ alignSelf: "flex-start" }}>{t("cls.details")}</button>
    </div>
  );
}

function DetailClasse({ c, periode, onClose, t, admin, onChanged }) {
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState("");
  const [profs, setProfs] = useState([]);
  const [choix, setChoix] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => { if (admin) api.getTeachers().then(setProfs).catch(() => setProfs([])); }, [admin]);
  useEffect(() => { setChoix(d?.Titulaire ? String(d.Titulaire.ID) : ""); }, [d]);

  async function enregistrerTitulaire() {
    setMsg("");
    try {
      const r = await api.setTitulaire({ Niveau: c.Niveau, Classe: c.Classe, Serie: c.Serie || "", IDEnseignant: choix ? Number(choix) : null });
      setD((x) => ({ ...x, Titulaire: r.Titulaire }));
      setMsg(r.Titulaire ? `${r.Titulaire.Nom} est désormais titulaire de cette classe.` : "Titulaire retiré.");
      onChanged && onChanged();
    } catch (e) { setMsg(e.message); }
  }

  useEffect(() => {
    api.getClasseDetail({ niveau: c.Niveau, classe: c.Classe, serie: c.Serie || "", periode }).then(setD).catch((e) => setErreur(e.message));
  }, [c, periode]);

  useEffect(() => {
    const echap = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, [onClose]);

  const q = new URLSearchParams({ niveau: c.Niveau, classe: c.Classe, serie: c.Serie || "" }).toString();

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={libelleClasse(c)}>
        <div className="row-flex" style={{ justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>{libelleClasse(c)} <span className="badge badge-neutral" style={{ marginLeft: 8 }}>{t(`cls.level.${c.Niveau}`)}</span></h3>
          <button className="icon-btn" onClick={onClose} aria-label={t("common.close")}><X size={18} /></button>
        </div>

        {erreur && <p className="error-text">{erreur}</p>}
        {!d && !erreur && <Skeleton height={220} />}
        {d && (
          <>
            <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", marginBottom: 16 }}>
              <KpiCard tone="green" label={t("cls.size")} value={d.Effectif} />
              <KpiCard tone="brass" label={t("cls.avg")} value={d.MoyenneClasse === null ? "—" : d.MoyenneClasse} hint={d.Min !== null ? `${t("cls.min")} ${d.Min} · ${t("cls.max")} ${d.Max}` : ""} />
              <KpiCard tone="blue" label={t("cls.success")} value={d.TauxReussite === null ? "—" : `${d.TauxReussite}%`} />
              <KpiCard tone="green" label={t("cls.attendance")} value={d.TauxPresence === null ? "—" : `${d.TauxPresence}%`} />
            </div>

            <div className="row-flex no-print" style={{ marginBottom: 16 }}>
              <Link to={`/presences?${q}`} className="btn btn-primary btn-sm"><UserCheck size={15} aria-hidden="true" /> {t("cls.rollCall")}</Link>
              {(admin || d.SuisTitulaire) && <a className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer" href={api.bulletinsLotUrl({ niveau: c.Niveau, classe: c.Classe, serie: c.Serie || "", periode: d.Periode })}><FileText size={15} aria-hidden="true" /> {t("cls.bulletins")} (par mérite)</a>}
              {(admin || d.SuisTitulaire) && <Link to={`/conseil?${q}`} onClick={onClose} className="btn btn-ghost btn-sm"><Award size={15} aria-hidden="true" /> Conseil de classe</Link>}
              {admin && <a className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer" href={api.cartesClasseUrl({ niveau: c.Niveau, classe: c.Classe, serie: c.Serie || "" })}><CreditCard size={15} aria-hidden="true" /> {t("cls.cards")}</a>}
            </div>

            {admin && (
              <div style={{ marginBottom: 18, padding: 12, border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", background: "var(--paper-alt)" }}>
                <div className="kpi-label" style={{ marginBottom: 6 }}>Professeur titulaire</div>
                <div className="row-flex">
                  <select value={choix} onChange={(e) => setChoix(e.target.value)} aria-label="Professeur titulaire" style={{ minWidth: 220 }}>
                    <option value="">— Aucun titulaire —</option>
                    {profs.map((p) => <option key={p.ID} value={p.ID}>{p.Nom} {p.Prenom}</option>)}
                  </select>
                  <button className="btn btn-primary btn-sm" onClick={enregistrerTitulaire}>Enregistrer</button>
                </div>
                <p className="muted" style={{ fontSize: "0.78rem", margin: "8px 0 0" }}>
                  Le titulaire voit et gère toute la classe (toutes les matières, présences, résultats), remplit le conseil de classe et imprime les bulletins. Les autres enseignants ne voient que leur matière.
                </p>
                {msg && <p style={{ fontSize: "0.82rem", margin: "6px 0 0" }} role="status">{msg}</p>}
              </div>
            )}
            {!admin && d.Titulaire && <p className="muted" style={{ fontSize: "0.85rem" }}>Professeur titulaire : <b>{d.Titulaire.Nom}</b></p>}

            <div className="kpi-label" style={{ marginBottom: 6 }}>{t("cls.teachers")}</div>
            <div style={{ marginBottom: 16 }}><Enseignants liste={d.Enseignants} t={t} max={6} /></div>

            <div className="kpi-label" style={{ marginBottom: 6 }}>{t("cls.ranking")} — {d.Periode}</div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>{t("common.rank")}</th><th>{t("cls.student")}</th><th>{t("common.average")}</th><th>{t("cls.mention")}</th><th>{t("cls.absences")}</th></tr></thead>
                <tbody>
                  {d.Eleves.map((e) => (
                    <tr key={e.ID}>
                      <td className="mono">{e.Rang ?? "—"}</td>
                      <td><Link to={`/eleves/${e.ID}`} onClick={onClose} style={{ textDecoration: "none", fontWeight: 600 }}>{e.Nom}</Link> {e.Prenom}</td>
                      <td><span className={"badge " + classeMoyenne(e.Moyenne)}>{e.Moyenne === null ? "—" : e.Moyenne}</span></td>
                      <td className="muted">{e.Mention || "—"}</td>
                      <td className="mono">{e.Absences}{e.Retards > 0 ? <span className="muted"> (+{e.Retards})</span> : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Classes() {
  const { user } = useAuth();
  const { t } = usePrefs();
  const { ecole } = useEcole();
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState("");
  const [periode, setPeriode] = useState("");
  const [niveau, setNiveau] = useState("");
  const [filtre, setFiltre] = useState("");
  const [ouverte, setOuverte] = useState(null);

  useEffect(() => {
    setData(null); setErreur("");
    api.getClasses(periode ? { periode } : {}).then(setData).catch((e) => setErreur(e.message));
  }, [periode]);

  const visibles = useMemo(() => {
    const f = filtre.trim().toLowerCase();
    return (data?.classes || []).filter((c) =>
      (!niveau || c.Niveau === niveau) &&
      (!f || libelleClasse(c).toLowerCase().includes(f) || c.Enseignants.some((e) => e.Nom.toLowerCase().includes(f))));
  }, [data, niveau, filtre]);

  return (
    <div>
      <PageHeader eyebrow={t("section.etablissement")} title={t("cls.title")} subtitle={t("cls.subtitle")} />

      <div className="toolbar">
        <div style={{ position: "relative" }}>
          <Search size={15} aria-hidden="true" style={{ position: "absolute", left: 10, top: 11, color: "var(--text-soft)" }} />
          <input value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder={t("cls.search")} style={{ paddingLeft: 32 }} aria-label={t("cls.search")} />
        </div>
        <select value={niveau} onChange={(e) => setNiveau(e.target.value)} aria-label={t("common.level")}>
          <option value="">{t("stats.allLevels")}</option>
          {NIVEAUX.map((n) => <option key={n} value={n}>{t(`cls.level.${n}`)}</option>)}
        </select>
        {ecole?.periodes?.length > 0 && (
          <select value={periode || data?.periode || ""} onChange={(e) => setPeriode(e.target.value)} aria-label={t("common.period")}>
            {ecole.periodes.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
      </div>

      {erreur && <p className="error-text">{erreur}</p>}
      {!data && !erreur && <div className="grid-auto">{[0, 1, 2].map((i) => <Skeleton key={i} height={210} style={{ borderRadius: 10 }} />)}</div>}
      {data && data.classes.length === 0 && <div className="card"><EmptyState icon={School} title={t("cls.empty")} text={t("cls.emptyText")} /></div>}
      {data && data.classes.length > 0 && visibles.length === 0 && <div className="card"><EmptyState icon={Search} text={t("common.noData")} /></div>}

      {NIVEAUX.map((n) => {
        const liste = visibles.filter((c) => c.Niveau === n);
        if (!liste.length) return null;
        return (
          <div key={n}>
            <h2 className="section-title">
              <span style={{ width: 10, height: 10, borderRadius: 3, background: NIVEAU_COLORS[n], display: "inline-block" }} />
              {t(`cls.level.${n}`)} <span className="muted mono" style={{ fontSize: "0.8rem", fontWeight: 400 }}>{liste.length}</span>
            </h2>
            <div className="grid-auto">
              {liste.map((c) => <CarteClasse key={`${c.Niveau}${c.Classe}${c.Serie}`} c={c} t={t} admin={user.role === "Administrateur"} onOpen={() => setOuverte(c)} />)}
            </div>
          </div>
        );
      })}

      {ouverte && <DetailClasse c={ouverte} periode={periode || data?.periode} t={t} admin={user.role === "Administrateur"} onClose={() => setOuverte(null)} onChanged={() => api.getClasses(periode ? { periode } : {}).then(setData)} />}
    </div>
  );
}
