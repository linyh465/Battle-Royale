import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n.jsx";
import useGameSocket from "../hooks/useGameSocket.js";
import { GameOverOverlay } from "./GameCanvas.jsx";

export default function DirectorCanvas({ wsUrl }) {
  const { t } = useI18n();
  const canvasRef = useRef(null);
  const { stateRef, status } = useGameSocket({
    url: wsUrl,
    joinPayload: { type: "join_director" },
  });

  const viewRef = useRef({ x: 0, y: 0, scale: 1, fit: true });
  const dragRef = useRef(null);
  const [hint, setHint] = useState(true);
  const [gameOverData, setGameOverData] = useState(null);

  const prevResetSeqRef = useRef(0);
  const prevGameOverRef = useRef(false);

  // Poll for game over / reset events
  useEffect(() => {
    const id = setInterval(() => {
      const snap = stateRef.current;
      if (!snap) return;

      const seq = snap.reset_seq ?? 0;
      if (seq !== prevResetSeqRef.current) {
        prevResetSeqRef.current = seq;
        setGameOverData(null);
      }
      if (prevGameOverRef.current && !snap.game_over) {
        setGameOverData(null);
      }
      prevGameOverRef.current = snap.game_over ?? false;

      if (snap.game_over && !gameOverData) {
        const cols = (snap.settings?.leaderboard_columns || "kills,deaths,damage_dealt,damage_taken")
          .split(",").map(s => s.trim()).filter(Boolean);
        const sorted = [...(snap.players || [])].sort((a, b) => (b.kills ?? 0) - (a.kills ?? 0));
        setGameOverData({ players: sorted, columns: cols });
      }
    }, 200);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateRef]);

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

    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      dragRef.current = { x: e.clientX, y: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y };
      viewRef.current.fit = false;
      setHint(false);
    };
    const onMouseMove = (e) => {
      const d = dragRef.current;
      if (!d) return;
      const v = viewRef.current;
      v.x = d.vx + (e.clientX - d.x) / v.scale;
      v.y = d.vy + (e.clientY - d.y) / v.scale;
    };
    const onMouseUp = () => { dragRef.current = null; };
    const onWheel = (e) => {
      e.preventDefault();
      const v = viewRef.current;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      v.scale = Math.max(0.1, Math.min(4, v.scale * factor));
      v.fit = false;
    };
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    const draw = () => {
      try {
        const snap = stateRef.current;
        const W = canvas.clientWidth;
        const H = canvas.clientHeight;
        ctx.fillStyle = "#0b0f17";
        ctx.fillRect(0, 0, W, H);

        if (!snap?.world) {
          ctx.fillStyle = "#888";
          ctx.font = "16px sans-serif";
          ctx.fillText(`Director status: ${status}…`, 24, 32);
          raf = requestAnimationFrame(draw);
          return;
        }

        const v = viewRef.current;
        if (v.fit) {
          const sx = W / snap.world.w;
          const sy = H / snap.world.h;
          v.scale = Math.min(sx, sy) * 0.95;
          v.x = (W / v.scale - snap.world.w) / 2;
          v.y = (H / v.scale - snap.world.h) / 2;
        }

        ctx.save();
        ctx.scale(v.scale, v.scale);
        ctx.translate(v.x, v.y);

        // grid
        ctx.strokeStyle = "#1f2937";
        ctx.lineWidth = 1 / v.scale;
        ctx.beginPath();
        const step = 200;
        for (let x = 0; x <= snap.world.w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, snap.world.h); }
        for (let y = 0; y <= snap.world.h; y += step) { ctx.moveTo(0, y); ctx.lineTo(snap.world.w, y); }
        ctx.stroke();

        // world bounds
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 3 / v.scale;
        ctx.strokeRect(0, 0, snap.world.w, snap.world.h);

        // bullets
        ctx.fillStyle = "#fbbf24";
        for (const b of snap.bullets ?? []) ctx.fillRect(b.x, b.y, b.w, b.h);

        // players
        ctx.font = `${12 / v.scale}px sans-serif`;
        for (const p of snap.players ?? []) {
          const alive = p.state === "alive";
          const fill = !alive ? "#475569"
            : p.team === "red" ? "#ef4444"
            : p.team === "blue" ? "#3b82f6"
            : "#22c55e";
          ctx.fillStyle = fill;
          ctx.fillRect(p.x, p.y, p.w, p.h);
          if (alive) {
            const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 2 / v.scale;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(p.angle) * 30, cy + Math.sin(p.angle) * 30);
            ctx.stroke();
            const r = Math.max(0, p.hp / p.max_hp);
            ctx.fillStyle = "#1f2937";
            ctx.fillRect(p.x, p.y - 6, p.w, 3);
            ctx.fillStyle = r > 0.4 ? "#22c55e" : r > 0.2 ? "#f59e0b" : "#ef4444";
            ctx.fillRect(p.x, p.y - 6, p.w * r, 3);
          }
          ctx.fillStyle = "#e5e7eb";
          ctx.fillText(`${p.is_bot ? "🤖" : ""}${p.name}`, p.x, p.y - 8);
        }
        ctx.restore();

        // HUD
        ctx.fillStyle = "rgba(11,15,23,0.78)";
        ctx.fillRect(12, 12, 360, 76);
        ctx.strokeStyle = snap.game_over ? "#ff3b5c" : "#7c3aed";
        ctx.lineWidth = snap.game_over ? 2 : 1;
        ctx.strokeRect(12.5, 12.5, 359, 75);
        ctx.fillStyle = "#e5e7eb";
        ctx.font = "13px ui-monospace, monospace";
        ctx.fillText(snap.game_over ? "🏁 GAME OVER — DIRECTOR" : "🎬 DIRECTOR / GOD MODE", 24, 32);
        const aliveCount = (snap.players ?? []).filter(p => p.state === "alive").length;
        ctx.fillText(
          `alive ${aliveCount}/${snap.players.length}  ·  bullets ${snap.bullets.length}  ·  tick ${snap.tick}`,
          24, 52,
        );
        ctx.fillText(`world ${snap.world.w}×${snap.world.h}`, 24, 72);

        // Game timer
        if (snap.game_time_remaining > 0) {
          const mins = Math.floor(snap.game_time_remaining / 60);
          const secs = Math.floor(snap.game_time_remaining % 60);
          const timerText = `⏱ ${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
          ctx.fillStyle = snap.game_time_remaining <= 30 ? "#ff3b5c" : "#22d3ee";
          ctx.font = "bold 14px ui-monospace, monospace";
          ctx.textAlign = "center";
          ctx.fillText(timerText, W / 2, 28);
          ctx.textAlign = "start";
        }

        raf = requestAnimationFrame(draw);
      } catch (e) {
        console.error("Director draw error:", e);
        raf = requestAnimationFrame(draw);
      }
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [stateRef, status]);

  return (
    <>
      <canvas ref={canvasRef} style={{ display: "block", cursor: "grab" }} />
      {hint && (
        <div style={{
          position: "fixed", bottom: 16, left: 16,
          background: "rgba(11,15,23,0.85)", color: "#94a3b8",
          padding: "8px 12px", borderRadius: 6, fontSize: 12,
        }}>
          drag to pan · wheel to zoom
        </div>
      )}
      {gameOverData && (
        <GameOverOverlay
          data={gameOverData}
          t={t}
          onClose={() => setGameOverData(null)}
        />
      )}
    </>
  );
}
