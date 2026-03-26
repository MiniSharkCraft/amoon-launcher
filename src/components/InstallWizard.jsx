// src/components/InstallWizard.jsx — GUI installer wizard (Discord/Steam style)
import { useState, useEffect, useRef } from "react";
import {
  CheckCircle, Circle, ArrowRight, ArrowLeft, X,
  ShieldCheck, HardDrive, Cpu, Package,
  DownloadSimple, CircleNotch, Warning, XCircle,
  FolderOpen, Rocket, GameController, Leaf,
  Hammer, Wrench, Scissors, PuzzlePiece, Cube,
  Memory, Desktop, Globe, Confetti,
} from "@phosphor-icons/react";
import useStore from "../store";

const A = "#2563EB";   // accent blue
const T = "#f0f4ff";   // text
const T2 = "#8892a4";  // text dim
const T3 = "#3a4556";  // text muted
const BG = "#0f1117";
const CARD = "#161b24";
const BORDER = "rgba(255,255,255,0.07)";
const GREEN = "#22c55e";
const RED = "#ef4444";
const YELLOW = "#eab308";

const STEPS = [
  { id: "welcome",  label: "Welcome"         },
  { id: "eula",     label: "License"         },
  { id: "location", label: "Install location"},
  { id: "syscheck", label: "System check"    },
  { id: "install",  label: "Installing"      },
  { id: "finish",   label: "Finish"          },
];

const EULA_TEXT = `MINECRAFT END USER LICENSE AGREEMENT

By installing or using Minecraft, you agree to these terms:

1. LICENSE
   Mojang AB ("Mojang") grants you a personal, non-exclusive,
   non-transferable license to install and use Minecraft on devices
   you own or control for personal, non-commercial use.

2. RESTRICTIONS
   You may not copy, modify, rent, sell, or distribute the game
   without Mojang's written permission. You may not reverse engineer
   or create derivative works based on the game.

3. ONLINE SERVICES
   Online features require a valid Minecraft account. Mojang may
   modify or discontinue online services at any time without notice.

4. UPDATES
   The game may be updated automatically. Some updates may be
   required to continue using certain features.

5. INTELLECTUAL PROPERTY
   All rights, title, and interest in the game remain with Mojang.
   Mojang® and Minecraft® are registered trademarks of Mojang AB.

6. TERMINATION
   This license terminates automatically if you breach any term.
   Upon termination, you must destroy all copies of the game.

7. DISCLAIMER
   The game is provided "as is" without warranty of any kind.
   Mojang is not liable for any damages arising from its use.

Full EULA: https://www.minecraft.net/en-us/eula`;

