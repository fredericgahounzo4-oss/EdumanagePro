import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { api } from "../api";
import { usePrefs } from "../PrefsContext";
import { useClickOutside } from "../lib/hooks";
import { Avatar } from "./ui";
import { libelleClasse } from "../lib/format";

const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Recherche instantanée d'un élève depuis n'importe quelle page (Ctrl/⌘ + K).
// La liste est chargée une seule fois, puis filtrée localement (donc aussi disponible hors connexion via le cache).
export default function GlobalSearch() {
  const { t } = usePrefs();
  const navigate = useNavigate();
  const ref = useRef(null);
  const inputRef = useRef(null);
  const [q, setQ] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [eleves, setEleves] = useState(null);
  const [actif, setActif] = useState(0);
  useClickOutside(ref, ouvert, () => setOuvert(false));

  useEffect(() => {
    const raccourci = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener("keydown", raccourci);
    return () => window.removeEventListener("keydown", raccourci);
  }, []);

  function charger() {
    if (eleves === null) api.getStudents().then(setEleves).catch(() => setEleves([]));
  }

  const resultats = useMemo(() => {
    const mots = norm(q).split(/\s+/).filter(Boolean);
    if (!mots.length || !eleves) return [];
    return eleves
      .filter((e) => { const h = norm(`${e.Nom} ${e.Prenom} ${e.Classe} ${e.Serie}`); return mots.every((m) => h.includes(m)); })
      .slice(0, 8);
  }, [q, eleves]);

  function aller(e) {
    setOuvert(false); setQ(""); inputRef.current?.blur();
    navigate(`/eleves/${e.ID}`);
  }

  function touche(ev) {
    if (ev.key === "ArrowDown") { ev.preventDefault(); setActif((a) => Math.min(a + 1, resultats.length - 1)); }
    else if (ev.key === "ArrowUp") { ev.preventDefault(); setActif((a) => Math.max(a - 1, 0)); }
    else if (ev.key === "Enter" && resultats[actif]) aller(resultats[actif]);
    else if (ev.key === "Escape") { setOuvert(false); inputRef.current?.blur(); }
  }

  return (
    <div className="search-box" ref={ref} role="search">
      <Search size={16} className="search-ic" aria-hidden="true" />
      <input ref={inputRef} value={q} placeholder={t("top.search")} aria-label={t("top.search")}
        onFocus={() => { charger(); setOuvert(true); }}
        onChange={(e) => { setQ(e.target.value); setActif(0); setOuvert(true); }}
        onKeyDown={touche} />
      {!q && <span className="kbd" aria-hidden="true">Ctrl K</span>}
      {ouvert && q.trim() && (
        <div className="dropdown" role="listbox">
          {resultats.length === 0
            ? <p className="muted" style={{ padding: 14, margin: 0, fontSize: "0.85rem" }}>{eleves === null ? t("common.loading") : t("top.searchEmpty")}</p>
            : resultats.map((e, i) => (
              <button key={e.ID} role="option" aria-selected={i === actif} className={"dropdown-item" + (i === actif ? " focus" : "")}
                onMouseEnter={() => setActif(i)} onClick={() => aller(e)}>
                <Avatar nom={e.Nom} prenom={e.Prenom} small />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{e.Nom} {e.Prenom}</div>
                  <div className="muted" style={{ fontSize: "0.74rem" }}>{libelleClasse(e)} · {e.Niveau}</div>
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
