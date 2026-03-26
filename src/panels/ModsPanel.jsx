// src/panels/ModsPanel.jsx
import { useEffect, useState } from "react";
import {
  PuzzlePiece, Package, MagnifyingGlass, DownloadSimple, CheckCircle,
  CircleNotch, Tag,
} from "@phosphor-icons/react";
import useStore from "../store";
import { C, inputStyle, btnPrimary, btnSecondary } from "../constants/theme";

export default function ModsPanel() {
  const { mods, modpacks, modsLoading, modpacksLoading, searchMods, searchModpacks } = useStore();
  const [tab, setTab]         = useState("mods");
  const [query, setQuery]     = useState("");
  const [installed, setInst]  = useState({});

  const handleSearch = () => {
    if (tab === "mods") searchMods(query || "optimization");
    else searchModpacks(query || "");
  };

  useEffect(() => { searchMods("optimization"); searchModpacks(""); }, []);

  const items   = tab === "mods" ? mods : modpacks;
  const loading = tab === "mods" ? modsLoading : modpacksLoading;

  return (
    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box", overflow: "hidden" }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {[{ id: "mods", icon: <PuzzlePiece size={14} /> }, { id: "modpacks", icon: <Package size={14} /> }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "7px 16px", borderRadius: 8, border: "none",
            background: tab === t.id ? C.accent : "rgba(255,255,255,0.06)",
            color: tab === t.id ? "white" : C.text2, fontSize: 13,
            cursor: "pointer", fontFamily: "inherit",
            fontWeight: tab === t.id ? 500 : 400,
            display: "inline-flex", alignItems: "center", gap: 5,
          }}>
            {t.icon} {t.id.charAt(0).toUpperCase() + t.id.slice(1)}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
          placeholder={`Search ${tab} on Modrinth...`}
          style={inputStyle}
        />
        <button onClick={handleSearch} style={{ ...btnPrimary, flexShrink: 0 }}>
          <MagnifyingGlass size={15} />
        </button>
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", color: C.text2, padding: 40, fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <CircleNotch size={24} className="spin" />
            Searching Modrinth...
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", color: C.text3, padding: 40, fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <MagnifyingGlass size={28} weight="duotone" />
            No results
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map(mod => (
              <div key={mod.project_id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                {mod.icon_url
                  ? <img src={mod.icon_url} style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} alt="" />
                  : <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Package size={20} color={C.text3} /></div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2 }}>{mod.title}</div>
                  <div style={{ fontSize: 12, color: C.text2, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mod.description}</div>
                  <div style={{ fontSize: 11, color: C.text3, display: "flex", alignItems: "center", gap: 4 }}>
                    <DownloadSimple size={11} /> {(mod.downloads / 1e6).toFixed(1)}M
                    <span style={{ margin: "0 2px" }}>·</span>
                    <Tag size={11} /> {mod.categories?.slice(0, 3).join(", ")}
                  </div>
                </div>
                <button
                  onClick={() => setInst(p => ({ ...p, [mod.project_id]: !p[mod.project_id] }))}
                  style={{
                    ...(installed[mod.project_id] ? { ...btnSecondary, color: C.green, borderColor: "rgba(34,197,94,0.3)" } : btnPrimary),
                    flexShrink: 0, padding: "7px 14px", fontSize: 12,
                  }}
                >
                  {installed[mod.project_id] ? <><CheckCircle size={13} />Installed</> : <><DownloadSimple size={13} />Install</>}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
