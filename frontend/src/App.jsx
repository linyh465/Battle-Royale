/**
 * EN: App.jsx — Phase 20.
 *     - "/"        → Lobby (or DirectorCanvas if ?role=director).
 *     - "/admin"   → Phase 20 formal admin route: dark-themed login screen
 *                    that, on successful password auth, renders <AdminPanel>.
 *                    The 5-click logo easter egg on the lobby still works for
 *                    backwards compatibility, but ops can now also reach the
 *                    admin panel directly by URL.
 *     - "*"        → NotFound (cyberpunk 404).
 *     A React <ErrorBoundary> wraps <GameCanvas /> so any uncaught render error
 *     shows a fallback instead of a white screen (Bug 2 fix). The build's
 *     version string is read from APP_VERSION and rendered at the very bottom
 *     of the lobby — the constant is updated by the claude.md version
 *     controller on every change.
 * zh-TW: App.jsx — Phase 20。
 *     - "/"        → 大廳（若 ?role=director 則改顯示 DirectorCanvas）。
 *     - "/admin"   → Phase 20 正式管理員路由：深色登入畫面，密碼通過後
 *                    渲染 <AdminPanel>。原本連點 5 下 logo 的彩蛋仍可使用，
 *                    但運維現在能直接以網址抵達管理面板。
 *     - "*"        → NotFound（賽博龐克 404 頁面）。
 *     React <ErrorBoundary> 包覆 <GameCanvas />，任何 render 例外都會顯示
 *     fallback UI 而非白畫面（Bug 2 修正）。版本字串由 APP_VERSION 常數讀取，
 *     渲染在大廳最底部 — 此常數由 claude.md 版本控制器在每次更新時遞增。
 */
import { useEffect, useRef, useState, Component } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { useI18n } from "./i18n.jsx";
import GameCanvas from "./components/GameCanvas.jsx";
import DirectorCanvas from "./components/DirectorCanvas.jsx";
import AdminPanel from "./components/AdminPanel.jsx";
import PortraitLock from "./components/PortraitLock.jsx";
import NotFound from "./components/NotFound.jsx";
import Docs from "./components/Docs.jsx";
import expandSnapshot from "./hooks/expandSnapshot.js";

// EN: Phase 20 — single source of truth for the displayed build version.
//     The companion `claude.md` version controller in the repo root tracks
//     the changelog; this string is bumped in lockstep with every published
//     change so the lobby footer never lies.
// zh-TW: Phase 20 — 顯示版本字串的唯一權威來源。倉庫根目錄的 `claude.md`
//     版本控制器記錄變更紀錄；每次發布都會與此字串同步遞增，
//     確保大廳頁尾顯示的版本永遠正確。
export const APP_VERSION = "v2.6.0";

