import { useEffect, useRef, useState, useCallback } from "react";
import { useI18n } from "../i18n.jsx";
import useGameSocket from "../hooks/useGameSocket.js";
import MobileControls from "./MobileControls.jsx";
import DeathScreen from "./DeathScreen.jsx";

const INPUT_HZ = 30;
const INPUT_DT = 1000 / INPUT_HZ;
const MINIMAP_SIZE = 180;
const PAD = 12;
const THREAT_DOT_THRESHOLD = 0.985;
const THREAT_RANGE = 760; // doubled from 380

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

  const [gameOverData, setGameOverData] = useState(null);
  const [resetNotice, setResetNotice] = useState(false);

  const prevResetSeqRef = useRef(0);
  const prevGameOverRef = useRef(false);

  const { stateRef, playerId, status, send } = useGameSocket({
    url: wsUrl,
    joinPayload: { type: "join", name, weapon },
  });

  const keysRef = useRef({ w: false, a: false, s: false, d: false });
  const mouseRef = useRef({ x: 0, y: 0, fire: false });
  const joystickRef = useRef({ x: 0, y: 0 });
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
      const usingJoystick = Math.abs(jx) + Math.abs(jy) > 0.001;

      if (usingJoystick) {
        angle = Math.atan2(dy, dx);
        lastAngleRef.current = angle;
      } else if (!IS_COARSE && me && canvas && snap?.world) {
        const camX = me.x + me.w / 2 - canvas.clientWidth / 2;
        const camY = me.y + me.h / 2 - canvas.clientHeight / 2;
        const wx = mouseRef.current.x + camX;
        const wy = mouseRef.current.y + camY;
        angle = Math.atan2(wy - (me.y + me.h / 2), wx - (me.x + me.w / 2));
        lastAngleRef.current = angle;
      }

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

      // Detect match reset
      const seq = snap.reset_seq ?? 0;
      if (seq !== prevResetSeqRef.current) {
        prevResetSeqRef.current = seq;
        setResetNotice(true);
        setGameOverData(null);
        const tid = setTimeout(() => setResetNotice(false), 3000);
        return () => clearTimeout(tid);
      }

      // Auto-close game over when game restarts
      if (prevGameOverRef.current && !snap.game_over) {
        setGameOverData(null);
      }
      prevGameOverRef.current = snap.game_over ?? false;

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

      if (snap.game_over && !gameOverData) {
        const cols = (snap.settings?.leaderboard_columns || "kills,deaths,damage_dealt,damage_taken")
          .split(",").map(s => s.trim()).filter(Boolean);
        const sorted = [...(snap.players || [])].sort((a, b) => (b.kills ?? 0) - (a.kills ?? 0));
        setGameOverData({ players: sorted, columns: cols });
      }
    }, 100);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      drawHUD(ctx, snap, me, status, W);

      if (snap.game_time_remaining > 0) {
        drawGameTimer(ctx, W, snap.game_time_remaining, t.timeRemaining);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [stateRef, status, t]);

  const handleJoystick = useCallback((x, y) => { joystickRef.current.x = x; joystickRef.current.y = y; }, []);
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

  return (
    <>
      <canvas ref={canvasRef} style={{ display: "block", cursor: IS_COARSE ? "none" : "crosshair" }} />

      {overlay.meState === "alive" && (
        <MobileControls onJoystick={handleJoystick} onFire={handleFire} />
      )}

      {overlay.meState === "dead" && (
        <DeathScreen
          respawnRemaining={overlay.respawnRemaining}
          canRespawn={overlay.canRespawn}
          killerName={overlay.killerName}
          killerWeapon={overlay.killerWeapon}
          onSpectate={() => send({ type: "spectate" })}
          onRespawn={() => send({ type: "respawn" })}
        />
      )}

      {/* Spectate bar with countdown */}
      {overlay.meState === "spectating" && (
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

      {/* Game Over overlay */}
      {gameOverData && (
        <GameOverOverlay
          data={gameOverData}
          t={t}
          onClose={() => setGameOverData(null)}
        />
      )}

      {/* Match reset toast */}
      {resetNotice && <ResetNotice label={t.matchResetNotice} />}
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

// ── Leaderboard used by both GameCanvas and DirectorCanvas ──
export function GameOverOverlay({ data, t, onClose }) {
  const { players, columns } = data;
  const colLabels = {
    kills: t.kills,
    deaths: t.deaths,
    damage_dealt: t.damageDealt,
    damage_taken: t.damageTaken,
  };

  const [mobileSortCol, setMobileSortCol] = useState(columns[0] || "kills");
  // Desktop: show each selected column as a separate sorted panel
  // Mobile: single sorted table + dropdown
  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 700;

  const sortedFor = (col) =>
    [...players].sort((a, b) => (b[col] ?? 0) - (a[col] ?? 0));

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(3,6,13,0.93)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "flex-start",
      overflowY: "auto", padding: "20px 12px 32px",
    }}>
      {/* Title */}
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
        letterSpacing: "0.32em", color: "#91a3c4", marginBottom: 16, flexShrink: 0,
      }}>
        {t.finalLeaderboard}
      </div>

      {/* Mobile: dropdown sort selector */}
      {!isDesktop && (
        <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--br-mono)", fontSize: 11, color: "#91a3c4" }}>{t.sortBy}</span>
          <select
            style={{
              background: "rgba(10,18,38,0.9)", color: "#d8e6ff",
              border: "1px solid rgba(110,145,200,0.3)", borderRadius: 6,
              padding: "4px 8px", fontFamily: "var(--br-mono)", fontSize: 12,
            }}
            value={mobileSortCol}
            onChange={e => setMobileSortCol(e.target.value)}
          >
            {columns.map(c => (
              <option key={c} value={c}>{colLabels[c] || c}</option>
            ))}
          </select>
        </div>
      )}

      {/* Desktop: multiple panels, Mobile: single panel */}
      <div style={{
        display: "flex", flexDirection: isDesktop ? "row" : "column",
        gap: 10, width: "100%", maxWidth: isDesktop ? "min(98vw,1200px)" : 480,
        flexWrap: "wrap", justifyContent: "center",
      }}>
        {(isDesktop ? columns : [mobileSortCol]).map(col => (
          <LeaderboardPanel key={col}
            players={sortedFor(col)}
            sortCol={col}
            colLabel={colLabels[col] || col}
            allCols={isDesktop ? [col] : columns}
            colLabels={colLabels}
            isSingle={!isDesktop}
          />
        ))}
      </div>

      <button
        style={{
          marginTop: 18, padding: "10px 36px",
          background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.4)",
          borderRadius: 8, color: "#22d3ee",
          fontFamily: "var(--br-display)", fontWeight: 700,
          fontSize: 14, letterSpacing: "0.2em", cursor: "pointer",
          flexShrink: 0,
        }}
        onClick={onClose}
      >
        {t.close}
      </button>
    </div>
  );
}

