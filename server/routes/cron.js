const express = require("express");
const { appliquerCycleDeVie } = require("../lib/cycleDeVie");

const router = express.Router();

// Appelé chaque jour par Vercel Cron (voir vercel.json). Vercel envoie automatiquement l'en-tête
// "Authorization: Bearer <CRON_SECRET>" lorsque la variable d'environnement CRON_SECRET est définie.
// Sans CRON_SECRET, la route reste fermée.
router.get("/cycle-de-vie", async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: "Non autorisé" });
  const r = await appliquerCycleDeVie();
  res.json({ success: true, ...r });
});

module.exports = router;
