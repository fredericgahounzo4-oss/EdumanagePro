// Express 4 n'intercepte pas les erreurs des routes asynchrones : une erreur (base indisponible, donnée absente...)
// laisse la requête SANS RÉPONSE jusqu'au délai d'expiration du serveur (erreur 504 chez l'utilisateur).
// Ce correctif transmet ces erreurs au gestionnaire d'erreurs de app.js, qui répond proprement en JSON.
// (Équivalent du paquet "express-async-errors", sans dépendance supplémentaire.)
const Layer = require("express/lib/router/layer");

Layer.prototype.handle_request = function handleRequest(req, res, next) {
  const fn = this.handle;
  if (fn.length > 3) return next(); // gestionnaire d'erreurs : ignoré ici
  try {
    const retour = fn(req, res, next);
    if (retour && typeof retour.catch === "function") retour.catch(next);
  } catch (err) {
    next(err);
  }
};
