import { Link } from "react-router-dom";
import { initiales } from "../lib/format";

// Petits composants d'interface partagés par les nouveaux écrans.

export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <header className={"page-header" + (actions ? " with-actions" : "")}>
      <div>
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="header-actions no-print">{actions}</div>}
    </header>
  );
}

export function KpiCard({ icon: Icon, label, value, hint, tone = "green", to }) {
  const contenu = (
    <>
      {Icon && <div className={`kpi-icon tone-${tone}`}><Icon size={22} aria-hidden="true" /></div>}
      <div style={{ minWidth: 0 }}>
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}</div>
        {hint && <div className="kpi-hint">{hint}</div>}
      </div>
    </>
  );
  return to ? <Link to={to} className="kpi">{contenu}</Link> : <div className="kpi">{contenu}</div>;
}

export function Panel({ title, subtitle, action, children, flush = true, className = "" }) {
  return (
    <section className={`card ${flush ? "flush" : ""} ${className}`}>
      {(title || action) && (
        <div className="card-header">
          <div>
            <h3 className="card-title">{title}</h3>
            {subtitle && <div className="card-sub">{subtitle}</div>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="empty-state">
      {Icon && <div className="empty-ic"><Icon size={24} aria-hidden="true" /></div>}
      {title && <h4>{title}</h4>}
      {text && <p style={{ margin: "0 0 12px" }}>{text}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ height = 16, width = "100%", style }) {
  return <div className="skeleton" style={{ height, width, ...style }} aria-hidden="true" />;
}

export function KpiSkeletons({ n = 4 }) {
  return (
    <div className="kpi-grid" aria-busy="true">
      {Array.from({ length: n }).map((_, i) => <Skeleton key={i} height={78} style={{ borderRadius: 10 }} />)}
    </div>
  );
}

export function ProgressBar({ value, color }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return <div className="progress" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${v}%`, background: color }} /></div>;
}

export function Avatar({ nom, prenom, small }) {
  return <span className={"avatar" + (small ? " avatar-sm" : "")} aria-hidden="true">{initiales(prenom, nom)}</span>;
}

// Bloc de chargement / erreur cohérent pour les données d'un panneau
export function EtatChargement({ erreur, onRetry, t }) {
  if (erreur) {
    return (
      <div className="card-body">
        <p className="error-text" style={{ marginTop: 0 }}>{erreur}</p>
        {onRetry && <button className="btn btn-ghost btn-sm" onClick={onRetry}>{t("common.retry")}</button>}
      </div>
    );
  }
  return <div className="card-body"><Skeleton height={14} width="70%" /><Skeleton height={14} style={{ marginTop: 10 }} /><Skeleton height={14} width="85%" style={{ marginTop: 10 }} /></div>;
}

// Couleur de mention/moyenne : vert ≥ 10, laiton 8–10, rouge < 8
export function classeMoyenne(m) {
  if (m === null || m === undefined) return "badge-neutral";
  if (m >= 10) return "badge-sage";
  if (m >= 8) return "badge-brass";
  return "badge-alert";
}
