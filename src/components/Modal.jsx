// src/components/Modal.jsx
import { X } from "@phosphor-icons/react";
import { C } from "../constants/theme";

export default function Modal({ title, onClose, children, width = 380 }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }}>
      <div style={{
        background: C.sidebar, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: 28, width,
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 20,
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{title}</div>
          <div onClick={onClose} style={{ cursor: "pointer", color: C.text3, display: "flex" }}>
            <X size={18} />
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