function LeaderboardPanel({ players, sortCol, colLabel, allCols, colLabels, isSingle }) {
  return (
    <div style={{
      background: "rgba(10,18,38,0.9)", border: "1px solid rgba(110,145,200,0.2)",
      borderRadius: 10, overflow: "hidden",
      flex: isSingle ? "none" : "1 1 200px", minWidth: 0,
    }}>
      {/* Panel header */}
      <div style={{
        background: "rgba(34,211,238,0.1)", borderBottom: "1px solid rgba(110,145,200,0.2)",
        padding: "7px 12px",
        fontFamily: "var(--br-mono)", fontSize: 11, letterSpacing: "0.22em",
        color: "#22d3ee", textAlign: "center",
      }}>
        ▲ {colLabel.toUpperCase()}
      </div>
      {/* Column headers */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `32px 1fr ${allCols.map(() => "64px").join(" ")}`,
        padding: "5px 10px",
        fontFamily: "var(--br-mono)", fontSize: 10, letterSpacing: "0.15em", color: "#5a6b8a",
        borderBottom: "1px solid rgba(110,145,200,0.08)",
      }}>
        <span>#</span>
        <span>NAME</span>
        {allCols.map(c => (
          <span key={c} style={{ textAlign: "right" }}>
            {(colLabels[c] || c).slice(0, 4).toUpperCase()}
          </span>
        ))}
      </div>
      {/* Rows */}
      {players.slice(0, 10).map((p, i) => (
        <div key={p.id} style={{
          display: "grid",
          gridTemplateColumns: `32px 1fr ${allCols.map(() => "64px").join(" ")}`,
          padding: "6px 10px",
          borderBottom: "1px solid rgba(110,145,200,0.05)",
          fontFamily: "var(--br-font)", fontSize: 13,
          color: i === 0 ? "#fbbf24" : "#d8e6ff",
          background: i === 0 ? "rgba(251,191,36,0.06)" : "transparent",
        }}>
          <span style={{ fontFamily: "var(--br-mono)", color: "#5a6b8a", fontSize: 11 }}>
            {String(i + 1).padStart(2, "0")}
          </span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {p.is_bot ? "🤖 " : ""}{p.name}
          </span>
          {allCols.map(c => (
            <span key={c} style={{
              textAlign: "right", fontFamily: "var(--br-mono)", fontSize: 12,
              color: c === sortCol ? "#22d3ee" : "#91a3c4",
            }}>
              {typeof p[c] === "number" ? Math.round(p[c]) : (p[c] ?? 0)}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

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

  const teamColor = p.team === "red" ? "#ef4444" : p.team === "blue" ? "#3b82f6" : null;
  const aliveFill = isMe ? "#22c55e" : (teamColor || "#3b82f6");
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

function drawMinimap(ctx, snap, me) {
  const x0 = PAD, y0 = PAD, size = MINIMAP_SIZE;
  ctx.save();
  ctx.fillStyle = "rgba(11,15,23,0.78)";
  ctx.fillRect(x0, y0, size, size);
  ctx.strokeStyle = "#475569";
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, size - 1, size - 1);
  const sx = size / snap.world.w;
  const sy = size / snap.world.h;
  for (const p of snap.players ?? []) {
    if (p.state !== "alive") continue;
    const isMe = me && p.id === me.id;
    ctx.beginPath();
    ctx.fillStyle = isMe ? "#22c55e" : "#ef4444";
    ctx.arc(x0 + (p.x + p.w / 2) * sx, y0 + (p.y + p.h / 2) * sy, isMe ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHUD(ctx, snap, me, status, W) {
  const panelW = 260, panelH = 110, x0 = W - panelW - PAD, y0 = PAD;
  ctx.fillStyle = "rgba(11,15,23,0.78)";
  ctx.fillRect(x0, y0, panelW, panelH);
  ctx.strokeStyle = "#475569";
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, panelW - 1, panelH - 1);
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "13px ui-monospace, monospace";
  ctx.textAlign = "start";
  let row = y0 + 22;
  ctx.fillText(`status : ${status}`, x0 + 12, row); row += 18;
  ctx.fillText(`tick   : ${snap.tick}`, x0 + 12, row); row += 18;
  const alive = snap.players.filter((p) => p.state === "alive").length;
  ctx.fillText(`alive  : ${alive}/${snap.players.length}`, x0 + 12, row); row += 18;
  if (me) {
    ctx.fillText(`${me.name}${me.team ? ` [${me.team}]` : ""}`, x0 + 12, row); row += 18;
    ctx.fillText(`hp ${me.hp.toFixed(0)}/${me.max_hp}  k:${me.kills} d:${me.deaths}  ${me.weapon}`, x0 + 12, row);
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

function detectThreats(snap, me) {
  const threats = [];
  const cx = me.x + me.w / 2, cy = me.y + me.h / 2;
  for (const e of snap.players) {
    if (e.id === me.id || e.state !== "alive") continue;
    if (snap.settings?.team_mode && e.team && e.team === me.team) continue;
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
  // Positioned at bottom center
  ctx.fillText(`⚠ ${label}`, W / 2, H - 50);
  ctx.restore();
}
