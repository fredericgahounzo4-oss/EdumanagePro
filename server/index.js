// Point d'entrée pour le développement local (npm start).
// Sur Vercel, c'est api/index.js qui sert d'entrée (voir ce fichier pour plus de détails).
require("dotenv").config(); // charge automatiquement le fichier .env (local uniquement)
const path = require("path");
const express = require("express");
const app = require("./app");

// En local uniquement : sert aussi le frontend compilé (client/dist), pour un usage
// "tout-en-un" sans configuration Vercel (npm run build puis npm start suffit).
const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) res.status(200).send("SchoolManager Pro API en cours d'exécution. (build client manquant : lancez `npm run build` dans /client)");
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`SchoolManager Pro — serveur démarré sur http://localhost:${PORT}`);
});
