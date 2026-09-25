const express = require("express");
const { pool, query } = require("../db/pool");
const { calculerNote, listeEvals, arrondi2 } = require("../lib/calculs");
const { requireAuth, requireRole } = require("../lib/auth");
const { getAffectationsForUser, studentInScope, peutNoter } = require("../lib/scope");
const { getMatieresFor } = require("../lib/matieres");

const router = express.Router();
router.use(requireAuth, requireRole("Administrateur", "Enseignant"));

function toNoteJson(n) {
  const c = calculerNote({
    interro: n.interro, devoir: n.devoir, composition: n.composition,
    interros: n.interros, devoirs: n.devoirs, compositions: n.compositions, coefficient: n.coefficient,
  });
  return {
    ID: n.id, IDEleve: n.id_eleve, Matiere: n.matiere, Periode: n.periode, Interro: Number(n.interro),
    Devoir: Number(n.devoir), Composition: Number(n.composition), Coefficient: Number(n.coefficient),
    Interros: c.listes.interros, Devoirs: c.listes.devoirs, Compositions: c.listes.compositions,
    NoteClasse: arrondi2(c.noteClasse),
    NoteGenerale: Number(n.note_generale), NoteFinale: Number(n.note_finale),
    Professeur: n.professeur, Absences: n.absences,
  };
}

// Valide une note saisie : nombre entre 0 et 20
function valeurNote(v) {
  const n = Number(v);
  if (v === "" || v === null || v === undefined || !Number.isFinite(n) || n < 0 || n > 20) {
    const e = new Error("Une note doit être un nombre compris entre 0 et 20");
    e.status = 400;
    throw e;
  }
  return n;
}

// Colonnes calculées à enregistrer pour une ligne de notes (listes + moyennes + note générale/finale)
function colonnesCalculees({ interros, devoirs, compositions, coefficient, niveau }) {
  const c = calculerNote({ interros, devoirs, compositions, coefficient, niveau });
  return {
    interros: JSON.stringify(c.listes.interros), devoirs: JSON.stringify(c.listes.devoirs), compositions: JSON.stringify(c.listes.compositions),
    interro: arrondi2(c.moyInterros), devoir: arrondi2(c.moyDevoirs), composition: arrondi2(c.moyCompos),
    noteGenerale: arrondi2(c.noteGenerale), noteFinale: arrondi2(c.noteFinale),
  };
}

async function getEleve(id, etablissementId) {
  const r = await query(
    `SELECT id AS "ID", nom AS "Nom", prenom AS "Prenom", niveau AS "Niveau", classe AS "Classe", serie AS "Serie"
     FROM eleves WHERE id = $1 AND etablissement_id = $2`,
    [id, etablissementId]
  );
  return r.rows[0] || null;
}

async function checkAccess(req, res, idEleve) {
  const eleve = await getEleve(idEleve, req.user.etablissementId);
  if (!eleve) { res.status(404).json({ error: "Élève introuvable" }); return null; }
  const affectations = await getAffectationsForUser(req.user);
  if (!studentInScope(eleve, affectations)) {
    res.status(403).json({ error: "Vous n'êtes pas affecté à la classe de cet élève" });
    return null;
  }
  return eleve;
}

// ---------- Notes par élève (fiche élève) ----------

router.get("/", async (req, res) => {
  const { idEleve, periode } = req.query;
  if (idEleve && !(await checkAccess(req, res, idEleve))) return;
  const conditions = ["etablissement_id = $1"];
  const params = [req.user.etablissementId];
  if (idEleve) { params.push(idEleve); conditions.push(`id_eleve = $${params.length}`); }
  if (periode) { params.push(periode); conditions.push(`periode = $${params.length}`); }
  const r = await query(`SELECT * FROM notes WHERE ${conditions.join(" AND ")}`, params);
  res.json(r.rows.map(toNoteJson));
});

