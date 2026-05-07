import { useEffect, useState } from "react";
import { useI18n } from "../i18n.jsx";

function isPortraitMobile() {
  if (typeof window === "undefined") return false;
  const portrait = window.matchMedia?.("(orientation: portrait)")?.matches;
  const small = window.innerWidth <= 900;
  return portrait && small;
}

export default function PortraitLock() {
  const { t } = useI18n();
  const [locked, setLocked] = useState(isPortraitMobile());

  useEffect(() => {
    const onChange = () => setLocked(isPortraitMobile());
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
  }, []);

  if (!locked) return null;

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "#0b0f17",
      color: "#e5e7eb",
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 20,
      textAlign: "center",
      padding: 32,
    }}>
      <div style={{
        fontSize: "min(20vw, 96px)",
        animation: "spin 2s linear infinite",
        display: "inline-block",
        lineHeight: 1,
      }}>
        ⟳
      </div>
      <p style={{
        margin: 0,
        fontFamily: "var(--br-display, sans-serif)",
        fontWeight: 600,
        fontSize: "clamp(14px, 4vw, 22px)",
        letterSpacing: "0.05em",
        color: "#22d3ee",
      }}>
        {t.rotateLandscape}
      </p>
    </div>
  );
}
