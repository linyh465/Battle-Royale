import { useEffect, useState } from "react";
import Joystick from "./Joystick.jsx";
import AimJoystick from "./AimJoystick.jsx";

/**
 * EN: MobileControls (Phase 15) — twin-stick layout.
 *     LEFT  : <Joystick/>      → movement only (NO automatic aim).
 *     RIGHT : <AimJoystick/>   → aim direction + fire (replaces FireButton).
 *     The legacy auto-aim where the weapon barrel followed the LEFT stick
 *     has been REMOVED at the GameCanvas layer; this component just wires
 *     the two stick callbacks back to the parent.
 * zh-TW: MobileControls（Phase 15）— 雙搖桿佈局。
 *     左：<Joystick/>      → 「僅控制移動」（不再自動旋轉槍口）。
 *     右：<AimJoystick/>   → 控制瞄準角度 + 射擊（取代 FireButton）。
 *     舊版「左搖桿同時控制移動與槍口」的行為已在 GameCanvas 層移除；
 *     本元件只負責把兩支搖桿的 callback 接回上層。
 */
function shouldShow() {
  if (typeof window === "undefined") return false;
  const forced = new URLSearchParams(location.search).get("touch") === "1";
  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
  const touch = "ontouchstart" in window;
  return forced || coarse || touch;
}

// Responsive control size: ~22% of the smaller viewport dimension, clamped 100-180px
function getCtrlSize() {
  const dim = Math.min(window.innerWidth, window.innerHeight);
  return Math.max(100, Math.min(180, Math.round(dim * 0.22)));
}

export default function MobileControls({ onJoystick, onAim, onFire }) {
  const [visible, setVisible] = useState(shouldShow());
  const [ctrlSize, setCtrlSize] = useState(getCtrlSize);

  useEffect(() => {
    const onResize = () => {
      setVisible(shouldShow());
      setCtrlSize(getCtrlSize());
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  if (!visible) return null;

  const knobSize = Math.round(ctrlSize * 0.43);
  const pad = Math.round(ctrlSize * 0.17);

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      pointerEvents: "none",
      zIndex: 10,
    }}>
      {/* EN: LEFT — movement only.
          zh-TW: 左 — 僅控制移動。 */}
      <div style={{
        position: "absolute",
        left: pad,
        bottom: pad,
        pointerEvents: "auto",
      }}>
        <Joystick size={ctrlSize} knobSize={knobSize} onChange={onJoystick} />
      </div>
      {/* EN: RIGHT — twin-stick aim + fire (Phase 15).
          zh-TW: 右 — 雙搖桿瞄準 + 射擊（Phase 15）。 */}
      <div style={{
        position: "absolute",
        right: pad,
        bottom: pad,
        pointerEvents: "auto",
      }}>
        <AimJoystick
          size={ctrlSize}
          knobSize={knobSize}
          onAim={onAim}
          onFire={onFire}
        />
      </div>
    </div>
  );
}
