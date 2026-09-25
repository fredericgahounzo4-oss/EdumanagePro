import { useEffect, useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { tailleFileAttente, surChangementFile, synchroniser } from "../lib/offline";
import { usePrefs } from "../PrefsContext";

// Bandeau d'état : prévient quand on travaille hors connexion et combien de saisies restent à synchroniser.
export default function BandeauHorsLigne() {
  const { t } = usePrefs();
  const [horsLigne, setHorsLigne] = useState(typeof navigator !== "undefined" && !navigator.onLine);
  const [enAttente, setEnAttente] = useState(tailleFileAttente());

  useEffect(() => {
    const on = () => setHorsLigne(false);
    const off = () => setHorsLigne(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const desabo = surChangementFile(setEnAttente);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); desabo(); };
  }, []);

  if (!horsLigne && enAttente === 0) return null;

  return (
    <div className="no-print" role="status" style={{
      background: horsLigne ? "#8C3A3A" : "#B08D57", color: "#fff", padding: "7px 20px", fontSize: "0.82rem",
      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap",
    }}>
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {horsLigne && <WifiOff size={15} aria-hidden="true" />}
        {horsLigne ? t("offline.off") : t("offline.on")}
        {enAttente > 0 && ` ${t("offline.pending", { n: enAttente })}`}
      </span>
      {!horsLigne && enAttente > 0 && (
        <button
          onClick={async () => { await synchroniser(); setEnAttente(tailleFileAttente()); }}
          style={{ background: "rgba(255,255,255,.2)", color: "#fff", border: "none", borderRadius: 4, padding: "3px 10px", fontSize: "0.78rem", display: "flex", alignItems: "center", gap: 6 }}
        >
          <RefreshCw size={13} aria-hidden="true" /> {t("offline.sync")}
        </button>
      )}
    </div>
  );
}