// Création d'une note : réservée aux enseignants (Module 4) — l'administrateur peut
// corriger une note existante (PUT) mais ne saisit pas les notes initiales lui-même.
router.post("/", requireRole("Enseignant"), async (req, res) => {
  const { IDEleve, Matiere, Periode, Interro, Devoir, Composition, Interros, Devoirs, Compositions, Coefficient, Professeur, Absences } = req.body;
  if (!IDEleve || !Matiere || !Periode) return res.status(400).json({ error: "IDEleve, Matiere et Periode sont requis" });
  const eleve = await checkAccess(req, res, IDEleve);
  if (!eleve) return;
  const affectations = await getAffectationsForUser(req.user);
  if (!peutNoter(affectations, { ...eleve, Matiere })) return res.status(403).json({ error: "Vous n'enseignez pas cette matière dans cette classe" });

  const liste = (arr, scal) => (Array.isArray(arr) ? arr.map(valeurNote) : (scal === undefined || scal === null || scal === "" ? [] : [valeurNote(scal)]));
  const col = colonnesCalculees({
    interros: liste(Interros, Interro), devoirs: liste(Devoirs, Devoir), compositions: liste(Compositions, Composition),
    coefficient: Coefficient, niveau: eleve.Niveau,
  });
  const r = await query(
    `INSERT INTO notes (etablissement_id, id_eleve, matiere, periode, interro, devoir, composition, interros, devoirs, compositions,
                        coefficient, note_generale, note_finale, professeur, absences)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12,$13,$14,$15)
     ON CONFLICT (etablissement_id, id_eleve, matiere, periode)
     DO UPDATE SET interro=EXCLUDED.interro, devoir=EXCLUDED.devoir, composition=EXCLUDED.composition,
       interros=EXCLUDED.interros, devoirs=EXCLUDED.devoirs, compositions=EXCLUDED.compositions,
       coefficient=EXCLUDED.coefficient, note_generale=EXCLUDED.note_generale, note_finale=EXCLUDED.note_finale,
       professeur=EXCLUDED.professeur, absences=EXCLUDED.absences
     RETURNING *`,
    [req.user.etablissementId, IDEleve, Matiere, Periode, col.interro, col.devoir, col.composition, col.interros, col.devoirs, col.compositions,
      Coefficient || 1, col.noteGenerale, col.noteFinale, Professeur || "", Absences || 0]
  );
  res.status(201).json(toNoteJson(r.rows[0]));
});

// Modification d'une note existante : Administrateur (correction) ou Enseignant
router.put("/:id", async (req, res) => {
  const existingRes = await query("SELECT * FROM notes WHERE id = $1 AND etablissement_id = $2", [req.params.id, req.user.etablissementId]);
  const existing = existingRes.rows[0];
  if (!existing) return res.status(404).json({ error: "Note introuvable" });
  const eleve = await checkAccess(req, res, existing.id_eleve);
  if (!eleve) return;
  const affectations = await getAffectationsForUser(req.user);
  if (!peutNoter(affectations, { ...eleve, Matiere: existing.matiere })) return res.status(403).json({ error: "Vous n'enseignez pas cette matière dans cette classe" });

  const b = req.body;
  // Une liste fournie remplace l'ancienne ; une valeur unique ne remplace la liste QUE si elle a changé
  // (évite d'écraser plusieurs interros quand on enregistre la fiche sans toucher à ce champ).
  const choisir = (liste, scalaire, actuelListe, actuelScalaire) => {
    if (Array.isArray(liste)) return liste.map(valeurNote);
    if (scalaire === undefined || scalaire === null || scalaire === "") return listeEvals(actuelListe, actuelScalaire);
    if (Number(scalaire) === Number(actuelScalaire)) return listeEvals(actuelListe, actuelScalaire);
    return [valeurNote(scalaire)];
  };
  const coefficient = b.Coefficient ?? existing.coefficient;
  const col = colonnesCalculees({
    interros: choisir(b.Interros, b.Interro, existing.interros, existing.interro),
    devoirs: choisir(b.Devoirs, b.Devoir, existing.devoirs, existing.devoir),
    compositions: choisir(b.Compositions, b.Composition, existing.compositions, existing.composition),
    coefficient, niveau: eleve.Niveau,
  });
  const r = await query(
    `UPDATE notes SET interro=$1, devoir=$2, composition=$3, interros=$4::jsonb, devoirs=$5::jsonb, compositions=$6::jsonb,
       coefficient=$7, note_generale=$8, note_finale=$9, professeur=$10, absences=$11
     WHERE id = $12 RETURNING *`,
    [col.interro, col.devoir, col.composition, col.interros, col.devoirs, col.compositions, coefficient, col.noteGenerale, col.noteFinale,
      b.Professeur ?? existing.professeur, b.Absences ?? existing.absences, req.params.id]
  );
  res.json(toNoteJson(r.rows[0]));
});