export default function InstallWizard({ installation, versionId, onClose, onComplete }) {
  const { checkSystem, downloadVersion, downloadProgress, java, downloadJava, javaLoading, installFabric, updateInstallation } = useStore();

  const [step,        setStep]       = useState(0);
  const [eulaOk,      setEulaOk]     = useState(false);
  const [installDir,  setInstallDir] = useState(".amoon");
  const [sysInfo,     setSysInfo]    = useState(null);
  const [sysLoading,  setSysLoading] = useState(false);
  const [installing,  setInstalling] = useState(false);
  const [done,        setDone]       = useState(false);
  const [error,       setError]      = useState(null);
  const eulaRef = useRef(null);

  // Syscheck khi vào step 3
  useEffect(() => {
    if (STEPS[step].id !== "syscheck") return;
    setSysLoading(true);
    checkSystem(installDir).then(info => {
      setSysInfo(info);
      setSysLoading(false);
    }).catch(() => setSysLoading(false));
  }, [step]);

  // Install khi vào step 4 — dùng ref để chắc chắn chỉ chạy 1 lần
  const installStarted = useRef(false);
  useEffect(() => {
    if (STEPS[step].id !== "install" || installStarted.current) return;
    installStarted.current = true;
    runInstall();
  }, [step]);

  const runInstall = async () => {
    setInstalling(true);
    setError(null);
    try {
      if (!java) await downloadJava(21);
      await downloadVersion(versionId, installDir);

      // Install Fabric if needed
      const loader = installation?.loader ?? "vanilla";
      if (loader === "fabric") {
        await installFabric(versionId, installDir);
      }

      // Save gameDir back to the installation record
      if (installation?.id) {
        updateInstallation(installation.id, { gameDir: installDir, version: versionId });
      }

      setDone(true);
      setTimeout(() => setStep(5), 600);
    } catch (e) {
      setError(String(e));
    }
    setInstalling(false);
  };

  const canNext = () => {
    const id = STEPS[step].id;
    if (id === "eula")     return eulaOk;
    if (id === "syscheck") return !sysLoading;
    if (id === "install")  return done;
    return true;
  };

  const next = () => { if (step < STEPS.length - 1) setStep(s => s + 1); };
  const back = () => { if (step > 0) setStep(s => s - 1); };

  const pct = downloadProgress
    ? Math.round((downloadProgress.completed / Math.max(downloadProgress.total, 1)) * 100)
    : 0;

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999,
      background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: 780, height: 520,
        background: BG, borderRadius: 14,
        border: `1px solid ${BORDER}`,
        boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
        display: "flex", flexDirection: "column",
        overflow: "hidden", fontFamily: "'Outfit','Segoe UI',sans-serif",
      }}>

        {/* ── Title bar ── */}
        <div style={{
          height: 42, background: CARD,
          borderBottom: `1px solid ${BORDER}`,
          display: "flex", alignItems: "center",
          padding: "0 16px", gap: 10, flexShrink: 0,
        }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }}/>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#eab308" }}/>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }}/>
          <span style={{ fontSize: 13, color: T2, marginLeft: 8, flex: 1 }}>
            AMoon Launcher Setup — Minecraft {versionId}
          </span>
          {STEPS[step].id !== "install" && (
            <div onClick={onClose} style={{ cursor: "pointer", color: T3, display: "flex", padding: 4, borderRadius: 6 }}>
              <X size={15}/>
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* ── Sidebar ── */}
          <div style={{
            width: 200, background: "rgba(255,255,255,0.02)",
            borderRight: `1px solid ${BORDER}`,
            padding: "28px 0", flexShrink: 0,
            display: "flex", flexDirection: "column", gap: 2,
          }}>
            {/* Logo */}
            <div style={{ padding: "0 20px 24px", borderBottom: `1px solid ${BORDER}`, marginBottom: 8 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: `linear-gradient(135deg, ${A}, #1d4ed8)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 800, color: "white", marginBottom: 8,
              }}>A</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T }}>AMoon Launcher</div>
              <div style={{ fontSize: 11, color: T3 }}>v0.1.0 Setup</div>
            </div>

            {STEPS.map((s, i) => {
              const done_s = i < step;
              const active = i === step;
              return (
                <div key={s.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 20px", fontSize: 13,
                  color: active ? T : done_s ? GREEN : T3,
                  background: active ? "rgba(37,99,235,0.12)" : "transparent",
                  borderLeft: active ? `2px solid ${A}` : "2px solid transparent",
                }}>
                  {done_s
                    ? <CheckCircle size={15} weight="fill" color={GREEN}/>
                    : active
                      ? <Circle size={15} weight="fill" color={A}/>
                      : <Circle size={15} color={T3}/>
                  }
                  {s.label}
                </div>
              );
            })}
          </div>

          {/* ── Main content ── */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "32px 36px" }}>
              <StepContent
                stepId={STEPS[step].id}
                eulaOk={eulaOk} setEulaOk={setEulaOk} eulaRef={eulaRef}
                installDir={installDir} setInstallDir={setInstallDir}
                sysInfo={sysInfo} sysLoading={sysLoading}
                java={java} javaLoading={javaLoading}
                installing={installing} done={done} error={error}
                pct={pct} downloadProgress={downloadProgress}
                versionId={versionId} installation={installation}
                onRetry={runInstall}
              />
            </div>

            {/* ── Footer buttons ── */}
            <div style={{
              height: 64, borderTop: `1px solid ${BORDER}`,
              display: "flex", alignItems: "center",
              padding: "0 32px", gap: 10, flexShrink: 0,
              background: "rgba(255,255,255,0.01)",
            }}>
              <div style={{ flex: 1 }}/>

              {step > 0 && STEPS[step].id !== "install" && STEPS[step].id !== "finish" && (
                <button onClick={back} style={btnSec}>
                  <ArrowLeft size={14}/> Back
                </button>
              )}

              {STEPS[step].id === "finish" ? (
                <button onClick={() => { onComplete?.(); onClose(); }} style={btnPri}>
                  <Rocket size={14}/> Launch Game
                </button>
              ) : STEPS[step].id === "install" ? (
                error ? (
                  <button onClick={runInstall} style={btnPri}>
                    Retry
                  </button>
                ) : null
              ) : (
                <button
                  onClick={next}
                  disabled={!canNext()}
                  style={{ ...btnPri, opacity: canNext() ? 1 : 0.4 }}
                >
                  {step === STEPS.length - 2 ? "Install" : "Next"} <ArrowRight size={14}/>
                </button>
              )}

              {STEPS[step].id !== "install" && STEPS[step].id !== "finish" && (
                <button onClick={onClose} style={btnSec}>Cancel</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step content components ──────────────────────────────────────────────────

function StepContent(p) {
  switch (p.stepId) {
    case "welcome":  return <StepWelcome {...p}/>;
    case "eula":     return <StepEula {...p}/>;
    case "location": return <StepLocation {...p}/>;
    case "syscheck": return <StepSyscheck {...p}/>;
    case "install":  return <StepInstall {...p}/>;
    case "finish":   return <StepFinish {...p}/>;
    default: return null;
  }
}

function H({ title, sub }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: T, marginBottom: 6 }}>{title}</div>
      {sub && <div style={{ fontSize: 13, color: T2, lineHeight: 1.6 }}>{sub}</div>}
    </div>
  );
}

const LOADER_ICON = {
  vanilla:  <Cube      size={18} weight="duotone" color="#22c55e"/>,
  fabric:   <Scissors  size={18} weight="duotone" color="#dbb86c"/>,
  forge:    <Hammer    size={18} weight="duotone" color="#e06c3c"/>,
  neoforge: <Wrench    size={18} weight="duotone" color="#f59e0b"/>,
  quilt:    <PuzzlePiece size={18} weight="duotone" color="#a78bfa"/>,
};

function StepWelcome({ versionId, installation }) {
  const loader = installation?.loader ?? "vanilla";
  return (
    <>
      <H title="Welcome to AMoon Launcher Setup"
         sub="This wizard will guide you through the installation of Minecraft and all required components." />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          { icon: <GameController size={18} weight="duotone" color={A}/>,   title: `Minecraft ${versionId}`,  sub: "Game client, libraries, and assets" },
          { icon: <Memory size={18} weight="duotone" color="#a78bfa"/>,      title: "Java 21 Runtime",          sub: "Auto-downloaded if not found (~170MB)" },
          { icon: LOADER_ICON[loader] ?? LOADER_ICON.vanilla,                title: loader === "vanilla" ? "Vanilla Minecraft" : `${loader.charAt(0).toUpperCase()+loader.slice(1)} Loader`, sub: loader === "vanilla" ? "Pure vanilla, no mods" : `${loader} mod loader will be installed` },
        ].map((row, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "14px 16px", borderRadius: 10,
            background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`,
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {row.icon}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T }}>{row.title}</div>
              <div style={{ fontSize: 12, color: T2, marginTop: 2 }}>{row.sub}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20, fontSize: 12, color: T3 }}>
        Click <strong style={{ color: T2 }}>Next</strong> to continue.
      </div>
    </>
  );
}

