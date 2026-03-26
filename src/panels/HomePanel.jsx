// src/panels/HomePanel.jsx
import {
  Sparkle, Scissors, Wrench, Fire, Cpu, ArrowSquareOut, Newspaper,
} from "@phosphor-icons/react";
import { C, btnPrimary } from "../constants/theme";

export default function HomePanel() {
  return (
    <div style={{ padding: "20px 24px", overflowY: "auto", height: "100%", boxSizing: "border-box" }}>
      {/* Hero banner */}
      <div style={{
        borderRadius: 14, overflow: "hidden", marginBottom: 20,
        background: "linear-gradient(135deg,#1a1f35,#0f1424)",
        border: `1px solid ${C.border}`, minHeight: 200,
        display: "flex", alignItems: "flex-end", position: "relative",
      }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,transparent 30%,rgba(15,17,23,0.95) 100%)" }} />
        <div style={{ position: "relative", padding: "20px 24px", width: "100%", boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Sparkle size={12} color={C.accent} />
            <span style={{ fontSize: 11, color: C.accent, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>Latest news</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>Minecraft Java Edition 1.21.4</div>
          <div style={{ fontSize: 13, color: C.text2, marginBottom: 14 }}>The newest release is now available. Explore new features and bug fixes.</div>
          <button style={{ ...btnPrimary, fontSize: 13 }}><ArrowSquareOut size={14} /> Read more</button>
        </div>
      </div>

      {/* News grid */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <Newspaper size={13} color={C.text3} />
        <span style={{ fontSize: 11, fontWeight: 600, color: C.text3, textTransform: "uppercase", letterSpacing: 1.2 }}>More news</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[
          { title: "Fabric 0.16.9 released",  sub: "New loader with performance improvements", tag: "Modloader", icon: <Scissors size={12} weight="duotone" /> },
          { title: "NeoForge 21.4 stable",    sub: "NeoForge for 1.21.4 is now stable",        tag: "Modloader", icon: <Wrench size={12} weight="duotone" /> },
          { title: "Modrinth new features",   sub: "Browse mods faster with new search",        tag: "Platform",  icon: <Fire size={12} weight="duotone" /> },
          { title: "Java 21 recommended",     sub: "Mojang recommends Java 21 for best perf",  tag: "Java",      icon: <Cpu size={12} weight="duotone" /> },
        ].map(({ title, sub, tag, icon }) => (
          <div key={title} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
              <span style={{ color: C.accent }}>{icon}</span>
              <span style={{ fontSize: 11, color: C.accent, fontWeight: 500 }}>{tag}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>{title}</div>
            <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.5 }}>{sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
