import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";

// Ferme un menu déroulant au clic extérieur ou sur Échap
export function useClickOutside(ref, actif, onClose) {
  useEffect(() => {
    if (!actif) return undefined;
    const clic = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const touche = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", clic);
    document.addEventListener("keydown", touche);
    return () => { document.removeEventListener("mousedown", clic); document.removeEventListener("keydown", touche); };
  }, [ref, actif, onClose]);
}

// Compteurs de la barre latérale et de la cloche : interrogés toutes les 60 s et au retour sur l'onglet.
// Les erreurs réseau sont ignorées (mode hors connexion) : on garde la dernière valeur connue.
export function useCompteurs(user) {
  const [c, setC] = useState({ messages: 0, notifications: 0 });
  const actif = useRef(true);

  const rafraichir = useCallback(async () => {
    if (!user || user.role === "SuperAdmin" || !navigator.onLine) return;
    const [m, n] = await Promise.allSettled([api.getNonLus(), api.getNotifCompteur()]);
    if (!actif.current) return;
    setC((prev) => ({
      messages: m.status === "fulfilled" ? m.value.nonLus : prev.messages,
      notifications: n.status === "fulfilled" ? n.value.nonLues : prev.notifications,
    }));
  }, [user]);

  useEffect(() => {
    actif.current = true;
    rafraichir();
    const id = setInterval(rafraichir, 60000);
    const visible = () => { if (document.visibilityState === "visible") rafraichir(); };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("online", rafraichir);
    return () => { actif.current = false; clearInterval(id); document.removeEventListener("visibilitychange", visible); window.removeEventListener("online", rafraichir); };
  }, [rafraichir]);

  return { ...c, rafraichir };
}

// Charge des données avec gestion d'erreur et rechargement : { data, erreur, chargement, recharger }
export function useChargement(fn, deps) {
  const [etat, setEtat] = useState({ data: null, erreur: "", chargement: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let annule = false;
    setEtat((e) => ({ ...e, chargement: true, erreur: "" }));
    Promise.resolve().then(fn)
      .then((data) => { if (!annule) setEtat({ data, erreur: "", chargement: false }); })
      .catch((err) => { if (!annule) setEtat({ data: null, erreur: err.message || "Erreur", chargement: false }); });
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...etat, recharger: () => setTick((t) => t + 1) };
}

// Classes où l'enseignant connecté peut noter, et lesquelles il tient en tant que TITULAIRE.
// (Pour un administrateur : tout est autorisé, la liste n'est pas chargée.)
export function useMesClasses(user) {
  const [classes, setClasses] = useState(null);
  useEffect(() => {
    if (!user || user.role !== "Enseignant") { setClasses([]); return; }
    api.getMesClassesNotes().then((r) => setClasses(r.classes)).catch(() => setClasses([]));
  }, [user]);
  const titulaireDe = (niveau, classe, serie = "") =>
    !!user && (user.role === "Administrateur" ||
      (classes || []).some((c) => c.Titulaire && c.Niveau === niveau && c.Classe === classe && (!serie || c.Serie === serie || !c.Serie)));
  return { classes, estTitulaire: (classes || []).some((c) => c.Titulaire), titulaireDe };
}
