// src/components/Toggle.jsx
import { C } from "../constants/theme";

export default function Toggle({ on, onChange }) {
  return (
    <div
      onClick={() => onChange(!on)}
      style={{
        width: 38, height: 21, borderRadius: 11, cursor: "pointer",
        background: on ? C.accent : "rgba(255,255,255,0.1)",
        position: "relative", transition: "background .2s", flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute", width: 15, height: 15,
        background: "white", borderRadius: "50%",
        top: 3, left: on ? 20 : 3, transition: "left .2s",
      }} />
    </div>
  );
}
