// src/components/EditInstallModal.jsx
import { useState } from "react";
import useStore from "../store";
import Modal from "./Modal";
import Toggle from "./Toggle";
import { C, inputStyle, btnPrimary, btnSecondary } from "../constants/theme";

export default function EditInstallModal({ inst, onClose }) {
  const { updateInstallation, versions } = useStore();
  const [name, setName]           = useState(inst.name);
  const [version, setVersion]     = useState(inst.version ?? "");
  const [loader, setLoader]       = useState(inst.loader);
  const [ram, setRam]             = useState(inst.ram ?? 4096);
  const [width, setWidth]         = useState(inst.width ?? 854);
  const [height, setHeight]       = useState(inst.height ?? 480);
  const [fullscreen, setFull]     = useState(inst.fullscreen ?? false);
  const [jvmArgs, setJvm]         = useState(inst.jvmArgs ?? "");
  const releases = versions.filter(v => v.type === "release");

  const handleSave = () => {
    updateInstallation(inst.id, { name, version: version || null, loader, ram, width: +width, height: +height, fullscreen, jvmArgs });
    onClose();
  };

  const Row = ({ label, children }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: C.text2, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );

  return (
    <Modal title="Edit installation" onClose={onClose} width={440}>
      <Row label="Name"><input value={name} onChange={e => setName(e.target.value)} style={inputStyle} /></Row>
      <Row label="Version">
        <select value={version} onChange={e => setVersion(e.target.value)} style={inputStyle}>
          <option value="">Latest release</option>
          {releases.slice(0, 40).map(v => <option key={v.id} value={v.id}>{v.id}</option>)}
        </select>
      </Row>
      <Row label="Modloader">
        <select value={loader} onChange={e => setLoader(e.target.value)} style={inputStyle}>
          {["vanilla", "fabric", "forge", "neoforge", "quilt"].map(l =>
            <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
          )}
        </select>
      </Row>
      <Row label={`Max RAM — ${Math.round(ram / 1024)}GB`}>
        <input type="range" min={1024} max={16384} step={512} value={ram} onChange={e => setRam(+e.target.value)} style={{ width: "100%", accentColor: C.accent }} />
      </Row>
      <Row label="Resolution">
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input value={width} onChange={e => setWidth(e.target.value)} style={{ ...inputStyle, width: 80 }} placeholder="854" />
          <span style={{ color: C.text3 }}>×</span>
          <input value={height} onChange={e => setHeight(e.target.value)} style={{ ...inputStyle, width: 80 }} placeholder="480" />
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.text2, cursor: "pointer" }}>
            <Toggle on={fullscreen} onChange={setFull} />
            Fullscreen
          </label>
        </div>
      </Row>
      <Row label="JVM Arguments">
        <input value={jvmArgs} onChange={e => setJvm(e.target.value)} placeholder="-XX:+UseG1GC -Xss1M" style={inputStyle} />
      </Row>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button onClick={handleSave} style={{ ...btnPrimary, flex: 1, justifyContent: "center" }}>Save</button>
        <button onClick={onClose} style={{ ...btnSecondary, flex: 1, justifyContent: "center" }}>Cancel</button>
      </div>
    </Modal>
  );
}
