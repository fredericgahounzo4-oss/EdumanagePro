const express = require("express");
const { query } = require("../db/pool");
const { requireAuth } = require("../lib/auth");

const router = express.Router();
router.use(requireAuth);

// La cloche réunit deux sources, sans doublon :
//  - la table `notifications` (absences, examens, encaissements...)  -> id "n:<id>"
//  - les messages système de type 'Notification' déjà envoyés aux parents (ex : reçu de paiement) -> id "m:<id>"
// Les messages ordinaires de la messagerie n'y figurent pas : ils ont leur propre pastille dans le menu.

router.get("/", async (req, res) => {
  if (!req.user.etablissementId) return res.json({ items: [], nonLues: 0 });
  const uid = req.user.id;

  let notifs = [];
  try {
    const n = await query(
      `SELECT id, type, titre, message, lien, lu, created_at FROM notifications
       WHERE id_utilisateur = $1 ORDER BY created_at DESC LIMIT 100`,
      [uid]
    );
    notifs = n.rows.map((x) => ({
      id: `n:${x.id}`, source: "notification", type: x.type, titre: x.titre,
      message: x.message, lien: x.lien, lu: x.lu, date: x.created_at,
    }));
  } catch (err) {
    // Table absente (migration non exécutée) : on continue avec les messages système seulement
    console.error("[notifications] table indisponible :", err.message);
  }

  const m = await query(
    `SELECT id, sujet, corps, lu, envoye_le FROM messages
     WHERE destinataire_id = $1 AND type = 'Notification' ORDER BY envoye_le DESC LIMIT 50`,
    [uid]
  );
  const systeme = m.rows.map((x) => ({
    id: `m:${x.id}`, source: "message", type: "info", titre: x.sujet || "Notification",
    message: x.corps, lien: "/messagerie", lu: x.lu, date: x.envoye_le,
  }));

  const items = [...notifs, ...systeme]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 100);
  res.json({ items, nonLues: items.filter((i) => !i.lu).length });
});

// Compteur léger, interrogé régulièrement pour la pastille de la cloche
router.get("/compteur", async (req, res) => {
  if (!req.user.etablissementId) return res.json({ nonLues: 0 });
  let total = 0;
  try {
    const n = await query("SELECT COUNT(*)::int AS c FROM notifications WHERE id_utilisateur = $1 AND lu = false", [req.user.id]);
    total += n.rows[0].c;
  } catch { /* table absente */ }
  const m = await query(
    "SELECT COUNT(*)::int AS c FROM messages WHERE destinataire_id = $1 AND type = 'Notification' AND lu = false",
    [req.user.id]
  );
  total += m.rows[0].c;
  res.json({ nonLues: total });
});

router.post("/tout-lu", async (req, res) => {
  try { await query("UPDATE notifications SET lu = true WHERE id_utilisateur = $1 AND lu = false", [req.user.id]); } catch { /* table absente */ }
  await query("UPDATE messages SET lu = true WHERE destinataire_id = $1 AND type = 'Notification' AND lu = false", [req.user.id]);
  res.json({ success: true });
});

function parseId(raw) {
  const [source, id] = String(raw).split(":");
  if ((source !== "n" && source !== "m") || !/^\d+$/.test(id || "")) return null;
  return { source, id: Number(id) };
}

router.post("/:id/lu", async (req, res) => {
  const p = parseId(req.params.id);
  if (!p) return res.status(400).json({ error: "Identifiant invalide" });
  const r = p.source === "n"
    ? await query("UPDATE notifications SET lu = true WHERE id = $1 AND id_utilisateur = $2", [p.id, req.user.id])
    : await query("UPDATE messages SET lu = true WHERE id = $1 AND destinataire_id = $2 AND type = 'Notification'", [p.id, req.user.id]);
  if (r.rowCount === 0) return res.status(404).json({ error: "Notification introuvable" });
  res.json({ success: true });
});

router.delete("/:id", async (req, res) => {
  const p = parseId(req.params.id);
  if (!p || p.source !== "n") return res.status(400).json({ error: "Seules les notifications de la cloche peuvent être supprimées" });
  const r = await query("DELETE FROM notifications WHERE id = $1 AND id_utilisateur = $2", [p.id, req.user.id]);
  if (r.rowCount === 0) return res.status(404).json({ error: "Notification introuvable" });
  res.json({ success: true });
});

module.exports = router;
