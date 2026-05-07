import { useEffect, useState } from "react";
import Joystick from "./Joystick.jsx";
import FireButton from "./FireButton.jsx";

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

export default function MobileControls({ onJoystick, onFire }) {
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
  const fireSize = Math.round(ctrlSize * 0.9);
  const pad = Math.round(ctrlSize * 0.17);

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      pointerEvents: "none",
      zIndex: 10,
    }}>
      <div style={{
        position: "absolute",
        left: pad,
        bottom: pad,
        pointerEvents: "auto",
      }}>
        <Joystick size={ctrlSize} knobSize={knobSize} onChange={onJoystick} />
      </div>
      <div style={{
        position: "absolute",
        right: pad,
        bottom: pad + Math.round(ctrlSize * 0.05),
        pointerEvents: "auto",
      }}>
        <FireButton size={fireSize} onChange={onFire} />
      </div>
    </div>
  );
}
