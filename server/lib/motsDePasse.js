// GESTION DES MOTS DE PASSE
//   Administrateur d'école : réinitialisé par le SUPERADMIN uniquement ; peut changer lui-même son mot de passe.
//   Enseignant             : réinitialisé par l'ADMINISTRATEUR de l'école uniquement (jamais par le superadmin) ;
//                            ne peut changer lui-même son mot de passe que si l'administrateur l'y autorise.
//   Caissier, élève, parent: réinitialisés par l'administrateur de l'école.
// Tout changement de mot de passe coupe les sessions ouvertes avant ce changement (voir lib/cycleDeVie.js).
const crypto = require("crypto");
const { query } = require("../db/pool");
const { hashPassword } = require("./auth");
const { invaliderCacheAcces } = require("./cycleDeVie");

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"; // sans caractères ambigus (0/O, 1/l/I)

// Mot de passe provisoire lisible et difficile à deviner (12 caractères, ~69 bits)
function genererMotDePasse(longueur = 12) {
  const octets = crypto.randomBytes(longueur);
  return Array.from(octets, (o) => ALPHABET[o % ALPHABET.length]).join("");
}

// Renvoie un message d'erreur, ou null si le nouveau mot de passe est acceptable
function validerNouveauMotDePasse(nouveau, { ancien = "", identifiant = "" } = {}) {
  const n = String(nouveau ?? "");
  if (n.length < 8) return "Le nouveau mot de passe doit contenir au moins 8 caractères.";
  if (n.length > 100) return "Le nouveau mot de passe est trop long (100 caractères au maximum).";
  if (n === ancien) return "Le nouveau mot de passe doit être différent de l'actuel.";
  if (identifiant && n.toLowerCase() === String(identifiant).toLowerCase()) return "Le mot de passe ne doit pas être identique à l'identifiant.";
  if (/^(.)\1+$/.test(n)) return "Choisissez un mot de passe moins évident (un seul caractère répété).";
  return null;
}

// Définit un nouveau mot de passe. `etablissementId` et `roles` restreignent les comptes concernés
// (un administrateur d'école ne peut viser que son école ; le superadmin que les administrateurs).
// Renvoie la ligne du compte modifié, ou null si aucun compte ne correspond.
async function definirMotDePasse({ userId, etablissementId = null, roles = null, motDePasse }) {
  const { hash, salt } = hashPassword(motDePasse);
  const construire = (avecDate) => {
    const params = [hash, salt, userId];
    let sql = `UPDATE utilisateurs SET mot_de_passe_hash = $1, mot_de_passe_sel = $2${avecDate ? ", mdp_modifie_le = now()" : ""} WHERE id = $3`;
    if (etablissementId !== null) { params.push(etablissementId); sql += ` AND etablissement_id = $${params.length}`; }
    if (roles) { params.push(roles); sql += ` AND role = ANY($${params.length}::text[])`; }
    return { sql: sql + " RETURNING id, identifiant, nom, role, etablissement_id, id_enseignant, id_eleve", params };
  };
  let r;
  try {
    const q = construire(true);
    r = await query(q.sql, q.params);
  } catch (err) {
    if (err.code !== "42703") throw err; // migration v5 non exécutée : le mot de passe change, mais sans coupure des anciennes sessions
    const q = construire(false);
    r = await query(q.sql, q.params);
  }
  invaliderCacheAcces();
  return r.rows[0] || null;
}

// Les enseignants de cette école ont-ils le droit de changer eux-mêmes leur mot de passe ?
async function profsPeuventChanger(etablissementId) {
  if (!etablissementId) return false;
  try {
    const r = await query("SELECT profs_changent_mdp FROM etablissements WHERE id = $1", [etablissementId]);
    return !!r.rows[0]?.profs_changent_mdp;
  } catch (err) {
    if (err.code === "42703") return false; // migration v5 non exécutée : réservé à l'administrateur
    throw err;
  }
}

module.exports = { genererMotDePasse, validerNouveauMotDePasse, definirMotDePasse, profsPeuventChanger };
