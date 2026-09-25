/* Service worker de SchoolManager Pro
 *
 * Deux rôles :
 * 1. Mettre en cache l'application (HTML/CSS/JS) pour qu'elle s'ouvre sans connexion.
 * 2. Mettre en cache les dernières données consultées (listes d'élèves, matières...)
 *    afin qu'elles restent lisibles hors connexion.
 *
 * Les écritures faites hors connexion (notes, présences) sont mises en file d'attente
 * côté application (voir src/lib/offline.js) puis rejouées au retour du réseau.
 */

// Versions incrémentées à chaque évolution majeure : l'ancien cache est purgé à l'activation.
const CACHE_APP = "smp-app-v2";
const CACHE_DATA = "smp-data-v2";

// Requêtes GET dont la dernière réponse est conservée pour consultation hors connexion
const DATA_CACHEABLE = [
  "/api/students", "/api/matieres", "/api/timetable", "/api/settings",
  "/api/results", "/api/dashboard", "/api/exams", "/api/teachers",
  "/api/classes", "/api/stats", "/api/attendance/appel",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_APP).then((c) => c.addAll(["/", "/index.html"]).catch(() => {})));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(noms.filter((n) => n !== CACHE_APP && n !== CACHE_DATA).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // les écritures passent par la file d'attente applicative

  const url = new URL(request.url);

  if (url.pathname.startsWith("/api/")) {
    const cacheable = DATA_CACHEABLE.some((p) => url.pathname.startsWith(p));
    if (!cacheable) return;
    // Réseau d'abord (données fraîches), cache en secours si hors connexion
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copie = res.clone();
          caches.open(CACHE_DATA).then((c) => c.put(request, copie)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || new Response(
          JSON.stringify({ error: "Hors connexion et aucune donnée en cache" }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        )))
    );
    return;
  }

  // Pages (HTML) : RÉSEAU D'ABORD. Sans cela, index.html resterait figé dans le cache et les utilisateurs
  // ne recevraient jamais les nouvelles versions de l'application après un déploiement.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copie = res.clone();
          caches.open(CACHE_APP).then((c) => c.put("/index.html", copie)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("/index.html").then((r) => r || caches.match("/")))
    );
    return;
  }

  // Ressources de l'application (JS/CSS versionnés par leur nom) : cache d'abord pour un démarrage instantané hors connexion
  event.respondWith(
    caches.match(request).then((cached) =>
      cached || fetch(request).then((res) => {
        if (res.ok && (request.destination === "document" || request.destination === "script" || request.destination === "style")) {
          const copie = res.clone();
          caches.open(CACHE_APP).then((c) => c.put(request, copie)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match("/index.html"))
    )
  );
});

// Permet à l'application de demander au service worker de vider les caches (déconnexion)
self.addEventListener("message", (event) => {
  if (event.data === "vider-cache-donnees") caches.delete(CACHE_DATA);
});
