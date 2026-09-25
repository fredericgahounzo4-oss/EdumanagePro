import { NavLink } from "react-router-dom";
import { useState } from "react";
import { GraduationCap, LogOut, X } from "lucide-react";
import { EXPORT_ITEM } from "../lib/menu";
import { api } from "../api";
import { usePrefs } from "../PrefsContext";

export default function Sidebar({ menu, user, ecole, compteurs, ouvert, onClose, onLogout }) {
  const { t } = usePrefs();
  const [logoKo, setLogoKo] = useState(false);
  const nom = user.role === "SuperAdmin" ? t("app.name") : (ecole?.nom || t("app.name"));
  const eyebrow = user.role === "SuperAdmin" ? t("section.plateforme") : t("app.name");
  const ExportIcon = EXPORT_ITEM.icon;

  return (
    <aside className={"sidebar" + (ouvert ? " mobile-open" : "")} aria-label="Navigation principale">
      <button className="sidebar-close-btn" onClick={onClose} aria-label={t("nav.closeMenu")}><X size={20} /></button>

      <div className="sidebar-brand">
        <div className="brand-mark">
          {ecole?.logo && !logoKo
            ? <img src={ecole.logo} alt="" onError={() => setLogoKo(true)} />
            : <GraduationCap size={22} aria-hidden="true" />}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="brand-name">{nom}</div>
          <div className="brand-eyebrow">{eyebrow}</div>
        </div>
      </div>

      <nav className="sidebar-scroll">
        {menu.map((section) => (
          <div key={section.key}>
            <div className="nav-section-label">{t(section.key)}</div>
            {section.items.map((it) => {
              const Icon = it.icon;
              const n = it.badge ? compteurs[it.badge] : 0;
              return (
                <NavLink key={it.to} to={it.to} end={it.end} onClick={onClose}
                  className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
                  <Icon size={18} aria-hidden="true" />
                  <span>{t(it.labelKey)}</span>
                  {n > 0 && <span className="nav-badge" aria-label={`${n}`}>{n > 99 ? "99+" : n}</span>}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        {user.role === "Administrateur" && (
          <a href={api.exportUrl()} className="nav-link" style={{ fontSize: "0.84rem", padding: "7px 12px" }}>
            <ExportIcon size={16} aria-hidden="true" /> {t(EXPORT_ITEM.labelKey)}
          </a>
        )}
        <button className="nav-link" style={{ fontSize: "0.84rem", padding: "7px 12px" }} onClick={onLogout}>
          <LogOut size={16} aria-hidden="true" /> {t("nav.logout")}
        </button>
      </div>
    </aside>
  );
}
