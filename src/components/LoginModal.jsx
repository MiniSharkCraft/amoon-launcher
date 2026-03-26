// src/components/LoginModal.jsx
import { useEffect, useState, useRef } from "react";
import {
  X, ShieldCheck, MicrosoftOutlookLogo, Globe, Crown, WifiSlash,
  SignIn, CircleNotch, CheckCircle,
} from "@phosphor-icons/react";
import useStore from "../store";
import { C, inputStyle } from "../constants/theme";

const AUTH_TYPES = [
  { id: "microsoft", label: "Login with Microsoft",    desc: "Official Mojang/Microsoft account", icon: <MicrosoftOutlookLogo size={16} weight="duotone" /> },
  { id: "elyby",     label: "Authorization at Ely.by", desc: "Custom skin + premium features",    icon: <Globe size={16} weight="duotone" /> },
  { id: "amoon",     label: "AMoon Account",           desc: "Custom auth by AMoon Team",         icon: <Crown size={16} weight="duotone" /> },
  { id: "offline",   label: "Offline mode",            desc: "No account needed",                 icon: <WifiSlash size={16} weight="duotone" /> },
];

export default function LoginModal({ onClose }) {
  const { loginOffline, accountLoading, accountError, accounts, activeAccountId, switchAccount, removeAccount } = useStore();
  const [authType, setAuthType] = useState("offline");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const prevLen = useRef(accounts.length);

  useEffect(() => {
    if (accounts.length > prevLen.current) { prevLen.current = accounts.length; }
    prevLen.current = accounts.length;
  }, [accounts.length]);

  const handleAdd = () => {
    if (!username.trim()) return;
    loginOffline(username.trim());
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "#1a2035", border: `1px solid ${C.border}`, borderRadius: 14, width: 580, overflow: "hidden" }}>

        {/* Header */}
        <div style={{ background: C.accent, padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          <div onClick={onClose} style={{ cursor: "pointer", color: "white", display: "flex", padding: 4, borderRadius: 6 }}>
            <X size={16} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: "white", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ShieldCheck size={16} weight="bold" /> Account settings
          </span>
        </div>

        {/* Body */}
        <div style={{ display: "flex", gap: 0 }}>

          {/* Left — Form */}
          <div style={{ flex: 1, padding: "20px", borderRight: `1px solid ${C.border}` }}>
            <input
              placeholder="E-mail / Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              style={{ ...inputStyle, marginBottom: 14 }}
            />

            {/* Auth type radio */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              {AUTH_TYPES.map(t => (
                <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <div
                    onClick={() => setAuthType(t.id)}
                    style={{
                      width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                      border: `2px solid ${authType === t.id ? C.accent : C.border2}`,
                      background: authType === t.id ? C.accent : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all .15s",
                    }}
                  >
                    {authType === t.id && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "white" }} />}
                  </div>
                  <span style={{ color: authType === t.id ? C.accent : C.text3, display: "flex" }}>{t.icon}</span>
                  <span style={{ fontSize: 13, color: authType === t.id ? C.text : C.text2 }}>{t.label}</span>
                </label>
              ))}
            </div>

            {/* Password */}
            {authType !== "offline" && (
              <input
                placeholder="Password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ ...inputStyle, marginBottom: 14 }}
              />
            )}

            {accountError && <div style={{ fontSize: 12, color: C.red, marginBottom: 10 }}>{accountError}</div>}

            {/* Login button */}
            <button
              onClick={handleAdd}
              disabled={!username.trim() || accountLoading}
              style={{
                width: "100%", padding: "10px 0", borderRadius: 8, border: "none",
                background: "#22c55e", color: "white", fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                opacity: (!username.trim() || accountLoading) ? 0.5 : 1,
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {accountLoading ? <CircleNotch size={14} className="spin" /> : <SignIn size={14} />}
                {accountLoading ? "Adding..." : authType === "offline" ? "Add offline account" : authType === "amoon" ? "Login with AMoon" : authType === "elyby" ? "Login with Ely.by" : "Login with Microsoft"}
              </span>
            </button>

            {/* Info text */}
            <div style={{ marginTop: 14, fontSize: 11, color: C.text3, lineHeight: 1.6 }}>
              {authType === "microsoft"
                ? "Login with your official Mojang/Microsoft account to access all premium features."
                : authType === "elyby"
                  ? "Ely.by gives you custom skin support and premium features on compatible servers."
                  : authType === "amoon"
                    ? "AMoon Account is a custom auth system built by the AMoon Team. Register at amoon.app"
                    : "Play offline without an account. Your username will be displayed in-game."
              }
            </div>
          </div>

          {/* Right — Account list */}
          <div style={{ width: 200, padding: "20px 16px" }}>
            <div style={{ fontSize: 12, color: C.text2, marginBottom: 10, fontWeight: 500 }}>Available accounts</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, fontSize: 12, color: C.text3, cursor: "pointer" }}>
                (new account)
              </div>

              {accounts.map(acc => (
                <div
                  key={acc.id}
                  onClick={() => switchAccount(acc.id)}
                  style={{
                    padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13,
                    background: activeAccountId === acc.id ? "rgba(37,99,235,0.2)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${activeAccountId === acc.id ? C.accent : C.border}`,
                    color: activeAccountId === acc.id ? C.text : C.text2,
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <div style={{
                    width: 24, height: 24, borderRadius: 6,
                    background: `linear-gradient(135deg,${C.accent},#1d4ed8)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700, color: "white", flexShrink: 0,
                  }}>
                    {acc.username.slice(0, 2).toUpperCase()}
                  </div>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{acc.username}</span>
                </div>
              ))}
            </div>

            {/* Add / Remove buttons */}
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={handleAdd}
                disabled={!username.trim() || accountLoading}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 7, border: "none",
                  background: C.accent, color: "white", fontSize: 12, fontWeight: 500,
                  cursor: "pointer", fontFamily: "inherit",
                  opacity: (!username.trim() || accountLoading) ? 0.5 : 1,
                }}
              >
                Add
              </button>
              <button
                onClick={() => activeAccountId && removeAccount(activeAccountId)}
                disabled={!activeAccountId}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 7, border: "none",
                  background: "#f97316", color: "white", fontSize: 12, fontWeight: 500,
                  cursor: "pointer", fontFamily: "inherit",
                  opacity: !activeAccountId ? 0.5 : 1,
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
