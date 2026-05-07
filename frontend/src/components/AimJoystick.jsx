import { useEffect, useRef } from "react";

/**
 * EN: AimJoystick (Phase 15) — right-side twin-stick aim + fire control.
 *     Replaces the legacy <FireButton/>. Behaviour matches the brief:
 *       • Drag the knob in any direction → reports `angle` (radians) AND
 *         keeps the fire flag held down → continuous fire respecting the
 *         active weapon's `fire_rate` cooldown (enforced server-side).
 *       • A quick tap with no perceptible drag → fires a single shot
 *         (one short fire = on, fire = off pulse).
 *       • Releasing the knob → fire flag drops back to false.
 *     The knob is moved via direct DOM mutation (no setState), so dragging
 *     never triggers React reconciliation on the GameCanvas tree — same
 *     trick as the existing <Joystick/> component for movement.
 *
 *     Callbacks:
 *       onAim(angle, active)
 *           angle  : current aim direction in radians (math convention).
 *           active : true while a meaningful direction is being held; false
 *                    when the knob is released or near-center.
 *       onFire(on) : true while pressed, false when released. Single taps
 *                    emit a short on→off pulse synchronously on pointerup.
 *
 *     Why this is twin-stick safe: the parent (GameCanvas) feeds the
 *     reported `angle` into the input loop ONLY when `active` is true.
 *     This is what removes the "weapon barrel follows the LEFT (movement)
 *     stick" behaviour required by the Phase 15 brief.
 *
 * zh-TW: AimJoystick（Phase 15）— 右側「瞄準 + 射擊」雙搖桿控制元件。
 *     取代舊版 <FireButton/>，行為對應 Phase 15 規格：
 *       • 拖曳搖桿到任意方向 → 同步回報 `angle`（弧度）並保持 fire = true
 *         → 持續射擊；伺服器端會依目前武器的 `fire_rate` 強制冷卻。
 *       • 短點一下、未明顯拖曳 → 擊發「單發射擊」（同步送出 fire on→off 脈衝）。
 *       • 放開搖桿 → fire 立即回 false。
 *     搖桿球以 DOM 直接位移（不走 setState），拖曳不會觸發 GameCanvas
 *     重渲染，與既有的 <Joystick/>（移動）相同手法。
 *
 *     callback：
 *       onAim(angle, active)
 *           angle  ：當前瞄準角度（弧度，數學慣例）。
 *           active ：拖到有意義方向時為 true；放開或回中時為 false。
 *       onFire(on) ：按下為 true，放開為 false；短點會在 pointerup 時
 *                    同步發出 on→off 脈衝（單發）。
 *
 *     為什麼這樣是真正的「雙搖桿」：上層（GameCanvas）只有在 `active`
 *     為 true 時才會把 `angle` 餵進輸入迴圈。這就是 Phase 15 規格要求
 *     「左搖桿不再控制槍口角度」的實作關鍵。
 */
export default function AimJoystick({
  size = 140,
  knobSize = 60,
  onAim,
  onFire,
  style,
}) {
  const baseRef = useRef(null);
  const knobRef = useRef(null);
  const activeRef = useRef(false);
  const draggedRef = useRef(false);
  const pointerIdRef = useRef(null);
  const downAtRef = useRef(0);
  // EN: An aim is "meaningful" once the knob has moved past this normalised
  //     radius. Keeps tiny twitches from rotating the weapon barrel wildly.
  // zh-TW: 搖桿位移超過此正規化半徑才視為「有意義的瞄準」，
  //     避免微小手抖造成槍口大幅旋轉。
  const AIM_DEAD_ZONE = 0.18;
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

      const norm = dist > 0 ? Math.min(1, dist / radius) : 0;
      if (norm >= AIM_DEAD_ZONE) {
        const angle = Math.atan2(dy, dx);
        // EN: Once we leave the dead zone we count the gesture as a drag,
        //     so that pointerup will NOT also emit a single-tap pulse.
        // zh-TW: 一旦離開死區即視為「拖曳」，pointerup 時就不會再額外發
        //     單擊脈衝。
        draggedRef.current = true;
        onAim?.(angle, true);
      } else {
        onAim?.(0, false);
      }
    };

    const setPressed = (on) => {
      knob.style.background = on
        ? "rgba(239, 68, 68, 0.95)"
        : "rgba(59, 130, 246, 0.85)";
      base.style.boxShadow = on
        ? "0 0 0 3px rgba(239,68,68,0.45), 0 0 24px rgba(239,68,68,0.4)"
        : "none";
    };

    const onDown = (e) => {
      e.preventDefault();
      activeRef.current = true;
      draggedRef.current = false;
      pointerIdRef.current = e.pointerId;
      downAtRef.current = performance.now();
      base.setPointerCapture?.(e.pointerId);
      setPressed(true);
      // EN: Start firing immediately on press — continuous-hold support.
      //     The actual cadence is enforced server-side by Weapon.can_fire.
      // zh-TW: 一按下立即開始射擊（按住連發）。實際射速冷卻由伺服器端的
      //     Weapon.can_fire 控制，前端只送 fire 旗標。
      onFire?.(true);
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
      const wasDrag = draggedRef.current;
      const heldMs = performance.now() - downAtRef.current;
      setKnob(0, 0);
      setPressed(false);
      onAim?.(0, false);
      onFire?.(false);
      // EN: Single-tap fallback. If the user never dragged AND the press
      //     was short (≤ 220 ms), emit a quick on→off pulse on the next
      //     microtask so the input loop catches at least one `fire: true`
      //     tick. Without this, an ultra-quick tap could land entirely
      //     between two 33 ms input ticks and fire nothing.
      // zh-TW: 單擊保險。若使用者沒拖曳且按壓時間 ≤ 220 ms，
      //     在下一個 microtask 補送一個 on→off 脈衝，確保至少有一個
      //     `fire: true` 的輸入 tick 被送出，避免極短點擊正好夾在兩個
      //     33 ms 輸入 tick 之間導致空打。
      if (!wasDrag && heldMs <= 220) {
        queueMicrotask(() => {
          onFire?.(true);
          // Drop fire on the *next* macrotask to give the input loop one tick.
          setTimeout(() => onFire?.(false), 60);
        });
      }
      draggedRef.current = false;
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
  }, [onAim, onFire, radius]);

  return (
    <div
      ref={baseRef}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "rgba(15, 23, 42, 0.55)",
        border: "2px solid rgba(239, 68, 68, 0.65)",
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
          border: "2px solid #fff",
          position: "absolute",
          left: `calc(50% - ${knobSize / 2}px)`,
          top: `calc(50% - ${knobSize / 2}px)`,
          transform: "translate(0px, 0px)",
          pointerEvents: "none",
          color: "#fff",
          fontWeight: 700,
          fontSize: 12,
          display: "grid",
          placeItems: "center",
        }}
      >
        AIM
      </div>
    </div>
  );
}
