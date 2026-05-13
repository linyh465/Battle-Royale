import { useEffect, useRef, useState, useCallback } from "react";
import { useI18n } from "../i18n.jsx";
import useGameSocket from "../hooks/useGameSocket.js";
import MobileControls from "./MobileControls.jsx";
import DeathScreen from "./DeathScreen.jsx";

const INPUT_HZ = 30;
const INPUT_DT = 1000 / INPUT_HZ;

// EN: Phase 22 — strict responsive HUD / minimap scale. The Phase 20 logic
//     regressed on mobile because a landscape phone with innerWidth >= 768
//     would slip into the desktop branch and render the HUD/minimap at full
//     1.0× size. We now treat the device as mobile whenever EITHER the
//     viewport is below 768px OR the primary pointer is coarse (touch). The
//     mobile scale is a hard 0.5× of the desktop reference, evaluated each
//     frame so orientation changes snap to the correct size without reloading.
// zh-TW: Phase 22 — 嚴格的響應式 HUD / 小地圖縮放。Phase 20 的判斷在手機
//     橫向（innerWidth >= 768）時會誤判為桌面而以 1.0× 渲染，造成 HUD 與
//     小地圖在行動裝置上回到原本的大尺寸。改為「viewport 小於 768px」或
//     「主指標為粗指標（觸控）」任一條件滿足就視為行動裝置。行動裝置一律
//     使用桌面參考值的 0.5×，每幀重新計算，旋轉時也會立即對齊。
const HUD_SCALE_MOBILE = 0.5;
const HUD_SCALE_DESKTOP = 1.0;
const DESKTOP_BREAKPOINT = 768;
const getHudScale = () => {
  if (typeof window === "undefined") return HUD_SCALE_DESKTOP;
  const narrowViewport = window.innerWidth < DESKTOP_BREAKPOINT;
  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches
    || "ontouchstart" in window;
  return (narrowViewport || coarsePointer) ? HUD_SCALE_MOBILE : HUD_SCALE_DESKTOP;
};

// EN: Phase 17 — minimap is a 16:9 rectangle matching the world aspect ratio
//     (2560×1440). Phase 20 multiplies these base dimensions by `getHudScale()`
//     at render time so the minimap grows on desktop and shrinks on mobile.
// zh-TW: Phase 17 — 小地圖為 16:9 矩形，與世界比例（2560×1440）一致。
//     Phase 20 在 render 時以 `getHudScale()` 乘上基礎尺寸，桌面放大、手機縮小。
const MINIMAP_W_BASE = 320;
const MINIMAP_H_BASE = 180;
const PAD = 12;
const THREAT_DOT_THRESHOLD = 0.985;
const THREAT_RANGE = 760;

const IS_COARSE = typeof window !== "undefined"
  && (window.matchMedia?.("(pointer: coarse)")?.matches || "ontouchstart" in window);

