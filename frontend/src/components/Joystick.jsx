import { useEffect, useRef } from "react";

/**
 * EN: Virtual joystick. Calls onChange(dx, dy) with values in [-1, 1].
 *     The knob is moved via direct DOM mutation (not setState) so that
 *     dragging never triggers React reconciliation on the GameCanvas tree.
 * zh-TW: 虛擬搖桿。透過 onChange(dx, dy) 回傳 [-1, 1] 的值。
 *         搖桿球用 DOM 直接位移（不走 setState），拖曳時不會引發 React 重渲染。
 */
export default function Joystick({
  size = 140,
  knobSize = 60,
  onChange,
  style,
}) {
  const baseRef = useRef(null);
  const knobRef = useRef(null);
  const activeRef = useRef(false);
  const pointerIdRef = useRef(null);

  const radius = size / 2 - knobSize / 4;

  useEffect(() => {
    const base = baseRef.current;
    const knob = knobRef.current;
    if (!base || !knob) return;

    const setKnob = (dx, dy) => {
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };

    const compute = (clientX, clientY) => {
      const r = base.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > radius) {
        dx = (dx * radius) / dist;
        dy = (dy * radius) / dist;
      }
      setKnob(dx, dy);
      // EN: normalize to unit-ish vector for the input loop.
      // zh-TW: 正規化成接近單位向量，供 input 迴圈使用。
      onChange(dx / radius, dy / radius);
    };

    const onDown = (e) => {
      e.preventDefault();
      activeRef.current = true;
      pointerIdRef.current = e.pointerId;
      base.setPointerCapture?.(e.pointerId);
      compute(e.clientX, e.clientY);
    };
    const onMove = (e) => {
      if (!activeRef.current) return;
      if (pointerIdRef.current !== e.pointerId) return;
      compute(e.clientX, e.clientY);
    };
    const onUp = (e) => {
      if (!activeRef.current) return;
      activeRef.current = false;
      pointerIdRef.current = null;
      setKnob(0, 0);
      onChange(0, 0);
    };

    base.addEventListener("pointerdown", onDown);
    base.addEventListener("pointermove", onMove);
    base.addEventListener("pointerup", onUp);
    base.addEventListener("pointercancel", onUp);
    base.addEventListener("pointerleave", onUp);
    return () => {
      base.removeEventListener("pointerdown", onDown);
      base.removeEventListener("pointermove", onMove);
      base.removeEventListener("pointerup", onUp);
      base.removeEventListener("pointercancel", onUp);
      base.removeEventListener("pointerleave", onUp);
    };
  }, [onChange, radius]);

  return (
    <div
      ref={baseRef}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "rgba(15, 23, 42, 0.55)",
        border: "2px solid rgba(148, 163, 184, 0.6)",
        position: "relative",
        touchAction: "none",
        userSelect: "none",
        ...style,
      }}
    >
      <div
        ref={knobRef}
        style={{
          width: knobSize,
          height: knobSize,
          borderRadius: "50%",
          background: "rgba(59, 130, 246, 0.85)",
          border: "2px solid #e5e7eb",
          position: "absolute",
          left: `calc(50% - ${knobSize / 2}px)`,
          top: `calc(50% - ${knobSize / 2}px)`,
          transform: "translate(0px, 0px)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
