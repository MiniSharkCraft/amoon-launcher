// src/panels/FileManagerPanel.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import {
  FolderOpen, Trash, ArrowsClockwise, MagnifyingGlass,
  FileText, FileCss, Archive, Folder, HardDrive,
  PuzzlePiece, Cube, SunHorizon, Globe, Terminal,
  Warning, CheckCircle, X, Bug,
} from "@phosphor-icons/react";
import { invoke } from "@tauri-apps/api/core";
import useStore from "../store";
import { C } from "../constants/theme";

const TABS = [
  { id: "mods",          label: "Mods",           subdir: "mods",          icon: <PuzzlePiece size={14} weight="duotone"/>, exts: ["jar","zip","jar.disabled","zip.disabled"], dirs: false },
  { id: "shaderpacks",   label: "Shaders",         subdir: "shaderpacks",   icon: <SunHorizon  size={14} weight="duotone"/>, exts: ["zip"], dirs: false },
  { id: "resourcepacks", label: "Resource Packs",  subdir: "resourcepacks", icon: <Cube        size={14} weight="duotone"/>, exts: ["zip"], dirs: false },
  { id: "saves",         label: "Worlds",          subdir: "saves",         icon: <Globe       size={14} weight="duotone"/>, exts: [], dirs: true },
  { id: "logs",          label: "Logs",            subdir: "logs",          icon: <Terminal    size={14} weight="duotone"/>, exts: ["log","gz","txt"], dirs: false },
  { id: "crash-reports", label: "Crash Reports",  subdir: "crash-reports", icon: <Bug         size={14} weight="duotone"/>, exts: ["txt"], dirs: false },
];

function fmtSize(bytes) {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(ts) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("vi-VN", { day:"2-digit", month:"2-digit", year:"numeric" });
}

function extIcon(entry) {
  if (entry.is_dir)  return <Folder    size={15} weight="duotone" color="#eab308"/>;
  if (entry.ext === "jar" || entry.ext === "jar.disabled") return <Archive size={15} weight="duotone" color="#a78bfa"/>;
  if (entry.ext === "zip" || entry.ext === "zip.disabled") return <Archive size={15} weight="duotone" color="#60a5fa"/>;
  if (entry.ext === "log" || entry.ext === "txt")          return <FileText size={15} weight="duotone" color="#34d399"/>;
  return <HardDrive size={15} weight="duotone" color={C.text3}/>;
}