export default function GameCanvas({ wsUrl, name, weapon }) {
  const { t } = useI18n();
  const canvasRef = useRef(null);

  const [overlay, setOverlay] = useState({
    meState: "alive",
    respawnRemaining: 0,
    canRespawn: false,
    killerName: "",
    killerWeapon: "rifle",
  });

  // EN: Phase 15 — postGame UI state. The leaderboard panel is OPEN by
  //     default the moment the server enters POST_GAME (final standings
  //     freeze). Closing it returns the player to the canvas to keep
  //     fighting in the sandbox brawl. The frozen leaderboard payload
  //     itself comes from the server snapshot (`frozen_leaderboard` /
  //     wire key `fl`).
  // zh-TW: Phase 15 — 賽後 UI 狀態。一旦伺服器進入 POST_GAME，排行榜面板
  //     預設「打開」（顯示凍結後的最終排行）。關閉面板會回到畫布並繼續
  //     沙盒對戰。凍結排行榜的內容來自伺服器快照（`frozen_leaderboard` /
  //     wire 短鍵 `fl`）。
  const [showFinalBoard, setShowFinalBoard] = useState(false);
  const [resetNotice, setResetNotice] = useState(false);
  // EN: Phase 17 — React state for the global pause overlay. Updated by the
  //     10 Hz overlay poll so React re-renders when the admin toggles pause.
  // zh-TW: Phase 17 — 全域暫停覆蓋層的 React 狀態。由 10 Hz overlay poll
  //     更新，管理員切換暫停時 React 才會重新渲染。
  const [pauseState, setPauseState] = useState({ paused: false, message: "" });

  const prevResetSeqRef = useRef(0);
  const prevMatchStateRef = useRef("PLAYING");

  const { stateRef, playerId, status, send } = useGameSocket({
    url: wsUrl,
    joinPayload: { type: "join", name, weapon },
  });

  const keysRef = useRef({ w: false, a: false, s: false, d: false });
  const mouseRef = useRef({ x: 0, y: 0, fire: false });
  const joystickRef = useRef({ x: 0, y: 0 });
  // EN: Phase 15 — twin-stick aim state. When `active` is true the angle
  //     comes from the RIGHT joystick. When false we fall back to mouse
  //     aim on desktop, or simply hold the last known angle on mobile
  //     (so the weapon doesn't snap to 0 rad when the player lifts off).
  // zh-TW: Phase 15 — 雙搖桿瞄準狀態。`active` 為 true 時角度來自右搖桿；
  //     為 false 時：桌面退回滑鼠瞄準；手機則保留最後一個角度，避免放開
  //     搖桿後槍口瞬間跳回 0 弧度。
  const aimRef = useRef({ angle: 0, active: false });
  const touchFireRef = useRef(false);
  const lastAngleRef = useRef(0);
  const playerIdRef = useRef(null);
  const spectateTargetRef = useRef(null);
  useEffect(() => { playerIdRef.current = playerId; }, [playerId]);

  // ---------------- Desktop input ----------------
  useEffect(() => {
    const onKeyDown = (e) => {
      const k = e.key.toLowerCase();
      if (k in keysRef.current) keysRef.current[k] = true;
      if (k === " ") {
        const snap = stateRef.current;
        const me = snap?.players?.find(p => p.id === playerIdRef.current);
        if (me?.state === "dead" && (me.respawn_at || 0) <= (snap?.now || 0))
          send({ type: "respawn" });
      }
      if (k === "tab") { e.preventDefault(); send({ type: "spectate" }); }
    };
    const onKeyUp = (e) => {
      const k = e.key.toLowerCase();
      if (k in keysRef.current) keysRef.current[k] = false;
    };
    const onMouseMove = (e) => {
      const r = canvasRef.current?.getBoundingClientRect();
      if (!r) return;
      mouseRef.current.x = e.clientX - r.left;
      mouseRef.current.y = e.clientY - r.top;
    };
    const onMouseDown = (e) => { if (e.button === 0) mouseRef.current.fire = true; };
    const onMouseUp = (e) => { if (e.button === 0) mouseRef.current.fire = false; };
    const onContext = (e) => e.preventDefault();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("contextmenu", onContext);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("contextmenu", onContext);
    };
  }, [send, stateRef]);

  // ---------------- Input loop @ 30 Hz ----------------
  // EN: Phase 15 twin-stick rule:
  //   • LEFT joystick (movement) NEVER affects aim. Old behaviour where
  //     `angle = atan2(jy, jx)` was deleted.
  //   • RIGHT joystick (AimJoystick) feeds aimRef. When active, its angle
  //     wins. When idle on mobile, keep the last angle. On desktop with
  //     no joystick at all, use mouse → world aim.
  // zh-TW: Phase 15 雙搖桿規則：
  //   • 左搖桿（移動）絕不影響瞄準，已刪除舊版「角度跟隨左搖桿」邏輯。
  //   • 右搖桿（AimJoystick）寫入 aimRef，active 時角度由它決定；手機未
  //     按住時保留最後角度；桌面無任何搖桿則使用滑鼠 → 世界座標瞄準。
  useEffect(() => {
    const id = setInterval(() => {
      const k = keysRef.current;
      const kdx = (k.d ? 1 : 0) - (k.a ? 1 : 0);
      const kdy = (k.s ? 1 : 0) - (k.w ? 1 : 0);
      const jx = joystickRef.current.x;
      const jy = joystickRef.current.y;
      const dx = Math.abs(jx) > Math.abs(kdx) ? jx : kdx;
      const dy = Math.abs(jy) > Math.abs(kdy) ? jy : kdy;

      const snap = stateRef.current;
      const me = snap?.players?.find((p) => p.id === playerIdRef.current);
      const canvas = canvasRef.current;

      let angle = lastAngleRef.current;
      const aim = aimRef.current;

      if (aim.active) {
        angle = aim.angle;
        lastAngleRef.current = angle;
      } else if (!IS_COARSE && me && canvas && snap?.world) {
        // EN: Desktop fallback — aim toward the mouse position in world space.
        // zh-TW: 桌面退回模式 — 朝滑鼠位置（世界座標）瞄準。
        const camX = me.x + me.w / 2 - canvas.clientWidth / 2;
        const camY = me.y + me.h / 2 - canvas.clientHeight / 2;
        const wx = mouseRef.current.x + camX;
        const wy = mouseRef.current.y + camY;
        angle = Math.atan2(wy - (me.y + me.h / 2), wx - (me.x + me.w / 2));
        lastAngleRef.current = angle;
      }
      // EN: Mobile + idle right-stick → keep `lastAngleRef` (no snap).
      // zh-TW: 手機 + 右搖桿放開 → 保留 lastAngleRef，不重設角度。

      // EN: Phase 17 — suppress ALL input while the match is paused.
      // zh-TW: Phase 17 — 比賽暫停時不送出任何輸入。
      if (snap?.match_paused) return;

      const fire = mouseRef.current.fire || touchFireRef.current;
      send({ type: "input", dx, dy, angle, fire });
    }, INPUT_DT);
    return () => clearInterval(id);
  }, [send, stateRef]);

  // ---------------- Overlay poll @ 10 Hz ----------------
  useEffect(() => {
    const id = setInterval(() => {
      const snap = stateRef.current;
      if (!snap) return;

      // Match reset detection
      const seq = snap.reset_seq ?? 0;
      if (seq !== prevResetSeqRef.current) {
        prevResetSeqRef.current = seq;
        setResetNotice(true);
        setShowFinalBoard(false);
        const tid = setTimeout(() => setResetNotice(false), 3000);
        return () => clearTimeout(tid);
      }

      // EN: Phase 15 — auto-pop the final board the instant the server
      //     transitions from PLAYING → POST_GAME. The user can dismiss it
      //     to return to the sandbox brawl; we never re-pop it for the
      //     same match (only on a fresh PLAYING → POST_GAME edge).
      // zh-TW: Phase 15 — 伺服器由 PLAYING 切到 POST_GAME 的瞬間自動彈出
      //     最終排行榜。使用者關閉後不會再自動彈第二次（除非進入新一輪
      //     的 PLAYING → POST_GAME 轉換）。
      const ms = snap.match_state || "PLAYING";
      if (prevMatchStateRef.current !== ms) {
        if (ms === "POST_GAME") setShowFinalBoard(true);
        if (ms === "PLAYING") setShowFinalBoard(false);
        prevMatchStateRef.current = ms;
      }

      const me = snap.players.find((p) => p.id === playerIdRef.current);
      if (!me) return;
      const remaining = Math.max(0, (me.respawn_at || 0) - (snap.now || 0));
      setOverlay((prev) => {
        const next = {
          meState: me.state,
          respawnRemaining: remaining,
          canRespawn: me.state === "dead" && remaining <= 0,
          killerName: me.killed_by_name || prev.killerName || "",
          killerWeapon: me.killed_by_weapon || prev.killerWeapon || "rifle",
        };
        if (prev.meState === next.meState
          && Math.ceil(prev.respawnRemaining) === Math.ceil(next.respawnRemaining)
          && prev.canRespawn === next.canRespawn) return prev;
        return next;
      });

      // EN: Phase 17 — sync pause state so the React overlay updates.
      // zh-TW: Phase 17 — 同步暫停狀態，讓 React 覆蓋層更新。
      const snapPaused = !!snap.match_paused;
      const snapPauseMsg = snap.pause_message || "";
      setPauseState((prev) => {
        if (prev.paused === snapPaused && prev.message === snapPauseMsg) return prev;
        return { paused: snapPaused, message: snapPauseMsg };
      });
    }, 100);
    return () => clearInterval(id);
  }, [stateRef]);

  // ---------------- Render loop @ rAF ----------------
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let raf = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const snap = stateRef.current;
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;

      ctx.fillStyle = "#0b0f17";
      ctx.fillRect(0, 0, W, H);

      if (!snap?.world) {
        ctx.fillStyle = "#888";
        ctx.font = "16px sans-serif";
        ctx.fillText(`Status: ${status}…`, 24, 32);
        raf = requestAnimationFrame(draw);
        return;
      }

      const me = snap.players.find((p) => p.id === playerIdRef.current);

      let camTarget = me;
      if (me && me.state === "spectating") {
        const alive = snap.players.filter((p) => p.state === "alive");
        const cur = alive.find((p) => p.id === spectateTargetRef.current);
        camTarget = cur || alive[0] || me;
        spectateTargetRef.current = camTarget?.id ?? null;
      }
      const camX = camTarget ? camTarget.x + camTarget.w / 2 - W / 2 : 0;
      const camY = camTarget ? camTarget.y + camTarget.h / 2 - H / 2 : 0;

      drawGrid(ctx, W, H, camX, camY);
      drawWorldBounds(ctx, snap.world, camX, camY);

      ctx.fillStyle = "#fbbf24";
      for (const b of snap.bullets ?? []) ctx.fillRect(b.x - camX, b.y - camY, b.w, b.h);

      for (const p of snap.players ?? []) {
        drawPlayer(ctx, p, camX, camY, p.id === playerIdRef.current);
      }

      const tNow = performance.now() / 1000;
      if (me && me.state === "alive") {
        const threats = detectThreats(snap, me);
        if (threats.length > 0) drawThreatBanner(ctx, W, H, tNow, t.threatWarning);
      }

      drawMinimap(ctx, snap, me);
      drawHUD(ctx, snap, me, W, t);

      if (snap.game_time_remaining > 0) {
        drawGameTimer(ctx, W, snap.game_time_remaining, t.timeRemaining);
      }

      // EN: Phase 15 — POST_GAME banner overlays the canvas while in sandbox.
      // zh-TW: Phase 15 — 沙盒對戰時頂端顯示 POST_GAME 橫幅。
      if ((snap.match_state || "PLAYING") === "POST_GAME" && !showFinalBoard) {
        drawPostGameBanner(ctx, W, t.postGame);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [stateRef, status, t, showFinalBoard]);

  const handleJoystick = useCallback((x, y) => { joystickRef.current.x = x; joystickRef.current.y = y; }, []);
  const handleAim = useCallback((angle, active) => {
    aimRef.current.angle = angle;
    aimRef.current.active = active;
  }, []);
  const handleFire = useCallback((on) => { touchFireRef.current = on; }, []);

  const cycleSpectate = (dir) => {
    const snap = stateRef.current;
    if (!snap) return;
    const alive = snap.players.filter((p) => p.state === "alive");
    if (alive.length === 0) return;
    const curId = spectateTargetRef.current;
    const idx = Math.max(0, alive.findIndex((p) => p.id === curId));
    const next = alive[(idx + (dir > 0 ? 1 : -1) + alive.length) % alive.length];
    spectateTargetRef.current = next.id;
  };

  // EN: Build the "final standings" data the FullLeaderboard renders.
  //     Source of truth is the server snapshot's frozen_leaderboard (wire
  //     key `fl`). If the client hasn't received it yet (rare race), fall
  //     back to the live player list so the modal is never empty.
  // zh-TW: 給 FullLeaderboard 顯示的「最終排行榜」資料。
  //     資料源為伺服器快照的 frozen_leaderboard（wire 短鍵 `fl`）；
  //     若極短暫時間內 client 還沒收到，退回使用即時玩家清單，避免
  //     彈窗看起來空白。
  const finalBoardData = (() => {
    const snap = stateRef.current;
    if (!snap) return null;
    const cols = (snap.settings?.leaderboard_columns || "kills,deaths,damage_dealt,damage_taken")
      .split(",").map(s => s.trim()).filter(Boolean);
    const frozen = Array.isArray(snap.frozen_leaderboard) && snap.frozen_leaderboard.length > 0
      ? snap.frozen_leaderboard
      : (snap.players || []);
    return {
      players: frozen,
      columns: cols,
      // EN: Phase 18 — pass active leaderboard type + sandbox toggle to the
      //     FullLeaderboard so it can render only the selected category and
      //     conditionally disable the Close button.
      // zh-TW: Phase 18 — 傳遞排行榜類別與沙盒開關給 FullLeaderboard。
      activeType: snap.active_leaderboard_type || "kills",
      sandboxEnabled: snap.sandbox_enabled !== undefined ? snap.sandbox_enabled : true,
    };
  })();

  // EN: Phase 17 — derive pause values from React state (driven by the
  //     10 Hz overlay poll) so the overlay shows reactively.
  // zh-TW: Phase 17 — 從 React 狀態取得暫停值（由 10 Hz overlay poll 驅動），
  //     確保覆蓋層反應式顯示。
  const isPaused = pauseState.paused;
  const pauseMsg = pauseState.message;

  // EN: Phase 18 — when the final leaderboard is showing, suppress the
  //     DeathScreen so dead players see the standings, not the death overlay.
  // zh-TW: Phase 18 — 最終排行榜顯示時隱藏死亡畫面，讓陣亡玩家看到排行榜。
  const leaderboardVisible = showFinalBoard && finalBoardData;

  return (
    <>
      <canvas ref={canvasRef} style={{ display: "block", cursor: IS_COARSE ? "none" : "crosshair" }} />

      {overlay.meState === "alive" && !isPaused && (
        <MobileControls
          onJoystick={handleJoystick}
          onAim={handleAim}
          onFire={handleFire}
        />
      )}

      {/* EN: Phase 18 — DeathScreen is HIDDEN when the final leaderboard is
              visible, so dead players always see the standings overlay.
          zh-TW: Phase 18 — 最終排行榜可見時隱藏死亡畫面。 */}
      {overlay.meState === "dead" && !isPaused && !leaderboardVisible && (
        <DeathScreen
          respawnRemaining={overlay.respawnRemaining}
          canRespawn={overlay.canRespawn}
          killerName={overlay.killerName}
          killerWeapon={overlay.killerWeapon}
          onSpectate={() => send({ type: "spectate" })}
          onRespawn={() => send({ type: "respawn" })}
        />
      )}

      {overlay.meState === "spectating" && !isPaused && (
        <div className="br-spectate-bar">
          <button className="br-btn br-btn--ghost" onClick={() => cycleSpectate(-1)}>
            {t.previous}
          </button>
          <span className="br-spectate-label">{t.spectating}</span>
          <button className="br-btn br-btn--ghost" onClick={() => cycleSpectate(1)}>
            {t.next}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
            {overlay.respawnRemaining > 0 && (
              <span style={{
                fontFamily: "var(--br-mono)", fontSize: 15, color: "#22d3ee",
                background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.35)",
                padding: "2px 10px", borderRadius: 6, minWidth: 48, textAlign: "center",
              }}>
                {Math.ceil(overlay.respawnRemaining)}s
              </span>
            )}
            <button className="br-btn" onClick={() => send({ type: "respawn" })}
              disabled={overlay.respawnRemaining > 0}>
              {t.rejoin}
            </button>
          </div>
        </div>
      )}

      {/* EN: Phase 18 — FullLeaderboard with z-index 500 strictly overrides
              the DeathScreen. Renders 4-category tabs and sandbox lock.
          zh-TW: Phase 18 — FullLeaderboard z-index 500 嚴格覆蓋死亡畫面。
              包含 4 類排行榜頁籤與沙盒鎖定。 */}
      {leaderboardVisible && (
        <FullLeaderboard
          data={finalBoardData}
          t={t}
          localPlayerId={playerIdRef.current}
          onClose={() => setShowFinalBoard(false)}
        />
      )}

      {resetNotice && <ResetNotice label={t.matchResetNotice} />}

      {/* EN: Phase 17 — full-screen unclosable pause overlay.
          zh-TW: Phase 17 — 全螢幕不可關閉的暫停覆蓋層。 */}
      {isPaused && <PauseOverlay message={pauseMsg} t={t} />}
    </>
  );
}

