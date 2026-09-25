const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { controlerAcces } = require("./cycleDeVie");

// Clé de signature JWT — en production (Vercel), définir JWT_SECRET en variable d'environnement
// pour que la session reste valide entre les redéploiements et les différentes instances serverless.
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me-in-production";

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  const check = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(check), Buffer.from(hash));
}

// payload : { id, identifiant, nom, role, etablissementId }
function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "12h" });
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  // Accepte aussi un token en query string (?token=...) pour les liens ouverts dans un nouvel onglet
  // (téléchargement du bulletin PDF, export Excel, logo).
  const token = header.startsWith("Bearer ") ? header.slice(7) : (req.query.token || null);
  if (!token) return res.status(401).json({ error: "Authentification requise" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Session invalide ou expirée" });
  }
  // Un jeton reste valide jusqu'à son expiration : on vérifie donc, à CHAQUE requête, que l'école de l'utilisateur
  // est toujours active (ni suspendue, ni archivée, ni supprimée) et que son compte existe encore.
  if (req.user.role === "SuperAdmin" || !req.user.etablissementId) return next();
  try {
    const acces = await controlerAcces(req.user);
    if (!acces.ok) return res.status(acces.status).json(acces.corps);
  } catch (err) {
    console.error("[auth] contrôle d'accès impossible :", err.message);
    return res.status(503).json({ error: "Service momentanément indisponible. Réessayez dans un instant." });
  }
  next();
}

// Restreint l'accès à une liste de rôles autorisés : 'SuperAdmin' | 'Administrateur' | 'Enseignant'
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Action non autorisée pour votre rôle" });
    }
    next();
  };
}

// Pour les routes propres à une école : s'assure que l'utilisateur est bien rattaché
// à un établissement (le SuperAdmin, qui n'en a pas, ne peut pas accéder à ces routes).
function requireEtablissement(req, res, next) {
  if (!req.user.etablissementId) {
    return res.status(403).json({ error: "Ce compte n'est rattaché à aucun établissement" });
  }
  next();
}

module.exports = {
  hashPassword, verifyPassword, createToken, requireAuth, requireRole, requireEtablissement,
};
