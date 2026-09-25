// Rappels locaux avant chaque cours pour les enseignants.
//
// Limite technique à connaître : une alerte garantie téléphone éteint ou application
// totalement fermée n'existe pas sur le web sans serveur de notifications push (qui
// nécessite lui-même une connexion au moment de l'envoi). Ce module fait le maximum
// possible côté navigateur : l'emploi du temps est mis en cache à la première connexion,
// puis les rappels sont déclenchés localement — donc sans connexion — tant que
// l'application reste ouverte ou installée sur l'écran d'accueil (PWA en arrière-plan).

const CACHE_KEY = "smp_mon_emploi_cache";
const NOTIFIED_PREFIX = "smp_notified_";
const MINUTES_AVANT = 10;
const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export function cacheSchedule(entries) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ entries, savedAt: Date.now() })); } catch { /* quota atteint */ }
}

export function getCachedSchedule() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission() {
  return notificationsSupported() ? Notification.permission : "unsupported";
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return "unsupported";
  return Notification.requestPermission();
}

function afficherNotification(titre, corps) {
  const opts = { body: corps, tag: titre, requireInteraction: false };
  if (navigator.serviceWorker && navigator.serviceWorker.ready) {
    navigator.serviceWorker.ready
      .then((reg) => { if (reg.showNotification) reg.showNotification(titre, opts); else new Notification(titre, opts); })
      .catch(() => { try { new Notification(titre, opts); } catch { /* ignore */ } });
  } else {
    try { new Notification(titre, opts); } catch { /* ignore */ }
  }
}

function dejaNotifieAujourdhui(id) {
  return localStorage.getItem(NOTIFIED_PREFIX + id) === new Date().toDateString();
}

function marquerNotifie(id) {
  localStorage.setItem(NOTIFIED_PREFIX + id, new Date().toDateString());
}

function verifierEtNotifier(entries) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  const now = new Date();
  const jour = JOURS[now.getDay()];
  const minutesNow = now.getHours() * 60 + now.getMinutes();

  for (const e of entries) {
    if (e.Jour !== jour) continue;
    const [h, m] = String(e.HeureDebut).split(":").map(Number);
    const diff = (h * 60 + m) - minutesNow;
    if (diff >= 0 && diff <= MINUTES_AVANT && !dejaNotifieAujourdhui(e.ID)) {
      const classe = `${e.Classe}${e.Serie ? " " + e.Serie : ""}`;
      afficherNotification(
        "Cours dans " + diff + " min",
        `${e.Matiere} en ${classe} à ${e.HeureDebut}${e.Salle ? ` — ${e.Salle}` : ""}.`
      );
      marquerNotifie(e.ID);
    }
  }
}

let intervalId = null;

export function startReminderLoop(fetchLatest) {
  stopReminderLoop();
  async function tick() {
    let entries = null;
    try {
      entries = await fetchLatest();
      if (entries) cacheSchedule(entries);
    } catch {
      const cache = getCachedSchedule();
      entries = cache ? cache.entries : null;
    }
    if (entries) verifierEtNotifier(entries);
  }
  tick();
  intervalId = setInterval(tick, 30000);
}

export function stopReminderLoop() {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}
