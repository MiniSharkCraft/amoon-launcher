// src/App.jsx — AMoon Launcher (Full featured)
import { useEffect, useState, useRef } from "react";
import {
  GearSix, Play, Plus, X,
  DiscordLogo, Lightning, HardDrive,
  Cpu, ArrowsClockwise, GameController, Sparkle,
  Newspaper, Terminal, Package, Users, Trash,
  MagnifyingGlass, DownloadSimple, CheckCircle,
  // Auth icons
  MicrosoftOutlookLogo, Globe, ShieldCheck, WifiSlash,
  // Loader & installation icons
  Wrench, Hammer, Scissors, Cube,
  // UI extras
  Rocket, Warning, Info, PencilSimple,
  CircleNotch, SignIn,
  House, PuzzlePiece, UserCircle,
  ArrowSquareOut, Broom, Crown,
  Tag, Fire,
} from "@phosphor-icons/react";
import useStore from "./store";
import InstallWizard from "./components/InstallWizard";
import LoginModal from "./components/LoginModal";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:"#0f1117", sidebar:"#161b24", card:"#1c2130",
  border:"rgba(255,255,255,0.06)", border2:"rgba(255,255,255,0.12)",
  accent:"#2563EB", text:"#f0f4ff", text2:"#8892a4", text3:"#4a5568",
  green:"#22c55e", red:"#ef4444", yellow:"#eab308",
};

const inputStyle = {
  width:"100%", boxSizing:"border-box",
  background:"rgba(255,255,255,0.05)", color:C.text,
  border:`1px solid ${C.border}`, borderRadius:8,
  padding:"9px 12px", fontSize:13, fontFamily:"inherit", outline:"none",
};

const btnPrimary = {
  background:C.accent, color:"white", border:"none",
  padding:"9px 18px", borderRadius:8, fontSize:13, fontWeight:500,
  cursor:"pointer", fontFamily:"inherit",
  display:"inline-flex", alignItems:"center", gap:6,
};

const btnSecondary = {
  background:"rgba(255,255,255,0.06)", color:C.text2,
  border:`1px solid ${C.border}`, padding:"9px 16px",
  borderRadius:8, fontSize:13, cursor:"pointer", fontFamily:"inherit",
  display:"inline-flex", alignItems:"center", gap:6,
};

// ─── Icon maps ────────────────────────────────────────────────────────────────
const LOADER_ICONS = {
  vanilla:  (s=16,w="duotone") => <Cube size={s} weight={w}/>,
  fabric:   (s=16,w="duotone") => <Scissors size={s} weight={w}/>,
  forge:    (s=16,w="duotone") => <Hammer size={s} weight={w}/>,
  neoforge: (s=16,w="duotone") => <Wrench size={s} weight={w}/>,
  quilt:    (s=16,w="duotone") => <PuzzlePiece size={s} weight={w}/>,
};

const AUTH_ICONS = {
  microsoft: <MicrosoftOutlookLogo size={18} weight="duotone"/>,
  elyby:     <Globe size={18} weight="duotone"/>,
  amoon:     <Crown size={18} weight="duotone"/>,
  offline:   <WifiSlash size={18} weight="duotone"/>,
};