function StepEula({ eulaOk, setEulaOk, eulaRef }) {
  return (
    <>
      <H title="License Agreement"
         sub="Please read the Minecraft End User License Agreement carefully." />
      <div
        ref={eulaRef}
        style={{
          height: 220, overflowY: "auto", background: "#090c12",
          borderRadius: 8, border: `1px solid ${BORDER}`,
          padding: "14px 16px", fontFamily: "monospace",
          fontSize: 11.5, color: T2, lineHeight: 1.75,
          whiteSpace: "pre-wrap", marginBottom: 18,
        }}>
        {EULA_TEXT}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        <div
          onClick={() => setEulaOk(v => !v)}
          style={{
            width: 18, height: 18, borderRadius: 4, flexShrink: 0,
            border: `2px solid ${eulaOk ? A : BORDER}`,
            background: eulaOk ? A : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all .15s",
          }}>
          {eulaOk && <CheckCircle size={11} weight="fill" color="white"/>}
        </div>
        <span style={{ fontSize: 13, color: T2 }}>
          I have read and accept the <span style={{ color: A }}>Minecraft EULA</span>
        </span>
      </label>
    </>
  );
}

function StepLocation({ installDir, setInstallDir }) {
  const presets = [
    { label: "Default",  path: ".amoon" },
    { label: "Home",     path: `${typeof window !== "undefined" ? "~" : "~"}/.amoon` },
    { label: "Custom",   path: null },
  ];
  const [custom, setCustom] = useState(false);
  return (
    <>
      <H title="Choose Install Location"
         sub="Select where AMoon Launcher will store game files, mods, and assets." />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {presets.map((p, i) => (
          <div
            key={i}
            onClick={() => { if (p.path) { setInstallDir(p.path); setCustom(false); } else setCustom(true); }}
            style={{
              padding: "12px 16px", borderRadius: 10, cursor: "pointer",
              border: `1px solid ${(p.path ? installDir === p.path : custom) ? A : BORDER}`,
              background: (p.path ? installDir === p.path : custom) ? "rgba(37,99,235,0.1)" : "rgba(255,255,255,0.02)",
              display: "flex", alignItems: "center", gap: 12,
            }}>
            <div style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0, border: `2px solid ${(p.path ? installDir === p.path : custom) ? A : T3}`, background: (p.path ? installDir === p.path : custom) ? A : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {(p.path ? installDir === p.path : custom) && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "white" }}/>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T }}>{p.label}</div>
              <div style={{ fontSize: 11, color: T3, marginTop: 2 }}>{p.path || "Enter custom path below"}</div>
            </div>
            {(p.path ? installDir === p.path : custom) && <CheckCircle size={16} weight="fill" color={A}/>}
          </div>
        ))}
      </div>
      {custom && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={installDir}
            onChange={e => setInstallDir(e.target.value)}
            placeholder="e.g. /home/user/.minecraft"
            style={{ flex: 1, background: "rgba(255,255,255,0.05)", color: T, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, fontFamily: "inherit", outline: "none" }}
          />
        </div>
      )}
      <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, fontSize: 12, color: T3, display: "flex", gap: 8, alignItems: "center" }}>
        <HardDrive size={14} color={T3}/>
        Install path: <span style={{ color: T2 }}>{installDir}</span>
      </div>
    </>
  );
}