router.delete("/:id", async (req, res) => {
  const existingRes = await query("SELECT * FROM notes WHERE id = $1 AND etablissement_id = $2", [req.params.id, req.user.etablissementId]);
  const existing = existingRes.rows[0];
  if (!existing) return res.status(404).json({ error: "Note introuvable" });
  const eleve = await checkAccess(req, res, existing.id_eleve);
  if (!eleve) return;
  if (!peutNoter(await getAffectationsForUser(req.user), { ...eleve, Matiere: existing.matiere })) return res.status(403).json({ error: "Vous n'enseignez pas cette matière dans cette classe" });
  await query("DELETE FROM notes WHERE id = $1", [req.params.id]);
  res.json({ success: true });
});

// ---------- Feuille de notes collective (saisie par classe entière) ----------
// L'enseignant choisit Classe + Matière + Période + type d'évaluation (Interro / Devoir / Composition) et son
// NUMÉRO (Interro 1, Interro 2...). Chaque évaluation est une colonne de la feuille papier.
//   moyenne des interros = somme des interros / nombre d'interros données
//   note de classe       = (moyenne des interros + devoir) / 2
//   note générale        = (note de classe + composition) / 2

const CHAMPS = { Interro: "interros", Devoir: "devoirs", Composition: "compositions" };
const SCALAIRE = { interros: "interro", devoirs: "devoir", compositions: "composition" };

async function classeEtMatiere(req, { niveau, classe, serie, matiere }) {
  const affectations = await getAffectationsForUser(req.user);
  if (!peutNoter(affectations, { Niveau: niveau, Classe: classe, Serie: serie || "", Matiere: matiere })) {
    return { erreur: [403, "Vous n'êtes pas affecté à cette classe/matière"] };
  }
  const matieresConfig = await getMatieresFor({ etablissementId: req.user.etablissementId, niveau, classe, serie });
  const matiereInfo = matieresConfig.find((m) => m.Nom === matiere);
  if (!matiereInfo) return { erreur: [404, "Cette matière n'est pas configurée pour cette classe"] };
  return { matiereInfo };
}

// Classes et matières où l'utilisateur peut saisir des notes (alimente les listes déroulantes de la feuille)
router.get("/mes-classes", async (req, res) => {
  const affectations = await getAffectationsForUser(req.user);
  const elevesRes = await query(
    `SELECT DISTINCT niveau AS "Niveau", classe AS "Classe", serie AS "Serie" FROM eleves WHERE etablissement_id = $1`,
    [req.user.etablissementId]
  );
  const classes = [];
  for (const c of elevesRes.rows) {
    const mesLignes = affectations === null ? null : affectations.filter((a) => a.Niveau === c.Niveau && a.Classe === c.Classe && (!a.Serie || a.Serie === (c.Serie || "")));
    if (mesLignes !== null && mesLignes.length === 0) continue;
    const config = await getMatieresFor({ etablissementId: req.user.etablissementId, niveau: c.Niveau, classe: c.Classe, serie: c.Serie });
    const toutes = mesLignes === null || mesLignes.some((a) => !a.Matiere);
    const permises = toutes ? config.map((m) => m.Nom) : config.map((m) => m.Nom).filter((n) => mesLignes.some((a) => a.Matiere === n));
    if (permises.length) classes.push({ ...c, Serie: c.Serie || "", Matieres: permises, Titulaire: !!(mesLignes && mesLignes.some((a) => a.Titulaire)) });
  }
  classes.sort((a, b) => (a.Niveau + a.Classe + a.Serie).localeCompare(b.Niveau + b.Classe + b.Serie));
  res.json({ classes });
});

