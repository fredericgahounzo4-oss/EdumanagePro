import { useEffect, useState } from "react";
import { api } from "../api";

export default function Messagerie() {
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [composer, setComposer] = useState(false);
  const [form, setForm] = useState({ DestinataireID: "", Sujet: "", Corps: "" });
  const [ouvert, setOuvert] = useState(null);
  const [error, setError] = useState("");

  function load() {
    api.getMessages().then(setMessages).catch((e) => setError(e.message));
    api.getContacts().then(setContacts).catch(() => {});
  }
  useEffect(load, []);

  async function envoyer(e) {
    e.preventDefault();
    if (!form.DestinataireID || !form.Corps.trim()) return;
    try {
      await api.sendMessage({ ...form, DestinataireID: Number(form.DestinataireID) });
      setForm({ DestinataireID: "", Sujet: "", Corps: "" });
      setComposer(false);
      load();
    } catch (err) { alert(err.message); }
  }

  async function ouvrir(m) {
    setOuvert(m);
    if (m.recu && !m.Lu) {
      await api.marquerLu(m.ID);
      load();
    }
  }

  const nonLus = messages.filter((m) => m.recu && !m.Lu).length;

  return (
    <div>
      <header className="page-header">
        <div className="page-eyebrow">Communication</div>
        <h1 className="page-title">Messagerie</h1>
        <p className="page-subtitle">
          {messages.length} message(s){nonLus > 0 ? ` — ${nonLus} non lu(s)` : ""}. Échangez avec l'établissement, les enseignants ou les familles.
        </p>
      </header>

      <div className="toolbar">
        <button className="btn btn-primary" style={{ marginLeft: "auto" }} onClick={() => setComposer(true)}>
          ✉ Nouveau message
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: ouvert ? "1fr 1fr" : "1fr", gap: 20, alignItems: "start" }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {messages.length === 0 ? (
            <div className="empty-state">Aucun message.</div>
          ) : (
            <table>
              <tbody>
                {messages.map((m) => (
                  <tr key={m.ID} style={{ cursor: "pointer", fontWeight: m.recu && !m.Lu ? 600 : 400 }} onClick={() => ouvrir(m)}>
                    <td style={{ width: 70 }}>
                      {m.Type === "Notification"
                        ? <span className="badge badge-brass">Notif</span>
                        : m.recu ? <span className="badge badge-sage">Reçu</span> : <span style={{ color: "var(--text-soft)", fontSize: "0.76rem" }}>Envoyé</span>}
                    </td>
                    <td>
                      <div style={{ fontSize: "0.86rem" }}>{m.recu ? (m.ExpediteurNom || "Système") : m.DestinataireNom}</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-soft)" }}>{m.Sujet || m.Corps.slice(0, 50)}</div>
                    </td>
                    <td className="mono" style={{ fontSize: "0.74rem", color: "var(--text-soft)", width: 90 }}>
                      {new Date(m.EnvoyeLe).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {ouvert && (
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <h3 style={{ fontFamily: "var(--font-display)", marginTop: 0 }}>{ouvert.Sujet || "(sans objet)"}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setOuvert(null)}>Fermer</button>
            </div>
            <p style={{ fontSize: "0.8rem", color: "var(--text-soft)", marginTop: 0 }}>
              {ouvert.recu ? "De" : "À"} : {ouvert.recu ? (ouvert.ExpediteurNom || "Système") : ouvert.DestinataireNom}
              {" · "}{new Date(ouvert.EnvoyeLe).toLocaleString("fr-FR")}
              {ouvert.EleveNom ? ` · Concerne ${ouvert.EleveNom} ${ouvert.ElevePrenom}` : ""}
            </p>
            <div style={{ background: "var(--paper-alt)", borderRadius: 6, padding: 14, whiteSpace: "pre-wrap", fontSize: "0.9rem" }}>
              {ouvert.Corps}
            </div>
            {ouvert.recu && ouvert.ExpediteurID && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 12 }}
                onClick={() => { setForm({ DestinataireID: String(ouvert.ExpediteurID), Sujet: "Re: " + (ouvert.Sujet || ""), Corps: "" }); setComposer(true); }}
              >
                ↩ Répondre
              </button>
            )}
          </div>
        )}
      </div>

      {composer && (
        <div className="modal-backdrop" onClick={() => setComposer(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Nouveau message</h3>
            <form onSubmit={envoyer}>
              <div className="form-field" style={{ marginBottom: 10 }}>
                <label>Destinataire</label>
                <select required value={form.DestinataireID} onChange={(e) => setForm({ ...form, DestinataireID: e.target.value })}>
                  <option value="">— Choisir —</option>
                  {contacts.map((c) => <option key={c.ID} value={c.ID}>{c.Nom} ({c.Role})</option>)}
                </select>
              </div>
              <div className="form-field" style={{ marginBottom: 10 }}>
                <label>Objet</label>
                <input value={form.Sujet} onChange={(e) => setForm({ ...form, Sujet: e.target.value })} />
              </div>
              <div className="form-field" style={{ marginBottom: 16 }}>
                <label>Message</label>
                <textarea
                  required rows={6} value={form.Corps}
                  onChange={(e) => setForm({ ...form, Corps: e.target.value })}
                  style={{ width: "100%", fontFamily: "var(--font-body)", padding: 10, border: "1px solid var(--line)", borderRadius: 6, resize: "vertical" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setComposer(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">Envoyer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
