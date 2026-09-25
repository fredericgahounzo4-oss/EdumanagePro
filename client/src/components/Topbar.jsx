import { useCallback, useRef, useState } from "react";
import { Menu, Sun, Moon, Check, Monitor, LogOut, CalendarDays, KeyRound, Lock } from "lucide-react";
import { usePrefs } from "../PrefsContext";
import { useClickOutside } from "../lib/hooks";
import { LANGUES } from "../i18n";
import { Avatar } from "./ui";
import NotificationBell from "./NotificationBell";
import GlobalSearch from "./GlobalSearch";
import ChangerMotDePasse from "./ChangerMotDePasse";
import { peutChangerMdp } from "../lib/permissions";

function MenuUtilisateur({ user, ecole, onLogout }) {
  const { t, theme, setTheme, langue, setLangue } = usePrefs();
  const [mdpOuvert, setMdpOuvert] = useState(false);
  const peutChanger = peutChangerMdp(user, ecole);
  const ref = useRef(null);
  const [ouvert, setOuvert] = useState(false);
  const fermer = useCallback(() => setOuvert(false), []);
  useClickOutside(ref, ouvert, fermer);

  const themes = [
    { id: "light", label: t("top.themeLight"), Icon: Sun },
    { id: "dark", label: t("top.themeDark"), Icon: Moon },
    { id: "auto", label: t("top.themeAuto"), Icon: Monitor },
  ];

  return (
    <div className="dropdown-wrap" ref={ref}>
      <button className="user-chip" onClick={() => setOuvert((o) => !o)} aria-haspopup="true" aria-expanded={ouvert} aria-label={t("top.account")}>
        <Avatar nom={user.nom} />
        <span className="name">{user.nom}</span>
      </button>
      {ouvert && (
        <div className="dropdown" role="menu">
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-soft)" }}>
            <div style={{ fontWeight: 600 }}>{user.nom}</div>
            <div className="mono muted" style={{ fontSize: "0.7rem" }}>{t(`role.${user.role}`)}</div>
          </div>
          <div className="nav-section-label" style={{ color: "var(--text-soft)", padding: "10px 16px 4px" }}>{t("top.theme")}</div>
          {themes.map(({ id, label, Icon }) => (
            <button key={id} className="dropdown-item" onClick={() => setTheme(id)}>
              <Icon size={16} aria-hidden="true" /> <span style={{ flex: 1 }}>{label}</span>
              {theme === id && <Check size={15} aria-hidden="true" />}
            </button>
          ))}
          <div className="nav-section-label" style={{ color: "var(--text-soft)", padding: "10px 16px 4px" }}>{t("top.language")}</div>
          {Object.entries(LANGUES).map(([code, nom]) => (
            <button key={code} className="dropdown-item" onClick={() => setLangue(code)}>
              <span className="mono" style={{ width: 16, fontSize: "0.7rem" }}>{code.toUpperCase()}</span>
              <span style={{ flex: 1 }}>{nom}</span>
              {langue === code && <Check size={15} aria-hidden="true" />}
            </button>
          ))}
          <div className="dropdown-sep" />
          {peutChanger ? (
            <button className="dropdown-item" onClick={() => { setOuvert(false); setMdpOuvert(true); }}><KeyRound size={16} aria-hidden="true" /> {t("top.changePassword")}</button>
          ) : (
            <div className="dropdown-item" style={{ opacity: 0.7, cursor: "default", fontSize: "0.8rem" }} title="Adressez-vous à l'administrateur de votre école pour faire réinitialiser votre mot de passe.">
              <Lock size={15} aria-hidden="true" /> {t("top.passwordManaged")}
            </div>
          )}
          <button className="dropdown-item" onClick={onLogout}><LogOut size={16} aria-hidden="true" /> {t("nav.logout")}</button>
        </div>
      )}
      {mdpOuvert && <ChangerMotDePasse onClose={() => setMdpOuvert(false)} />}
    </div>
  );
}

export default function Topbar({ titre, user, ecole, compteurs, onMenu, onLogout }) {
  const { t, themeEffectif, basculerTheme, langue, setLangue } = usePrefs();
  const personnel = user.role === "Administrateur" || user.role === "Enseignant";
  const aCloche = user.role !== "SuperAdmin";

  return (
    <header className="topbar no-print">
      <button className="icon-btn burger-btn" onClick={onMenu} aria-label={t("nav.openMenu")}><Menu size={20} /></button>
      <h2 className="topbar-title" style={{ margin: 0 }}>{titre}</h2>

      {personnel && <GlobalSearch />}
      {ecole?.periode && personnel && (
        <span className="chip hide-sm" title={t("top.period")}><CalendarDays size={13} aria-hidden="true" /> {ecole.periode}</span>
      )}
      <button className="icon-btn" onClick={basculerTheme} aria-label={t("top.theme")} title={t("top.theme")}>
        {themeEffectif === "dark" ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
      </button>
      <button className="icon-btn lang-btn" onClick={() => setLangue(langue === "fr" ? "en" : "fr")} aria-label={t("top.language")} title={t("top.language")}>
        {langue === "fr" ? "EN" : "FR"}
      </button>
      {aCloche && <NotificationBell compteurs={compteurs} />}
      <MenuUtilisateur user={user} ecole={ecole} onLogout={onLogout} />
    </header>
  );
}