// ── Match Reset Toast ──
function ResetNotice({ label }) {
  return (
    <div style={{
      position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
      zIndex: 300, pointerEvents: "none",
      background: "rgba(34,211,238,0.18)", backdropFilter: "blur(8px)",
      border: "1px solid rgba(34,211,238,0.5)",
      borderRadius: 10, padding: "10px 28px",
      fontFamily: "var(--br-display)", fontWeight: 700,
      fontSize: "clamp(13px,3vw,18px)", letterSpacing: "0.2em",
      color: "#22d3ee", textShadow: "0 0 16px rgba(34,211,238,0.7)",
    }}>
      ✓ {label}
    </div>
  );
}

// EN: Phase 17 — full-screen, unclosable pause overlay. The admin controls
//     `match_paused` from the dashboard; while active, the canvas keeps drawing
//     but ALL local input is suppressed and this overlay sits on top of
//     everything (z-index 9999). The title is bilingual by design; the body
//     shows whatever custom `pause_message` the admin set.
// zh-TW: Phase 17 — 全螢幕不可關閉的暫停覆蓋層。管理員從控制台切換
//     `match_paused`；啟用時畫布仍然渲染，但所有本地輸入被抑制，此覆蓋層
//     位於所有元素之上（z-index 9999）。標題為雙語設計；內文顯示管理員
//     設定的自訂 `pause_message`。
function PauseOverlay({ message, t }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(3,6,13,0.95)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      pointerEvents: "all",
    }}>
      {/* Pulsing ring decoration / 脈動環裝飾 */}
      <div style={{
        width: 120, height: 120, borderRadius: "50%",
        border: "2px solid rgba(255,59,92,0.5)",
        boxShadow: "0 0 40px rgba(255,59,92,0.3), inset 0 0 30px rgba(255,59,92,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 24,
        animation: "pulse 2s ease-in-out infinite",
      }}>
        <span style={{ fontSize: 48 }}>⏸</span>
      </div>

      {/* EN title / 英文標題 */}
      <div style={{
        fontFamily: "var(--br-display)", fontSize: "clamp(20px,5vw,42px)",
        fontWeight: 700, letterSpacing: "0.18em", color: "#ff3b5c",
        textShadow: "0 0 32px rgba(255,59,92,0.7)",
        marginBottom: 4, textAlign: "center",
      }}>
        {t.pauseTitle}
      </div>

      {/* zh-TW subtitle / 中文副標 */}
      <div style={{
        fontFamily: "var(--br-display)", fontSize: "clamp(16px,4vw,28px)",
        fontWeight: 700, letterSpacing: "0.28em", color: "#ff7a8e",
        textShadow: "0 0 20px rgba(255,122,142,0.5)",
        marginBottom: 20, textAlign: "center",
      }}>
        {t.pauseTitleZh}
      </div>

      {/* Admin custom message / 管理員自訂訊息 */}
      {message && (
        <div style={{
          maxWidth: "min(90vw, 600px)",
          fontFamily: "var(--br-mono)", fontSize: "clamp(12px,2.5vw,16px)",
          color: "#91a3c4", textAlign: "center",
          background: "rgba(110,145,200,0.08)",
          border: "1px solid rgba(110,145,200,0.2)",
          borderRadius: 10, padding: "12px 24px",
          lineHeight: 1.6,
        }}>
          {message}
        </div>
      )}

      {/* CSS animation / CSS 動畫 */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.08); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// EN: Phase 15 — full-list, scrollable Tab/End-Game leaderboard.