const INSTALL_ICONS = {
  vanilla:  <Cube size={18} weight="duotone" color="#22c55e"/>,
  fabric:   <Scissors size={18} weight="duotone" color="#dbb86c"/>,
  forge:    <Hammer size={18} weight="duotone" color="#e06c3c"/>,
  neoforge: <Wrench size={18} weight="duotone" color="#f59e0b"/>,
  quilt:    <PuzzlePiece size={18} weight="duotone" color="#a78bfa"/>,
};

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ on, onChange }) {
  return (
    <div onClick={() => onChange(!on)} style={{ width:38, height:21, borderRadius:11, cursor:"pointer", background:on?C.accent:"rgba(255,255,255,0.1)", position:"relative", transition:"background .2s", flexShrink:0 }}>
      <div style={{ position:"absolute", width:15, height:15, background:"white", borderRadius:"50%", top:3, left:on?20:3, transition:"left .2s" }}/>
    </div>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, width=380 }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>
      <div style={{ background:C.sidebar, border:`1px solid ${C.border}`, borderRadius:16, padding:28, width }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <div style={{ fontSize:16, fontWeight:600, color:C.text }}>{title}</div>
          <div onClick={onClose} style={{ cursor:"pointer", color:C.text3, display:"flex" }}><X size={18}/></div>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Add Installation Modal ───────────────────────────────────────────────────
function AddInstallModal({ onClose }) {
  const { versions, addInstallation } = useStore();
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [loader, setLoader] = useState("vanilla");
  const releases = versions.filter(v=>v.type==="release");
  const handleAdd = () => {
    if (!name.trim()||!version) return;
    addInstallation({ id:Date.now().toString(), name:name.trim(), version, loader, icon:loader, ram:4096, width:854, height:480, fullscreen:false, jvmArgs:"" });
    onClose();
  };

  return (
    <Modal title="New installation" onClose={onClose}>
      {[
        { label:"Name", el:<input value={name} onChange={e=>setName(e.target.value)} placeholder="My Installation" style={inputStyle}/> },
        { label:"Version", el:
          <select value={version} onChange={e=>setVersion(e.target.value)} style={inputStyle}>
            <option value="">Select version...</option>
            {releases.slice(0,40).map(v=><option key={v.id} value={v.id}>{v.id}</option>)}
          </select>
        },
        { label:"Modloader", el:
          <select value={loader} onChange={e=>setLoader(e.target.value)} style={inputStyle}>
            {Object.keys(LOADER_ICONS).map(l=><option key={l} value={l}>{l.charAt(0).toUpperCase()+l.slice(1)}</option>)}
          </select>
        },
      ].map(({label,el})=>(
        <div key={label} style={{ marginBottom:14 }}>
          <div style={{ fontSize:12, color:C.text2, marginBottom:6 }}>{label}</div>
          {el}
        </div>
      ))}
      <div style={{ display:"flex", gap:8, marginTop:4 }}>
        <button onClick={handleAdd} disabled={!name.trim()||!version} style={{ ...btnPrimary, flex:1, justifyContent:"center", opacity:(!name.trim()||!version)?0.5:1 }}>Create</button>
        <button onClick={onClose} style={{ ...btnSecondary, flex:1, justifyContent:"center" }}>Cancel</button>
      </div>
    </Modal>
  );
}

// ─── Edit Installation Modal ──────────────────────────────────────────────────
function EditInstallModal({ inst, onClose }) {
  const { updateInstallation, versions } = useStore();
  const [name, setName]           = useState(inst.name);
  const [version, setVersion]     = useState(inst.version ?? "");
  const [loader, setLoader]       = useState(inst.loader);
  const [ram, setRam]             = useState(inst.ram ?? 4096);
  const [width, setWidth]         = useState(inst.width ?? 854);
  const [height, setHeight]       = useState(inst.height ?? 480);
  const [fullscreen, setFull]     = useState(inst.fullscreen ?? false);
  const [jvmArgs, setJvm]         = useState(inst.jvmArgs ?? "");
  const releases = versions.filter(v=>v.type==="release");

  const handleSave = () => {
    updateInstallation(inst.id, { name, version:version||null, loader, ram, width:+width, height:+height, fullscreen, jvmArgs });
    onClose();
  };

  const Row = ({ label, children }) => (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:12, color:C.text2, marginBottom:6 }}>{label}</div>
      {children}
    </div>
  );

  return (
    <Modal title="Edit installation" onClose={onClose} width={440}>
      <Row label="Name"><input value={name} onChange={e=>setName(e.target.value)} style={inputStyle}/></Row>
      <Row label="Version">
        <select value={version} onChange={e=>setVersion(e.target.value)} style={inputStyle}>
          <option value="">Latest release</option>
          {releases.slice(0,40).map(v=><option key={v.id} value={v.id}>{v.id}</option>)}
        </select>
      </Row>
      <Row label="Modloader">
        <select value={loader} onChange={e=>setLoader(e.target.value)} style={inputStyle}>
          {["vanilla","fabric","forge","neoforge","quilt"].map(l=><option key={l} value={l}>{l.charAt(0).toUpperCase()+l.slice(1)}</option>)}
        </select>
      </Row>
      <Row label={`Max RAM — ${Math.round(ram/1024)}GB`}>
        <input type="range" min={1024} max={16384} step={512} value={ram} onChange={e=>setRam(+e.target.value)} style={{ width:"100%", accentColor:C.accent }}/>
      </Row>
      <Row label="Resolution">
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <input value={width} onChange={e=>setWidth(e.target.value)} style={{ ...inputStyle, width:80 }} placeholder="854"/>
          <span style={{ color:C.text3 }}>×</span>
          <input value={height} onChange={e=>setHeight(e.target.value)} style={{ ...inputStyle, width:80 }} placeholder="480"/>
          <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, color:C.text2, cursor:"pointer" }}>
            <Toggle on={fullscreen} onChange={setFull}/>
            Fullscreen
          </label>
        </div>
      </Row>
      <Row label="JVM Arguments">
        <input value={jvmArgs} onChange={e=>setJvm(e.target.value)} placeholder="-XX:+UseG1GC -Xss1M" style={inputStyle}/>
      </Row>
      <div style={{ display:"flex", gap:8, marginTop:4 }}>
        <button onClick={handleSave} style={{ ...btnPrimary, flex:1, justifyContent:"center" }}>Save</button>
        <button onClick={onClose} style={{ ...btnSecondary, flex:1, justifyContent:"center" }}>Cancel</button>
      </div>
    </Modal>
  );
}

