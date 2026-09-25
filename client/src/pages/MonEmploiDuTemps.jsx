import { useEffect, useState } from "react";
import { api } from "../api";
import {
  startReminderLoop, stopReminderLoop, getCachedSchedule,
  notificationPermission, requestNotificationPermission, notificationsSupported,
} from "../lib/notifications";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const COULEURS = ["#DCE3D3", "#F0E6D2", "#E4DCEF", "#DCE9EF", "#F0DCDC", "#E9E4D0"];

function couleurPour(matiere) {
  let h = 0;
  for (const c of String(matiere)) h = (h * 31 + c.charCodeAt(0)) % 997;
  return COULEURS[h % COULEURS.length];
}

export default function MonEmploiDuTemps() {
  const [creneaux, setCreneaux] = useState([]);
  const [horsLigne, setHorsLigne] = useState(false);
  const [permission, setPermission] = useState(notificationPermission());
  const [error, setError] = useState("");

  useEffect(() => {
    api.getMonEmploiDuTemps()
      .then((d) => { setCreneaux(d); setHorsLigne(false); })
      .catch(() => {
        const cache = getCachedSchedule();
        if (cache) { setCreneaux(cache.entries); setHorsLigne(true); }
        else setError("Emploi du temps indisponible hors connexion (il sera enregistré à la première connexion).");
      });

    // Rappels : programmés localement, donc fonctionnels même sans connexion
    startReminderLoop(() => api.getMonEmploiDuTemps());
    return () => stopReminderLoop();
  }, []);

  async function activerRappels() {
    const p = await requestNotificationPermission();
    setPermission(p);
  }

  // Plage horaire couverte par l'emploi du temps réel
  const heures = [...new Set(creneaux.map((c) => `${c.HeureDebut}-${c.HeureFin}`))]
    .sort((a, b) => a.localeCompare(b));

  const parCase = {};
  for (const c of creneaux) parCase[`${c.Jour}|${c.HeureDebut}-${c.HeureFin}`] = c;

  const joursUtilises = JOURS.filter((j) => creneaux.some((c) => c.Jour === j));
  const colonnes = joursUtilises.length > 0 ? joursUtilises : JOURS.slice(0, 5);

  return (
    <div>
      <header className="page-header">
        <div className="page-eyebrow">Organisation</div>
        <h1 className="page-title">Mon emploi du temps</h1>
        <p className="page-subtitle">
          Tous vos cours, toutes classes confondues.
          {horsLigne && " (affiché depuis la copie locale — vous êtes hors connexion)"}
        </p>
      </header>

      {notificationsSupported() && permission !== "granted" && (
        <div className="card" style={{ marginBottom: 16, background: "var(--paper-alt)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ fontSize: "0.88rem" }}>
              <strong>Activer les rappels de cours</strong>
              <div style={{ color: "var(--text-soft)", fontSize: "0.82rem", marginTop: 2 }}>
                Recevez une alerte 10 minutes avant chaque cours, avec la classe concernée.
                Les rappels fonctionnent sans connexion tant que l'application reste ouverte ou installée sur l'écran d'accueil.
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={activerRappels}>Activer</button>
          </div>
        </div>
      )}
      {permission === "granted" && (
        <p style={{ fontSize: "0.82rem", color: "var(--text-soft)", marginBottom: 14 }}>
          ✓ Rappels activés — vous serez prévenu 10 minutes avant chaque cours.
        </p>
      )}

      {error && <p className="error-text">{error}</p>}

      {creneaux.length === 0 ? (
        <div className="card"><div className="empty-state">Aucun cours ne vous est assigné pour le moment.</div></div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table style={{ minWidth: 700 }}>
            <thead>
              <tr>
                <th style={{ width: 110 }}>Horaire</th>
                {colonnes.map((j) => <th key={j} style={{ textAlign: "center" }}>{j}</th>)}
              </tr>
            </thead>
            <tbody>
              {heures.map((plage) => (
                <tr key={plage}>
                  <td className="mono" style={{ fontSize: "0.8rem", fontWeight: 600 }}>{plage.replace("-", " – ")}</td>
                  {colonnes.map((j) => {
                    const c = parCase[`${j}|${plage}`];
                    return (
                      <td key={j} style={{ padding: 4, verticalAlign: "top" }}>
                        {c && (
                          <div style={{
                            background: couleurPour(c.Matiere), color: "#241F16", borderRadius: 5, padding: "7px 9px",
                            fontSize: "0.8rem", lineHeight: 1.35,
                          }}>
                            <div style={{ fontWeight: 700 }}>{c.Matiere}</div>
                            <div>{c.Classe}{c.Serie ? ` ${c.Serie}` : ""}</div>
                            {c.Salle && <div style={{ color: "#5B5442", fontSize: "0.74rem" }}>{c.Salle}</div>}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card" style={{ marginTop: 20 }}>
        <h3 style={{ fontFamily: "var(--font-display)", marginTop: 0 }}>Liste de mes cours</h3>
        <table>
          <thead><tr><th>Jour</th><th>Horaire</th><th>Matière</th><th>Classe</th><th>Salle</th></tr></thead>
          <tbody>
            {creneaux.map((c) => (
              <tr key={c.ID}>
                <td>{c.Jour}</td>
                <td className="mono">{c.HeureDebut} – {c.HeureFin}</td>
                <td style={{ fontWeight: 600 }}>{c.Matiere}</td>
                <td>{c.Classe}{c.Serie ? ` ${c.Serie}` : ""}</td>
                <td>{c.Salle || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
