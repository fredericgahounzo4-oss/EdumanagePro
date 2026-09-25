import { useEffect, useMemo, useState, useCallback } from "react";
import { Building2, AlertTriangle, Download, Users, RefreshCw, Clock, FileText, Info } from "lucide-react";
import { api } from "../api";
import { usePrefs } from "../PrefsContext";
import { PageHeader, Panel, EmptyState, Skeleton } from "../components/ui";

const EMPTY = {
  Nom: "", Type: "Prive", NiveauxActifs: ["Primaire", "College", "Lycee"],
  AdminNom: "", AdminIdentifiant: "", AdminMotDePasse: "",
};
const NIVEAUX = ["Primaire", "College", "Lycee"];
const ACTIONS = {
  suspension: ["Suspension", "badge-alert"], reactivation: ["Réactivation", "badge-sage"], archivage_auto: ["Fermeture automatique", "badge-brass"],
  restauration: ["Restauration", "badge-sage"], purge: ["Suppression définitive", "badge-neutral"],
};

// Gestion des écoles par le superadmin.
// UNE ÉCOLE NE SE SUPPRIME JAMAIS DIRECTEMENT : suspension (motif) -> fermeture automatique après 30 jours
// -> archives (données conservées 1 an) -> suppression définitive automatique.
export default function Ecoles() {
  const { locale } = usePrefs();
  const [ecoles, setEcoles] = useState(null);
  const [regles, setRegles] = useState({ delaiSuspensionJours: 30, dureeArchiveJours: 365 });
  const [journal, setJournal] = useState(null);
  const [onglet, setOnglet] = useState("actives");
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [aSuspendre, setASuspendre] = useState(null);
  const [motif, setMotif] = useState("");
  const [erreurSuspension, setErreurSuspension] = useState("");
  const [detailEcole, setDetailEcole] = useState(null);
  const [comptes, setComptes] = useState([]);
  const [resetResult, setResetResult] = useState(null);

  const date = (d) => (d ? new Date(d).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) : "—");
  const charger = useCallback(() => {
    api.getEcoles().then(setEcoles).catch((e) => setError(e.message));
    api.getReglesEcoles().then(setRegles).catch(() => {});
    api.getJournalEcoles().then(setJournal).catch(() => setJournal([]));
  }, []);
  useEffect(charger, [charger]);

  const parStatut = useMemo(() => {
    const l = ecoles || [];
    return { actives: l.filter((e) => e.Statut === "actif"), suspendues: l.filter((e) => e.Statut === "suspendu"), archives: l.filter((e) => e.Statut === "archive") };
  }, [ecoles]);

  function toggleNiveau(n) {
    setForm((f) => ({ ...f, NiveauxActifs: f.NiveauxActifs.includes(n) ? f.NiveauxActifs.filter((x) => x !== n) : [...f.NiveauxActifs, n] }));
  }
  async function submit(e) {
    e.preventDefault();
    if (form.NiveauxActifs.length === 0) return alert("Choisissez au moins un niveau enseigné par cette école.");
    try { await api.createEcole(form); setForm(EMPTY); setModalOpen(false); charger(); } catch (err) { alert(err.message); }
  }

  async function confirmerSuspension() {
    setErreurSuspension("");
    try { await api.suspendreEcole(aSuspendre.ID, motif); setASuspendre(null); setMotif(""); setOnglet("suspendues"); charger(); }
    catch (err) { setErreurSuspension(err.message); }
  }
  async function reactiver(e) {
    if (!window.confirm(`Réactiver « ${e.Nom} » ? Ses utilisateurs retrouvent l'accès immédiatement.`)) return;
    try { await api.reactiverEcole(e.ID); setOnglet("actives"); charger(); } catch (err) { alert(err.message); }
  }
  async function restaurer(e) {
    if (!window.confirm(`Restaurer « ${e.Nom} » ? Le compte et toutes ses données redeviennent actifs.`)) return;
    try { await api.restaurerEcole(e.ID); setOnglet("actives"); charger(); } catch (err) { alert(err.message); }
  }

  async function openDetail(ecole) {
    setDetailEcole(ecole); setResetResult(null);
    setComptes(await api.getEcoleComptes(ecole.ID));
  }
  async function resetPassword(userId) {
    try { setResetResult(await api.reinitialiserCompteEcole(detailEcole.ID, userId)); } catch (err) { alert(err.message); }
  }

  const lienExport = (e) => <a className="btn btn-ghost btn-sm" href={api.exportEcoleUrl(e.ID)} title="Télécharger toutes les données de l'école (Excel)"><Download size={14} aria-hidden="true" /> Exporter</a>;
  const compteurs = (e) => `${e.comptes.Administrateur} adm. · ${e.comptes.Enseignant} ens. · ${e.comptes.Eleve} élèves`;

  return (
    <div>
      <PageHeader eyebrow="Plateforme SchoolManager Pro" title="Écoles"
        subtitle="Chaque école a ses propres comptes, élèves et données — totalement isolés des autres écoles."
        actions={<button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ Ajouter une école</button>} />

      <div className="alert-strip info" role="note">
        <Info size={18} aria-hidden="true" />
        <span className="grow">
          <b>Une école ne se supprime jamais directement.</b> En cas d'infraction, suspendez-la : l'accès de tous ses comptes est coupé immédiatement.
          Sans régularisation sous {regles.delaiSuspensionJours} jours, elle est <b>fermée et archivée automatiquement</b> ; ses données sont conservées
          {" "}{Math.round(regles.dureeArchiveJours / 365)} an, puis supprimées définitivement.
        </span>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="tabs" role="tablist">
        {[["actives", `Actives (${parStatut.actives.length})`], ["suspendues", `Suspendues (${parStatut.suspendues.length})`],
          ["archives", `Archives (${parStatut.archives.length})`], ["journal", "Journal"]].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={onglet === id} className={"tab" + (onglet === id ? " active" : "")} onClick={() => setOnglet(id)}>{label}</button>
        ))}
      </div>

      {!ecoles && !error && <Skeleton height={200} />}

      {ecoles && onglet === "actives" && (
        <Panel>
          {parStatut.actives.length === 0 ? <EmptyState icon={Building2} text="Aucune école active." /> : (
            <div className="table-wrap"><table>
              <thead><tr><th>École</th><th>Type</th><th>Élèves</th><th>Comptes</th><th>Créée le</th><th></th></tr></thead>
              <tbody>
                {parStatut.actives.map((e) => (
                  <tr key={e.ID}>
                    <td><b>{e.Nom}</b></td>
                    <td><span className="badge badge-neutral">{e.Type}</span></td>
                    <td className="mono">{e.effectifTotal}</td>
                    <td className="muted" style={{ fontSize: "0.82rem" }}>{compteurs(e)}</td>
                    <td className="muted">{date(e.CreatedAt)}</td>
                    <td style={{ textAlign: "right" }}>
                      <div className="row-flex" style={{ justifyContent: "flex-end", gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openDetail(e)}><Users size={14} aria-hidden="true" /> Comptes</button>
                        <button className="btn btn-danger btn-sm" onClick={() => { setASuspendre(e); setMotif(""); setErreurSuspension(""); }}><AlertTriangle size={14} aria-hidden="true" /> Suspendre</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </Panel>
      )}

      {ecoles && onglet === "suspendues" && (
        <Panel>
          {parStatut.suspendues.length === 0 ? <EmptyState icon={AlertTriangle} text="Aucune école suspendue." /> : (
            <div className="table-wrap"><table>
              <thead><tr><th>École</th><th>Motif de la suspension</th><th>Suspendue le</th><th>Fermeture automatique</th><th></th></tr></thead>
              <tbody>
                {parStatut.suspendues.map((e) => (
                  <tr key={e.ID}>
                    <td><b>{e.Nom}</b></td>
                    <td style={{ maxWidth: 320, whiteSpace: "normal" }}>{e.MotifSuspension || "—"}</td>
                    <td className="muted">{date(e.SuspenduLe)}</td>
                    <td>
                      <span className={"badge " + (e.JoursAvantFermeture <= 7 ? "badge-alert" : "badge-brass")}><Clock size={11} aria-hidden="true" /> dans {e.JoursAvantFermeture} j</span>
                      <div className="muted" style={{ fontSize: "0.74rem", marginTop: 3 }}>le {date(e.SuppressionPrevueLe)}</div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="row-flex" style={{ justifyContent: "flex-end", gap: 6 }}>
                        <button className="btn btn-primary btn-sm" onClick={() => reactiver(e)}><RefreshCw size={14} aria-hidden="true" /> Réactiver</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => openDetail(e)}><Users size={14} aria-hidden="true" /> Comptes</button>
                        {lienExport(e)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </Panel>
      )}

      {ecoles && onglet === "archives" && (
        <Panel title="Archives" subtitle={`Écoles fermées : plus aucun accès, données conservées ${Math.round(regles.dureeArchiveJours / 365)} an avant suppression définitive.`}>
          {parStatut.archives.length === 0 ? <EmptyState icon={Building2} text="Aucune école archivée." /> : (
            <div className="table-wrap"><table>
              <thead><tr><th>École</th><th>Archivée le</th><th>Suppression définitive</th><th>Contenu conservé</th><th></th></tr></thead>
              <tbody>
                {parStatut.archives.map((e) => (
                  <tr key={e.ID}>
                    <td><b>{e.Nom}</b></td>
                    <td className="muted">{date(e.ArchiveLe)}</td>
                    <td>
                      <span className={"badge " + (e.JoursAvantPurge <= 30 ? "badge-alert" : "badge-neutral")}>dans {e.JoursAvantPurge} j</span>
                      <div className="muted" style={{ fontSize: "0.74rem", marginTop: 3 }}>le {date(e.PurgePrevueLe)}</div>
                    </td>
                    <td className="muted" style={{ fontSize: "0.82rem" }}>{e.effectifTotal} élève(s) · {compteurs(e)}</td>
                    <td style={{ textAlign: "right" }}>
                      <div className="row-flex" style={{ justifyContent: "flex-end", gap: 6 }}>
                        <button className="btn btn-primary btn-sm" onClick={() => restaurer(e)}><RefreshCw size={14} aria-hidden="true" /> Restaurer</button>
                        {lienExport(e)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </Panel>
      )}

      {onglet === "journal" && (
        <Panel title="Journal" subtitle="Trace permanente : conservée même après la suppression définitive d'une école.">
          {!journal ? <div className="card-body"><Skeleton height={80} /></div> : journal.length === 0 ? <EmptyState icon={FileText} text="Aucun évènement pour le moment." /> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Date</th><th>École</th><th>Évènement</th><th>Motif</th><th>Par</th></tr></thead>
              <tbody>
                {journal.map((j) => {
                  const [libelle, classe] = ACTIONS[j.Action] || [j.Action, "badge-neutral"];
                  return (
                    <tr key={j.ID}>
                      <td className="muted mono" style={{ fontSize: "0.78rem" }}>{new Date(j.Date).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</td>
                      <td><b>{j.Ecole}</b></td>
                      <td><span className={"badge " + classe}>{libelle}</span></td>
                      <td style={{ maxWidth: 340, whiteSpace: "normal" }}>{j.Motif || "—"}</td>
                      <td className="muted">{j.Auteur}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </Panel>
      )}

      {aSuspendre && (
        <div className="modal-backdrop" onClick={() => setASuspendre(null)}>
          <div className="modal" style={{ width: 520 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3>Suspendre « {aSuspendre.Nom} »</h3>
            <p className="muted" style={{ fontSize: "0.88rem", lineHeight: 1.55 }}>
              L'accès de <b>tous les comptes</b> de cette école (administrateurs, enseignants, élèves, parents), y compris les sessions déjà ouvertes, sera coupé <b>immédiatement</b>.
              Les données restent intactes. Sans régularisation sous <b>{regles.delaiSuspensionJours} jours</b>, l'école sera fermée et archivée automatiquement.
            </p>
            <div className="form-field" style={{ marginBottom: 12 }}>
              <label htmlFor="motif">Motif de la suspension (infraction constatée) — affiché à l'école</label>
              <textarea id="motif" rows={3} style={{ width: "100%" }} value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex. : frais de plateforme impayés depuis 3 mois" />
            </div>
            {erreurSuspension && <p className="error-text" role="alert">{erreurSuspension}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setASuspendre(null)}>Annuler</button>
              <button className="btn btn-danger" onClick={confirmerSuspension} disabled={motif.trim().length < 5}>Suspendre l'école</button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Ajouter une école</h3>
            <form onSubmit={submit}>
              <div className="form-field" style={{ marginBottom: 10 }}>
                <label>Nom de l'école</label>
                <input required value={form.Nom} onChange={(e) => setForm({ ...form, Nom: e.target.value })} />
              </div>
              <div className="form-field" style={{ marginBottom: 10 }}>
                <label>Type (détermine le format du bulletin)</label>
                <select value={form.Type} onChange={(e) => setForm({ ...form, Type: e.target.value })}>
                  <option value="Prive">Privé</option>
                  <option value="Public">Public / Officiel</option>
                </select>
              </div>
              <div className="form-field" style={{ marginBottom: 16 }}>
                <label>Niveaux enseignés par cette école</label>
                <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
                  {NIVEAUX.map((n) => (
                    <label key={n} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.86rem", fontWeight: 400 }}>
                      <input type="checkbox" checked={form.NiveauxActifs.includes(n)} onChange={() => toggleNiveau(n)} />
                      {n}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, marginBottom: 4 }}>
                <p style={{ fontSize: "0.82rem", color: "var(--text-soft)", marginBottom: 10 }}>Premier compte administrateur de cette école</p>
              </div>
              <div className="form-field" style={{ marginBottom: 10 }}><label>Nom complet</label><input required value={form.AdminNom} onChange={(e) => setForm({ ...form, AdminNom: e.target.value })} /></div>
              <div className="form-field" style={{ marginBottom: 10 }}><label>Identifiant</label><input required value={form.AdminIdentifiant} onChange={(e) => setForm({ ...form, AdminIdentifiant: e.target.value })} /></div>
              <div className="form-field" style={{ marginBottom: 16 }}><label>Mot de passe</label><input required type="password" value={form.AdminMotDePasse} onChange={(e) => setForm({ ...form, AdminMotDePasse: e.target.value })} /></div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">Créer l'école</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailEcole && (
        <div className="modal-backdrop" onClick={() => setDetailEcole(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Administrateurs — {detailEcole.Nom}</h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-soft)", marginBottom: 12 }}>
              En cas d'oubli, générez un mot de passe provisoire à communiquer à l'administrateur (l'ancien cesse de fonctionner et ses sessions ouvertes sont fermées).
              La plateforme ne gère que les administrateurs : les mots de passe des enseignants sont gérés par l'administrateur de l'école.
            </p>
            {comptes.length === 0 ? <p className="loading">Aucun compte administrateur pour cette école.</p> : (
              <table>
                <thead><tr><th>Nom</th><th>Identifiant</th><th>Rôle</th><th></th></tr></thead>
                <tbody>
                  {comptes.map((c) => (
                    <tr key={c.ID}>
                      <td>{c.Nom}</td><td className="mono">{c.Identifiant}</td>
                      <td><span className="badge badge-brass">{c.Role}</span></td>
                      <td><button className="btn btn-ghost btn-sm" onClick={() => resetPassword(c.ID)}>Réinitialiser</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {resetResult && (
              <div style={{ background: "var(--paper-alt)", borderRadius: 6, padding: 14, marginTop: 14 }}>
                <div className="mono" style={{ marginBottom: 6 }}>Identifiant : <strong>{resetResult.identifiant}</strong></div>
                <div className="mono">Nouveau mot de passe : <strong>{resetResult.motDePasse}</strong></div>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}><button className="btn btn-ghost" onClick={() => setDetailEcole(null)}>Fermer</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
