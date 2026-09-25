import { useEffect, useState } from "react";
import { GraduationCap, FileText, UserCheck, Wallet, WifiOff, Sun, Moon } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { usePrefs } from "../PrefsContext";

export default function Login() {
  const { login } = useAuth();
  const { t, themeEffectif, basculerTheme, langue, setLangue } = usePrefs();
  const [needsBootstrap, setNeedsBootstrap] = useState(null);
  const [form, setForm] = useState({ Nom: "", Identifiant: "", MotDePasse: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.authStatus().then((s) => setNeedsBootstrap(s.needsSuperAdminBootstrap)).catch(() => setNeedsBootstrap(false));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = needsBootstrap ? await api.bootstrap(form) : await api.login(form);
      login(res.token, res.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (needsBootstrap === null) return null;

  const points = [[FileText, "auth.p1"], [UserCheck, "auth.p2"], [Wallet, "auth.p3"], [WifiOff, "auth.p4"]];

  return (
    <div className="auth-layout">
      <div className="auth-hero">
        <div className="row-flex" style={{ gap: 12 }}>
          <div className="brand-mark" style={{ width: 46, height: 46 }}><GraduationCap size={24} aria-hidden="true" /></div>
          <div>
            <div className="brand-name" style={{ fontSize: "1.15rem" }}>{t("app.name")}</div>
            <div className="brand-eyebrow">Gestion scolaire</div>
          </div>
        </div>
        <div>
          <h2>{t("auth.heroTitle")}</h2>
          <p>{t("auth.heroText")}</p>
          <ul className="auth-points">
            {points.map(([Icon, k]) => <li key={k}><span className="pt"><Icon size={17} aria-hidden="true" /></span>{t(k)}</li>)}
          </ul>
        </div>
        <div className="mono" style={{ fontSize: "0.68rem", opacity: 0.55, letterSpacing: "0.1em" }}>SCHOOLMANAGER PRO</div>
      </div>

      <div className="auth-panel">
        <div className="auth-tools">
          <button className="icon-btn" onClick={basculerTheme} aria-label={t("top.theme")}>{themeEffectif === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
          <button className="icon-btn lang-btn" onClick={() => setLangue(langue === "fr" ? "en" : "fr")} aria-label={t("top.language")}>{langue === "fr" ? "EN" : "FR"}</button>
        </div>

        <div className="card" style={{ width: 400, maxWidth: "100%", padding: 30 }}>
          <div className="page-eyebrow">{t("app.name")}</div>
          <h1 className="page-title" style={{ fontSize: "1.6rem", marginBottom: 4 }}>
            {needsBootstrap ? t("auth.bootstrapTitle") : t("auth.title")}
          </h1>
          <p className="page-subtitle" style={{ marginBottom: 22 }}>
            {needsBootstrap ? t("auth.bootstrapText") : t("auth.subtitle")}
          </p>

          <form onSubmit={submit}>
            {needsBootstrap && (
              <div className="form-field" style={{ marginBottom: 12 }}>
                <label htmlFor="nom">{t("auth.fullName")}</label>
                <input id="nom" required autoComplete="name" value={form.Nom} onChange={(e) => setForm({ ...form, Nom: e.target.value })} />
              </div>
            )}
            <div className="form-field" style={{ marginBottom: 12 }}>
              <label htmlFor="identifiant">{t("auth.username")}</label>
              <input id="identifiant" required autoFocus autoComplete="username" value={form.Identifiant} onChange={(e) => setForm({ ...form, Identifiant: e.target.value })} />
            </div>
            <div className="form-field" style={{ marginBottom: 16 }}>
              <label htmlFor="mdp">{t("auth.password")}</label>
              <input id="mdp" required type="password" autoComplete={needsBootstrap ? "new-password" : "current-password"} value={form.MotDePasse} onChange={(e) => setForm({ ...form, MotDePasse: e.target.value })} />
            </div>
            {error && <p className="error-text" role="alert" style={{ marginTop: 0 }}>{error}</p>}
            <button className="btn btn-primary" type="submit" style={{ width: "100%", padding: "11px 16px" }} disabled={loading}>
              {loading ? "…" : needsBootstrap ? t("auth.bootstrapSubmit") : t("auth.submit")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
