import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./AuthContext.jsx";
import { PrefsProvider } from "./PrefsContext.jsx";
import { EcoleProvider } from "./EcoleContext.jsx";
import "./index.css";
import { demarrerSynchroAuto } from "./lib/offline";

// Mode hors connexion : met l'application en cache et rejoue les saisies différées
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => { /* non bloquant */ });
  });
}
demarrerSynchroAuto();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <PrefsProvider>
        <AuthProvider>
          <EcoleProvider>
            <App />
          </EcoleProvider>
        </AuthProvider>
      </PrefsProvider>
    </BrowserRouter>
  </React.StrictMode>
);
