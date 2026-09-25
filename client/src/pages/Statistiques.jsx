import { useEffect, useState } from "react";
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { Trophy, TrendingUp, UserCheck, Wallet, Printer, AlertCircle, UserX } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { usePrefs } from "../PrefsContext";
import { useEcole } from "../EcoleContext";
import { tooltipProps, axisTick, gridStroke, MENTION_COLORS } from "../lib/chart";
import { formatMois, formatArgent } from "../lib/format";
import { PageHeader, Panel, KpiCard, KpiSkeletons, EmptyState, Skeleton, Avatar, classeMoyenne } from "../components/ui";

const NIVEAUX = ["Primaire", "College", "Lycee"];

function Vide({ text }) {
  return <p className="muted" style={{ margin: 0, padding: "36px 20px", textAlign: "center", fontSize: "0.9rem" }}>{text}</p>;
}

function ListeEleves({ items, t, badge }) {
  if (!items.length) return <EmptyState icon={UserCheck} text={t("stats.nothing")} />;
  return items.map((e, i) => (
    <Link key={e.ID} to={`/eleves/${e.ID}`} className="list-row" style={{ textDecoration: "none", color: "inherit" }}>
      <span className="mono muted" style={{ width: 18 }}>{i + 1}</span>
      <Avatar nom={e.Nom} prenom={e.Prenom} small />
      <div className="grow"><div className="primary">{e.Nom} {e.Prenom}</div><div className="secondary">{e.Classe}</div></div>
      {badge(e)}
    </Link>
  ));
}