export default function FileManagerPanel() {
  const { listDirFiles, deleteFile, openPath, readTextFile, getResourcePackIcon, installations, selectedInstall } = useStore();

  const inst    = installations.find(i => i.id === selectedInstall);
  const gameDir = inst?.gameDir ?? ".amoon";

  const [tab,      setTab]    = useState("mods");
  const [files,    setFiles]  = useState([]);
  const [loading,  setLoad]   = useState(false);
  const [search,   setSearch] = useState("");
  const [toast,    setToast]  = useState(null);  // { msg, ok }
  const [logText,  setLogText] = useState(null);
  const [logFile,  setLogFile] = useState(null);
  const [deleting, setDel]    = useState(null);
  const [dragOver,  setDragOver]  = useState(false);
  const [packIcons, setPackIcons] = useState({});  // path → base64 url

  const activeTab = TABS.find(t => t.id === tab);

  const load = useCallback(async () => {
    if (!activeTab) return;
    setLoad(true);
    const dirPath = `${gameDir}/${activeTab.subdir}`;
    const list = await listDirFiles(dirPath, activeTab.exts, activeTab.dirs);
    setFiles(list);
    setLoad(false);
    // Auto-load first log/crash file
    if ((tab === "logs" || tab === "crash-reports") && list.length > 0 && !logFile) {
      const first = list.find(f => f.ext === "log") ?? list[0];
      setLogFile(first.path);
      const text = await readTextFile(first.path);
      setLogText(text);
    }
  }, [tab, gameDir]);

  useEffect(() => {
    setSearch("");
    setLogText(null);
    setLogFile(null);
    setPackIcons({});
    load();
  }, [tab]);

  // Load resource pack icons after files load
  useEffect(() => {
    if (tab !== "resourcepacks" || files.length === 0) return;
    (async () => {
      const icons = {};
      for (const f of files) {
        if (f.ext === "zip") {
          const icon = await getResourcePackIcon(f.path);
          if (icon) icons[f.path] = icon;
        }
      }
      setPackIcons(icons);
    })();
  }, [files, tab]);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  };

  const handleDelete = async (entry) => {
    setDel(entry.path);
    try {
      await deleteFile(entry.path);
      showToast(`Đã xóa ${entry.name}`);
      setFiles(f => f.filter(x => x.path !== entry.path));
    } catch (e) {
      showToast(`Lỗi: ${e}`, false);
    }
    setDel(null);
  };

  const handleOpen = (entry) => openPath(entry.is_dir ? entry.path : entry.path.substring(0, entry.path.lastIndexOf("/")));

  const handleOpenFolder = () => openPath(`${gameDir}/${activeTab.subdir}`);

  const handleLogClick = async (entry) => {
    setLogFile(entry.path);
    const text = await readTextFile(entry.path);
    setLogText(text);
  };

  const filtered = files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  // Drag & drop: copy dropped files (paths available in Tauri via webview) into current tab folder
  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setDragOver(false);
    if (!activeTab || activeTab.id === "logs" || activeTab.id === "crash-reports" || activeTab.id === "saves") return;
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) return;

    const destDir = `${gameDir}/${activeTab.subdir}`;
    let copied = 0;
    for (const f of droppedFiles) {
      const filePath = f.path ?? "";
      if (!filePath) continue;
      try {
        await invoke("copy_file_to_dir", { srcPath: filePath, destDir });
        copied++;
      } catch {}
    }
    if (copied > 0) {
      showToast(`Đã thêm ${copied} file`);
      load();
    } else {
      showToast("Drag & drop: mở folder rồi copy file vào thủ công", false);
    }
  }, [activeTab, gameDir, load]);

  return (
    <div
      style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden", position:"relative" }}
      onDragOver={e=>{ e.preventDefault(); setDragOver(true); }}
      onDragLeave={()=>setDragOver(false)}
      onDrop={handleDrop}
    >
      {dragOver && (
        <div style={{ position:"absolute", inset:0, zIndex:40, background:"rgba(37,99,235,0.15)", border:`2px dashed ${C.accent}`, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
          <span style={{ fontSize:16, color:C.accent, fontWeight:600 }}>Drop files to install</span>
        </div>
      )}

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

      {/* Header + tabs */}
      <div style={{ padding:"16px 20px 0", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
          <FolderOpen size={16} weight="duotone" color={C.accent}/>
          <span style={{ fontSize:14, fontWeight:600, color:C.text }}>File Manager</span>
          <span style={{ fontSize:11, color:C.text3, marginLeft:4 }}>{gameDir}</span>
          <div style={{ flex:1 }}/>
          <button onClick={handleOpenFolder} style={btn2}>
            <FolderOpen size={13}/> Open folder
          </button>
          <button onClick={load} style={btn2}>
            <ArrowsClockwise size={13}/> Refresh
          </button>
        </div>

        {/* Tab bar */}
        <div style={{ display:"flex", gap:2 }}>
          {TABS.map(t => (
            <div key={t.id} onClick={() => setTab(t.id)} style={{
              display:"flex", alignItems:"center", gap:6,
              padding:"7px 14px", cursor:"pointer", fontSize:13,
              borderBottom: tab===t.id ? `2px solid ${C.accent}` : "2px solid transparent",
              color: tab===t.id ? C.accent : C.text2,
              transition:"color .15s",
            }}>
              {t.icon} {t.label}
            </div>
          ))}
        </div>
      </div>

      {/* Logs / Crash Reports layout */}
      {(tab === "logs" || tab === "crash-reports") ? (
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
          {/* File list sidebar */}
          <div style={{ width:220, borderRight:`1px solid ${C.border}`, overflowY:"auto", padding:8 }}>
            {loading
              ? <div style={{ color:C.text3, fontSize:12, padding:12 }}>Loading...</div>
              : files.length === 0
                ? <div style={{ color:C.text3, fontSize:12, padding:12 }}>No log files</div>
                : files.map(f => (
                  <div key={f.path} onClick={() => handleLogClick(f)} style={{
                    padding:"7px 10px", borderRadius:7, cursor:"pointer", fontSize:12,
                    background: logFile===f.path ? "rgba(37,99,235,0.15)" : "transparent",
                    color: logFile===f.path ? C.text : C.text2,
                    display:"flex", alignItems:"center", gap:7, marginBottom:2,
                  }}>
                    {extIcon(f)}
                    <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</span>
                  </div>
                ))
            }
          </div>
          {/* Log content */}
          <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
            {logText !== null ? (
              <>
                <div style={{ padding:"8px 14px", borderBottom:`1px solid ${C.border}`, fontSize:11, color:C.text3, display:"flex", alignItems:"center", gap:6 }}>
                  <Terminal size={12}/> {logFile?.split("/").pop()}
                  <div style={{ flex:1 }}/>
                  <MagnifyingGlass size={12}/>
                  <input
                    value={search} onChange={e=>setSearch(e.target.value)}
                    placeholder="Filter..." style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${C.border}`, borderRadius:5, padding:"3px 8px", fontSize:11, color:C.text, fontFamily:"inherit", outline:"none", width:140 }}
                  />
                </div>
                <div style={{ flex:1, overflowY:"auto", fontFamily:"monospace", fontSize:11.5, lineHeight:1.7, padding:"10px 14px", color:"#a0aec0" }}>
                  {logText.split("\n")
                    .filter(ln => !search || ln.toLowerCase().includes(search.toLowerCase()))
                    .map((ln, i) => (
                      <div key={i} style={{
                        color: ln.includes("ERROR") || ln.includes("FATAL") ? "#fca5a5"
                             : ln.includes("WARN")  ? "#fde68a"
                             : ln.includes("INFO")  ? "#a0aec0"
                             : "#6b7280",
                      }}>{ln}</div>
                    ))
                  }
                </div>
              </>
            ) : (
              <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:C.text3, fontSize:13 }}>
                <div style={{ textAlign:"center" }}>
                  <Terminal size={32} color={C.text3} style={{ marginBottom:8, opacity:0.4 }}/>
                  <div>Select a log file to view</div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Normal file list */
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          {/* Search */}
          <div style={{ padding:"10px 20px", flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.04)", border:`1px solid ${C.border}`, borderRadius:8, padding:"7px 12px" }}>
              <MagnifyingGlass size={14} color={C.text3}/>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder={`Search ${activeTab?.label.toLowerCase()}...`}
                style={{ background:"none", border:"none", color:C.text, fontSize:13, fontFamily:"inherit", outline:"none", flex:1 }}
              />
              {search && <div onClick={() => setSearch("")} style={{ cursor:"pointer", color:C.text3, display:"flex" }}><X size={13}/></div>}
            </div>
          </div>

          {/* File list */}
          <div style={{ flex:1, overflowY:"auto", padding:"0 20px 16px" }}>
            {loading ? (
              <div style={{ color:C.text3, fontSize:13, padding:"20px 0", textAlign:"center" }}>Loading...</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign:"center", padding:"40px 0" }}>
                <FolderOpen size={40} color={C.text3} weight="duotone" style={{ opacity:0.3, marginBottom:12 }}/>
                <div style={{ fontSize:13, color:C.text3 }}>
                  {search ? "No files match your search" : `No ${activeTab?.label.toLowerCase()} found`}
                </div>
                <div style={{ fontSize:11, color:C.text3, marginTop:6, opacity:0.7 }}>
                  Files in <code style={{ color:C.text2 }}>{gameDir}/{activeTab?.subdir}/</code>
                </div>
              </div>
            ) : (
              <>
                {/* Table header */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 80px 100px 60px", padding:"6px 10px", fontSize:11, color:C.text3, borderBottom:`1px solid ${C.border}`, marginBottom:4 }}>
                  <span>Name</span>
                  <span style={{ textAlign:"right" }}>Size</span>
                  <span style={{ textAlign:"center" }}>Modified</span>
                  <span/>
                </div>

                {filtered.map(entry => (
                  <div key={entry.path} style={{
                    display:"grid", gridTemplateColumns:"1fr 80px 100px 60px",
                    alignItems:"center", padding:"7px 10px", borderRadius:8,
                    background:"rgba(255,255,255,0.02)",
                    border:`1px solid transparent`,
                    marginBottom:3, transition:"background .1s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                  >
                    {/* Name */}
                    <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
                      {packIcons[entry.path]
                        ? <img src={packIcons[entry.path]} alt="" style={{ width:15, height:15, borderRadius:2, imageRendering:"pixelated", flexShrink:0 }}/>
                        : extIcon(entry)}
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:13, color: entry.ext.endsWith("disabled") ? C.text3 : C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {entry.name}
                        </div>
                        {entry.ext.endsWith("disabled") && (
                          <span style={{ fontSize:10, color:C.text3, background:"rgba(255,255,255,0.06)", borderRadius:3, padding:"1px 5px" }}>disabled</span>
                        )}
                      </div>
                    </div>

                    {/* Size */}
                    <div style={{ fontSize:12, color:C.text3, textAlign:"right" }}>{fmtSize(entry.size)}</div>

                    {/* Date */}
                    <div style={{ fontSize:11, color:C.text3, textAlign:"center" }}>{fmtDate(entry.modified)}</div>

                    {/* Actions */}
                    <div style={{ display:"flex", justifyContent:"flex-end", gap:4 }}>
                      <div onClick={() => handleOpen(entry)} title="Open folder" style={iconBtn}>
                        <FolderOpen size={13}/>
                      </div>
                      <div onClick={() => handleDelete(entry)} title="Delete" style={{ ...iconBtn, color: deleting===entry.path ? C.red : C.text3 }}>
                        <Trash size={13}/>
                      </div>
                    </div>
                  </div>
                ))}

                <div style={{ fontSize:11, color:C.text3, textAlign:"center", marginTop:12 }}>
                  {filtered.length} {activeTab?.label.toLowerCase()} · {fmtSize(filtered.reduce((s, f) => s + f.size, 0))} total
                </div>
              </>
            )}
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

const iconBtn = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 26, height: 26, borderRadius: 6, cursor: "pointer",
  color: C.text3, background: "transparent", transition: "background .1s",
};