// ─── HOME panel ───────────────────────────────────────────────────────────────
function HomeContent({ onEditInst }) {
  return (
    <div style={{ padding:"20px 24px", overflowY:"auto", height:"100%", boxSizing:"border-box" }}>
      <div style={{ borderRadius:14, overflow:"hidden", marginBottom:20, background:"linear-gradient(135deg,#1a1f35,#0f1424)", border:`1px solid ${C.border}`, minHeight:200, display:"flex", alignItems:"flex-end", position:"relative" }}>
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom,transparent 30%,rgba(15,17,23,0.95) 100%)" }}/>
        <div style={{ position:"relative", padding:"20px 24px", width:"100%", boxSizing:"border-box" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
            <Sparkle size={12} color={C.accent}/><span style={{ fontSize:11, color:C.accent, textTransform:"uppercase", letterSpacing:1, fontWeight:600 }}>Latest news</span>
          </div>
          <div style={{ fontSize:18, fontWeight:700, color:C.text, marginBottom:4 }}>Minecraft Java Edition 1.21.4</div>
          <div style={{ fontSize:13, color:C.text2, marginBottom:14 }}>The newest release is now available. Explore new features and bug fixes.</div>
          <button style={{ ...btnPrimary, fontSize:13 }}><ArrowSquareOut size={14}/> Read more</button>
        </div>
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
        <Newspaper size={13} color={C.text3}/>
        <span style={{ fontSize:11, fontWeight:600, color:C.text3, textTransform:"uppercase", letterSpacing:1.2 }}>More news</span>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        {[
          { title:"Fabric 0.16.9 released",  sub:"New loader with performance improvements", tag:"Modloader", icon:<Scissors size={12} weight="duotone"/> },
          { title:"NeoForge 21.4 stable",    sub:"NeoForge for 1.21.4 is now stable",        tag:"Modloader", icon:<Wrench size={12} weight="duotone"/> },
          { title:"Modrinth new features",   sub:"Browse mods faster with new search",        tag:"Platform",  icon:<Fire size={12} weight="duotone"/> },
          { title:"Java 21 recommended",     sub:"Mojang recommends Java 21 for best perf",  tag:"Java",      icon:<Cpu size={12} weight="duotone"/> },
        ].map(({title,sub,tag,icon})=>(
          <div key={title} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 16px", cursor:"pointer" }}>
            <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:6 }}>
              <span style={{ color:C.accent }}>{icon}</span>
              <span style={{ fontSize:11, color:C.accent, fontWeight:500 }}>{tag}</span>
            </div>
            <div style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:4 }}>{title}</div>
            <div style={{ fontSize:12, color:C.text2, lineHeight:1.5 }}>{sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MODS panel ───────────────────────────────────────────────────────────────
function ModsPanel() {
  const { mods, modpacks, modsLoading, modpacksLoading, searchMods, searchModpacks,
          installMod, installations, selectedInstall } = useStore();
  const [tab, setTab]         = useState("mods");
  const [query, setQuery]     = useState("");
  const [installed, setInst]  = useState({});
  const [installing, setInstalling] = useState({});

  const selInst = installations.find(i => i.id === selectedInstall);
  const instDir = selInst ? `.amoon/instances/${selInst.id}` : ".amoon/instances/default";

  const handleInstall = async (mod) => {
    if (installed[mod.project_id] || installing[mod.project_id]) return;
    setInstalling(p => ({ ...p, [mod.project_id]: true }));
    try {
      await installMod(mod.project_id, selInst?.version ?? null, selInst?.loader ?? "fabric", instDir);
      setInst(p => ({ ...p, [mod.project_id]: true }));
    } catch { /* error logged in store */ }
    setInstalling(p => ({ ...p, [mod.project_id]: false }));
  };

  const handleSearch = () => {
    if (tab==="mods") searchMods(query||"optimization");
    else searchModpacks(query||"");
  };

  useEffect(() => { searchMods("optimization"); searchModpacks(""); }, []);

  const items   = tab==="mods" ? mods : modpacks;
  const loading = tab==="mods" ? modsLoading : modpacksLoading;

  return (
    <div style={{ padding:"20px 24px", display:"flex", flexDirection:"column", height:"100%", boxSizing:"border-box", overflow:"hidden" }}>
      {/* Tabs */}
      <div style={{ display:"flex", gap:4, marginBottom:16 }}>
        {[{id:"mods",icon:<PuzzlePiece size={14}/>},{id:"modpacks",icon:<Package size={14}/>}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:"7px 16px", borderRadius:8, border:"none", background:tab===t.id?C.accent:"rgba(255,255,255,0.06)", color:tab===t.id?"white":C.text2, fontSize:13, cursor:"pointer", fontFamily:"inherit", fontWeight:tab===t.id?500:400, display:"inline-flex", alignItems:"center", gap:5 }}>
            {t.icon} {t.id.charAt(0).toUpperCase()+t.id.slice(1)}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        <input
          value={query} onChange={e=>setQuery(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&handleSearch()}
          placeholder={`Search ${tab} on Modrinth...`}
          style={{ ...inputStyle }}
        />
        <button onClick={handleSearch} style={{ ...btnPrimary, flexShrink:0 }}>
          <MagnifyingGlass size={15}/>
        </button>
      </div>

      {/* Results */}
      <div style={{ flex:1, overflowY:"auto" }}>
        {loading ? (
          <div style={{ textAlign:"center", color:C.text2, padding:40, fontSize:13, display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
            <CircleNotch size={24} className="spin"/>
            Searching Modrinth...
          </div>
        ) : items.length===0 ? (
          <div style={{ textAlign:"center", color:C.text3, padding:40, fontSize:13, display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
            <MagnifyingGlass size={28} weight="duotone"/>
            No results
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {items.map(mod=>(
              <div key={mod.project_id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
                {mod.icon_url
                  ? <img src={mod.icon_url} style={{ width:44, height:44, borderRadius:10, objectFit:"cover", flexShrink:0 }} alt=""/>
                  : <div style={{ width:44, height:44, borderRadius:10, background:"rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><Package size={20} color={C.text3}/></div>
                }
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:2 }}>{mod.title}</div>
                  <div style={{ fontSize:12, color:C.text2, marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{mod.description}</div>
                  <div style={{ fontSize:11, color:C.text3, display:"flex", alignItems:"center", gap:4 }}>
                    <DownloadSimple size={11}/> {(mod.downloads/1e6).toFixed(1)}M
                    <span style={{ margin:"0 2px" }}>·</span>
                    <Tag size={11}/> {mod.categories?.slice(0,3).join(", ")}
                  </div>
                </div>
                <button
                  onClick={() => handleInstall(mod)}
                  disabled={!!installed[mod.project_id] || !!installing[mod.project_id]}
                  style={{ ...installed[mod.project_id] ? { ...btnSecondary, color:C.green, borderColor:"rgba(34,197,94,0.3)" } : btnPrimary, flexShrink:0, padding:"7px 14px", fontSize:12, opacity: installing[mod.project_id] ? 0.6 : 1 }}
                >
                  {installed[mod.project_id] ? <><CheckCircle size={13}/>Installed</> : installing[mod.project_id] ? <><CircleNotch size={13} className="spin"/>Installing...</> : <><DownloadSimple size={13}/>Install</>}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ACCOUNTS panel ───────────────────────────────────────────────────────────
function AccountsPanel({ onAddAccount }) {
  const { accounts, activeAccountId, switchAccount, removeAccount } = useStore();

  return (
    <div style={{ padding:"20px 24px", overflowY:"auto", height:"100%", boxSizing:"border-box" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <div style={{ fontSize:16, fontWeight:600, color:C.text }}>Accounts</div>
        <button onClick={onAddAccount} style={{ ...btnPrimary, padding:"7px 14px", fontSize:12 }}>
          <Plus size={13}/> Add account
        </button>
      </div>

      {accounts.length===0 ? (
        <div style={{ textAlign:"center", padding:40, color:C.text3, fontSize:13, display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
          <UserCircle size={40} weight="duotone" color={C.text3}/>
          No accounts yet. Add one to start playing!
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {accounts.map(acc=>(
            <div key={acc.id} onClick={()=>switchAccount(acc.id)} style={{ background:C.card, border:`1px solid ${activeAccountId===acc.id?C.accent:C.border}`, borderRadius:12, padding:"14px 16px", display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}>
              <div style={{ width:44, height:44, borderRadius:10, background:`linear-gradient(135deg,${C.accent},#1d4ed8)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:700, color:"white", flexShrink:0 }}>
                {acc.username.slice(0,2).toUpperCase()}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600, color:C.text }}>{acc.username}</div>
                <div style={{ fontSize:12, color:C.text3, marginTop:2 }}>Offline mode · UUID: {acc.uuid?.slice(0,8)}...</div>
              </div>
              {activeAccountId===acc.id && (
                <span style={{ fontSize:11, padding:"3px 8px", borderRadius:20, background:"rgba(34,197,94,0.12)", color:C.green, border:"1px solid rgba(34,197,94,0.25)", display:"inline-flex", alignItems:"center", gap:4 }}><CheckCircle size={12} weight="fill"/> Active</span>
              )}
              <div onClick={e=>{e.stopPropagation();removeAccount(acc.id);}} style={{ color:C.text3, cursor:"pointer", display:"flex", padding:4, borderRadius:6 }}>
                <Trash size={15}/>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop:16, padding:"14px 16px", background:C.card, border:`1px solid ${C.border}`, borderRadius:12, fontSize:12, color:C.text3, display:"flex", alignItems:"center", gap:8 }}>
        <Info size={16} weight="duotone" color={C.accent}/>
        Click "Add account" to login with Microsoft, Ely.by, or offline mode.
      </div>
    </div>
  );
}

// ─── CONSOLE panel ────────────────────────────────────────────────────────────
function ConsolePanel() {
  const { consoleLogs, clearLogs } = useStore();
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [consoleLogs]);

  return (
    <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", height:"100%", boxSizing:"border-box", overflow:"hidden" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <Terminal size={15} color={C.text2}/>
          <span style={{ fontSize:14, fontWeight:600, color:C.text }}>Console</span>
        </div>
        <button onClick={clearLogs} style={{ ...btnSecondary, padding:"5px 12px", fontSize:12 }}><Broom size={13}/> Clear</button>
      </div>
      <div style={{ flex:1, background:"#090c12", borderRadius:10, border:`1px solid ${C.border}`, padding:"12px 14px", overflowY:"auto", fontFamily:"monospace", fontSize:12, lineHeight:1.7 }}>
        {consoleLogs.length===0
          ? <div style={{ color:C.text3, display:"flex", alignItems:"center", gap:6 }}><Terminal size={14}/> No output yet. Launch a game to see logs.</div>
          : consoleLogs.map((log,i)=>(
            <div key={i} style={{ color: log.includes("Error")||log.includes("error") ? C.red : log.includes("[AMoon]") ? C.accent : "#a0aec0" }}>{log}</div>
          ))
        }
        <div ref={bottomRef}/>
      </div>
    </div>
  );
}

// ─── SETTINGS panel ───────────────────────────────────────────────────────────
function SettingsPanel() {
  const { java, javaLoading, detectJava } = useStore();
  const loadSettings = () => {
    try { return JSON.parse(localStorage.getItem("amoon-settings") || "{}"); } catch { return {}; }
  };
  const saved = loadSettings();
  const [discord,  setDiscord]  = useState(saved.discord  ?? true);
  const [closeOnL, setCloseOnL] = useState(saved.closeOnL ?? false);
  const [gpu,      setGpu]      = useState(saved.gpu      ?? false);
  const [dns,      setDns]      = useState(saved.dns      ?? true);

  const saveSetting = (key, val) => {
    const cur = loadSettings();
    localStorage.setItem("amoon-settings", JSON.stringify({ ...cur, [key]: val }));
  };

  const Section = ({title,children}) => (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:11, fontWeight:600, color:C.text3, textTransform:"uppercase", letterSpacing:1.2, marginBottom:10 }}>{title}</div>
      <div style={{ background:C.card, borderRadius:12, border:`1px solid ${C.border}`, overflow:"hidden" }}>
        {children}
      </div>
    </div>
  );
  const Row = ({icon,label,desc,right}) => (
    <div style={{ padding:"13px 16px", display:"flex", alignItems:"center", gap:12, borderBottom:`1px solid ${C.border}` }}>
      {icon && <div style={{ color:C.text3, display:"flex", flexShrink:0 }}>{icon}</div>}
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, color:C.text }}>{label}</div>
        {desc && <div style={{ fontSize:11, color:C.text3, marginTop:2 }}>{desc}</div>}
      </div>
      {right}
    </div>
  );

  return (
    <div style={{ padding:"20px 24px", overflowY:"auto", height:"100%", boxSizing:"border-box" }}>
      <div style={{ fontSize:18, fontWeight:600, color:C.text, marginBottom:20, display:"flex", alignItems:"center", gap:8 }}><GearSix size={20} weight="duotone"/> Launcher Settings</div>
      <Section title="Java">
        <Row icon={<Cpu size={17}/>} label="Java installation" desc={java?java.path:"No Java detected"} right={
          <button onClick={detectJava} disabled={javaLoading} style={{ ...btnSecondary, padding:"6px 14px", fontSize:12 }}>
            <ArrowsClockwise size={13}/>{javaLoading?"Detecting...":java?`Java ${java.major_version} ✓`:"Detect Java"}
          </button>
        }/>
      </Section>
      <Section title="Performance">
        <Row icon={<HardDrive size={17}/>} label="Use Dedicated GPU" desc="Force dedicated GPU on dual-GPU systems" right={<Toggle on={gpu} onChange={v=>{setGpu(v);saveSetting("gpu",v);}}/>}/>
      </Section>
      <Section title="Features">
        <Row icon={<DiscordLogo size={17}/>} label="Discord Rich Presence" right={<Toggle on={discord} onChange={v=>{setDiscord(v);saveSetting("discord",v);}}/>}/>
        <Row icon={<Lightning size={17}/>} label="DNS Override" desc="Better connectivity" right={<Toggle on={dns} onChange={v=>{setDns(v);saveSetting("dns",v);}}/>}/>
        <Row icon={<GameController size={17}/>} label="Close launcher on game start" right={<Toggle on={closeOnL} onChange={v=>{setCloseOnL(v);saveSetting("closeOnL",v);}}/>}/>
      </Section>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const {
    accounts, activeAccountId, java, javaLoading,
    launching, launchError, launchSuccess,
    detectJava, fetchVersions, launchGame, isVersionInstalled, versions,
    installations, selectedInstall, setSelectedInstall,
    activePanel, setActivePanel, consoleLogs,
  } = useStore();

  const account = accounts.find(a=>a.id===activeAccountId) ?? null;

  const [showLogin,    setShowLogin]    = useState(false);
  const [showAddInst,  setShowAddInst]  = useState(false);
  const [editInst,     setEditInst]     = useState(null);
  const [showWizard,   setShowWizard]   = useState(false);

  useEffect(() => { detectJava(); fetchVersions(); }, []);

  const selInst   = installations.find(i=>i.id===selectedInstall);
  const releases  = versions.filter(v=>v.type==="release");
  const snaps     = versions.filter(v=>v.type==="snapshot");
  const playVer   = selInst?.version ?? (selInst?.id==="snap"?snaps[0]?.id:releases[0]?.id) ?? "...";
  const loaderLbl = selInst ? `${selInst.loader==="vanilla"?"":selInst.loader+"-"}${playVer}` : "...";

  const handlePlay = async () => {
    if (!account) { setShowLogin(true); return; }
    const ver = selInst?.version ?? (selInst?.id === "snap" ? snaps[0]?.id : releases[0]?.id);
    if (!ver) return;
    const installed = await isVersionInstalled(ver);
    if (installed) {
      launchGame();
    } else {
      setShowWizard(true);
    }
  };

  const NAV = [
    { id:"home",     label:"Home",     icon:<House size={16} weight="duotone"/> },
    { id:"mods",     label:"Mods",     icon:<PuzzlePiece size={16} weight="duotone"/> },
    { id:"accounts", label:"Accounts", icon:<Users size={16} weight="duotone"/> },
    { id:"console",  label:"Console",  icon:<Terminal size={16} weight="duotone"/>, badge: consoleLogs.length>0 },
    { id:"settings", label:"Settings", icon:<GearSix size={16} weight="duotone"/> },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:C.bg, color:C.text, fontFamily:"'Outfit','Segoe UI',sans-serif", overflow:"hidden" }}>

      {showLogin   && <LoginModal onClose={()=>setShowLogin(false)}/>}
      {showAddInst && <AddInstallModal onClose={()=>setShowAddInst(false)}/>}
      {editInst    && <EditInstallModal inst={editInst} onClose={()=>setEditInst(null)}/>}
      {showWizard  && (
        <InstallWizard
          installation={selInst}
          versionId={playVer}
          onClose={() => setShowWizard(false)}
          onComplete={() => { setShowWizard(false); launchGame(); }}
        />
      )}

      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* ── Sidebar ───────────────────────────────────────── */}
        <div style={{ width:220, background:C.sidebar, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", flexShrink:0 }}>

          {/* Account */}
          <div onClick={()=>!account&&setShowLogin(true)} style={{ padding:"14px 12px", borderBottom:`1px solid ${C.border}`, cursor:account?"default":"pointer" }}>
            {account ? (
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:36, height:36, borderRadius:8, background:`linear-gradient(135deg,${C.accent},#1d4ed8)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"white", flexShrink:0 }}>
                  {account.username.slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, color:C.text3 }}>Logged in as</div>
                  <div style={{ fontSize:13, fontWeight:600, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{account.username}</div>
                </div>
                <div onClick={e=>{e.stopPropagation();setActivePanel("accounts");}} style={{ color:C.text3, cursor:"pointer", display:"flex", padding:4, borderRadius:6 }}>
                  <PencilSimple size={14}/>
                </div>
              </div>
            ) : (
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:36, height:36, borderRadius:8, background:"rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <UserCircle size={20} weight="duotone" color={C.text2}/>
                </div>
                <span style={{ fontSize:13, color:C.text2, display:"inline-flex", alignItems:"center", gap:5 }}><SignIn size={13}/> Click to login</span>
              </div>
            )}
          </div>

          {/* Nav */}
          <div style={{ padding:"8px 8px 4px" }}>
            {NAV.map(n=>(
              <div key={n.id} onClick={()=>setActivePanel(n.id)} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 10px", borderRadius:8, cursor:"pointer", background:activePanel===n.id?"rgba(37,99,235,0.15)":"transparent", color:activePanel===n.id?C.accent:C.text2, marginBottom:2, position:"relative" }}>
                {n.icon}
                <span style={{ fontSize:13 }}>{n.label}</span>
                {n.badge && <div style={{ width:6, height:6, borderRadius:"50%", background:C.green, marginLeft:"auto" }}/>}
              </div>
            ))}
          </div>

          {/* Installations list */}
          <div style={{ padding:"0 8px", flex:1, overflowY:"auto" }}>
            <div style={{ display:"flex", alignItems:"center", padding:"8px 10px 6px" }}>
              <span style={{ fontSize:11, fontWeight:600, color:C.text3, textTransform:"uppercase", letterSpacing:1, flex:1 }}>Installations</span>
              <div onClick={()=>setShowAddInst(true)} style={{ cursor:"pointer", color:C.text3, display:"flex", padding:4, borderRadius:5 }}>
                <Plus size={14} weight="bold"/>
              </div>
            </div>

            {installations.map(inst=>(
              <div key={inst.id} onClick={()=>{setSelectedInstall(inst.id);setActivePanel("home");}} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 10px", borderRadius:8, cursor:"pointer", marginBottom:2, background:selectedInstall===inst.id&&activePanel==="home"?"rgba(37,99,235,0.15)":"transparent", color:selectedInstall===inst.id&&activePanel==="home"?C.text:C.text2, position:"relative" }}
                onContextMenu={e=>{e.preventDefault();setEditInst(inst);}}
              >
                <span style={{ display:"flex", flexShrink:0 }}>{INSTALL_ICONS[inst.loader] || INSTALL_ICONS[inst.icon] || <Cube size={18} weight="duotone" color={C.text3}/>}</span>
                <span style={{ fontSize:13, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{inst.name}</span>
                <div onClick={e=>{e.stopPropagation();setEditInst(inst);}} style={{ color:C.text3, display:"flex", padding:2, opacity:0, transition:"opacity .15s" }}
                  onMouseEnter={e=>e.currentTarget.style.opacity=1}
                  onMouseLeave={e=>e.currentTarget.style.opacity=0}
                >
                  <GearSix size={13}/>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Content ───────────────────────────────────────── */}
        <div style={{ flex:1, overflow:"hidden" }}>
          {activePanel==="home"     && <HomeContent onEditInst={setEditInst}/>}
          {activePanel==="mods"     && <ModsPanel/>}
          {activePanel==="accounts" && <AccountsPanel onAddAccount={()=>setShowLogin(true)}/>}
          {activePanel==="console"  && <ConsolePanel/>}
          {activePanel==="settings" && <SettingsPanel/>}
        </div>
      </div>

      {/* ── Bottom bar ────────────────────────────────────── */}
      <div style={{ height:64, background:C.sidebar, borderTop:`1px solid ${C.border}`, display:"flex", alignItems:"center", padding:"0 20px", gap:16, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:java?C.green:C.red, flexShrink:0 }}/>
          <Cpu size={13} color={C.text2}/>
          <span style={{ fontSize:12, color:C.text2 }}>{javaLoading?"Detecting...":java?`Java ${java.major_version}`:"Not found"}</span>
        </div>

        {selInst && (
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:12, color:C.text3 }}>{INSTALL_ICONS[selInst.loader] || <Cube size={14} weight="duotone"/>} {selInst.name}</span>
            <div onClick={()=>setEditInst(selInst)} style={{ cursor:"pointer", color:C.text3, display:"flex" }}><GearSix size={13}/></div>
          </div>
        )}

        <div style={{ flex:1 }}/>

        {launchError   && <span style={{ fontSize:12, color:C.red,   maxWidth:300, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"inline-flex", alignItems:"center", gap:5 }}><Warning size={14} weight="fill"/>{launchError}</span>}
        {launchSuccess && <span style={{ fontSize:12, color:C.green, maxWidth:300, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"inline-flex", alignItems:"center", gap:5 }}><CheckCircle size={14} weight="fill"/>{launchSuccess}</span>}

        <button onClick={handlePlay} disabled={launching} style={{
          background:launching?"rgba(37,99,235,0.5)":C.accent, color:"white", border:"none",
          padding:"0 32px", height:44, borderRadius:10, fontSize:14, fontWeight:700,
          cursor:launching?"default":"pointer", fontFamily:"inherit", letterSpacing:0.5,
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
          minWidth:160, transition:"background .15s", gap:1,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
            {launching ? <Rocket size={15} weight="fill"/> : <Play size={15} weight="fill"/>}
            {launching?"LAUNCHING...":"PLAY"}
          </div>
          <span style={{ fontSize:10, fontWeight:400, opacity:0.7 }}>{loaderLbl}</span>
        </button>
      </div>
    </div>
  );
}