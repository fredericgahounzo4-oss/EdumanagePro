import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  Users, GraduationCap, School, UserCheck, Wallet, AlertCircle, CalendarDays, UserX, ChevronRight, ClipboardList, FileText, Clock,
} from "lucide-react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { usePrefs } from "../PrefsContext";
import { useEcole } from "../EcoleContext";
import { useChargement } from "../lib/hooks";
import { tooltipProps, axisTick, gridStroke, NIVEAU_COLORS, MENTION_COLORS } from "../lib/chart";
import { dateLocaleISO, jourFrancais, formatDateLongue, formatArgent, formatArgentCompact, formatDateCourte, enMinutes, libelleClasse } from "../lib/format";
import { PageHeader, KpiCard, KpiSkeletons, Panel, EmptyState, EtatChargement, ProgressBar, Avatar } from "../components/ui";

const NIVEAU_KEYS = { Primaire: "cls.level.Primaire", College: "cls.level.College", Lycee: "cls.level.Lycee" };
const majuscule = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ------------------------------- Blocs communs -------------------------------

function ChartVide({ text }) {
  return <p className="muted" style={{ margin: 0, padding: "40px 20px", textAlign: "center", fontSize: "0.9rem" }}>{text}</p>;
}

function GraphEffectifs({ perf, t }) {
  const data = perf.data && Object.entries(perf.data.repartitionParNiveau)
    .map(([niveau, value]) => ({ name: t(NIVEAU_KEYS[niveau]), value, niveau })).filter((d) => d.value > 0);
  return (
    <Panel title={t("dash.workload")}>
      {!perf.data ? <EtatChargement erreur={perf.erreur} onRetry={perf.recharger} t={t} />
        : data.length === 0 ? <ChartVide text={t("dash.noStudents")} />
          : (
            <div className="card-body">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={82} paddingAngle={2} stroke="var(--surface)">
                    {data.map((d) => <Cell key={d.niveau} fill={NIVEAU_COLORS[d.niveau] || "var(--brass)"} />)}
                  </Pie>
                  <Tooltip {...tooltipProps} />
                </PieChart>
              </ResponsiveContainer>
              <div className="legend" style={{ justifyContent: "center" }}>
                {data.map((d) => <span key={d.niveau}><i style={{ background: NIVEAU_COLORS[d.niveau] }} />{d.name} · <b className="mono">{d.value}</b></span>)}
              </div>
            </div>
          )}
    </Panel>
  );
}

