// src/store.js
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

// ─── Persistence helpers ─────────────────────────────────────────────────────
const STORAGE_KEY = "amoon-launcher-state";

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return {
      accounts:        data.accounts        ?? [],
      activeAccountId: data.activeAccountId ?? null,
      installations:   data.installations   ?? undefined,
      selectedInstall: data.selectedInstall ?? "rel",
      activePanel:     data.activePanel     ?? "home",
    };
  } catch {
    return {};
  }
}

function persistState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      accounts:        state.accounts,
      activeAccountId: state.activeAccountId,
      installations:   state.installations,
      selectedInstall: state.selectedInstall,
      activePanel:     state.activePanel,
    }));
  } catch { /* ignore */ }
}

const persisted = loadPersistedState();

// ─── Default installations ───────────────────────────────────────────────────
const DEFAULT_INSTALLATIONS = [
  { id:"snap", name:"Latest Snapshot", version:null, loader:"vanilla", icon:"vanilla", ram:4096, width:854, height:480, fullscreen:false, jvmArgs:"" },
  { id:"rel",  name:"Latest Release",  version:null, loader:"vanilla", icon:"vanilla", ram:4096, width:854, height:480, fullscreen:false, jvmArgs:"" },
];

// ─── Store ───────────────────────────────────────────────────────────────────
const useStore = create((set, get) => ({
  // ─── System check ─────────────────────────────────────
  checkSystem: async (gameDir = ".amoon") => {
    try {
      return await invoke("check_system", { gameDir });
    } catch {
      return null;
    }
  },

  // ─── Java ─────────────────────────────────────────────────
  java: null,
  javaLoading: false,
  detectJava: async () => {
    set({ javaLoading: true });
    try {
      const java = await invoke("detect_java");
      set({ java, javaLoading: false });
    } catch {
      set({ java: null, javaLoading: false });
    }
  },
  downloadJava: async (version = 21) => {
    set({ javaLoading: true });
    try {
      const java = await invoke("download_java", { version });
      set({ java, javaLoading: false });
      get().addLog(`[AMoon] Downloaded Java ${java.major_version}`);
      return java;
    } catch (e) {
      set({ javaLoading: false });
      get().addLog(`[AMoon] Java download failed: ${e}`);
      throw e;
    }
  },

  // ─── Versions ─────────────────────────────────────────────
  versions: [],
  versionsLoading: false,
  fetchVersions: async () => {
    set({ versionsLoading: true });
    try {
      const manifest = await invoke("get_version_manifest");
      set({ versions: manifest.versions, versionsLoading: false });
    } catch {
      // Fallback: fetch trực tiếp nếu Rust command fail
      try {
        const res  = await fetch("https://launchermeta.mojang.com/mc/game/version_manifest_v2.json");
        const data = await res.json();
        set({ versions: data.versions, versionsLoading: false });
      } catch {
        set({ versionsLoading: false });
      }
    }
  },

  // ─── Installations ────────────────────────────────────────
  installations: persisted.installations ?? DEFAULT_INSTALLATIONS,
  selectedInstall: persisted.selectedInstall ?? "rel",
  setSelectedInstall: (id) => {
    set({ selectedInstall: id });
    persistState(get());
  },
  addInstallation: (inst) => {
    set(s => ({ installations: [...s.installations, inst] }));
    persistState(get());
  },
  updateInstallation: (id, patch) => {
    set(s => ({
      installations: s.installations.map(i => i.id===id ? {...i,...patch} : i)
    }));
    persistState(get());
  },
  deleteInstallation: (id) => {
    set(s => ({
      installations: s.installations.filter(i => i.id!==id),
      selectedInstall: s.selectedInstall===id ? "rel" : s.selectedInstall,
    }));
    persistState(get());
  },

  // ─── Accounts ─────────────────────────────────────────────
  accounts: persisted.accounts ?? [],
  activeAccountId: persisted.activeAccountId ?? null,
  accountLoading: false,
  accountError: null,
  get account() {
    const s = get();
    return s.accounts.find(a => a.id === s.activeAccountId) ?? null;
  },
  loginAmoon: async (username, password, totpCode = null) => {
    set({ accountLoading: true, accountError: null });
    try {
      const body = { username, password };
      if (totpCode) body.totp_code = totpCode;
      const res = await fetch("https://account.anhcong.dev/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.requires_2fa) throw new Error("__2FA__");
        throw new Error(data.error || "Login failed");
      }
      const id = Date.now().toString();
      set(s => ({
        accounts: [...s.accounts, {
          id,
          username: data.username,
          uuid: data.uuid,
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          avatarUrl: data.profile?.avatar_url || "",
          skinUrl: data.profile?.skin_url || "",
          accountType: "amoon",
        }],
        activeAccountId: id,
        accountLoading: false,
      }));
      persistState(get());
    } catch (e) {
      set({ accountError: String(e).replace("Error: ",""), accountLoading: false });
      throw e;
    }
  },
  loginOffline: async (username) => {
    set({ accountLoading: true, accountError: null });
    try {
      const acc = await invoke("login_offline", { username });
      const id  = Date.now().toString();
      set(s => ({
        accounts: [...s.accounts, { ...acc, id, accountType:"offline" }],
        activeAccountId: id,
        accountLoading: false,
      }));
      persistState(get());
    } catch (e) {
      set({ accountError: String(e), accountLoading: false });
    }
  },
  loginMicrosoftStart: async () => {
    set({ accountLoading: true, accountError: null });
    try {
      const result = await invoke("login_microsoft_start");
      get().addLog(`[AMoon] Microsoft login started — check your browser`);
      return result;
    } catch (e) {
      set({ accountError: String(e), accountLoading: false });
      throw e;
    }
  },
  loginMicrosoftFinish: async (code) => {
    set({ accountLoading: true, accountError: null });
    try {
      const acc = await invoke("login_microsoft_finish", { code });
      const id  = Date.now().toString();
      set(s => ({
        accounts: [...s.accounts, { ...acc, id, accountType:"microsoft" }],
        activeAccountId: id,
        accountLoading: false,
      }));
      persistState(get());
    } catch (e) {
      set({ accountError: String(e), accountLoading: false });
    }
  },
  loginElybyStart: async () => {
    set({ accountLoading: true, accountError: null });
    try {
      const result = await invoke("login_elyby_start");
      get().addLog(`[AMoon] Ely.by login started — check your browser`);
      return result;
    } catch (e) {
      set({ accountError: String(e), accountLoading: false });
      throw e;
    }
  },
  loginElybyFinish: async (code, codeVerifier) => {
    set({ accountLoading: true, accountError: null });
    try {
      const acc = await invoke("login_elyby", { code, codeVerifier });
      const id  = Date.now().toString();
      set(s => ({
        accounts: [...s.accounts, { ...acc, id, accountType:"elyby" }],
        activeAccountId: id,
        accountLoading: false,
      }));
      persistState(get());
    } catch (e) {
      set({ accountError: String(e), accountLoading: false });
    }
  },
  switchAccount: (id) => {
    set({ activeAccountId: id });
    persistState(get());
  },
  removeAccount: (id) => {
    set(s => {
      const remaining = s.accounts.filter(a => a.id !== id);
      return {
        accounts: remaining,
        activeAccountId: s.activeAccountId === id ? (remaining[0]?.id ?? null) : s.activeAccountId,
      };
    });
    persistState(get());
  },

  // ─── Mods (Modrinth via Rust) ──────────────────────────────
  mods: [],
  modsLoading: false,
  modSearch: "",
  setModSearch: (q) => set({ modSearch: q }),
  searchMods: async (query, gameVersion, loader) => {
    set({ modsLoading: true });
    try {
      const mods = await invoke("search_modrinth", {
        query: query || "optimization",
        projectType: "mod",
        gameVersion: gameVersion ?? null,
        loader: loader ?? null,
        limit: 20,
      });
      set({ mods, modsLoading: false });
    } catch {
      // Fallback: direct fetch
      try {
        const res  = await fetch(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(query||"optimization")}&limit=20&facets=[["project_type:mod"]]`);
        const data = await res.json();
        set({ mods: data.hits, modsLoading: false });
      } catch {
        set({ mods: [], modsLoading: false });
      }
    }
  },

  // ─── Modpacks (Modrinth via Rust) ──────────────────────────
  modpacks: [],
  modpacksLoading: false,
  searchModpacks: async (query, gameVersion) => {
    set({ modpacksLoading: true });
    try {
      const modpacks = await invoke("search_modrinth", {
        query: query || "",
        projectType: "modpack",
        gameVersion: gameVersion ?? null,
        loader: null,
        limit: 20,
      });
      set({ modpacks, modpacksLoading: false });
    } catch {
      try {
        const res  = await fetch(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(query||"")}&limit=20&facets=[["project_type:modpack"]]`);
        const data = await res.json();
        set({ modpacks: data.hits, modpacksLoading: false });
      } catch {
        set({ modpacks: [], modpacksLoading: false });
      }
    }
  },

  // ─── Shaders (Modrinth via Rust) ───────────────────────────
  shaders: [],
  shadersLoading: false,
  searchShaders: async (query, gameVersion) => {
    set({ shadersLoading: true });
    try {
      const shaders = await invoke("search_shaders", {
        query: query || "shader",
        gameVersion: gameVersion ?? null,
      });
      set({ shaders, shadersLoading: false });
    } catch {
      set({ shaders: [], shadersLoading: false });
    }
  },

  // ─── Install mod/shader/resourcepack ───────────────────────
  installMod: async (projectId, gameVersion, loader, instanceDir) => {
    try {
      const result = await invoke("install_mod", { projectId, gameVersion, loader, instanceDir });
      get().addLog(`[AMoon] ${result}`);
      return result;
    } catch (e) {
      get().addLog(`[AMoon] Install failed: ${e}`);
      throw e;
    }
  },
  installShader: async (projectId, gameVersion, instanceDir) => {
    try {
      const result = await invoke("install_shader", { projectId, gameVersion, instanceDir });
      get().addLog(`[AMoon] ${result}`);
      return result;
    } catch (e) {
      get().addLog(`[AMoon] Install failed: ${e}`);
      throw e;
    }
  },
  installResourcePack: async (projectId, gameVersion, instanceDir) => {
    try {
      const result = await invoke("install_resource_pack", { projectId, gameVersion, instanceDir });
      get().addLog(`[AMoon] ${result}`);
      return result;
    } catch (e) {
      get().addLog(`[AMoon] Install failed: ${e}`);
      throw e;
    }
  },

  // ─── Installed mods list ───────────────────────────────────
  installedMods: [],
  listInstalledMods: async (instanceDir) => {
    try {
      const mods = await invoke("list_installed_mods", { instanceDir });
      set({ installedMods: mods });
      return mods;
    } catch {
      set({ installedMods: [] });
      return [];
    }
  },
  deleteMod: async (instanceDir, filename, modType) => {
    try {
      const result = await invoke("delete_mod", { instanceDir, filename, modType });
      get().addLog(`[AMoon] ${result}`);
      // Refresh list
      get().listInstalledMods(instanceDir);
      return result;
    } catch (e) {
      get().addLog(`[AMoon] Delete failed: ${e}`);
      throw e;
    }
  },

  // ─── Download version ──────────────────────────────────────
  downloading: false,
  downloadProgress: null,
  isVersionInstalled: async (versionId, gameDir = ".amoon") => {
    try { return await invoke("is_version_installed", { versionId, gameDir }); }
    catch { return false; }
  },
  downloadVersion: async (versionId, gameDir = ".amoon") => {
    set({ downloading: true, downloadProgress: { total: 0, completed: 0, current: "Starting..." } });
    get().addLog(`[AMoon] Downloading Minecraft ${versionId}...`);
    try {
      const result = await invoke("download_version", { versionId, gameDir });
      get().addLog(`[AMoon] ${result}`);
      set({ downloading: false, downloadProgress: null });
      return result;
    } catch (e) {
      get().addLog(`[AMoon] Download failed: ${e}`);
      set({ downloading: false, downloadProgress: null });
      throw e;
    }
  },
  pollDownloadProgress: async () => {
    try {
      const progress = await invoke("get_download_progress");
      set({ downloadProgress: progress });
      return progress;
    } catch {
      return null;
    }
  },

  // ─── Console log ──────────────────────────────────────────
  consoleLogs: [],
  addLog: (line) => set(s => ({ consoleLogs: [...s.consoleLogs.slice(-500), line] })),
  clearLogs: () => set({ consoleLogs: [] }),

  // ─── Launch ───────────────────────────────────────────────
  launching: false,
  launchError: null,
  launchSuccess: null,
  launchGame: async () => {
    const { accounts, activeAccountId, versions, installations, selectedInstall, java, downloadVersion } = get();
    const account = accounts.find(a => a.id===activeAccountId);
    if (!account) { set({ launchError:"Chưa đăng nhập!" }); return; }
    if (!java)    { set({ launchError:"Không tìm thấy Java!" }); return; }

    const inst     = installations.find(i => i.id===selectedInstall);
    const releases = versions.filter(v => v.type==="release");
    const snaps    = versions.filter(v => v.type==="snapshot");
    if (releases.length === 0) { set({ launchError:"Chưa load được danh sách version! Kiểm tra kết nối mạng." }); return; }
    const versionId = inst?.version ?? (inst?.id==="snap" ? snaps[0]?.id : releases[0]?.id) ?? releases[0]?.id;
    if (!versionId) { set({ launchError:"Chưa load được version!" }); return; }

    set({ launching:true, launchError:null, launchSuccess:null, consoleLogs:[] });
    get().addLog(`[AMoon] Launching Minecraft ${versionId}...`);
    get().addLog(`[AMoon] Java: ${java.path}`);
    get().addLog(`[AMoon] RAM: ${Math.round((inst?.ram??4096)/1024)}GB`);
    get().addLog(`[AMoon] Account: ${account.username}`);

    try {
      const result = await invoke("launch_game", {
        config: {
          version_id: versionId,
          game_dir: ".amoon",
          java_path: java.path,
          max_memory: inst?.ram ?? 4096,
          min_memory: 512,
          width: inst?.width ?? 854,
          height: inst?.height ?? 480,
          fullscreen: inst?.fullscreen ?? false,
          extra_jvm_args: inst?.jvmArgs ? inst.jvmArgs.split(" ").filter(Boolean) : [],
        },
        account,
      });
      get().addLog(`[AMoon] ${result}`);
      set({ launching:false, launchSuccess:result });
    } catch (e) {
      get().addLog(`[AMoon] Error: ${e}`);
      set({ launching:false, launchError:String(e) });
    }
  },

  // ─── Files / File Manager ────────────────────────────────
  listDirFiles: async (dirPath, extensions = [], includeDirs = false) => {
    try { return await invoke("list_dir_files", { dirPath, extensions, includeDirs }); }
    catch { return []; }
  },
  readTextFile: async (filePath) => {
    try { return await invoke("read_text_file", { filePath }); }
    catch { return ""; }
  },
  readImageBase64: async (filePath) => {
    try { return await invoke("read_image_base64", { filePath }); }
    catch { return null; }
  },
  deleteFile: async (filePath) => {
    return await invoke("delete_file", { filePath });
  },
  openPath: async (path) => {
    await invoke("open_path", { path });
  },

  // ─── UI ───────────────────────────────────────────────────
  activePanel: persisted.activePanel ?? "home",
  setActivePanel: (p) => {
    set({ activePanel: p });
    persistState(get());
  },
}));

export default useStore;
