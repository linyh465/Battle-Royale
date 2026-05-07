/**
 * EN: App.jsx — Merged lobby with new UI + standalone admin routing.
 *     - ?role=director → DirectorCanvas (bypass lobby).
 *     - 5-click admin trigger → after admin_ok, route to full-screen AdminPanel
 *       (admin does NOT join as a player and does NOT mount GameCanvas).
 *     - Normal player → Lobby → GameCanvas.
 *     - Language toggle (EN / 中文) in lobby header.
 * zh-TW: App.jsx — 合併新 UI 的大廳 + 獨立管理員路由。
 *     - ?role=director → DirectorCanvas（跳過大廳）。
 *     - 連點 5 下管理員觸發 → admin_ok 後導向全螢幕 AdminPanel
 *       （管理員不會加入為玩家，也不會掛載 GameCanvas）。
 *     - 一般玩家 → 大廳 → GameCanvas。
 *     - 大廳頂部的語言切換 (EN / 中文)。
 */
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useI18n } from "./i18n.jsx";
import GameCanvas from "./components/GameCanvas.jsx";
import DirectorCanvas from "./components/DirectorCanvas.jsx";
import AdminPanel from "./components/AdminPanel.jsx";
import PortraitLock from "./components/PortraitLock.jsx";
import useGameSocket from "./hooks/useGameSocket.js";
import expandSnapshot from "./hooks/expandSnapshot.js";

