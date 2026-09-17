/// <reference lib="webworker" />
// @ts-nocheck
// Service worker personnalisé (mode injectManifest de vite-plugin-pwa).
// Exclu du typecheck global (tsconfig.json) car les types "webworker" entrent
// en conflit avec les types "dom" utilisés par le reste de l'application.

import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

self.skipWaiting();

// ------------------------------------------------------------------
// 1. Coquille de l'application (JS/CSS/HTML/icônes) — mise en cache au
//    moment du build, pour un démarrage rapide et hors-ligne de l'interface.
// ------------------------------------------------------------------
precacheAndRoute(self.__WB_MANIFEST);

// ------------------------------------------------------------------
// 2. Lectures API (GET /api/...) — réseau d'abord, secours sur le cache
//    si hors-ligne. Permet de consulter les dernières données connues
//    (notes, élèves, paiements, emploi du temps, messages...) sans connexion.
// ------------------------------------------------------------------
registerRoute(
  ({ url, request }) => request.method === 'GET' && url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'edumanage-api-cache',
    networkTimeoutSeconds: 6,
    plugins: [
      new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  })
);

// ------------------------------------------------------------------
// 3. Écritures mises en file d'attente hors-ligne : Notes, Présences,
//    Paiements. Si la requête échoue faute de réseau, elle est stockée
//    et automatiquement rejouée à la reconnexion (Background Sync —
//    supporté par Chrome/Edge/Android ; sur Safari/iOS, la requête est
//    rejouée dès que l'application est rouverte en ligne, faute de
//    support natif de la Background Sync API par Apple).
//
//    Toute autre écriture (comptes, classes, matières, élèves, emploi du
//    temps, messages...) n'est PAS mise en file : elle échoue normalement
//    hors-ligne, avec un message clair côté application plutôt que de
//    risquer un envoi silencieux sur une donnée pouvant avoir changé.
// ------------------------------------------------------------------
const QUEUED_PREFIXES = ['/api/notes/', '/api/presences/', '/api/paiements/'];

const syncPlugin = new BackgroundSyncPlugin('edumanage-offline-writes', {
  maxRetentionTime: 24 * 60, // rejoue pendant 24h max, puis abandonne
});

const offlineWriteHandler = async (options) => {
  try {
    return await new NetworkOnly({ plugins: [syncPlugin] }).handle(options);
  } catch (err) {
    // La requête est déjà en file (le plugin l'a ajoutée avant de relancer
    // l'erreur) — on répond à la page par un succès "en attente" plutôt
    // que de laisser échouer l'appel fetch() de l'application.
    return new Response(JSON.stringify({ queued: true }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

registerRoute(
  ({ url, request }) =>
    (request.method === 'POST' || request.method === 'PATCH') &&
    QUEUED_PREFIXES.some(prefix => url.pathname.startsWith(prefix)),
  offlineWriteHandler,
  'POST'
);
registerRoute(
  ({ url, request }) =>
    (request.method === 'POST' || request.method === 'PATCH') &&
    QUEUED_PREFIXES.some(prefix => url.pathname.startsWith(prefix)),
  offlineWriteHandler,
  'PATCH'
);
