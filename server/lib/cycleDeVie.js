// CYCLE DE VIE D'UNE ÉCOLE
//   actif -> suspendu (superadmin, motif obligatoire) -> archive (automatique après 30 jours) -> supprimée (automatique après 1 an)
// Une école n'est jamais supprimée directement : ni par un administrateur, ni par le superadmin.
// Les données d'une école suspendue ou archivée restent intactes ; seul l'ACCÈS est coupé.
const { pool, query } = require("../db/pool");

const DELAI_SUSPENSION_JOURS = 30;   // avant fermeture automatique
const DUREE_ARCHIVE_JOURS = 365;     // conservation des données avant suppression définitive

const fr = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

async function journaliser(executeur, { etablissementId, nom, action, motif = "", auteur = "système", details = {} }) {
  await executeur.query(
    "INSERT INTO journal_ecoles (etablissement_id, nom_ecole, action, motif, auteur, details) VALUES ($1,$2,$3,$4,$5,$6::jsonb)",
    [etablissementId, nom || "", action, motif, auteur, JSON.stringify(details)]
  );
}

// ------------------------------------------------------------------------------------------------
// CONTRÔLE D'ACCÈS — appelé à CHAQUE requête d'un utilisateur d'école (voir lib/auth.js)
// Un jeton (JWT) reste valide jusqu'à son expiration : sans ce contrôle, une école suspendue ou fermée
// garderait l'accès de ses utilisateurs déjà connectés.
// ------------------------------------------------------------------------------------------------
const cache = new Map();
const TTL_MS = Number(process.env.ACCES_TTL_MS || 15000); // délai maximal avant qu'une suspension soit effective partout
const invaliderCacheAcces = () => cache.clear();

function corpsBlocage(e) {
  if (e.statut === "suspendu") {
    return {
      code: "ECOLE_SUSPENDUE", etablissement: e.nom, motif: e.motif_suspension || "", dateLimite: e.suppression_prevue_le,
      suspenduLe: e.suspendu_le,
      error: `Le compte de ${e.nom} est suspendu.${e.motif_suspension ? ` Motif : ${e.motif_suspension}.` : ""}` +
        (e.suppression_prevue_le ? ` Sans régularisation avant le ${fr(e.suppression_prevue_le)}, le compte sera fermé et archivé.` : "") +
        " Contactez l'administration de la plateforme.",
    };
  }
  return {
    code: "ECOLE_ARCHIVEE", etablissement: e.nom,
    error: `Le compte de ${e.nom} a été fermé et archivé. Contactez l'administration de la plateforme.`,
  };
}

