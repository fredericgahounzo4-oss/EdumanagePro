import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { useAuth } from "./AuthContext";

// Informations de l'établissement de l'utilisateur connecté (nom, logo, période, devise).
// Rechargées quand l'administrateur modifie les paramètres (évènement "smp-settings-updated").
const Ctx = createContext({ ecole: null });

export function EcoleProvider({ children }) {
  const { user } = useAuth();
  const [ecole, setEcole] = useState(null);

  const charger = useCallback(() => {
    if (!user || user.role === "SuperAdmin") { setEcole(null); return; }
    api.getSettings()
      .then((s) => setEcole({
        nom: s.Nom, type: s.Type, periode: s.PeriodeActuelle, devise: s.Devise || "FCFA",
        periodes: s.PeriodesDisponibles || [], profsChangentMdp: !!s.ProfsChangentMotDePasse, logo: s.logoUrl ? `${api.logoUrl()}&v=${Date.now()}` : "",
      }))
      .catch(() => setEcole((e) => e || { nom: "", periode: "", devise: "FCFA", periodes: [], logo: "" }));
  }, [user]);

  useEffect(() => {
    charger();
    window.addEventListener("smp-settings-updated", charger);
    return () => window.removeEventListener("smp-settings-updated", charger);
  }, [charger]);

  const value = useMemo(() => ({ ecole, rafraichir: charger }), [ecole, charger]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEcole() {
  return useContext(Ctx);
}
