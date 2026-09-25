import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useEcole } from "../EcoleContext";
import { usePrefs } from "../PrefsContext";
import { menuPour, titreDepuisChemin } from "../lib/menu";
import { useCompteurs, useMesClasses } from "../lib/hooks";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import BandeauHorsLigne from "./BandeauHorsLigne";
import ErrorBoundary from "./ErrorBoundary";

// Coque commune à tous les rôles : barre latérale à sections, barre du haut, bandeau hors ligne.
export default function Shell({ children }) {
  const { user, logout } = useAuth();
  const { ecole } = useEcole();
  const { t } = usePrefs();
  const location = useLocation();
  const [menuOuvert, setMenuOuvert] = useState(false);
  const compteurs = useCompteurs(user);

  const { estTitulaire } = useMesClasses(user);
  const menu = useMemo(() => menuPour(user.role, { titulaire: estTitulaire }), [user.role, estTitulaire]);
  const cleTitre = titreDepuisChemin(menu, location.pathname);
  const titre = cleTitre ? t(cleTitre) : t("app.name");

  // Ferme le menu mobile à chaque changement de page et met à jour le titre de l'onglet
  useEffect(() => { setMenuOuvert(false); }, [location.pathname]);
  useEffect(() => {
    const ecoleNom = ecole?.nom && user.role !== "SuperAdmin" ? ` · ${ecole.nom}` : "";
    document.title = `${titre}${ecoleNom} — ${t("app.name")}`;
  }, [titre, ecole, user.role, t]);

  return (
    <div className="app-shell">
      <div className={"sidebar-backdrop" + (menuOuvert ? " visible" : "")} onClick={() => setMenuOuvert(false)} />
      <Sidebar menu={menu} user={user} ecole={ecole} compteurs={compteurs}
        ouvert={menuOuvert} onClose={() => setMenuOuvert(false)} onLogout={logout} />
      <div className="main-content">
        <Topbar titre={titre} user={user} ecole={ecole} compteurs={compteurs} onMenu={() => setMenuOuvert(true)} onLogout={logout} />
        <BandeauHorsLigne />
        <main className="page-content" id="contenu">
          <ErrorBoundary t={t} resetKey={location.pathname}>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