// Renvoie { ok: true } ou { ok: false, status, corps }
// `iat` : date d'émission du jeton (secondes). Un jeton émis AVANT le dernier changement de mot de passe du compte est refusé.
async function controlerAcces({ etablissementId, id, iat }) {
  const cle = `${etablissementId}:${id}`;
  let entree = cache.get(cle);
  if (!entree || Date.now() - entree.t >= TTL_MS) {
    // Trois niveaux de requête : les colonnes des migrations v5 puis v4 peuvent ne pas encore exister
    const requetes = [
      `SELECT e.statut, e.nom, e.motif_suspension, e.suspendu_le, e.suppression_prevue_le,
              (SELECT COUNT(*) FROM utilisateurs u WHERE u.id = $2 AND u.etablissement_id = e.id)::int AS compte_ok,
              (SELECT floor(extract(epoch FROM u.mdp_modifie_le))::bigint FROM utilisateurs u WHERE u.id = $2) AS mdp_ts
       FROM etablissements e WHERE e.id = $1`,
      `SELECT e.statut, e.nom, e.motif_suspension, e.suspendu_le, e.suppression_prevue_le,
              (SELECT COUNT(*) FROM utilisateurs u WHERE u.id = $2 AND u.etablissement_id = e.id)::int AS compte_ok
       FROM etablissements e WHERE e.id = $1`,
      `SELECT CASE WHEN e.active THEN 'actif' ELSE 'suspendu' END AS statut, e.nom, '' AS motif_suspension, NULL AS suspendu_le, NULL AS suppression_prevue_le,
              (SELECT COUNT(*) FROM utilisateurs u WHERE u.id = $2 AND u.etablissement_id = e.id)::int AS compte_ok
       FROM etablissements e WHERE e.id = $1`,
    ];
    let r;
    for (let i = 0; i < requetes.length; i++) {
      try { r = await query(requetes[i], [etablissementId, id]); break; }
      catch (err) { if (err.code !== "42703" || i === requetes.length - 1) throw err; }
    }
    const e = r.rows[0];
    let v;
    if (!e) v = { ok: false, status: 403, corps: { code: "ECOLE_ARCHIVEE", error: "Ce compte n'existe plus : l'établissement a été fermé. Contactez l'administration de la plateforme." } };
    else if (e.statut !== "actif") v = { ok: false, status: 403, corps: corpsBlocage(e) };
    else if (!e.compte_ok) v = { ok: false, status: 401, corps: { error: "Ce compte a été supprimé" } };
    else v = { ok: true };
    entree = { t: Date.now(), v, mdpTs: e && e.mdp_ts ? Number(e.mdp_ts) : 0 };
    cache.set(cle, entree);
  }
  if (entree.v.ok && entree.mdpTs && iat && Number(iat) < entree.mdpTs) {
    return { ok: false, status: 401, corps: { code: "MOT_DE_PASSE_MODIFIE", error: "Votre mot de passe a été modifié : reconnectez-vous." } };
  }
  return entree.v;
}

// ------------------------------------------------------------------------------------------------
// TRANSITIONS (superadmin)
// ------------------------------------------------------------------------------------------------
function erreur(status, message) { const e = new Error(message); e.status = status; return e; }

async function ecoleParId(id) {
  const r = await query("SELECT id, nom, statut FROM etablissements WHERE id = $1", [id]);
  if (!r.rows[0]) throw erreur(404, "École introuvable");
  return r.rows[0];
}

async function suspendreEcole({ id, motif, auteur }) {
  const m = String(motif || "").trim();
  if (m.length < 5) throw erreur(400, "Indiquez le motif de la suspension (infraction constatée) : au moins 5 caractères.");
  const r = await query(
    `UPDATE etablissements SET statut = 'suspendu', active = false, suspendu_le = now(), motif_suspension = $2,
            suppression_prevue_le = now() + ($3 || ' days')::interval, archive_le = NULL, purge_prevue_le = NULL
     WHERE id = $1 AND statut = 'actif' RETURNING id, nom, suppression_prevue_le`,
    [id, m.slice(0, 500), String(DELAI_SUSPENSION_JOURS)]
  );
  if (!r.rows[0]) { const e = await ecoleParId(id); throw erreur(409, `Cette école est déjà ${e.statut === "suspendu" ? "suspendue" : "archivée"}.`); }
  await journaliser({ query }, { etablissementId: id, nom: r.rows[0].nom, action: "suspension", motif: m, auteur, details: { suppressionPrevueLe: r.rows[0].suppression_prevue_le } });
  invaliderCacheAcces();
  return r.rows[0];
}

async function reactiverEcole({ id, auteur }) {
  const r = await query(
    `UPDATE etablissements SET statut = 'actif', active = true, suspendu_le = NULL, motif_suspension = '', suppression_prevue_le = NULL
     WHERE id = $1 AND statut = 'suspendu' RETURNING id, nom`,
    [id]
  );
  if (!r.rows[0]) { const e = await ecoleParId(id); throw erreur(409, e.statut === "actif" ? "Cette école est déjà active." : "Une école archivée se restaure (elle n'est plus simplement suspendue)."); }
  await journaliser({ query }, { etablissementId: id, nom: r.rows[0].nom, action: "reactivation", auteur });
  invaliderCacheAcces();
  return r.rows[0];
}

