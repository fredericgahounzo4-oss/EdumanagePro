import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Trash2, Check } from "lucide-react";
import { api } from "../api";
import { usePrefs } from "../PrefsContext";
import { iconeNotif } from "../lib/notifIcons";
import { tempsRelatif } from "../lib/format";
import { PageHeader, Panel, EmptyState, Skeleton } from "../components/ui";

export default function Notifications() {
  const { t, locale } = usePrefs();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [erreur, setErreur] = useState("");
  const [filtre, setFiltre] = useState("toutes");

  const charger = useCallback(() => {
    api.getNotifications().then((r) => setItems(r.items)).catch((e) => setErreur(e.message));
  }, []);
  useEffect(charger, [charger]);

  const nonLues = useMemo(() => (items || []).filter((i) => !i.lu).length, [items]);
  const visibles = useMemo(() => (items || []).filter((i) => filtre === "toutes" || !i.lu), [items, filtre]);

  const maj = (id, patch) => setItems((l) => l.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  async function lire(n) {
    if (n.lu) return;
    maj(n.id, { lu: true });
    try { await api.marquerNotifLue(n.id); } catch { maj(n.id, { lu: false }); }
  }
  async function ouvrir(n) {
    await lire(n);
    if (n.lien) navigate(n.lien);
  }
  async function supprimer(n) {
    try { await api.supprimerNotif(n.id); setItems((l) => l.filter((i) => i.id !== n.id)); } catch (e) { alert(e.message); }
  }
  async function toutLu() {
    try { await api.toutMarquerLu(); setItems((l) => l.map((i) => ({ ...i, lu: true }))); } catch (e) { alert(e.message); }
  }

  return (
    <div>
      <PageHeader eyebrow={t("section.communication")} title={t("notif.title")}
        subtitle={`${t("notif.subtitle")}${nonLues ? " · " + t("notif.unread", { n: nonLues }) : ""}`}
        actions={nonLues > 0 && <button className="btn btn-ghost" onClick={toutLu}><CheckCheck size={16} aria-hidden="true" /> {t("notif.markAll")}</button>} />

      <div className="tabs" role="tablist">
        {[["toutes", t("notif.filterAll")], ["non-lues", `${t("notif.filterUnread")}${nonLues ? ` (${nonLues})` : ""}`]].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={filtre === id} className={"tab" + (filtre === id ? " active" : "")} onClick={() => setFiltre(id)}>{label}</button>
        ))}
      </div>

      {erreur && <p className="error-text">{erreur}</p>}
      <Panel>
        {items === null && !erreur && <div className="card-body">{[0, 1, 2].map((i) => <Skeleton key={i} height={44} style={{ marginBottom: 10 }} />)}</div>}
        {items && visibles.length === 0 && <EmptyState icon={Bell} title={t("notif.empty")} text={t("notif.emptyText")} />}
        {visibles.map((n) => {
          const { Icon, tone } = iconeNotif(n.type);
          return (
            <div key={n.id} className={"notif-item" + (n.lu ? "" : " unread")} style={{ alignItems: "center" }}>
              <button onClick={() => ouvrir(n)} style={{ display: "flex", gap: 12, flex: 1, minWidth: 0, background: "transparent", border: "none", color: "inherit", textAlign: "left", padding: 0, alignItems: "flex-start" }}>
                <span className={`notif-ic tone-${tone}`}><Icon size={16} aria-hidden="true" /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div className="notif-title">{n.titre}</div>
                  {n.message && <div className="notif-msg">{n.message}</div>}
                  <div className="notif-time">{tempsRelatif(n.date, locale)}</div>
                </span>
                {!n.lu && <span className="unread-dot" aria-label="non lu" />}
              </button>
              <div className="row-flex" style={{ gap: 2, flexShrink: 0 }}>
                {!n.lu && <button className="icon-btn" onClick={() => lire(n)} aria-label={t("notif.markRead")} title={t("notif.markRead")}><Check size={16} /></button>}
                {n.source === "notification" && <button className="icon-btn" onClick={() => supprimer(n)} aria-label={t("notif.delete")} title={t("notif.delete")}><Trash2 size={16} /></button>}
              </div>
            </div>
          );
        })}
      </Panel>
    </div>
  );
}