//     • Shows EVERY player (no top-10 cap) with `overflow-y-auto`.
//     • Highlights the local player's row with a glowing cyan border.
//     • "Close" returns to the canvas so the sandbox brawl can continue.
// zh-TW: Phase 15 — 完整可捲動的排行榜（Tab / 賽後皆使用此元件）。
//     • 顯示所有玩家（不再限制前 10），長度超過時自動 `overflow-y-auto`。
//     • 本地玩家列以青色發光邊框高亮。
//     • 按「關閉」即可回到畫布繼續沙盒對戰。
export function FullLeaderboard({ data, t, localPlayerId, onClose }) {
  const { players, activeType, sandboxEnabled } = data;

  // EN: Phase 20 — Bug 4 fix. The 4 leaderboard categories used to render
  //     simultaneously (merged columns), which produced the "broken / merged"
  //     output players reported. The component now conditionally renders
  //     ONLY the single array dictated by `GameSettings.active_leaderboard_type`
  //     (surfaced as `data.activeType`). Any unknown value falls back to
  //     "kills" so the panel never blanks out on a malformed snapshot.
  // zh-TW: Phase 20 — Bug 4 修正。先前 4 種排行榜類別會同時渲染（欄位合併在
  //     一起），即玩家回報的「排行榜壞掉 / 合併」現象。此元件改為依
  //     `GameSettings.active_leaderboard_type`（透過 `data.activeType` 傳入）
  //     僅渲染唯一指定的類別陣列。未知值會 fallback 到 "kills"，避免快照異常
  //     時面板整個空白。
  const categories = [
    { key: "kills",        label: t.lbKills },
    { key: "deaths",       label: t.lbDeaths },
    { key: "damage_dealt", label: t.lbDamageDealt },
    { key: "damage_taken", label: t.lbDamageTaken },
  ];

  const current = categories.find(c => c.key === activeType) || categories[0];
  // EN: Sort and render ONLY the active category. No other category is ever
  //     surfaced in the rows; the tab strip only labels which one is active.
  // zh-TW: 僅針對選中類別排序並渲染。其他類別不會出現在表列中，
  //     上方頁籤僅標示目前是哪個。
  const sorted = [...players].sort((a, b) => (b[current.key] ?? 0) - (a[current.key] ?? 0));

  const closeLocked = !sandboxEnabled;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: "rgba(3,6,13,0.93)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "flex-start",
      padding: "20px 12px 32px",
    }}>
      <div style={{
        fontFamily: "var(--br-display)", fontSize: "clamp(22px,5vw,52px)",
        fontWeight: 700, letterSpacing: "0.18em", color: "#ff3b5c",
        textShadow: "0 0 32px rgba(255,59,92,0.7)", marginBottom: 4,
        flexShrink: 0,
      }}>
        {t.gameOver}
      </div>
      <div style={{
        fontFamily: "var(--br-mono)", fontSize: "clamp(9px,2vw,11px)",
        letterSpacing: "0.32em", color: "#91a3c4", marginBottom: 6, flexShrink: 0,
      }}>
        {t.finalLeaderboard}
      </div>

      {/* EN: Phase 18 — category tab bar. Only the admin-selected tab glows;
              players see which leaderboard is active but cannot switch.
          zh-TW: Phase 18 — 類別頁籤列。僅管理員選中的頁籤發光；
              玩家可見目前是哪個排行榜，但無法自行切換。 */}
      <div style={{
        display: "flex", gap: 6, marginBottom: 12, flexShrink: 0,
        flexWrap: "wrap", justifyContent: "center",
      }}>
        {categories.map(cat => {
          const isActive = cat.key === current.key;
          return (
            <span key={cat.key} style={{
              padding: "4px 16px", borderRadius: 6,
              fontFamily: "var(--br-mono)", fontSize: "clamp(10px,2.5vw,12px)",
              fontWeight: 700, letterSpacing: "0.15em",
              color: isActive ? "#22d3ee" : "#5a6b8a",
              background: isActive ? "rgba(34,211,238,0.15)" : "rgba(110,145,200,0.06)",
              border: isActive ? "1px solid rgba(34,211,238,0.5)" : "1px solid rgba(110,145,200,0.12)",
              boxShadow: isActive ? "0 0 12px rgba(34,211,238,0.3)" : "none",
              cursor: "default",
              transition: "all 0.2s ease",
            }}>
              {cat.label}
            </span>
          );
        })}
      </div>

      {/* EN: Scroll container — single-column leaderboard for the active category.
          zh-TW: 可捲動容器 — 僅顯示當前選中類別的單欄排行榜。 */}
      <div style={{
        width: "100%", maxWidth: "min(98vw, 600px)",
        background: "rgba(10,18,38,0.9)",
        border: "1px solid rgba(110,145,200,0.2)",
        borderRadius: 10, overflow: "hidden",
        display: "flex", flexDirection: "column",
        flex: "1 1 auto", minHeight: 0,
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "40px 1fr 80px",
          padding: "8px 12px",
          background: "rgba(34,211,238,0.08)",
          borderBottom: "1px solid rgba(110,145,200,0.2)",
          fontFamily: "var(--br-mono)", fontSize: 11,
          letterSpacing: "0.2em", color: "#5a6b8a",
          flexShrink: 0,
        }}>
          <span>#</span>
          <span>NAME</span>
          <span style={{ textAlign: "right", color: "#22d3ee" }}>
            {current.label}
          </span>
        </div>

        <div style={{ overflowY: "auto", flex: "1 1 auto", minHeight: 0 }}>
          {sorted.map((p, i) => {
            const isMe = localPlayerId && p.id === localPlayerId;
            return (
              <div key={p.id} style={{
                display: "grid",
                gridTemplateColumns: "40px 1fr 80px",
                padding: "8px 12px",
                borderBottom: "1px solid rgba(110,145,200,0.06)",
                fontFamily: "var(--br-font)", fontSize: 13,
                color: i === 0 ? "#fbbf24" : "#d8e6ff",
                background: isMe
                  ? "rgba(34,211,238,0.12)"
                  : (i === 0 ? "rgba(251,191,36,0.06)" : "transparent"),
                boxShadow: isMe
                  ? "inset 0 0 0 2px rgba(34,211,238,0.85), 0 0 18px rgba(34,211,238,0.45)"
                  : "none",
              }}>
                <span style={{ fontFamily: "var(--br-mono)", color: "#5a6b8a", fontSize: 11 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.is_bot ? "🤖 " : ""}{p.name}
                  {isMe && (
                    <span style={{
                      marginLeft: 8, fontSize: 10, color: "#22d3ee",
                      fontFamily: "var(--br-mono)", letterSpacing: "0.18em",
                    }}>
                      ◀ YOU
                    </span>
                  )}
                </span>
                <span style={{
                  textAlign: "right", fontFamily: "var(--br-mono)", fontSize: 12,
                  color: "#22d3ee",
                }}>
                  {typeof p[current.key] === "number" ? Math.round(p[current.key]) : (p[current.key] ?? 0)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* EN: Phase 18 — only the "Close" button remains. When sandbox is
              disabled by admin, the button is grayed out and unclickable.
          zh-TW: Phase 18 — 僅保留「關閉」按鈕。管理員停用沙盒時按鈕灰化不可點。 */}
      <div style={{ display: "flex", gap: 12, marginTop: 16, flexShrink: 0, flexDirection: "column", alignItems: "center" }}>
        <button
          style={{
            padding: "10px 36px",
            background: closeLocked ? "rgba(110,145,200,0.06)" : "rgba(34,211,238,0.12)",
            border: closeLocked ? "1px solid rgba(110,145,200,0.15)" : "1px solid rgba(34,211,238,0.4)",
            borderRadius: 8,
            color: closeLocked ? "#5a6b8a" : "#22d3ee",
            fontFamily: "var(--br-display)", fontWeight: 700,
            fontSize: 14, letterSpacing: "0.2em",
            cursor: closeLocked ? "not-allowed" : "pointer",
            opacity: closeLocked ? 0.5 : 1,
          }}
          disabled={closeLocked}
          onClick={closeLocked ? undefined : onClose}
        >
          {t.close}
        </button>
        {closeLocked && (
          <span style={{
            fontFamily: "var(--br-mono)", fontSize: 11, color: "#ff7a8e",
            letterSpacing: "0.12em",
          }}>
            🔒 {t.sandboxLocked}
          </span>
        )}
      </div>
    </div>
  );
}

// EN: Backwards-compat alias — DirectorCanvas still imports `GameOverOverlay`.
//     We expose the new full-list leaderboard under both names so legacy
//     callers keep working without a separate edit pass.
// zh-TW: 向後相容別名 — DirectorCanvas 仍以 `GameOverOverlay` 名稱匯入。
//     兩個名稱都指向新版完整排行榜元件，舊呼叫端不需另外修改。
export const GameOverOverlay = FullLeaderboard;

// ================ Canvas Render helpers ================

function drawGrid(ctx, W, H, camX, camY) {
  const step = 64;
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 1;
  ctx.beginPath();
  const startX = -((camX % step) + step) % step;
  const startY = -((camY % step) + step) % step;
  for (let x = startX; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = startY; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
}

function drawWorldBounds(ctx, world, camX, camY) {
  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 2;
  ctx.strokeRect(-camX, -camY, world.w, world.h);
}

function drawPlayer(ctx, p, camX, camY, isMe) {
  const x = p.x - camX;
  const y = p.y - camY;
  const cx = x + p.w / 2;
  const cy = y + p.h / 2;

  // EN: Phase 20 — team colour logic removed alongside the Teams feature.
  //     Every non-local alive player renders blue; the local player is green.
  // zh-TW: Phase 20 — 隨著隊伍功能移除，team 顏色邏輯一併刪除。
  //     非本機玩家固定為藍色，本機玩家為綠色。
  const aliveFill = isMe ? "#22c55e" : "#3b82f6";
  ctx.fillStyle = p.state === "alive" ? aliveFill : "#475569";
  ctx.fillRect(x, y, p.w, p.h);

  if (p.state === "alive") {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(p.angle) * 22, cy + Math.sin(p.angle) * 22);
    ctx.stroke();
  }

  const hpRatio = Math.max(0, p.hp / p.max_hp);
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(x, y - 8, p.w, 4);
  ctx.fillStyle = hpRatio > 0.4 ? "#22c55e" : hpRatio > 0.2 ? "#f59e0b" : "#ef4444";
  ctx.fillRect(x, y - 8, p.w * hpRatio, 4);

  ctx.fillStyle = "#e5e7eb";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${p.is_bot ? "🤖 " : ""}${p.name}`, cx, y - 12);
  ctx.textAlign = "start";
}

// EN: Phase 20 — minimap dimensions are now driven by `getHudScale()` so the
//     same code renders correctly on phones (0.5×) and desktops (1.0×).
//     Player dot radius is also scaled so individual blips remain legible at
//     both extremes without becoming pixel-noise on mobile or too-tiny on
//     desktop.
// zh-TW: Phase 20 — 小地圖尺寸由 `getHudScale()` 決定，同一份程式即可在
//     手機（0.5×）與桌面（1.0×）正確顯示。玩家圓點半徑同樣依比例縮放，
//     兩端都能保持可辨識（不會在手機變成像素噪點，也不會在桌面看起來太小）。
function drawMinimap(ctx, snap, me) {
  const scale = getHudScale();
  const x0 = PAD, y0 = PAD;
  const mw = MINIMAP_W_BASE * scale;
  const mh = MINIMAP_H_BASE * scale;
  ctx.save();
  ctx.fillStyle = "rgba(11,15,23,0.78)";
  ctx.fillRect(x0, y0, mw, mh);
  ctx.strokeStyle = "#475569";
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, mw - 1, mh - 1);
  const sx = mw / snap.world.w;
  const sy = mh / snap.world.h;
  // EN: Phase 20 — dot radius follows the HUD scale.
  // zh-TW: Phase 20 — 圓點半徑跟隨 HUD 比例。
  const meDotR = Math.max(2, 3 * scale * 2);
  const otherDotR = Math.max(1.5, 2 * scale * 2);
  for (const p of snap.players ?? []) {
    if (p.state !== "alive") continue;
    const isMe = me && p.id === me.id;
    ctx.beginPath();
    ctx.fillStyle = isMe ? "#22c55e" : "#ef4444";
    ctx.arc(x0 + (p.x + p.w / 2) * sx, y0 + (p.y + p.h / 2) * sy, isMe ? meDotR : otherDotR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// EN: Phase 20 — HUD dimensions scale with `getHudScale()`. Mobile keeps the
//     compact Phase 17 sizing (0.5×); desktop doubles every dimension so the
//     panel is comfortably readable on a 1440p screen.
//     Shows: Player, Alive, Dead, HP, Weapon, + Kills/Deaths (only PLAYING).
// zh-TW: Phase 20 — HUD 尺寸跟隨 `getHudScale()` 縮放。手機維持 Phase 17 緊湊
//     版（0.5×）；桌面則整體放大一倍，讓 1440p 螢幕也能舒適閱讀。
//     顯示：玩家、存活、死亡、HP、武器 +（僅 PLAYING 顯示）擊殺/死亡。
function drawHUD(ctx, snap, me, W, t) {
  const scale = getHudScale();
  const isPlaying = (snap.match_state || "PLAYING") === "PLAYING";
  const rowCount = isPlaying ? 7 : 5;

  // EN: Base sizes are the Phase 17 mobile values; scale = 0.5 → mobile,
  //     scale = 1.0 → desktop doubles every dimension.
  // zh-TW: 基準值為 Phase 17 行動版；scale = 0.5 → 手機、1.0 → 桌面整體放大。
  const baseFactor = scale / HUD_SCALE_MOBILE; // 1.0 mobile, 2.0 desktop
  const panelW = Math.round(150 * baseFactor);
  const lh = Math.round(13 * baseFactor);
  const padV = Math.round(6 * baseFactor);
  const padH = Math.round(8 * baseFactor);
  const fontPx = Math.max(9, Math.round(9 * baseFactor));
  const panelH = padV * 2 + rowCount * lh;
  const x0 = W - panelW - PAD, y0 = PAD;

  ctx.fillStyle = "rgba(11,15,23,0.82)";
  ctx.fillRect(x0, y0, panelW, panelH);
  ctx.strokeStyle = "rgba(34,211,238,0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, panelW - 1, panelH - 1);

  const aliveCount = snap.players.filter((p) => p.state === "alive").length;
  const awaitingRespawn = snap.players.filter((p) => p.state === "dead").length;

  ctx.font = `${fontPx}px ui-monospace, monospace`;
  ctx.textAlign = "start";
  let row = y0 + padV + fontPx;

  const drawRow = (label, value, valueColor = "#e5e7eb") => {
    ctx.fillStyle = "#91a3c4";
    ctx.fillText(label, x0 + padH, row);
    ctx.fillStyle = valueColor;
    const val = String(value);
    const metrics = ctx.measureText(val);
    ctx.fillText(val, x0 + panelW - padH - metrics.width, row);
    row += lh;
  };

  // EN: Phase 20 — `[team]` suffix removed; the Teams feature no longer exists.
  // zh-TW: Phase 20 — 移除 `[team]` 後綴；隊伍功能已不存在。
  const myName = me ? me.name : "—";
  const myHp = me ? `${Math.max(0, Math.round(me.hp))}/${Math.round(me.max_hp)}` : "—";
  const weaponId = me?.weapon || "—";
  const weaponLabel = (t[`weapon_${weaponId}`] || weaponId).toString();

  drawRow(`${t.hudPlayer}:`, myName, "#22d3ee");
  drawRow(`${t.hudAlive}:`, aliveCount, "#22c55e");
  drawRow(`${t.hudDead}:`, awaitingRespawn, "#ff7a8e");
  drawRow(`${t.hudHp}:`, myHp);
  drawRow(`${t.hudWeapon}:`, weaponLabel, "#fbbf24");

  // EN: Phase 17 — kills & deaths display (only during PLAYING match state).
  // zh-TW: Phase 17 — 擊殺與死亡統計（僅在 PLAYING 狀態顯示）。
  if (isPlaying && me) {
    drawRow(`${t.hudKills}:`, me.kills ?? 0, "#fbbf24");
    drawRow(`${t.hudDeaths}:`, me.deaths ?? 0, "#ff7a8e");
  }
}

function drawGameTimer(ctx, W, remaining, label) {
  const mins = Math.floor(remaining / 60);
  const secs = Math.floor(remaining % 60);
  const text = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const isLow = remaining <= 30;
  ctx.save();
  const boxW = 160, boxH = 44, x0 = (W - boxW) / 2, y0 = 12;
  ctx.fillStyle = "rgba(11,15,23,0.85)";
  ctx.fillRect(x0, y0, boxW, boxH);
  ctx.strokeStyle = isLow ? "#ff3b5c" : "#22d3ee";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, boxW - 1, boxH - 1);
  ctx.textAlign = "center";
  ctx.font = "bold 11px ui-monospace, monospace";
  ctx.fillStyle = isLow ? "#ff7a8e" : "#94a3b8";
  ctx.fillText(label, W / 2, y0 + 16);
  ctx.font = `bold ${isLow ? "20" : "18"}px ui-monospace, monospace`;
  ctx.fillStyle = isLow ? "#ff3b5c" : "#22d3ee";
  if (isLow) { ctx.shadowColor = "#ff3b5c"; ctx.shadowBlur = 12; }
  ctx.fillText(text, W / 2, y0 + 36);
  ctx.shadowBlur = 0;
  ctx.textAlign = "start";
  ctx.restore();
}

// EN: Phase 15 — POST_GAME banner pinned under the (now-hidden) timer.
// zh-TW: Phase 15 — POST_GAME 橫幅，貼在原計時器位置。
function drawPostGameBanner(ctx, W, label) {
  ctx.save();
  const boxW = 320, boxH = 36, x0 = (W - boxW) / 2, y0 = 12;
  ctx.fillStyle = "rgba(255,59,92,0.18)";
  ctx.fillRect(x0, y0, boxW, boxH);
  ctx.strokeStyle = "#ff3b5c";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, boxW - 1, boxH - 1);
  ctx.textAlign = "center";
  ctx.font = "bold 13px ui-monospace, monospace";
  ctx.fillStyle = "#ff7a8e";
  ctx.shadowColor = "#ff3b5c";
  ctx.shadowBlur = 10;
  ctx.fillText(`◆ ${label} ◆`, W / 2, y0 + 23);
  ctx.shadowBlur = 0;
  ctx.textAlign = "start";
  ctx.restore();
}

function detectThreats(snap, me) {
  const threats = [];
  const cx = me.x + me.w / 2, cy = me.y + me.h / 2;
  for (const e of snap.players) {
    if (e.id === me.id || e.state !== "alive") continue;
    // EN: Phase 20 — team-mode threat filter removed.
    // zh-TW: Phase 20 — 移除 team-mode 威脅過濾。
    const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
    const tx = cx - ex, ty = cy - ey;
    const dist = Math.hypot(tx, ty);
    if (dist > THREAT_RANGE || dist < 1) continue;
    const dot = (Math.cos(e.angle) * tx + Math.sin(e.angle) * ty) / dist;
    if (dot > THREAT_DOT_THRESHOLD) threats.push(e);
  }
  return threats;
}

function drawThreatBanner(ctx, W, H, tSec, label) {
  const alpha = 0.6 + 0.4 * Math.abs(Math.sin(tSec * 6));
  ctx.save();
  ctx.fillStyle = `rgba(239,68,68,${alpha})`;
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`⚠ ${label}`, W / 2, H - 50);
  ctx.restore();
}
