// src/panels/ScreenshotsPanel.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Image, FolderOpen, Trash, ArrowsClockwise,
  X, Download, Copy, ArrowLeft, ArrowRight,
  Camera, CheckCircle, Warning,
} from "@phosphor-icons/react";
import useStore from "../store";
import { C } from "../constants/theme";

function fmtDate(ts) {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// Single screenshot card with lazy-load image
function ScreenshotCard({ entry, onOpen, onDelete }) {
  const { readImageBase64 } = useStore();
  const [src,  setSrc]  = useState(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !src) {
        readImageBase64(entry.path).then(data => { if (data) setSrc(data); });
        obs.disconnect();
      }
    }, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [entry.path]);

  return (
    <div ref={ref} style={{
      borderRadius: 10, overflow: "hidden", cursor: "pointer",
      border: `1px solid ${C.border}`, background: C.card,
      position: "relative",
    }}
      onClick={() => onOpen(entry)}
      onMouseEnter={e => e.currentTarget.querySelector(".actions").style.opacity = "1"}
      onMouseLeave={e => e.currentTarget.querySelector(".actions").style.opacity = "0"}
    >
      {/* Thumbnail */}
      <div style={{ aspectRatio: "16/9", background: "rgba(255,255,255,0.03)", position: "relative", overflow: "hidden" }}>
        {src
          ? <img src={src} alt={entry.name} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
          : <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:C.text3 }}>
              <Camera size={24} weight="duotone" color={C.text3} style={{ opacity:0.3 }}/>
            </div>
        }
      </div>

      {/* Info */}
      <div style={{ padding: "8px 10px" }}>
        <div style={{ fontSize: 11, color: C.text2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{entry.name}</div>
        <div style={{ fontSize: 10, color: C.text3, marginTop: 2 }}>{fmtDate(entry.modified)}</div>
      </div>

      {/* Hover actions */}
      <div className="actions" style={{ position:"absolute", top:6, right:6, display:"flex", gap:4, opacity:0, transition:"opacity .15s" }}>
        <div onClick={e => { e.stopPropagation(); onDelete(entry); }} title="Delete" style={actionBtn("#ef4444")}>
          <Trash size={12}/>
        </div>
      </div>
    </div>
  );
}