function CheckRow({ label, sub, status, icon }) {
  const statusIcon = status === "loading" ? <CircleNotch size={15} className="spin" color={T3}/>
    : status === "ok"   ? <CheckCircle size={15} weight="fill" color={GREEN}/>
    : status === "warn" ? <Warning     size={15} weight="fill" color={YELLOW}/>
    : <XCircle size={15} weight="fill" color={RED}/>;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
      {icon && (
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: T3 }}>
          {icon}
        </div>
      )}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: T }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: T3, marginTop: 2 }}>{sub}</div>}
      </div>
      {statusIcon}
    </div>
  );
}

function StepSyscheck({ sysInfo, sysLoading, java }) {
  const s = sysInfo;
  const ramGB  = s ? (s.total_ram_mb / 1024).toFixed(1) : null;
  const diskGB = s ? (s.free_disk_mb / 1024).toFixed(1) : null;
  return (
    <>
      <H title="System Check" sub="Verifying your system meets the minimum requirements." />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <CheckRow
          icon={<Memory size={16} weight="duotone"/>}
          label={s ? `RAM: ${ramGB}GB installed` : "Checking RAM..."}
          sub={s ? (s.total_ram_mb >= 4096 ? "Great — 4GB+ recommended" : s.total_ram_mb >= 2048 ? "OK — 4GB recommended for best performance" : "Low — may experience lag") : null}
          status={sysLoading ? "loading" : !s ? "loading" : s.total_ram_mb >= 2048 ? (s.total_ram_mb >= 4096 ? "ok" : "warn") : "fail"}
        />
        <CheckRow
          icon={<HardDrive size={16} weight="duotone"/>}
          label={s ? `Free disk: ${diskGB}GB available` : "Checking disk space..."}
          sub={s ? (s.free_disk_mb >= 4096 ? "Plenty of space" : s.free_disk_mb >= 1024 ? "Sufficient (4GB+ recommended)" : "Low disk space") : null}
          status={sysLoading ? "loading" : !s ? "loading" : s.free_disk_mb >= 1024 ? (s.free_disk_mb >= 4096 ? "ok" : "warn") : "fail"}
        />
        <CheckRow
          icon={<Desktop size={16} weight="duotone"/>}
          label={s ? `CPU: ${s.cpu_name}` : "Checking CPU..."}
          sub={s ? `${s.cpu_count} cores · ${s.os} ${s.arch}` : null}
          status={sysLoading ? "loading" : !s ? "loading" : "ok"}
        />
        <CheckRow
          icon={<Cpu size={16} weight="duotone"/>}
          label={java ? `Java ${java.major_version} — ready` : "Java not found"}
          sub={java ? java.path : "Will be downloaded automatically (~170MB)"}
          status={sysLoading ? "loading" : java ? "ok" : "warn"}
        />
      </div>
      {s && !s.meets_min && (
        <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", fontSize: 12, color: "#fca5a5" }}>
          Your system doesn't meet minimum requirements. Minecraft may run poorly.
        </div>
      )}
    </>
  );
}

