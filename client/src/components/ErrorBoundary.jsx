import { Component } from "react";
import { AlertCircle } from "lucide-react";

// Empêche qu'une erreur d'affichage dans une page ne fasse tomber toute l'application (écran blanc).
export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { erreur: null }; }
  static getDerivedStateFromError(erreur) { return { erreur }; }
  componentDidCatch(erreur, info) { console.error("[UI]", erreur, info?.componentStack); }
  componentDidUpdate(prev) {
    // Change de page -> on réessaie d'afficher
    if (this.state.erreur && prev.resetKey !== this.props.resetKey) this.setState({ erreur: null });
  }
  render() {
    if (!this.state.erreur) return this.props.children;
    const t = this.props.t || ((k) => k);
    return (
      <div className="card" style={{ maxWidth: 520, margin: "60px auto", textAlign: "center" }}>
        <div className="empty-ic" style={{ width: 54, height: 54, margin: "0 auto 12px", borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--alert-bg)", color: "var(--alert)" }}>
          <AlertCircle size={26} />
        </div>
        <h3 style={{ fontFamily: "var(--font-display)", margin: "0 0 6px" }}>{t("common.crashTitle")}</h3>
        <p className="muted" style={{ margin: "0 0 16px" }}>{t("common.crashText")}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>{t("common.reload")}</button>
      </div>
    );
  }
}
