import { useCallback, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { api } from "../api";
import { usePrefs } from "../PrefsContext";
import { useClickOutside } from "../lib/hooks";
import { tempsRelatif } from "../lib/format";
import { iconeNotif } from "../lib/notifIcons";

export default function NotificationBell({ compteurs }) {
  const { t, locale } = usePrefs();
  const navigate = useNavigate();
  const ref = useRef(null);
  const [ouvert, setOuvert] = useState(false);
  const [items, setItems] = useState(null);
  const fermer = useCallback(() => setOuvert(false), []);
  useClickOutside(ref, ouvert, fermer);

  async function basculer() {
    const suivant = !ouvert;
    setOuvert(suivant);
    if (suivant) {
      try { setItems((await api.getNotifications()).items.slice(0, 6)); } catch { setItems([]); }
    }
  }

  async function ouvrir(n) {
    setOuvert(false);
    if (!n.lu) { try { await api.marquerNotifLue(n.id); compteurs.rafraichir(); } catch { /* non bloquant */ } }
    if (n.lien) navigate(n.lien);
  }

  async function toutLu() {
    try { await api.toutMarquerLu(); setItems((l) => (l || []).map((i) => ({ ...i, lu: true }))); compteurs.rafraichir(); } catch { /* non bloquant */ }
  }

  const n = compteurs.notifications;
  return (
    <div className="dropdown-wrap" ref={ref}>
      <button className="icon-btn" onClick={basculer} aria-label={t("nav.notifications")} aria-expanded={ouvert} aria-haspopup="true">
        <Bell size={19} aria-hidden="true" />
        {n > 0 && <span className="dot-badge">{n > 9 ? "9+" : n}</span>}
      </button>
      {ouvert && (
        <div className="dropdown" style={{ width: 360, maxWidth: "92vw" }} role="menu">
          <div className="dropdown-head">
            <span>{t("notif.title")}</span>
            {n > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={toutLu} style={{ padding: "3px 8px" }}>
                <CheckCheck size={14} aria-hidden="true" /> {t("notif.markAll")}
              </button>
            )}
          </div>
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {items === null && <p className="muted" style={{ padding: 16, margin: 0 }}>{t("common.loading")}</p>}
            {items && items.length === 0 && <p className="muted" style={{ padding: 20, margin: 0, textAlign: "center" }}>{t("notif.emptyText")}</p>}
            {items && items.map((it) => {
              const { Icon, tone } = iconeNotif(it.type);
              return (
                <button key={it.id} className={"notif-item" + (it.lu ? "" : " unread")} onClick={() => ouvrir(it)}>
                  <span className={`notif-ic tone-${tone}`}><Icon size={16} aria-hidden="true" /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <div className="notif-title">{it.titre}</div>
                    {it.message && <div className="notif-msg">{it.message}</div>}
                    <div className="notif-time">{tempsRelatif(it.date, locale)}</div>
                  </span>
                  {!it.lu && <span className="unread-dot" aria-label="non lu" />}
                </button>
              );
            })}
          </div>
          <Link to="/notifications" onClick={fermer} className="dropdown-item" style={{ justifyContent: "center", fontWeight: 600, borderTop: "1px solid var(--line-soft)" }}>
            {t("notif.seeAll")}
          </Link>
        </div>
      )}
    </div>
  );
}