function GraphMoyennes({ perf, t }) {
  return (
    <Panel title={t("dash.avgByClass")} subtitle={perf.data?.periode}>
      {!perf.data ? <EtatChargement erreur={perf.erreur} onRetry={perf.recharger} t={t} />
        : perf.data.moyennesParClasse.length === 0 ? <ChartVide text={t("stats.noNotes")} />
          : (
            <div className="card-body">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={perf.data.moyennesParClasse}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="classe" tick={axisTick} tickLine={false} axisLine={{ stroke: gridStroke }} />
                  <YAxis domain={[0, 20]} tick={axisTick} tickLine={false} axisLine={false} width={28} />
                  <Tooltip {...tooltipProps} />
                  <Bar dataKey="moyenne" fill="var(--primary)" radius={[5, 5, 0, 0]} maxBarSize={38} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
    </Panel>
  );
}

function GraphMentions({ perf, t }) {
  const data = perf.data?.repartitionMentions || [];
  return (
    <Panel title={t("dash.mentions")}>
      {!perf.data ? <EtatChargement erreur={perf.erreur} onRetry={perf.recharger} t={t} />
        : data.length === 0 ? <ChartVide text={t("stats.noNotes")} />
          : (
            <div className="card-body">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={data} dataKey="count" nameKey="mention" cx="50%" cy="50%" outerRadius={80} stroke="var(--surface)">
                    {data.map((e, i) => <Cell key={e.mention} fill={MENTION_COLORS[i % MENTION_COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...tooltipProps} />
                </PieChart>
              </ResponsiveContainer>
              <div className="legend" style={{ justifyContent: "center" }}>
                {data.map((e, i) => <span key={e.mention}><i style={{ background: MENTION_COLORS[i % MENTION_COLORS.length] }} />{e.mention} · <b className="mono">{e.count}</b></span>)}
              </div>
            </div>
          )}
    </Panel>
  );
}

function ListeExamens({ examens, t, locale }) {
  return (
    <Panel title={t("dash.upcomingExams")} action={<Link to="/examens" className="btn btn-ghost btn-sm">{t("common.viewAll")}</Link>}>
      {examens.length === 0
        ? <EmptyState icon={ClipboardList} text={t("dash.noExams")} />
        : examens.map((e) => {
          const d = new Date(e.DateDebut);
          const cible = [e.Niveau && t(NIVEAU_KEYS[e.Niveau] || "") , e.Classe, e.Serie].filter(Boolean).join(" ");
          return (
            <div className="list-row" key={e.ID}>
              <div className="date-tile"><b>{d.getDate()}</b><span>{d.toLocaleDateString(locale, { month: "short" })}</span></div>
              <div className="grow">
                <div className="primary">{e.Nom}</div>
                <div className="secondary">{e.Type}{cible ? ` · ${cible}` : ""}</div>
              </div>
              <span className="badge badge-neutral">{e.Statut}</span>
            </div>
          );
        })}
    </Panel>
  );
}

// Analyse pédagogique par niveau : logique d'origine de SchoolManagePro, conservée
function NiveauCard({ niveau, data, t }) {
  const [ouvert, setOuvert] = useState(false);
  const classes = Object.entries(data.parClasse);
  return (
    <div className="card">
      <div className="row-flex" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ fontFamily: "var(--font-display)", margin: 0 }}>
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: NIVEAU_COLORS[niveau], marginRight: 8 }} />
            {t(NIVEAU_KEYS[niveau])}
          </h3>
          <p className="muted" style={{ fontSize: "0.82rem", margin: "4px 0 0" }}>{data.totalEleves} {t("common.students")}</p>
        </div>
        {classes.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert}>
            {ouvert ? t("dash.hideDetail") : t("dash.seeByClass")}
          </button>
        )}
      </div>
      <div className="row-flex" style={{ gap: 26, marginTop: 16, alignItems: "flex-start" }}>
        <div>
          <div className="mono" style={{ fontSize: "1.4rem", fontWeight: 600 }}>{data.moyenneNiveau} / 20</div>
          <div className="muted" style={{ fontSize: "0.8rem" }}>{t("common.average")}</div>
        </div>
        <div>
          <div className="mono" style={{ fontSize: "1.4rem", fontWeight: 600 }}>{data.tauxReussite}%</div>
          <div className="muted" style={{ fontSize: "0.8rem" }}>{t("dash.successRate")}</div>
        </div>
        <div>
          <div style={{ fontSize: "1rem", fontWeight: 600 }}>{data.eleveMajor ? `${data.eleveMajor.nom} ${data.eleveMajor.prenom}` : "—"}</div>
          <div className="muted" style={{ fontSize: "0.8rem" }}>{t("dash.topStudent")} {data.eleveMajor ? `(${data.eleveMajor.moyenne}/20)` : ""}</div>
        </div>
      </div>
      {ouvert && classes.length > 0 && (
        <div className="table-wrap" style={{ marginTop: 16, borderTop: "1px solid var(--line-soft)", paddingTop: 12 }}>
          <table>
            <thead><tr><th>{t("common.class")}</th><th>{t("cls.size")}</th><th>{t("dash.seriesDetail")}</th></tr></thead>
            <tbody>
              {classes.map(([classe, v]) => (
                <tr key={classe}>
                  <td>{classe}</td>
                  <td className="mono">{v.total}</td>
                  <td className="muted" style={{ fontSize: "0.82rem" }}>
                    {Object.keys(v.series).length > 0 ? Object.entries(v.series).map(([s, n]) => `${s} (${n})`).join(", ") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AnalyseParNiveau({ perf, t }) {
  if (!perf.data) return null;
  const niveaux = ["Primaire", "College", "Lycee"].filter((n) => perf.data.parNiveau[n]?.totalEleves > 0);
  if (!niveaux.length) return null;
  return (
    <>
      <h2 className="section-title">{t("dash.pedagogy")}</h2>
      <div className="grid-auto" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}>
        {niveaux.map((n) => <NiveauCard key={n} niveau={n} data={perf.data.parNiveau[n]} t={t} />)}
      </div>
    </>
  );
}

function EnteteDashboard({ periode, user, ecole, t, locale, actions }) {
  return (
    <PageHeader
      eyebrow={`${t("dash.overview")}${periode ? " — " + periode : ""}`}
      title={t("dash.hello", { name: user.nom })}
      subtitle={`${majuscule(formatDateLongue(new Date(), locale))}${ecole?.nom ? " · " + ecole.nom : ""}`}
      actions={actions}
    />
  );
}

// -------------------------------- Administrateur --------------------------------

function DashboardAdmin() {
  const { user } = useAuth();
  const { t, locale } = usePrefs();
  const { ecole } = useEcole();
  const maintenant = new Date();
  const date = dateLocaleISO(maintenant);
  const jour = jourFrancais(maintenant);

  const ap = useChargement(() => api.getApercu({ date, jour }), [date]);
  const perf = useChargement(() => api.getDashboard(), []);
  const fin = useChargement(() => api.getSyntheseEcolage(), []);

  const a = ap.data;
  const f = fin.data;
  const devise = ecole?.devise || "FCFA";
  const pres = a?.presencesJour;
  const tauxJour = pres && pres.saisis > 0 ? Math.round((pres.presents / pres.saisis) * 100) : null;

  return (
    <div>
      <EnteteDashboard periode={a?.periode || perf.data?.periode} user={user} ecole={ecole} t={t} locale={locale}
        actions={<>
          <Link to="/presences" className="btn btn-ghost"><UserCheck size={16} aria-hidden="true" /> {t("dash.doRollCall")}</Link>
          <Link to="/ecolage" className="btn btn-primary"><Wallet size={16} aria-hidden="true" /> {t("dash.quickCashier")}</Link>
        </>} />

      {a && jour !== "Dimanche" && a.classesSansAppel > 0 && a.totaux.classes > 0 && (
        <div className="alert-strip warn" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span className="grow">{t("dash.alertNoRollCall", { n: a.classesSansAppel })}</span>
          <Link to="/presences">{t("dash.doRollCall")}</Link>
        </div>
      )}
      {f && f.nbEnRetard > 0 && (
        <div className="alert-strip info">
          <Wallet size={18} aria-hidden="true" />
          <span className="grow">{t("dash.alertLatePayers", { n: f.nbEnRetard })}</span>
          <Link to="/ecolage">{t("dash.seeCashier")}</Link>
        </div>
      )}

      {ap.erreur && !a && <p className="error-text">{ap.erreur}</p>}
      {!a && !ap.erreur ? <KpiSkeletons n={6} /> : a && (
        <div className="kpi-grid kpi-6">
          <KpiCard icon={Users} tone="green" to="/eleves" label={t("dash.students")} value={a.totaux.eleves} hint={`${a.totaux.parents} ${t("dash.parents").toLowerCase()}`} />
          <KpiCard icon={GraduationCap} tone="brass" to="/enseignants" label={t("dash.teachers")} value={a.totaux.enseignants} />
          <KpiCard icon={School} tone="blue" to="/classes" label={t("dash.classes")} value={a.totaux.classes} />
          <KpiCard icon={UserCheck} tone="green" to="/presences" label={t("dash.presentToday")}
            value={tauxJour === null ? "—" : `${tauxJour}%`}
            hint={pres.saisis > 0 ? t("dash.absLate", { a: pres.absents, l: pres.retards }) : t("dash.noAttendanceYet")} />
          <KpiCard icon={Wallet} tone="brass" to="/ecolage" label={t("dash.collection")}
            value={f ? `${f.tauxRecouvrement}%` : "…"} hint={f ? formatArgent(f.totalPaye, devise, locale) : ""} />
          <KpiCard icon={AlertCircle} tone="red" to="/ecolage" label={t("dash.remaining")}
            value={f ? formatArgentCompact(f.reste, devise, locale) : "…"} hint={f ? t("dash.overdueShort", { n: f.nbEnRetard }) : ""} />
        </div>
      )}

      <div className="grid-2">
        <GraphEffectifs perf={perf} t={t} />
        <GraphMoyennes perf={perf} t={t} />
      </div>

      <div className="grid-main">
        <Panel title={t("dash.feesTitle")} action={<Link to="/ecolage" className="btn btn-ghost btn-sm">{t("dash.seeCashier")}</Link>}>
          {!f ? <EtatChargement erreur={fin.erreur} onRetry={fin.recharger} t={t} /> : (
            <div className="card-body">
              <div className="row-flex" style={{ alignItems: "flex-end", justifyContent: "space-between", marginBottom: 10 }}>
                <div className="mono" style={{ fontSize: "2.2rem", fontWeight: 600, color: "var(--heading)" }}>{f.tauxRecouvrement}%</div>
                <div className="row-flex" style={{ gap: 22 }}>
                  {[[t("dash.feesExpected"), f.totalAttendu], [t("dash.feesPaid"), f.totalPaye], [t("dash.feesLeft"), f.reste]].map(([l, v]) => (
                    <div key={l}><div className="muted" style={{ fontSize: "0.72rem" }}>{l}</div><div className="mono" style={{ fontWeight: 600 }}>{formatArgent(v, devise, locale)}</div></div>
                  ))}
                </div>
              </div>
              <ProgressBar value={f.tauxRecouvrement} />
              {f.parNiveau.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div className="kpi-label" style={{ marginBottom: 10 }}>{t("dash.feesByLevel")}</div>
                  {f.parNiveau.map((n) => {
                    const p = n.attendu > 0 ? Math.round((n.paye / n.attendu) * 100) : 0;
                    return (
                      <div key={n.niveau} style={{ marginBottom: 12 }}>
                        <div className="row-flex" style={{ justifyContent: "space-between", fontSize: "0.84rem", marginBottom: 4 }}>
                          <span>{t(NIVEAU_KEYS[n.niveau] || "") || n.niveau}</span><span className="mono muted">{p}%</span>
                        </div>
                        <ProgressBar value={p} color={NIVEAU_COLORS[n.niveau]} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </Panel>

        <Panel title={t("dash.attendanceTitle")} action={<Link to="/presences" className="btn btn-ghost btn-sm">{t("att.tabRoll")}</Link>}>
          {!pres ? <EtatChargement erreur={ap.erreur} onRetry={ap.recharger} t={t} /> : pres.saisis === 0 ? (
            <EmptyState icon={UserCheck} text={t("dash.noAttendanceYet")} action={<Link to="/presences" className="btn btn-primary btn-sm">{t("dash.doRollCall")}</Link>} />
          ) : (
            <div className="card-body">
              <div className="row-flex" style={{ justifyContent: "space-around", textAlign: "center", marginBottom: 16 }}>
                {[[t("dash.present"), pres.presents, "var(--success)"], [t("dash.absent"), pres.absents, "var(--alert)"], [t("dash.late"), pres.retards, "var(--warning)"]].map(([l, v, c]) => (
                  <div key={l}><div className="mono" style={{ fontSize: "1.8rem", fontWeight: 600, color: c }}>{v}</div><div className="muted" style={{ fontSize: "0.75rem" }}>{l}</div></div>
                ))}
              </div>
              <div style={{ display: "flex", height: 10, borderRadius: 99, overflow: "hidden", background: "var(--paper-alt)" }} aria-hidden="true">
                <span style={{ width: `${(pres.presents / pres.saisis) * 100}%`, background: "var(--success)" }} />
                <span style={{ width: `${(pres.retards / pres.saisis) * 100}%`, background: "var(--brass)" }} />
                <span style={{ width: `${(pres.absents / pres.saisis) * 100}%`, background: "var(--alert)" }} />
              </div>
              <p className="muted" style={{ fontSize: "0.78rem", marginBottom: 0 }}>{a.classesAvecAppel}/{a.totaux.classes} {t("dash.classes").toLowerCase()}</p>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid-2">
        <Panel title={t("dash.latestPayments")} action={<Link to="/ecolage" className="btn btn-ghost btn-sm">{t("common.viewAll")}</Link>}>
          {!a ? <EtatChargement erreur={ap.erreur} onRetry={ap.recharger} t={t} /> : a.derniersPaiements.length === 0
            ? <EmptyState icon={Wallet} text={t("dash.noPayments")} />
            : a.derniersPaiements.map((p) => (
              <div className="list-row" key={p.ID}>
                <Avatar nom={p.Eleve.split(" ").slice(-1)[0]} prenom={p.Eleve.split(" ")[0]} small />
                <div className="grow"><div className="primary">{p.Eleve}</div><div className="secondary">{p.Classe} · {p.Mode} · {formatDateCourte(p.Date, locale)}</div></div>
                <div className="mono" style={{ fontWeight: 600, color: "var(--success)" }}>+{formatArgent(p.Montant, devise, locale)}</div>
              </div>
            ))}
        </Panel>

        <Panel title={t("dash.latestStudents")} action={<Link to="/eleves" className="btn btn-ghost btn-sm">{t("common.viewAll")}</Link>}>
          {!a ? <EtatChargement erreur={ap.erreur} onRetry={ap.recharger} t={t} /> : a.derniersEleves.length === 0
            ? <EmptyState icon={Users} text={t("dash.noStudents")} />
            : a.derniersEleves.map((e) => (
              <Link to={`/eleves/${e.ID}`} className="list-row" key={e.ID} style={{ textDecoration: "none", color: "inherit" }}>
                <Avatar nom={e.Nom} prenom={e.Prenom} small />
                <div className="grow"><div className="primary">{e.Nom} {e.Prenom}</div><div className="secondary">{libelleClasse(e)} · {t(NIVEAU_KEYS[e.Niveau] || "") || e.Niveau}</div></div>
                <ChevronRight size={16} className="muted" aria-hidden="true" />
              </Link>
            ))}
        </Panel>
      </div>

      <div className="grid-2">
        {a ? <ListeExamens examens={a.examensAVenir} t={t} locale={locale} /> : <Panel title={t("dash.upcomingExams")}><EtatChargement erreur={ap.erreur} onRetry={ap.recharger} t={t} /></Panel>}
        <GraphMentions perf={perf} t={t} />
      </div>

      <AnalyseParNiveau perf={perf} t={t} />
    </div>
  );
}

// ---------------------------------- Enseignant ----------------------------------

function DashboardEnseignant() {
  const { user } = useAuth();
  const { t, locale } = usePrefs();
  const { ecole } = useEcole();
  const maintenant = new Date();
  const date = dateLocaleISO(maintenant);
  const jour = jourFrancais(maintenant);
  const minutesNow = maintenant.getHours() * 60 + maintenant.getMinutes();

  const ap = useChargement(() => api.getApercu({ date, jour }), [date]);
  const perf = useChargement(() => api.getDashboard(), []);
  const a = ap.data;
  const pres = a?.presencesJour;

  const cours = useMemo(() => a?.coursDuJour || [], [a]);

  return (
    <div>
      <EnteteDashboard periode={a?.periode || perf.data?.periode} user={user} ecole={ecole} t={t} locale={locale}
        actions={<>
          <Link to="/presences" className="btn btn-ghost"><UserCheck size={16} aria-hidden="true" /> {t("dash.doRollCall")}</Link>
          <Link to="/notes-rapides" className="btn btn-primary"><FileText size={16} aria-hidden="true" /> {t("nav.notes")}</Link>
        </>} />

      {a && a.totaux.classes === 0 && (
        <div className="alert-strip info" role="status"><AlertCircle size={18} aria-hidden="true" /><span className="grow">{t("dash.noTeacherClass")}</span></div>
      )}

      {ap.erreur && !a && <p className="error-text">{ap.erreur}</p>}
      {!a && !ap.erreur ? <KpiSkeletons n={4} /> : a && (
        <div className="kpi-grid">
          <KpiCard icon={School} tone="blue" to="/classes" label={t("dash.myClasses")} value={a.totaux.classes} />
          <KpiCard icon={Users} tone="green" to="/eleves" label={t("dash.myStudents")} value={a.totaux.eleves} />
          <KpiCard icon={CalendarDays} tone="brass" to="/mon-emploi-du-temps" label={t("dash.coursesToday")} value={cours.length} hint={jour} />
          <KpiCard icon={UserX} tone="red" to="/presences" label={t("dash.absentToday")} value={pres.saisis > 0 ? pres.absents : "—"}
            hint={pres.saisis > 0 ? t("dash.absLate", { a: pres.absents, l: pres.retards }) : t("dash.noAttendanceYet")} />
        </div>
      )}

      <div className="grid-main">
        <Panel title={t("dash.todaySchedule")} action={<Link to="/mon-emploi-du-temps" className="btn btn-ghost btn-sm">{t("nav.monEmploi")}</Link>}>
          {!a ? <EtatChargement erreur={ap.erreur} onRetry={ap.recharger} t={t} /> : cours.length === 0
            ? <EmptyState icon={CalendarDays} text={t("dash.noCourses")} />
            : cours.map((c) => {
              const debut = enMinutes(c.HeureDebut), fin = enMinutes(c.HeureFin);
              const etat = minutesNow >= fin ? "past" : minutesNow >= debut ? "now" : "";
              return (
                <div className={`timeline-item ${etat}`} key={c.ID}>
                  <div className="timeline-time">{c.HeureDebut}<br /><span style={{ opacity: 0.7 }}>{c.HeureFin}</span></div>
                  <div className="timeline-bar" />
                  <div className="grow" style={{ flex: 1 }}>
                    <div className="primary" style={{ fontWeight: 600 }}>{c.Matiere}</div>
                    <div className="secondary muted" style={{ fontSize: "0.8rem" }}>{libelleClasse(c)}{c.Salle ? ` · ${t("dash.roomShort")} ${c.Salle}` : ""}</div>
                  </div>
                  {etat === "now" && <span className="badge badge-warn"><Clock size={11} aria-hidden="true" /> {t("dash.nowBadge")}</span>}
                </div>
              );
            })}
        </Panel>
        {a ? <ListeExamens examens={a.examensAVenir} t={t} locale={locale} /> : <Panel title={t("dash.upcomingExams")}><EtatChargement erreur={ap.erreur} onRetry={ap.recharger} t={t} /></Panel>}
      </div>

      {a && a.mesClasses.length > 0 && (
        <>
          <h2 className="section-title" style={{ marginTop: 10 }}>{t("dash.myClasses")}</h2>
          <div className="grid-auto" style={{ marginBottom: 20 }}>
            {a.mesClasses.map((c) => {
              const q = new URLSearchParams({ niveau: c.Niveau, classe: c.Classe, serie: c.Serie || "" }).toString();
              return (
                <div className="card" key={`${c.Niveau}${c.Classe}${c.Serie}`}>
                  <div className="row-flex" style={{ justifyContent: "space-between" }}>
                    <h3 style={{ fontFamily: "var(--font-display)", margin: 0 }}>{libelleClasse(c)}</h3>
                    <span className="badge badge-neutral">{t(NIVEAU_KEYS[c.Niveau] || "") || c.Niveau}</span>
                  </div>
                  <p className="muted" style={{ margin: "6px 0 14px", fontSize: "0.85rem" }}>
                    {c.Effectif} {t("common.students")}{c.Matieres.length ? ` · ${c.Matieres.join(", ")}` : ""}
                  </p>
                  <div className="row-flex">
                    <Link to={`/presences?${q}`} className="btn btn-ghost btn-sm"><UserCheck size={14} aria-hidden="true" /> {t("dash.rollCallShort")}</Link>
                    <Link to="/notes-rapides" className="btn btn-ghost btn-sm"><FileText size={14} aria-hidden="true" /> {t("dash.grades")}</Link>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="grid-2">
        <GraphMoyennes perf={perf} t={t} />
        <GraphMentions perf={perf} t={t} />
      </div>
      <AnalyseParNiveau perf={perf} t={t} />
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  return user?.role === "Enseignant" ? <DashboardEnseignant /> : <DashboardAdmin />;
}
