import { useEffect, useRef } from "react";

/**
 * EN: Big tap-to-fire button for mobile. Holds = continuous fire.
 *     Pressed state is reflected via DOM class only — never setState.
 * zh-TW: 手機用的大型射擊按鈕，按住即連續射擊。
 *         按下狀態僅透過 DOM class 切換，不走 setState。
 */
export default function FireButton({ size = 120, onChange, style }) {
  const ref = useRef(null);
  const activeRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const setPressed = (on) => {
      el.style.background = on
        ? "rgba(239, 68, 68, 0.95)"
        : "rgba(239, 68, 68, 0.65)";
      el.style.transform = on ? "scale(0.94)" : "scale(1)";
    };

    const onDown = (e) => {
      e.preventDefault();
      activeRef.current = true;
      el.setPointerCapture?.(e.pointerId);
      setPressed(true);
      onChange(true);
    };
    const onUp = (e) => {
      if (!activeRef.current) return;
      activeRef.current = false;
      setPressed(false);
      onChange(false);
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("pointerleave", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("pointerleave", onUp);
    };
  }, [onChange]);

  return (
    <div
      ref={ref}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "rgba(239, 68, 68, 0.65)",
        border: "3px solid #fff",
        color: "#fff",
        fontWeight: 700,
        fontSize: 20,
        display: "grid",
        placeItems: "center",
        touchAction: "none",
        userSelect: "none",
        transition: "transform 80ms ease",
        ...style,
      }}
    >
      FIRE
    </div>
  );
}