router.get("/feuille", async (req, res) => {
  const { niveau, classe, serie, matiere, periode } = req.query;
  if (!niveau || !classe || !matiere || !periode) {
    return res.status(400).json({ error: "Niveau, classe, matière et période sont requis" });
  }
  const { erreur, matiereInfo } = await classeEtMatiere(req, { niveau, classe, serie, matiere });
  if (erreur) return res.status(erreur[0]).json({ error: erreur[1] });

  const conditions = ["etablissement_id = $1", "niveau = $2", "classe = $3"];
  const params = [req.user.etablissementId, niveau, classe];
  if (serie) { params.push(serie); conditions.push(`serie = $${params.length}`); }

  const elevesRes = await query(
    `SELECT id AS "ID", nom AS "Nom", prenom AS "Prenom" FROM eleves
     WHERE ${conditions.join(" AND ")} ORDER BY nom, prenom`,
    params
  );
  const notesRes = await query(
    `SELECT * FROM notes WHERE etablissement_id = $1 AND matiere = $2 AND periode = $3 AND id_eleve = ANY($4::int[])`,
    [req.user.etablissementId, matiere, periode, elevesRes.rows.map((e) => e.ID)]
  );
  const notesByEleve = Object.fromEntries(notesRes.rows.map((n) => [n.id_eleve, n]));

  const nb = { Interro: 0, Devoir: 0, Composition: 0 };
  const eleves = elevesRes.rows.map((e) => {
    const n = notesByEleve[e.ID];
    const j = n ? toNoteJson(n) : null;
    if (j) { nb.Interro = Math.max(nb.Interro, j.Interros.length); nb.Devoir = Math.max(nb.Devoir, j.Devoirs.length); nb.Composition = Math.max(nb.Composition, j.Compositions.length); }
    return {
      ID: e.ID, Nom: e.Nom, Prenom: e.Prenom,
      Interros: j ? j.Interros : [], Devoirs: j ? j.Devoirs : [], Compositions: j ? j.Compositions : [],
      NoteClasse: j ? j.NoteClasse : "", NoteGenerale: j ? j.NoteGenerale : "",
    };
  });

  res.json({ matiere: matiereInfo, eleves, nombre: { Interro: nb.Interro, Devoir: nb.Devoir, Composition: nb.Composition } });
});

