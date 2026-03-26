// src/components/DownloadProgress.jsx — Phase 1: Download progress bar UI (#38)
import { CloudArrowDown, CircleNotch } from "@phosphor-icons/react";
import { C } from "../constants/theme";
import useStore from "../store";

export default function DownloadProgress() {
  const { downloading, downloadProgress } = useStore();

  if (!downloading || !downloadProgress) return null;

  const { total, completed, current } = downloadProgress;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div style={{
      position: "fixed", bottom: 80, right: 20, width: 320,
      background: C.sidebar, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: "14px 16px", zIndex: 50,
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <CircleNotch size={16} className="spin" color={C.accent} />
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Downloading...</span>
        <span style={{ fontSize: 12, color: C.text2, marginLeft: "auto" }}>{pct}%</span>
      </div>

      {/* Progress bar */}
      <div style={{
        width: "100%", height: 6, borderRadius: 3,
        background: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 8,
      }}>
        <div style={{
          width: `${pct}%`, height: "100%", borderRadius: 3,
          background: `linear-gradient(90deg, ${C.accent}, #3b82f6)`,
          transition: "width 0.3s ease",
        }} />
      </div>

      <div style={{ fontSize: 11, color: C.text3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {current || "Preparing..."}
      </div>
      <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>
        {completed} / {total} files
      </div>
    </div>
  );
}
