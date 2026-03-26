// src/constants/theme.js — Design tokens & shared styles

export const C = {
  bg:      "#0f1117",
  sidebar: "#161b24",
  card:    "#1c2130",
  border:  "rgba(255,255,255,0.06)",
  border2: "rgba(255,255,255,0.12)",
  accent:  "#2563EB",
  text:    "#f0f4ff",
  text2:   "#8892a4",
  text3:   "#4a5568",
  green:   "#22c55e",
  red:     "#ef4444",
  yellow:  "#eab308",
};

export const inputStyle = {
  width: "100%", boxSizing: "border-box",
  background: "rgba(255,255,255,0.05)", color: C.text,
  border: `1px solid ${C.border}`, borderRadius: 8,
  padding: "9px 12px", fontSize: 13, fontFamily: "inherit", outline: "none",
};

export const btnPrimary = {
  background: C.accent, color: "white", border: "none",
  padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500,
  cursor: "pointer", fontFamily: "inherit",
  display: "inline-flex", alignItems: "center", gap: 6,
};

export const btnSecondary = {
  background: "rgba(255,255,255,0.06)", color: C.text2,
  border: `1px solid ${C.border}`, padding: "9px 16px",
  borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
  display: "inline-flex", alignItems: "center", gap: 6,
};
