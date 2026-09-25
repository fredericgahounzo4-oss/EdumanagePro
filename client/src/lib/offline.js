// File d'attente des écritures effectuées hors connexion.
//
// Principe : quand une requête d'écriture (saisie de notes, présences...) échoue faute
// de réseau, elle est stockée localement ; dès que la connexion revient, les opérations
// sont rejouées dans l'ordre. L'utilisateur peut donc continuer à travailler en classe
// même sans internet, à condition d'avoir ouvert l'application au moins une fois avec
// connexion (pour disposer des listes d'élèves et de son jeton de session).

const QUEUE_KEY = "smp_file_attente";

function lireFile() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); } catch { return []; }
}

function ecrireFile(file) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(file)); } catch { /* quota atteint */ }
}

export function tailleFileAttente() {
  return lireFile().length;
}

export function ajouterAFile(operation) {
  const file = lireFile();
  file.push({ ...operation, id: Date.now() + Math.random(), creeLe: new Date().toISOString() });
  ecrireFile(file);
  notifierChangement();
}

export function viderFileAttente() {
  ecrireFile([]);
  notifierChangement();
}

const abonnes = new Set();
export function surChangementFile(cb) {
  abonnes.add(cb);
  return () => abonnes.delete(cb);
}
function notifierChangement() {
  const n = tailleFileAttente();
  abonnes.forEach((cb) => { try { cb(n); } catch { /* ignore */ } });
}

// Rejoue les opérations en attente. Retourne { envoyees, echouees }.
export async function synchroniser() {
  const file = lireFile();
  if (file.length === 0) return { envoyees: 0, echouees: 0 };

  const token = localStorage.getItem("smp_token");
  if (!token) return { envoyees: 0, echouees: file.length };

  const restantes = [];
  let envoyees = 0;

  for (const op of file) {
    try {
      const res = await fetch(op.url, {
        method: op.method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: op.body ? JSON.stringify(op.body) : undefined,
      });
      if (res.ok) {
        envoyees++;
      } else if (res.status >= 400 && res.status < 500) {
        // Rejet définitif (droits, donnée invalide) : inutile de réessayer indéfiniment
        envoyees++;
      } else {
        restantes.push(op);
      }
    } catch {
      restantes.push(op); // toujours hors connexion : on retente plus tard
    }
  }

  ecrireFile(restantes);
  notifierChangement();
  return { envoyees, echouees: restantes.length };
}

// Démarre la synchronisation automatique dès que la connexion revient
export function demarrerSynchroAuto() {
  const tenter = () => { if (navigator.onLine) synchroniser(); };
  window.addEventListener("online", tenter);
  const timer = setInterval(tenter, 60000);
  tenter();
  return () => {
    window.removeEventListener("online", tenter);
    clearInterval(timer);
  };
}

export function estHorsLigne() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}