router.post("/feuille", requireRole("Enseignant"), async (req, res) => {
  const { Niveau, Classe, Serie, Matiere, Periode, Champ, Professeur, Valeurs, Action } = req.body;
  const Index = Number(req.body.Index || 1);
  if (!Niveau || !Classe || !Matiere || !Periode || !Champ) {
    return res.status(400).json({ error: "Niveau, classe, matière, période et type d'évaluation sont requis" });
  }
  if (!CHAMPS[Champ]) return res.status(400).json({ error: "Type d'évaluation invalide (Interro, Devoir ou Composition attendu)" });
  if (!Number.isInteger(Index) || Index < 1 || Index > 20) return res.status(400).json({ error: "Numéro d'évaluation invalide" });
  const supprimer = Action === "supprimer";
  if (!supprimer && !Array.isArray(Valeurs)) return res.status(400).json({ error: "Valeurs attendues" });

  const { erreur, matiereInfo } = await classeEtMatiere(req, { niveau: Niveau, classe: Classe, serie: Serie, matiere: Matiere });
  if (erreur) return res.status(erreur[0]).json({ error: erreur[1] });
  const coefficient = Number(matiereInfo.Coefficient);
  const cle = CHAMPS[Champ];

  // Contrôle des valeurs AVANT toute écriture : tout ou rien
  let saisies = new Map();
  if (!supprimer) {
    try {
      for (const { idEleve, valeur } of Valeurs) {
        if (valeur === "" || valeur === null || valeur === undefined) continue;
        saisies.set(Number(idEleve), valeurNote(valeur));
      }
    } catch (e) { return res.status(400).json({ error: e.message }); }
  }

  const conditions = ["etablissement_id = $1", "niveau = $2", "classe = $3"];
  const params = [req.user.etablissementId, Niveau, Classe];
  if (Serie) { params.push(Serie); conditions.push(`serie = $${params.length}`); }
  const classeEleves = (await query(`SELECT id FROM eleves WHERE ${conditions.join(" AND ")}`, params)).rows.map((e) => Number(e.id));
  for (const id of saisies.keys()) {
    if (!classeEleves.includes(id)) return res.status(400).json({ error: "Un élève ne fait pas partie de cette classe" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const lignes = (await client.query(
      "SELECT * FROM notes WHERE etablissement_id = $1 AND matiere = $2 AND periode = $3 AND id_eleve = ANY($4::int[])",
      [req.user.etablissementId, Matiere, Periode, classeEleves]
    )).rows;
    const parEleve = new Map(lignes.map((l) => [Number(l.id_eleve), l]));

    // Listes de travail de chaque élève pour ce type d'évaluation
    const travail = new Map();
    for (const id of classeEleves) {
      const l = parEleve.get(id);
      travail.set(id, l ? [...listeEvals(l[cle], l[SCALAIRE[cle]])] : []);
    }

    let modifies = 0;
    if (supprimer) {
      if (![...travail.values()].some((l) => l.length >= Index)) { const e = new Error("Cette évaluation n'existe pas"); e.status = 400; throw e; }
      for (const l of travail.values()) if (l.length >= Index) l.splice(Index - 1, 1);
    } else {
      for (const [id, v] of saisies) {
        const l = travail.get(id);
        while (l.length < Index) l.push(null);
        l[Index - 1] = v;
      }
    }
    // Toutes les listes de la classe ont la même longueur : une évaluation manquée compte pour 0
    const longueur = Math.max(0, ...[...travail.values()].map((l) => l.length));
    for (const l of travail.values()) while (l.length < longueur) l.push(null);

    for (const id of classeEleves) {
      const existing = parEleve.get(id);
      const liste = travail.get(id);
      if (!existing && !saisies.has(id)) continue; // pas de ligne de notes tant qu'aucune valeur n'est saisie
      const base = existing
        ? { interros: listeEvals(existing.interros, existing.interro), devoirs: listeEvals(existing.devoirs, existing.devoir), compositions: listeEvals(existing.compositions, existing.composition) }
        : { interros: [], devoirs: [], compositions: [] };
      base[cle] = liste;
      const col = colonnesCalculees({ ...base, coefficient, niveau: Niveau });
      if (existing) {
        await client.query(
          `UPDATE notes SET interro=$1, devoir=$2, composition=$3, interros=$4::jsonb, devoirs=$5::jsonb, compositions=$6::jsonb,
             coefficient=$7, note_generale=$8, note_finale=$9, professeur=COALESCE(NULLIF($10,''), professeur) WHERE id = $11`,
          [col.interro, col.devoir, col.composition, col.interros, col.devoirs, col.compositions, coefficient, col.noteGenerale, col.noteFinale, Professeur || "", existing.id]
        );
      } else {
        await client.query(
          `INSERT INTO notes (etablissement_id, id_eleve, matiere, periode, interro, devoir, composition, interros, devoirs, compositions,
                              coefficient, note_generale, note_finale, professeur)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12,$13,$14)`,
          [req.user.etablissementId, id, Matiere, Periode, col.interro, col.devoir, col.composition, col.interros, col.devoirs, col.compositions,
            coefficient, col.noteGenerale, col.noteFinale, Professeur || ""]
        );
      }
      modifies++;
    }
    await client.query("COMMIT");
    res.json({ success: true, count: supprimer ? modifies : saisies.size, modifies });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Erreur lors de l'enregistrement : " + err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