async function restaurerEcole({ id, auteur }) {
  const r = await query(
    `UPDATE etablissements SET statut = 'actif', active = true, suspendu_le = NULL, motif_suspension = '', suppression_prevue_le = NULL,
            archive_le = NULL, purge_prevue_le = NULL
     WHERE id = $1 AND statut = 'archive' RETURNING id, nom`,
    [id]
  );
  if (!r.rows[0]) { await ecoleParId(id); throw erreur(409, "Seule une école archivée peut être restaurée."); }
  await journaliser({ query }, { etablissementId: id, nom: r.rows[0].nom, action: "restauration", auteur });
  invaliderCacheAcces();
  return r.rows[0];
}

// ------------------------------------------------------------------------------------------------
// TRANSITIONS AUTOMATIQUES — idempotent, appelé chaque jour par le cron Vercel, et aussi (au plus une fois
// par heure et par instance) à l'ouverture de la liste des écoles : rien n'est perdu si le cron n'est pas configuré.
// ------------------------------------------------------------------------------------------------
async function appliquerCycleDeVie() {
  const resultat = { archivees: [], purgees: [] };

  // 1) Suspendues depuis plus de 30 jours -> fermées et archivées (les données restent en place)
  const aArchiver = await query(
    `UPDATE etablissements SET statut = 'archive', active = false, archive_le = now(), purge_prevue_le = now() + ($1 || ' days')::interval
     WHERE statut = 'suspendu' AND suppression_prevue_le IS NOT NULL AND suppression_prevue_le <= now() RETURNING id, nom, purge_prevue_le`,
    [String(DUREE_ARCHIVE_JOURS)]
  );
  for (const e of aArchiver.rows) {
    await journaliser({ query }, { etablissementId: e.id, nom: e.nom, action: "archivage_auto", motif: `Aucune régularisation après ${DELAI_SUSPENSION_JOURS} jours de suspension`, details: { purgePrevueLe: e.purge_prevue_le } });
    resultat.archivees.push(e.nom);
  }

  // 2) Archivées depuis plus d'un an -> suppression définitive (double vérification des dates, en transaction)
  const candidates = await query(
    `SELECT id, nom FROM etablissements WHERE statut = 'archive' AND purge_prevue_le <= now() AND archive_le <= now() - ($1 || ' days')::interval`,
    [String(DUREE_ARCHIVE_JOURS)]
  );
  for (const e of candidates.rows) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await journaliser(client, { etablissementId: e.id, nom: e.nom, action: "purge", motif: `Fin de la conservation de ${DUREE_ARCHIVE_JOURS} jours en archives` });
      const d = await client.query(
        `DELETE FROM etablissements WHERE id = $1 AND statut = 'archive' AND purge_prevue_le <= now() AND archive_le <= now() - ($2 || ' days')::interval`,
        [e.id, String(DUREE_ARCHIVE_JOURS)]
      ); // toutes les tables de l'école sont supprimées en cascade
      if (d.rowCount === 0) { await client.query("ROLLBACK"); continue; }
      await client.query("COMMIT");
      resultat.purgees.push(e.nom);
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[cycle de vie] purge impossible pour", e.nom, err.message);
    } finally { client.release(); }
  }
  if (resultat.archivees.length || resultat.purgees.length) invaliderCacheAcces();
  return resultat;
}

let derniereExecution = 0;
async function appliquerCycleDeVieSiNecessaire(intervalleMs = 3600000) {
  if (Date.now() - derniereExecution < intervalleMs) return null;
  derniereExecution = Date.now();
  try { return await appliquerCycleDeVie(); } catch (err) { console.error("[cycle de vie]", err.message); return null; }
}

module.exports = {
  DELAI_SUSPENSION_JOURS, DUREE_ARCHIVE_JOURS, controlerAcces, corpsBlocage, invaliderCacheAcces,
  suspendreEcole, reactiverEcole, restaurerEcole, appliquerCycleDeVie, appliquerCycleDeVieSiNecessaire, journaliser,
};
