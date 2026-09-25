import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("smp_user");
    return raw ? JSON.parse(raw) : null;
  });

  // Compte de l'école suspendu ou fermé : le serveur refuse l'accès (code ECOLE_SUSPENDUE / ECOLE_ARCHIVEE).
  // On ferme la session, on vide les données hors connexion et on affiche l'écran explicatif.
  const [blocage, setBlocage] = useState(null);
  useEffect(() => {
    const surBlocage = (e) => {
      localStorage.removeItem("smp_token");
      localStorage.removeItem("smp_user");
      try { navigator.serviceWorker?.controller?.postMessage("vider-cache-donnees"); } catch { /* non bloquant */ }
      setUser(null);
      setBlocage(e.detail);
    };
    window.addEventListener("smp-compte-bloque", surBlocage);
    return () => window.removeEventListener("smp-compte-bloque", surBlocage);
  }, []);

  function login(token, u) {
    setBlocage(null);
    localStorage.setItem("smp_token", token);
    localStorage.setItem("smp_user", JSON.stringify(u));
    setUser(u);
  }

  function logout() {
    localStorage.removeItem("smp_token");
    localStorage.removeItem("smp_user");
    // Poste partagé : les données mises en cache pour la consultation hors connexion ne doivent pas rester lisibles
    try { navigator.serviceWorker?.controller?.postMessage("vider-cache-donnees"); } catch { /* non bloquant */ }
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, blocage, retourConnexion: () => setBlocage(null) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