export default function ScreenshotsPanel() {
  const { listDirFiles, deleteFile, openPath, readImageBase64, installations, selectedInstall } = useStore();
  const inst    = installations.find(i => i.id === selectedInstall);
  const gameDir = inst?.gameDir ?? ".amoon";

  const [files,    setFiles]   = useState([]);
  const [loading,  setLoad]    = useState(false);
  const [preview,  setPreview] = useState(null);  // { entry, src }
  const [previewIdx, setIdx]   = useState(0);
  const [toast,    setToast]   = useState(null);

  const load = useCallback(async () => {
    setLoad(true);
    const list = await listDirFiles(`${gameDir}/screenshots`, ["png","jpg","jpeg"], false);
    setFiles(list);
    setLoad(false);
  }, [gameDir]);

  useEffect(() => { load(); }, []);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  };

  const openPreview = async (entry) => {
    const idx = files.findIndex(f => f.path === entry.path);
    setIdx(idx);
    const src = await readImageBase64(entry.path);
    setPreview({ entry, src });
  };

  const navPreview = async (dir) => {
    const next = previewIdx + dir;
    if (next < 0 || next >= files.length) return;
    setIdx(next);
    const entry = files[next];
    const src   = await readImageBase64(entry.path);
    setPreview({ entry, src });
  };

  const handleDelete = async (entry) => {
    try {
      await deleteFile(entry.path);
      setFiles(f => f.filter(x => x.path !== entry.path));
      showToast(`Đã xóa ${entry.name}`);
      if (preview?.entry.path === entry.path) setPreview(null);
    } catch (e) {
      showToast(`Lỗi: ${e}`, false);
    }
  };

  const handleCopy = async () => {
    if (!preview?.src) return;
    try {
      const res  = await fetch(preview.src);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      showToast("Đã copy vào clipboard!");
    } catch {
      showToast("Không copy được (browser restriction)", false);
    }
  };

  // Keyboard nav in preview
  useEffect(() => {
    if (!preview) return;
    const handler = (e) => {
      if (e.key === "ArrowLeft")  navPreview(-1);
      if (e.key === "ArrowRight") navPreview(1);
      if (e.key === "Escape")     setPreview(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [preview, previewIdx]);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden", position:"relative" }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position:"absolute", top:12, right:16, zIndex:50,
          background: toast.ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
          border: `1px solid ${toast.ok ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
          borderRadius:8, padding:"8px 14px", fontSize:12,
          color: toast.ok ? "#86efac" : "#fca5a5",
          display:"flex", alignItems:"center", gap:6,
        }}>
          {toast.ok ? <CheckCircle size={13} weight="fill"/> : <Warning size={13} weight="fill"/>}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ padding:"16px 20px 12px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
        <Camera size={16} weight="duotone" color={C.accent}/>
        <span style={{ fontSize:14, fontWeight:600, color:C.text }}>Screenshots</span>
        <span style={{ fontSize:12, color:C.text3 }}>{files.length} file{files.length !== 1 ? "s" : ""}</span>
        <div style={{ flex:1 }}/>
        <button onClick={() => openPath(`${gameDir}/screenshots`)} style={btn2}>
          <FolderOpen size={13}/> Open folder
        </button>
        <button onClick={load} style={btn2}>
          <ArrowsClockwise size={13}/> Refresh
        </button>
      </div>

      {/* Grid */}
      <div style={{ flex:1, overflowY:"auto", padding:"16px 20px" }}>
        {loading ? (
          <div style={{ textAlign:"center", padding:"40px 0", color:C.text3, fontSize:13 }}>Loading screenshots...</div>
        ) : files.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 0" }}>
            <Camera size={48} weight="duotone" color={C.text3} style={{ opacity:0.3, marginBottom:16 }}/>
            <div style={{ fontSize:14, color:C.text3, marginBottom:6 }}>No screenshots yet</div>
            <div style={{ fontSize:12, color:C.text3, opacity:0.7 }}>
              Press <kbd style={{ background:"rgba(255,255,255,0.08)", borderRadius:4, padding:"1px 6px", fontSize:11, border:`1px solid ${C.border}` }}>F2</kbd> in-game to take a screenshot
            </div>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:12 }}>
            {files.map(entry => (
              <ScreenshotCard key={entry.path} entry={entry} onOpen={openPreview} onDelete={handleDelete}/>
            ))}
          </div>
        )}
      </div>

      {/* Preview modal */}
      {preview && (
        <div style={{
          position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:200,
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
        }} onClick={() => setPreview(null)}>
          {/* Toolbar */}
          <div style={{ position:"absolute", top:0, left:0, right:0, padding:"12px 20px", display:"flex", alignItems:"center", gap:10, background:"rgba(0,0,0,0.5)", backdropFilter:"blur(8px)" }}
            onClick={e => e.stopPropagation()}>
            <Camera size={14} color={C.text2}/>
            <span style={{ fontSize:13, color:C.text2, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {preview.entry.name}
            </span>
            <span style={{ fontSize:11, color:C.text3 }}>{previewIdx + 1} / {files.length}</span>
            <button onClick={handleCopy} style={btn2}><Copy size={13}/> Copy</button>
            <button onClick={() => handleDelete(preview.entry)} style={{ ...btn2, color:"#fca5a5", borderColor:"rgba(239,68,68,0.3)" }}>
              <Trash size={13}/> Delete
            </button>
            <div onClick={() => setPreview(null)} style={{ cursor:"pointer", color:C.text3, display:"flex", padding:4, borderRadius:6 }}>
              <X size={18}/>
            </div>
          </div>

          {/* Image */}
          {preview.src && (
            <img src={preview.src} alt={preview.entry.name}
              onClick={e => e.stopPropagation()}
              style={{ maxWidth:"90vw", maxHeight:"80vh", borderRadius:8, boxShadow:"0 32px 80px rgba(0,0,0,0.8)", objectFit:"contain" }}
            />
          )}

          {/* Nav arrows */}
          {previewIdx > 0 && (
            <div onClick={e => { e.stopPropagation(); navPreview(-1); }} style={navBtn("left")}>
              <ArrowLeft size={20} weight="bold"/>
            </div>
          )}
          {previewIdx < files.length - 1 && (
            <div onClick={e => { e.stopPropagation(); navPreview(1); }} style={navBtn("right")}>
              <ArrowRight size={20} weight="bold"/>
            </div>
          )}

          {/* Date */}
          <div style={{ position:"absolute", bottom:20, fontSize:12, color:C.text3 }}>
            {fmtDate(preview.entry.modified)}
          </div>
        </div>
      )}
    </div>
  );
}

const btn2 = {
  background: "rgba(255,255,255,0.06)", color: C.text2,
  border: `1px solid ${C.border}`, padding: "5px 12px",
  borderRadius: 7, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
  display: "inline-flex", alignItems: "center", gap: 5,
};

const actionBtn = (color) => ({
  width: 24, height: 24, borderRadius: 5, cursor: "pointer",
  background: `${color}33`, color, border: `1px solid ${color}66`,
  display: "flex", alignItems: "center", justifyContent: "center",
});

const navBtn = (side) => ({
  position: "absolute",
  [side]: 20,
  top: "50%",
  transform: "translateY(-50%)",
  width: 44, height: 44, borderRadius: "50%",
  background: "rgba(255,255,255,0.1)", backdropFilter: "blur(8px)",
  border: `1px solid rgba(255,255,255,0.15)`,
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", color: "white",
});
