import { useState } from "react";
import { KeyRound, X, Check } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

// Fenêtre « Changer mon mot de passe ». Le serveur vérifie le droit (administrateur : toujours ; enseignant :
// seulement si son administrateur l'a autorisé) et ferme les autres sessions du compte après le changement.
export default function ChangerMotDePasse({ onClose }) {
  const { login } = useAuth();
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [fait, setFait] = useState(false);

  const trop_court = nouveau.length > 0 && nouveau.length < 8;
  const different = confirmation.length > 0 && confirmation !== nouveau;
  const valide = actuel && nouveau.length >= 8 && confirmation === nouveau;

  async function soumettre(e) {
    e.preventDefault();
    setErreur(""); setEnvoi(true);
    try {
      const r = await api.changerMotDePasse({ MotDePasseActuel: actuel, NouveauMotDePasse: nouveau });
      login(r.token, r.user); // cet appareil reçoit un jeton neuf ; les autres sessions du compte sont fermées
      setFait(true);
    } catch (err) { setErreur(err.message); } finally { setEnvoi(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 440 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Changer mon mot de passe">
        <div className="row-flex" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}><KeyRound size={18} aria-hidden="true" /> Changer mon mot de passe</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>

        {fait ? (
          <>
            <div className="alert-strip info" role="status" style={{ margin: "12px 0" }}><Check size={16} aria-hidden="true" /><span>Mot de passe modifié. Vos autres sessions ouvertes ont été fermées.</span></div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}><button className="btn btn-primary" onClick={onClose}>Fermer</button></div>
          </>
        ) : (
          <form onSubmit={soumettre}>
            <div className="form-field" style={{ marginBottom: 10 }}>
              <label htmlFor="mdp-actuel">Mot de passe actuel</label>
              <input id="mdp-actuel" type="password" autoComplete="current-password" autoFocus value={actuel} onChange={(e) => setActuel(e.target.value)} />
            </div>
            <div className="form-field" style={{ marginBottom: 10 }}>
              <label htmlFor="mdp-nouveau">Nouveau mot de passe (8 caractères minimum)</label>
              <input id="mdp-nouveau" type="password" autoComplete="new-password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} />
              {trop_court && <span className="error-text" style={{ fontSize: "0.78rem" }}>Au moins 8 caractères.</span>}
            </div>
            <div className="form-field" style={{ marginBottom: 14 }}>
              <label htmlFor="mdp-confirm">Confirmer le nouveau mot de passe</label>
              <input id="mdp-confirm" type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
              {different && <span className="error-text" style={{ fontSize: "0.78rem" }}>Les deux mots de passe ne correspondent pas.</span>}
            </div>
            {erreur && <p className="error-text" role="alert" style={{ marginTop: 0 }}>{erreur}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
              <button type="submit" className="btn btn-primary" disabled={!valide || envoi}>{envoi ? "Enregistrement…" : "Changer le mot de passe"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
