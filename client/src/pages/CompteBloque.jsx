import { AlertTriangle, Lock } from "lucide-react";
import { useAuth } from "../AuthContext";

// Affiché à tous les utilisateurs d'une école dont le compte est suspendu ou fermé (archivé).
// Les données de l'école sont conservées : seul l'accès est coupé.
export default function CompteBloque() {
  const { blocage, retourConnexion } = useAuth();
  const suspendu = blocage.code === "ECOLE_SUSPENDUE";
  const Icone = suspendu ? AlertTriangle : Lock;
  const date = blocage.dateLimite ? new Date(blocage.dateLimite).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "var(--paper)" }}>
      <div className="card" role="alert" style={{ maxWidth: 560, width: "100%", padding: 32, textAlign: "center" }}>
        <div className="kpi-icon tone-red" style={{ width: 64, height: 64, margin: "0 auto 16px", borderRadius: "50%" }}><Icone size={30} aria-hidden="true" /></div>
        <div className="page-eyebrow">{blocage.etablissement || "Votre établissement"}</div>
        <h1 className="page-title" style={{ fontSize: "1.7rem", marginBottom: 10 }}>{suspendu ? "Compte suspendu" : "Compte fermé"}</h1>

        {suspendu ? (
          <>
            <p className="muted" style={{ margin: "0 0 14px", lineHeight: 1.6 }}>
              L'accès à la plateforme est suspendu pour tous les comptes de votre établissement. Vos données sont conservées.
            </p>
            {blocage.motif && (
              <div style={{ textAlign: "left", background: "var(--alert-bg)", color: "var(--alert)", borderRadius: "var(--radius-sm)", padding: "12px 14px", marginBottom: 12 }}>
                <div className="kpi-label" style={{ color: "inherit", marginBottom: 4 }}>Motif de la suspension</div>
                {blocage.motif}
              </div>
            )}
            {date && (
              <div style={{ textAlign: "left", background: "var(--brass-bg)", color: "var(--warning)", borderRadius: "var(--radius-sm)", padding: "12px 14px", marginBottom: 12 }}>
                <div className="kpi-label" style={{ color: "inherit", marginBottom: 4 }}>Date limite de régularisation</div>
                <b>{date}</b> — passé ce délai sans régularisation, le compte est fermé et archivé automatiquement.
              </div>
            )}
          </>
        ) : (
          <p className="muted" style={{ margin: "0 0 14px", lineHeight: 1.6 }}>
            Le compte de votre établissement a été fermé et ses données archivées. Pour demander sa restauration, contactez l'administration de la plateforme.
          </p>
        )}

        <p className="muted" style={{ fontSize: "0.88rem", margin: "0 0 20px" }}>Pour régulariser votre situation, contactez l'administration de la plateforme SchoolManager Pro.</p>
        <button className="btn btn-primary" onClick={retourConnexion}>Retour à la connexion</button>
      </div>
    </div>
  );
}
