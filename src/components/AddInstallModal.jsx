// src/components/AddInstallModal.jsx
import { useState } from "react";
import useStore from "../store";
import Modal from "./Modal";
import { inputStyle, btnPrimary, btnSecondary } from "../constants/theme";

export default function AddInstallModal({ onClose }) {
  const { versions, addInstallation } = useStore();
  const [name, setName]       = useState("");
  const [version, setVersion] = useState("");
  const [loader, setLoader]   = useState("vanilla");
  const releases = versions.filter(v => v.type === "release");

  const handleAdd = () => {
    if (!name.trim() || !version) return;
    addInstallation({
      id: Date.now().toString(), name: name.trim(), version, loader,
      icon: loader, ram: 4096, width: 854, height: 480, fullscreen: false, jvmArgs: "",
    });
    onClose();
  };

  return (
    <Modal title="New installation" onClose={onClose}>
      {[
        { label: "Name", el: <input value={name} onChange={e => setName(e.target.value)} placeholder="My Installation" style={inputStyle} /> },
        { label: "Version", el:
          <select value={version} onChange={e => setVersion(e.target.value)} style={inputStyle}>
            <option value="">Select version...</option>
            {releases.slice(0, 40).map(v => <option key={v.id} value={v.id}>{v.id}</option>)}
          </select>
        },
        { label: "Modloader", el:
          <select value={loader} onChange={e => setLoader(e.target.value)} style={inputStyle}>
            {["vanilla", "fabric", "forge", "neoforge", "quilt"].map(l =>
              <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
            )}
          </select>
        },
      ].map(({ label, el }) => (
        <div key={label} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#8892a4", marginBottom: 6 }}>{label}</div>
          {el}
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button onClick={handleAdd} disabled={!name.trim() || !version} style={{ ...btnPrimary, flex: 1, justifyContent: "center", opacity: (!name.trim() || !version) ? 0.5 : 1 }}>Create</button>
        <button onClick={onClose} style={{ ...btnSecondary, flex: 1, justifyContent: "center" }}>Cancel</button>
      </div>
    </Modal>
  );
}