function StepInstall({ installing, done, error, pct, downloadProgress, onRetry, javaLoading }) {
  return (
    <>
      <H
        title={done ? "Installation complete!" : error ? "Installation failed" : "Installing Minecraft..."}
        sub={done ? "All files have been downloaded and verified." : error ? null : "Please wait while files are being downloaded."}
      />

      {!done && !error && (
        <div style={{ marginBottom: 28 }}>
          {/* Big progress bar */}
          <div style={{ width: "100%", height: 10, borderRadius: 5, background: "rgba(255,255,255,0.07)", overflow: "hidden", marginBottom: 10 }}>
            <div style={{ width: `${pct}%`, height: "100%", borderRadius: 5, background: `linear-gradient(90deg, ${A}, #3b82f6)`, transition: "width 0.4s ease", boxShadow: `0 0 12px ${A}66` }}/>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T3, marginBottom: 20 }}>
            <span style={{ color: T2 }}>{downloadProgress?.current || (javaLoading ? "Downloading Java 21..." : "Preparing...")}</span>
            <span style={{ fontWeight: 600, color: T }}>{pct}%</span>
          </div>

          {/* File count */}
          {downloadProgress && (
            <div style={{ display: "flex", gap: 20 }}>
              {[
                { label: "Files", value: `${downloadProgress.completed} / ${downloadProgress.total}` },
                { label: "Status", value: pct >= 100 ? "Finalizing..." : "Downloading" },
              ].map((item, i) => (
                <div key={i} style={{ flex: 1, padding: "12px 14px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 11, color: T3, marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T }}>{item.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {done && (
        <div style={{ textAlign: "center", padding: "16px 0 24px" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(34,197,94,0.1)", border: "2px solid rgba(34,197,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <CheckCircle size={40} weight="fill" color={GREEN}/>
          </div>
          <div style={{ fontSize: 14, color: T2 }}>Minecraft {versionId} is ready to play</div>
        </div>
      )}

      {error && (
        <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", fontSize: 13, color: "#fca5a5", marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Error</div>
          {error}
        </div>
      )}
    </>
  );
}

function StepFinish({ versionId }) {
  return (
    <div style={{ textAlign: "center", paddingTop: 16 }}>
      <div style={{ width: 80, height: 80, borderRadius: 20, background: `linear-gradient(135deg, ${A}, #1d4ed8)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
        <GameController size={40} weight="duotone" color="white"/>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: T, marginBottom: 8 }}>Ready to play!</div>
      <div style={{ fontSize: 14, color: T2, marginBottom: 28, lineHeight: 1.7 }}>
        Minecraft <strong>{versionId}</strong> has been installed successfully.<br/>
        Click <strong>Launch Game</strong> to start playing.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 320, margin: "0 auto", textAlign: "left" }}>
        {[
          { icon: <GameController size={15} weight="duotone"/>, text: "Game files downloaded & verified" },
          { icon: <Cpu            size={15} weight="duotone"/>, text: "Java runtime configured" },
          { icon: <Confetti       size={15} weight="duotone"/>, text: "Ready to play!" },
        ].map(({ icon, text }, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: T2 }}>
            <CheckCircle size={15} weight="fill" color={GREEN}/>
            <span style={{ color: T3, display: "flex" }}>{icon}</span>
            {text}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Button styles ─────────────────────────────────────────────────────────────
const btnPri = {
  background: A, color: "white", border: "none",
  padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 500,
  cursor: "pointer", fontFamily: "inherit",
  display: "inline-flex", alignItems: "center", gap: 7,
};
const btnSec = {
  background: "rgba(255,255,255,0.06)", color: T2,
  border: `1px solid ${BORDER}`, padding: "9px 18px",
  borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
  display: "inline-flex", alignItems: "center", gap: 7,
};
