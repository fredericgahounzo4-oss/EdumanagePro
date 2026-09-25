// Point d'entrée Vercel : toutes les requêtes /api/* sont routées ici (voir vercel.json)
// et gérées par l'application Express, qui contient déjà toute la logique de routage interne.
module.exports = require("../server/app");