const WS_URL = (() => {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/ws`;
})();

// EN: read ?role=director once at module load — the URL never changes mid-session.
// zh-TW: 在模組載入時讀一次 ?role=director，整段 session 不會變。
const ROLE = new URLSearchParams(location.search).get("role");

export default function App() {
  // EN: Director View bypasses the lobby entirely.
  // zh-TW: 導播視角直接略過大廳。
  if (ROLE === "director") {
    return <DirectorCanvas wsUrl={WS_URL} />;
  }

  return <Lobby wsUrl={WS_URL} />;
}

// ---------------------------------------------------------------------------
// EN: View states — "lobby" | "player" | "admin"
//     The admin view connects a WS for read-only data but does NOT spawn a player.
// zh-TW: 視圖狀態 — "lobby" | "player" | "admin"
//         管理員視圖開啟 WS 取得唯讀資料，但不會產生玩家。
// ---------------------------------------------------------------------------
function Lobby({ wsUrl }) {
  const { t, lang, setLang } = useI18n();

  // EN: view — "lobby" | "player" | "admin"
  // zh-TW: view — "lobby"（大廳）| "player"（玩家）| "admin"（管理員）
  const [view, setView] = useState("lobby");
  const [name, setName] = useState("");
  const [weapon, setWeapon] = useState("rifle");
  const [clientUrl, setClientUrl] = useState("");
  const trimmedName = name.trim();

  // EN: admin password stash — verified by server on connect.
  // zh-TW: 先在本地暫存管理員密碼，連線後由伺服器驗證。
  const [adminPasswordPending, setAdminPasswordPending] = useState(null);
  const clickStampsRef = useRef([]);

  // EN: For standalone admin mode — WebSocket without joining as player.
  // zh-TW: 獨立管理員模式 — 不以玩家身份加入的 WebSocket。
  const [adminWsReady, setAdminWsReady] = useState(false);
  const adminStateRef = useRef(null);
  const adminWsRef = useRef(null);
  const adminSendRef = useRef(() => {});

  useEffect(() => {
    let aborted = false;
    fetch("/api/lan-info")
      .then((r) => r.json())
      .then((info) => {
        if (aborted) return;
        setClientUrl(info?.client_url || `${location.protocol}//${location.host}`);
      })
      .catch(() => setClientUrl(`${location.protocol}//${location.host}`));
    return () => { aborted = true; };
  }, []);

  // EN: 5-click hidden admin trigger. Window is 1.5 s; older clicks expire.
  // zh-TW: 隱藏管理員觸發 — 1.5 秒內連點 5 下，舊紀錄會自動過期。
  const onLogoClick = () => {
    const now = Date.now();
    const recent = clickStampsRef.current.filter((ts) => now - ts < 1500);
    recent.push(now);
    clickStampsRef.current = recent;
    if (recent.length >= 5) {
      clickStampsRef.current = [];
      const pw = window.prompt(`${t.adminPwPrompt}`);
      if (pw) setAdminPasswordPending(pw);
    }
  };

  // EN: When admin password is set, open a dedicated admin WebSocket
  //     that joins via join_admin (non-combatant). On admin_ok → route to admin view.
  // zh-TW: 設定管理員密碼後，開啟專用 WS 以 join_admin（非戰鬥員）加入。
  //         收到 admin_ok → 導向管理員視圖。
  useEffect(() => {
    if (!adminPasswordPending) return;
    const ws = new WebSocket(wsUrl);
    adminWsRef.current = ws;

    ws.onopen = () => {
      // EN: join as admin — server treats this as non-combatant (no player spawned).
      // zh-TW: 以管理員身份加入 — 伺服器視為非戰鬥員（不建立玩家）。
      ws.send(JSON.stringify({ type: "join_admin", password: adminPasswordPending }));
    };

    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === "state") {
        // EN: Expand Phase 9 short-key wire format before exposing to AdminPanel.
        // zh-TW: 將 Phase 9 短鍵格式展開後再交給 AdminPanel 使用。
        adminStateRef.current = expandSnapshot(msg);
      } else if (msg.type === "welcome") {
        // EN: After welcome, immediately authenticate as admin.
        // zh-TW: 收到 welcome 後立即進行管理員驗證。
        ws.send(JSON.stringify({ type: "admin_auth", password: adminPasswordPending }));
      } else if (msg.type === "admin_ok") {
        setAdminWsReady(true);
        setView("admin");
      } else if (msg.type === "admin_fail") {
        window.alert(t.adminAuthFail);
        setAdminPasswordPending(null);
        try { ws.close(); } catch {}
      }
    };

    ws.onclose = () => {
      if (view !== "admin") setAdminPasswordPending(null);
    };
    ws.onerror = () => {};

    adminSendRef.current = (msg) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    };

    return () => { try { ws.close(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminPasswordPending]);

  const handleEnterGame = () => {
    if (!trimmedName) return;
    setView("player");
  };

  // -------------------------------------------------------------------------
  // EN: Admin view — full-screen AdminPanel, no GameCanvas, no player controls.
  // zh-TW: 管理員視圖 — 全螢幕 AdminPanel，無 GameCanvas，無玩家控制。
  // -------------------------------------------------------------------------
  if (view === "admin") {
    return (
      <AdminPanel
        stateRef={adminStateRef}
        send={adminSendRef.current}
        onClose={() => {
          try { adminWsRef.current?.close(); } catch {}
          setAdminPasswordPending(null);
          setAdminWsReady(false);
          setView("lobby");
        }}
      />
    );
  }

  // -------------------------------------------------------------------------
  // EN: Player view — GameCanvas with full controls.
  // zh-TW: 玩家視圖 — GameCanvas 含完整控制。
  // -------------------------------------------------------------------------
  if (view === "player") {
    return (
      <>
        <PortraitLock />
        <GameCanvas
          wsUrl={wsUrl}
          name={trimmedName}
          weapon={weapon}
          adminPassword={null}
        />
      </>
    );
  }

  // -------------------------------------------------------------------------
  // EN: Lobby view — new cyberpunk UI.
  // zh-TW: 大廳視圖 — 全新賽博龐克 UI。
  // -------------------------------------------------------------------------
  return (
    <div className="br-lobby">
      {/* EN: ambient grid + scanlines / zh-TW: 環境格線 + 掃描線 */}
      <div className="br-bg-grid" aria-hidden />
      <div className="br-bg-glow br-bg-glow--cyan" aria-hidden />
      <div className="br-bg-glow br-bg-glow--crimson" aria-hidden />
      <div className="br-scanlines" aria-hidden />

      {/* EN: top chrome / zh-TW: 頂部 chrome */}
      <header className="br-topbar">
        <div className="br-brand" onClick={onLogoClick}>
          <svg className="br-brand-mark" viewBox="0 0 32 32" aria-hidden>
            <path d="M16 2 L29 9 V23 L16 30 L3 23 V9 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M16 8 L23 12 V20 L16 24 L9 20 V12 Z" fill="currentColor" opacity="0.85" />
          </svg>
          <div className="br-brand-text">
            <span className="br-brand-title">BATTLE<span className="br-brand-accent">ROYALE</span></span>
            <span className="br-brand-sub">{t.tagline}</span>
          </div>
          {adminPasswordPending && <span className="br-badge br-badge--admin">{t.admin}</span>}
        </div>

        {/* Language toggle — EN / 中文 / Tiếng Việt */}
        <div className="br-lang-toggle" role="tablist" aria-label="Language" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <a
            href={`http://${location.hostname}:8001`}
            target="_blank"
            rel="noopener noreferrer"
            className="br-lang-pill"
            style={{ textDecoration: 'none', color: 'var(--br-cyan)', fontWeight: 'bold' }}
          >
            【開發日誌】
          </a>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { id: "en", label: "EN" },
              { id: "zh", label: "中" },
              { id: "vi", label: "VN" },
            ].map(({ id, label }) => (
              <button key={id} role="tab" aria-selected={lang === id}
                className={`br-lang-pill ${lang === id ? "is-active" : ""}`}
                onClick={() => setLang(id)}
              >{label}</button>
            ))}
          </div>
        </div>
      </header>

      <main className="br-lobby-main">
        {/* EN: Left — callsign + loadout / zh-TW: 左側 — 代號 + 武裝 */}
        <section className="br-glass br-glass--primary br-deploy">
          <div className="br-glass-corner br-glass-corner--tl" />
          <div className="br-glass-corner br-glass-corner--tr" />
          <div className="br-glass-corner br-glass-corner--bl" />
          <div className="br-glass-corner br-glass-corner--br" />

          <div className="br-section-head">
            <span className="br-tick" />
            <h2 className="br-h2">{t.callsign}</h2>
          </div>
          <input
            className="br-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.callsignPh}
            maxLength={20}
            autoFocus
          />

          <div className="br-section-head" style={{ marginTop: 24 }}>
            <span className="br-tick" />
            <h2 className="br-h2">{t.loadout}</h2>
          </div>
          <div className="br-loadout">
            {[
              { id: "pistol",  label: t.pistol,  stat: "FAST" },
              { id: "rifle",   label: t.rifle,   stat: "BALANCED" },
              { id: "shotgun", label: t.shotgun, stat: "BURST" },
            ].map((w) => (
              <button
                key={w.id}
                className={`br-loadout-card ${weapon === w.id ? "is-active" : ""}`}
                onClick={() => setWeapon(w.id)}
                type="button"
              >
                <WeaponIcon kind={w.id} />
                <span className="br-loadout-label">{w.label}</span>
                <span className="br-loadout-stat">{w.stat}</span>
              </button>
            ))}
          </div>

          <button
            className="br-cta"
            onClick={handleEnterGame}
            disabled={!trimmedName}
          >
            <span className="br-cta-arrow">▸</span>
            <span>{t.enter}</span>
            <span className="br-cta-glint" aria-hidden />
          </button>

          <p className="br-hint">
            <span className="br-kbd">WASD</span> · <span className="br-kbd">Mouse</span> · {t.desktop}
          </p>
        </section>

        {/* EN: Right — Join Terminal QR / zh-TW: 右側 — 加入終端 QR */}
        <aside className="br-glass br-glass--terminal br-terminal">
          <div className="br-glass-corner br-glass-corner--tl br-glass-corner--cyan" />
          <div className="br-glass-corner br-glass-corner--tr br-glass-corner--cyan" />
          <div className="br-glass-corner br-glass-corner--bl br-glass-corner--cyan" />
          <div className="br-glass-corner br-glass-corner--br br-glass-corner--cyan" />

          <div className="br-terminal-head">
            <div className="br-terminal-dots">
              <span /><span /><span />
            </div>
            <span className="br-terminal-title">{t.joinTerminal}</span>
            <span className="br-status-led" />
          </div>

          <div className="br-terminal-body">
            <p className="br-terminal-hint">{t.scanHint}</p>

            <div className="br-qr-wrap">
              <div className="br-qr-frame">
                <div className="br-qr-corner br-qr-corner--tl" />
                <div className="br-qr-corner br-qr-corner--tr" />
                <div className="br-qr-corner br-qr-corner--bl" />
                <div className="br-qr-corner br-qr-corner--br" />
                {clientUrl ? (
                  <QRCodeSVG
                    value={clientUrl}
                    size={176}
                    bgColor="#03070d"
                    fgColor="#e6f7ff"
                    level="M"
                    className="br-qr-svg"
                  />
                ) : (
                  <div className="br-qr-detect">{t.detect}</div>
                )}
              </div>
            </div>

            {clientUrl && (
              <code className="br-terminal-url">
                <span className="br-terminal-prompt">$</span> {clientUrl}
              </code>
            )}
          </div>
        </aside>
      </main>

      <footer className="br-foot">
        <span className="br-foot-dot" />{t.nodeOnline}
        <span className="br-foot-sep">·</span>
        v2.4.1
        <span className="br-foot-sep">·</span>
        {t.mobile}
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EN: Weapon icon SVGs / zh-TW: 武器圖示 SVG
// ---------------------------------------------------------------------------
function WeaponIcon({ kind }) {
  if (kind === "pistol") {
    return (
      <svg viewBox="0 0 32 24" className="br-weapon-icon" aria-hidden>
        <path d="M3 8 H22 L26 12 V16 H22 L20 20 H10 L8 16 H3 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="13" cy="13" r="1.5" fill="currentColor" />
      </svg>
    );
  }
  if (kind === "shotgun") {
    return (
      <svg viewBox="0 0 32 24" className="br-weapon-icon" aria-hidden>
        <path d="M2 10 H26 L30 7 V17 L26 14 H22 L20 20 H10 L8 14 H2 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  // rifle (default)
  return (
    <svg viewBox="0 0 32 24" className="br-weapon-icon" aria-hidden>
      <path d="M2 9 H24 V13 H28 L30 11 V17 L28 15 H24 V19 L20 22 H8 L6 19 H2 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 9 V5 H14 V9" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