const WS_URL = (() => {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/ws`;
})();

// EN: read ?role=director once at module load — the URL never changes mid-session.
// zh-TW: 在模組載入時讀一次 ?role=director，整段 session 不會變。
const ROLE = new URLSearchParams(location.search).get("role");

// EN: Phase 20 — Bug 2 frontend half. <CanvasErrorBoundary> catches any
//     render-time exception thrown inside <GameCanvas> (and its descendants)
//     and shows a cyberpunk fallback instead of leaving the user staring at
//     a white screen. The "Reload" button is unconditional — even if the
//     state is irreparable, a hard refresh always gets the player back in.
// zh-TW: Phase 20 — Bug 2 前端半。<CanvasErrorBoundary> 攔截 <GameCanvas>
//     及其子節點在 render 階段拋出的任何例外，改顯示賽博龐克 fallback，
//     避免玩家看到白畫面。Reload 按鈕無條件可用 — 即使狀態無法恢復，
//     硬刷新永遠能讓玩家重新進入遊戲。
class CanvasErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // EN: Surface to the console so the bug remains diagnosable.
    // zh-TW: 印到 console 以保留除錯資訊。
    // eslint-disable-next-line no-console
    console.error("[CanvasErrorBoundary] uncaught render error:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "#03070d", color: "#ff7a8e",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          fontFamily: "var(--br-mono, ui-monospace, monospace)",
          padding: 24, textAlign: "center",
        }}>
          <div style={{
            fontSize: "clamp(20px,5vw,40px)",
            letterSpacing: "0.18em", marginBottom: 12,
            textShadow: "0 0 24px rgba(255,59,92,0.6)",
          }}>
            ⚠ CLIENT ERROR
          </div>
          <div style={{ fontSize: 14, color: "#91a3c4", marginBottom: 24, maxWidth: 480 }}>
            The arena hit an unexpected render error. The server is still
            running — reload the page to rejoin.
            <br />
            畫面渲染發生未預期錯誤，伺服器仍在運作，重新整理即可重新加入。
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 28px",
              background: "rgba(34,211,238,0.12)",
              border: "1px solid rgba(34,211,238,0.45)",
              borderRadius: 8, color: "#22d3ee",
              fontFamily: "inherit", letterSpacing: "0.2em",
              cursor: "pointer",
            }}
          >RELOAD ▸</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/docs" element={<Navigate to="/docs/en" replace />} />
        <Route path="/docs/:lang" element={<Docs />} />
        {/* EN: Phase 20 — formal /admin route: dark login screen → AdminPanel.
            zh-TW: Phase 20 — 正式 /admin 路由：深色登入畫面 → AdminPanel。 */}
        <Route path="/admin" element={<AdminRoute />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

// EN: Phase 20 — Dedicated /admin route. Opens its own admin WebSocket using
//     the same `join_admin` handshake the lobby's 5-click easter egg uses,
//     and renders the same <AdminPanel> on success. Failure shows an inline
//     error on the login screen — no alert popups.
// zh-TW: Phase 20 — 專用 /admin 路由。使用與大廳 5 連點彩蛋相同的
//     `join_admin` handshake 開啟管理員 WS，認證成功後渲染同一個
//     <AdminPanel>；失敗時於登入畫面直接顯示錯誤訊息，不再彈出 alert。
function AdminRoute() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [authed, setAuthed] = useState(false);
  const stateRef = useRef(null);
  const wsRef = useRef(null);
  const sendRef = useRef(() => {});

  const tryLogin = (password) => {
    setErr("");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join_admin", password }));
    };
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === "state") {
        stateRef.current = expandSnapshot(msg);
      } else if (msg.type === "admin_ok") {
        setAuthed(true);
      } else if (msg.type === "admin_fail") {
        setErr("Authentication failed / 驗證失敗");
        try { ws.close(); } catch { /* noop */ }
      }
    };
    ws.onerror = () => {
      setErr("Connection error / 連線錯誤");
    };
    sendRef.current = (m) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
    };
  };

  if (authed) {
    return (
      <AdminPanel
        stateRef={stateRef}
        send={sendRef.current}
        onClose={() => {
          try { wsRef.current?.close(); } catch { /* noop */ }
          setAuthed(false);
          navigate("/");
        }}
      />
    );
  }

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "#03070d", color: "#d8e6ff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--br-mono, ui-monospace, monospace)",
      padding: 24,
    }}>
      <div style={{
        width: "min(92vw, 380px)",
        background: "rgba(10,18,38,0.92)",
        border: "1px solid rgba(255,59,92,0.35)",
        borderRadius: 12, padding: 28,
        boxShadow: "0 0 32px rgba(255,59,92,0.18)",
      }}>
        <div style={{
          fontFamily: "var(--br-display, ui-monospace, monospace)",
          fontSize: 22, letterSpacing: "0.2em",
          color: "#ff7a8e", marginBottom: 4,
          textShadow: "0 0 18px rgba(255,59,92,0.5)",
        }}>
          ADMIN ACCESS
        </div>
        <div style={{ fontSize: 11, color: "#5a6b8a", letterSpacing: "0.24em", marginBottom: 20 }}>
          管理員登入 · COMMAND CENTER
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); if (pw) tryLogin(pw); }}
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <input
            type="password"
            autoFocus
            value={pw}
            placeholder="password / 密碼"
            onChange={(e) => setPw(e.target.value)}
            style={{
              background: "rgba(3,7,13,0.7)",
              border: "1px solid rgba(110,145,200,0.25)",
              borderRadius: 6, color: "#d8e6ff",
              padding: "10px 12px", fontFamily: "inherit",
            }}
          />
          <button
            type="submit"
            disabled={!pw}
            style={{
              padding: "10px 16px",
              background: pw ? "rgba(255,59,92,0.18)" : "rgba(110,145,200,0.08)",
              border: pw
                ? "1px solid rgba(255,59,92,0.5)"
                : "1px solid rgba(110,145,200,0.15)",
              borderRadius: 6,
              color: pw ? "#ff7a8e" : "#5a6b8a",
              fontFamily: "inherit", letterSpacing: "0.2em",
              cursor: pw ? "pointer" : "not-allowed",
            }}
          >AUTHENTICATE ▸</button>
          {err && (
            <div style={{ fontSize: 12, color: "#ff3b5c", letterSpacing: "0.12em" }}>
              {err}
            </div>
          )}
          <div style={{ fontSize: 11, color: "#5a6b8a", marginTop: 4 }}>
            {APP_VERSION}
          </div>
        </form>
      </div>
    </div>
  );
}

function RootRoute() {
  // EN: Director View bypasses the lobby entirely (kept on "/" with a query
  //     flag so production deep-links such as /?role=director still work).
  // zh-TW: 導播視角直接略過大廳（透過 "/" 上的 query 參數啟動，以保留
  //     /?role=director 這類舊有部署網址）。
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
  // EN: Phase 10 — comma-separated whitelist of weapon IDs the server has
  //     enabled. Driven by /api/settings on first paint and refreshed
  //     periodically so admin toggles propagate to lobby clients without
  //     them needing a WebSocket. Defaults to all six on cold start.
  // zh-TW: Phase 10 — 伺服器目前允許的武器 CSV 白名單。第一次進大廳時由
  //     /api/settings 抓回，之後定期刷新，讓管理員開關武器時，大廳玩家不
  //     需要先連 WebSocket 也能看到變化。冷啟動時預設全 6 種開放。
  const [allowedWeapons, setAllowedWeapons] = useState("pistol,rifle,shotgun,sniper,smg,rocket");
  const trimmedName = name.trim();

  // EN: admin password stash — verified by server on connect.
  // zh-TW: 先在本地暫存管理員密碼，連線後由伺服器驗證。
  const [adminPasswordPending, setAdminPasswordPending] = useState(null);
  const clickStampsRef = useRef([]);

  // EN: For standalone admin mode — WebSocket without joining as player.
  //     The ready flag is set by the admin handshake side-effect; consumers
  //     read it via setAdminWsReady -> setView path. We keep the setter to
  //     preserve the explicit reset on close.
  // zh-TW: 獨立管理員模式 — 不以玩家身份加入的 WebSocket。
  //     ready 旗標由管理員握手 side-effect 設定，主要透過 setAdminWsReady
  //     在關閉時顯式 reset；讀取端走 view = "admin" 的轉換。
  // eslint-disable-next-line no-unused-vars
  const [_adminWsReady, setAdminWsReady] = useState(false);
  const adminStateRef = useRef(null);
  const adminWsRef = useRef(null);
  const adminSendRef = useRef(() => {});

  useEffect(() => {
    // EN: Phase 10 QR fix — in production (HTTPS or any non-loopback host)
    //     the QR must point at `window.location.origin` (e.g. https://gun.piyou.me),
    //     NOT the LAN IP that /api/lan-info returns (which is meaningful only
    //     during local dev). We fall through to /api/lan-info only when the
    //     player is browsing on localhost / 127.0.0.1.
    // zh-TW: Phase 10 QR 修正 — 生產環境（HTTPS 或任何非 loopback 主機）
    //     QR 必須指向 `window.location.origin`（例如 https://gun.piyou.me），
    //     不能指向 /api/lan-info 回傳的 LAN IP（那只在本機 dev 有意義）。
    //     僅在使用者瀏覽 localhost / 127.0.0.1 時才走 /api/lan-info。
    const host = location.hostname;
    const isLocalDev = host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
    if (!isLocalDev) {
      setClientUrl(window.location.origin);
      return;
    }
    let aborted = false;
    fetch("/api/lan-info")
      .then((r) => r.json())
      .then((info) => {
        if (aborted) return;
        setClientUrl(info?.client_url || window.location.origin);
      })
      .catch(() => setClientUrl(window.location.origin));
    return () => { aborted = true; };
  }, []);

  // EN: Phase 10 — poll /api/settings so the lobby weapon picker reacts
  //     to admin toggles in near real-time. 3 s cadence is more than fast
  //     enough for human-paced settings changes; we don't open a WS just
  //     for this. If the request fails (offline, API hiccup), we keep the
  //     last-known list rather than nuking the UI.
  // zh-TW: Phase 10 — 定期 polling /api/settings，讓大廳的武器選單能近乎
  //     即時反映管理員的切換。3 秒節奏對人手操作已足夠快，不另外開 WS。
  //     請求失敗（離線 / API 暫時抖動）時保留上一份清單，避免 UI 瞬間清空。
  useEffect(() => {
    let aborted = false;
    const fetchSettings = () => {
      fetch("/api/settings")
        .then((r) => r.json())
        .then((info) => {
          if (aborted) return;
          if (typeof info?.allowed_weapons === "string") {
            setAllowedWeapons(info.allowed_weapons);
          }
        })
        .catch(() => {});
    };
    fetchSettings();
    const id = setInterval(fetchSettings, 3000);
    return () => { aborted = true; clearInterval(id); };
  }, []);

  // EN: If the player's currently-selected weapon was just disabled by the
  //     admin, snap to the first allowed one. Avoids the awkward state of
  //     trying to spawn with a weapon the server will silently reroll.
  // zh-TW: 玩家目前選中的武器若剛被管理員禁用，自動切回第一個還允許的武器，
  //     避免 join 後伺服器才靜默改派的尷尬時序。
  useEffect(() => {
    const allowed = allowedWeapons.split(",").map(s => s.trim()).filter(Boolean);
    if (allowed.length === 0) return;
    if (!allowed.includes(weapon)) setWeapon(allowed[0]);
  }, [allowedWeapons, weapon]);

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
        {/* EN: Phase 20 — Bug 2: ErrorBoundary catches any render crash so the
                player sees a fallback (with a reload button) instead of a
                blank white screen.
            zh-TW: Phase 20 — Bug 2：ErrorBoundary 攔截 render 階段的崩潰，
                顯示帶有 reload 按鈕的 fallback UI，取代白畫面。 */}
        <CanvasErrorBoundary>
          <GameCanvas
            wsUrl={wsUrl}
            name={trimmedName}
            weapon={weapon}
            adminPassword={null}
          />
        </CanvasErrorBoundary>
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

        {/* EN: Language toggle — EN / 中文 / Tiếng Việt (responsive, z-indexed).
                Phase 12: dev-log link now points at the same-origin /docs path
                served by the MkDocs StaticFiles mount in main.py. The old
                hard-coded port 8001 reference (relic of the dual-process dev
                layout) has been removed.
            zh-TW: 語言切換 — EN / 中文 / Tiếng Việt（響應式、高 z-index）。
                Phase 12：開發日誌連結改為同網域下的 /docs（由 main.py 的
                MkDocs StaticFiles 掛載提供），移除過去 dev 雙行程時期遺留
                的 8001 連結。 */}
        <div className="br-lang-area">
          {/* EN: Phase 15 — Docs / 開發日誌 button is wrapped in the same
                  `.br-lang-toggle / .br-lang-pills` container as the language
                  toggle so they share the rounded glass-pill chrome. The
                  button itself uses the same `.br-lang-pill` class with
                  `is-active` styling for visual parity. The link points at
                  the language-aware native React docs route, so 中文 users
                  land on /docs/zh-TW and EN/VI users land on /docs/en.
              zh-TW: Phase 15 — 「Docs / 開發日誌」按鈕被包進與語言切換相同的
                  `.br-lang-toggle / .br-lang-pills` 容器中，共用同一組
                  圓角玻璃藥丸樣式；按鈕本身沿用 `.br-lang-pill` + `is-active`
                  類別以達成視覺一致。連結會依當前語系直接指向新版 React
                  Docs 路由：中文 → /docs/zh-TW、EN/VI → /docs/en。 */}
          <div className="br-lang-toggle" aria-label="Documentation">
            <div className="br-lang-pills">
              <a
                href={lang === "zh" ? "/docs/zh-TW" : "/docs/en"}
                className="br-lang-pill is-active"
                style={{ textDecoration: "none" }}
              >
                {t.devLog}
              </a>
            </div>
          </div>
          <div className="br-lang-toggle" role="tablist" aria-label="Language">
            <div className="br-lang-pills">
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
          {/* EN: Phase 10 — six-weapon reactive picker. Cards greyed out when
                  the server has disabled that weapon via allowed_weapons.
                  Disabled cards are non-clickable so players can't try to
                  cheat past the whitelist. (Server enforces too — this is UX.)
              zh-TW: Phase 10 — 六種武器的反應式選單。伺服器在 allowed_weapons
                  中關閉的武器會變灰且無法點擊，避免玩家硬選後被伺服器靜默
                  改派。後端也會做最終強制（前端僅 UX）。 */}
          <div className="br-loadout br-loadout--six">
            {[
              { id: "pistol",  label: t.weapon_pistol,  stat: "BALANCED" },
              { id: "rifle",   label: t.weapon_rifle,   stat: "AUTO" },
              { id: "shotgun", label: t.weapon_shotgun, stat: "BURST" },
              { id: "sniper",  label: t.weapon_sniper,  stat: "ONESHOT" },
              { id: "smg",     label: t.weapon_smg,     stat: "RAPID" },
              { id: "rocket",  label: t.weapon_rocket,  stat: "HEAVY" },
            ].map((w) => {
              const allowedSet = new Set(
                allowedWeapons.split(",").map(s => s.trim()).filter(Boolean)
              );
              const enabled = allowedSet.has(w.id);
              return (
                <button
                  key={w.id}
                  className={`br-loadout-card ${weapon === w.id ? "is-active" : ""} ${enabled ? "" : "is-disabled"}`}
                  onClick={() => enabled && setWeapon(w.id)}
                  disabled={!enabled}
                  title={enabled ? w.label : t.weaponDisabled}
                  type="button"
                  style={enabled ? undefined : { opacity: 0.35, cursor: "not-allowed" }}
                >
                  <WeaponIcon kind={w.id} />
                  <span className="br-loadout-label">{w.label}</span>
                  <span className="br-loadout-stat">{enabled ? w.stat : t.locked}</span>
                </button>
              );
            })}
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
                <QRCodeSVG
                  /* EN: Always seed the QR with window.location.origin so the
                         production domain (e.g. https://gun.piyou.me) is in
                         the QR before /api/settings or /api/lan-info finishes.
                         If clientUrl resolves to something different (LAN dev
                         flow), use that instead.
                     zh-TW: QR 預設用 window.location.origin，確保生產網址
                         （例如 https://gun.piyou.me）在 /api/settings 或
                         /api/lan-info 還沒回來前就已經正確；若 clientUrl
                         解析成別的值（本機 dev 的 LAN URL），則改用那個。 */
                  value={clientUrl || window.location.origin}
                  size={176}
                  bgColor="#03070d"
                  fgColor="#e6f7ff"
                  level="M"
                  className="br-qr-svg"
                />
                {!clientUrl && location.hostname !== window.location.hostname && (
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

      {/* EN: Phase 20 — version string is read from the APP_VERSION constant
              which is bumped in lockstep with the claude.md version controller.
          zh-TW: Phase 20 — 版本字串由 APP_VERSION 常數讀入，與 claude.md
              版本控制器同步遞增。 */}
      <footer className="br-foot">
        <span className="br-foot-dot" />{t.nodeOnline}
        <span className="br-foot-sep">·</span>
        {APP_VERSION}
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
  if (kind === "sniper") {
    // EN: long barrel + scope.
    // zh-TW: 長槍管 + 光學瞄具。
    return (
      <svg viewBox="0 0 32 24" className="br-weapon-icon" aria-hidden>
        <path d="M2 11 H30 V13 H2 Z" fill="currentColor" />
        <circle cx="11" cy="8" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M11 5.5 V10.5 M8.5 8 H13.5" stroke="currentColor" strokeWidth="1" />
        <path d="M22 12 V18 H18 V14" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }
  if (kind === "smg") {
    // EN: stubby compact silhouette.
    // zh-TW: 短身緊湊輪廓。
    return (
      <svg viewBox="0 0 32 24" className="br-weapon-icon" aria-hidden>
        <path d="M5 9 H22 V13 H24 L26 11 V15 L24 13 H22 V17 L18 20 H10 L8 17 H5 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 9 V6 H15 V9" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }
  if (kind === "rocket") {
    // EN: launch tube + warhead.
    // zh-TW: 發射筒 + 彈頭。
    return (
      <svg viewBox="0 0 32 24" className="br-weapon-icon" aria-hidden>
        <path d="M3 9 H22 L27 12 L22 15 H3 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M22 12 L29 12" stroke="currentColor" strokeWidth="2" />
        <path d="M6 9 V6 H9 V9 M6 15 V18 H9 V15" fill="none" stroke="currentColor" strokeWidth="1.2" />
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