export default function Statistiques() {
  const { user } = useAuth();
  const { t, locale } = usePrefs();
  const { ecole } = useEcole();
  const admin = user.role === "Administrateur";
  const [periode, setPeriode] = useState("");
  const [niveau, setNiveau] = useState("");
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState("");
  const [fin, setFin] = useState(null);
  const devise = ecole?.devise || "FCFA";

  useEffect(() => {
    setD(null); setErreur("");
    const params = {};
    if (periode) params.periode = periode;
    if (niveau) params.niveau = niveau;
    api.getStats(params).then(setD).catch((e) => setErreur(e.message));
  }, [periode, niveau]);

  useEffect(() => {
    if (admin) api.getSyntheseEcolage().then(setFin).catch(() => setFin(null));
  }, [admin]);

  const mois = (arr) => (arr || []).map((m) => ({ ...m, label: formatMois(m.mois, locale) }));
  const matieres = d?.moyenneParMatiere || [];

  return (
    <div>
      <PageHeader eyebrow={t("section.rapports")} title={t("stats.title")}
        subtitle={`${t("stats.subtitle")}${d?.portee === "mes-classes" ? " " + t("stats.scopeMine") : ""}`}
        actions={<button className="btn btn-ghost" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> {t("common.print")}</button>} />

      <div className="toolbar no-print">
        <select value={niveau} onChange={(e) => setNiveau(e.target.value)} aria-label={t("common.level")}>
          <option value="">{t("stats.allLevels")}</option>
          {NIVEAUX.map((n) => <option key={n} value={n}>{t(`cls.level.${n}`)}</option>)}
        </select>
        {ecole?.periodes?.length > 0 && (
          <select value={periode || d?.periode || ecole.periode || ""} onChange={(e) => setPeriode(e.target.value)} aria-label={t("common.period")}>
            {ecole.periodes.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
      </div>

      {erreur && <p className="error-text">{erreur}</p>}
      {!d && !erreur && <><KpiSkeletons n={4} /><Skeleton height={280} /></>}

      {d && (
        <>
          <div className="kpi-grid">
            <KpiCard icon={Trophy} tone="brass" label={t("stats.avg")} value={d.moyenneGenerale === null ? "—" : `${d.moyenneGenerale} / 20`} hint={t("stats.gradedOf", { n: d.elevesNotes, t: d.totalEleves })} />
            <KpiCard icon={TrendingUp} tone="green" label={t("stats.success")} value={d.tauxReussite === null ? "—" : `${d.tauxReussite}%`} hint={d.periode} />
            <KpiCard icon={UserCheck} tone="blue" label={t("stats.attendance")} value={d.tauxPresence30j === null ? "—" : `${d.tauxPresence30j}%`} />
            {admin && <KpiCard icon={Wallet} tone="brass" to="/ecolage" label={t("stats.collection")} value={fin ? `${fin.tauxRecouvrement}%` : "…"} hint={fin ? formatArgent(fin.totalPaye, devise, locale) : ""} />}
          </div>

          <div className="grid-2">
            <Panel title={t("stats.bySubject")} subtitle={d.periode}>
              {matieres.length === 0 ? <Vide text={t("stats.noNotes")} /> : (
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={Math.max(220, matieres.length * 34)}>
                    <BarChart data={matieres} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                      <XAxis type="number" domain={[0, 20]} tick={axisTick} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="matiere" width={110} tick={{ ...axisTick, fontFamily: "var(--font-body)" }} tickLine={false} axisLine={false} />
                      <Tooltip {...tooltipProps} />
                      <Bar dataKey="moyenne" name={t("common.average")} radius={[0, 5, 5, 0]} maxBarSize={20}>
                        {matieres.map((m) => <Cell key={m.matiere} fill={m.moyenne >= 10 ? "var(--primary)" : "var(--alert)"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>

            <Panel title={t("stats.mentions")}>
              {d.elevesNotes === 0 ? <Vide text={t("stats.noNotes")} /> : (
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={d.repartitionMentions}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                      <XAxis dataKey="mention" tick={{ ...axisTick, fontSize: 10 }} tickLine={false} axisLine={{ stroke: gridStroke }} interval={0} />
                      <YAxis tick={axisTick} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                      <Tooltip {...tooltipProps} />
                      <Bar dataKey="count" name={t("common.students")} radius={[5, 5, 0, 0]} maxBarSize={44}>
                        {d.repartitionMentions.map((m, i) => <Cell key={m.mention} fill={MENTION_COLORS[i % MENTION_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
          </div>

          <div className="grid-2">
            <Panel title={t("stats.attByMonth")}>
              {d.presenceParMois.every((m) => m.presents + m.absents + m.retards === 0) ? <Vide text={t("att.noHistory")} /> : (
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={mois(d.presenceParMois)}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                      <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: gridStroke }} />
                      <YAxis tick={axisTick} tickLine={false} axisLine={false} width={34} allowDecimals={false} />
                      <Tooltip {...tooltipProps} />
                      <Bar dataKey="presents" name={t("dash.present")} stackId="a" fill="var(--success)" />
                      <Bar dataKey="retards" name={t("dash.late")} stackId="a" fill="var(--brass)" />
                      <Bar dataKey="absents" name={t("dash.absent")} stackId="a" fill="var(--alert)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>

            {admin && (
              <Panel title={t("stats.collectionByMonth")}>
                {!d.encaissementsParMois || d.encaissementsParMois.every((m) => m.total === 0) ? <Vide text={t("dash.noPayments")} /> : (
                  <div className="card-body">
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={mois(d.encaissementsParMois)}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                        <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: gridStroke }} />
                        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={50} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                        <Tooltip {...tooltipProps} formatter={(v) => formatArgent(v, devise, locale)} />
                        <Area type="monotone" dataKey="total" name={t("stats.paid")} stroke="var(--brass)" strokeWidth={2} fill="var(--brass)" fillOpacity={0.22} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Panel>
            )}
          </div>

          {admin && fin && fin.parNiveau.length > 0 && (
            <Panel title={t("stats.collectionByLevel")} className="" >
              <div className="card-body">
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={fin.parNiveau.map((n) => ({ ...n, niveau: t(`cls.level.${n.niveau}`) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="niveau" tick={axisTick} tickLine={false} axisLine={{ stroke: gridStroke }} />
                    <YAxis tick={axisTick} tickLine={false} axisLine={false} width={50} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                    <Tooltip {...tooltipProps} formatter={(v) => formatArgent(v, devise, locale)} />
                    <Bar dataKey="attendu" name={t("stats.expected")} fill="var(--line)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="paye" name={t("stats.paid")} fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          )}

          <div className="grid-3" style={{ marginTop: 20 }}>
            <Panel title={<span className="row-flex" style={{ gap: 8 }}><Trophy size={16} aria-hidden="true" /> {t("stats.top")}</span>}>
              <ListeEleves items={d.meilleursEleves} t={t} badge={(e) => <span className={"badge " + classeMoyenne(e.Moyenne)}>{e.Moyenne}</span>} />
            </Panel>
            <Panel title={<span className="row-flex" style={{ gap: 8 }}><AlertCircle size={16} aria-hidden="true" /> {t("stats.struggling")}</span>}>
              <ListeEleves items={d.elevesEnDifficulte} t={t} badge={(e) => <span className={"badge " + classeMoyenne(e.Moyenne)}>{e.Moyenne}</span>} />
            </Panel>
            <Panel title={<span className="row-flex" style={{ gap: 8 }}><UserX size={16} aria-hidden="true" /> {t("stats.absent")}</span>}>
              <ListeEleves items={d.elevesAbsents} t={t} badge={(e) => <span className="badge badge-alert">{e.Absences} {t("att.absences")}</span>} />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
