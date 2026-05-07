import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";

/**
 * EN: Docs.jsx (Phase 15) — native React SPA documentation page.
 *     Replaces the old MkDocs static site mounted at /docs. Pure
 *     CSS / inline-style animations (cyberpunk theme + typing effect);
 *     no third-party dependencies, no server build step.
 *
 *     Routes (App.jsx wires these):
 *       /docs/en     — strictly English content.
 *       /docs/zh-TW  — strictly Traditional Chinese content.
 *
 *     Bilingual content is held in two parallel maps below; the param
 *     selects which one to render. Switching language via the in-page
 *     toggle just navigates between the two routes (no client-side
 *     translation key lookup) — this keeps each route's HTML payload
 *     strictly mono-lingual as required by the spec.
 *
 * zh-TW: Docs.jsx（Phase 15）— 原生 React SPA 文件頁。
 *     完全取代舊版掛在 /docs 的 MkDocs 靜態站。所有動畫使用純 CSS /
 *     inline-style（賽博龐克 + 打字機效果），不依賴第三方套件，
 *     也不需任何伺服器端 build 步驟。
 *
 *     路由（由 App.jsx 配置）：
 *       /docs/en     — 嚴格英文內容。
 *       /docs/zh-TW  — 嚴格繁體中文內容。
 *
 *     雙語內容分別存於兩份平行 map，依路由參數選擇顯示哪一份。
 *     頁面內語言切換鈕直接 navigate 至另一條路由，不做運行時翻譯，
 *     確保每條路由的 HTML 都是「嚴格單一語系」。
 */

const CONTENT = {
  en: {
    title: "BATTLE ROYALE · OPERATOR MANUAL",
    subtitle: "Phase 15 build — twin-stick controls, sandbox brawl",
    sections: [
      {
        heading: "01 / OVERVIEW",
        body: [
          "Battle Royale is a continuous deathmatch arena. The world is a single 2560×1440 grid; there is no shrinking safe-zone. Match length is configured by the admin (default: untimed). When the timer expires the match transitions to POST-GAME · SANDBOX BRAWL — the leaderboard freezes, but combat continues so players can keep practising.",
        ],
      },
      {
        heading: "02 / CONTROLS — DESKTOP",
        body: [
          "Movement: W A S D",
          "Aim:      Mouse cursor (the weapon barrel tracks the cursor)",
          "Fire:     Left mouse button (hold for continuous fire)",
          "Respawn:  Space (when cooldown is 0)",
          "Spectate: Tab",
        ],
      },
      {
        heading: "03 / CONTROLS — MOBILE TWIN-STICK",
        body: [
          "LEFT joystick — movement only. The barrel is NEVER auto-aimed by movement direction.",
          "RIGHT joystick (AIM) — drag to aim. Tap to fire one round. Hold-and-drag for continuous fire (server enforces each weapon's fire-rate cap).",
          "The right stick fully replaces the legacy red FIRE button.",
        ],
      },
      {
        heading: "04 / WEAPON ARSENAL",
        body: [
          "Pistol — balanced sidearm.",
          "Assault Rifle — auto-fire workhorse.",
          "Shotgun — six-pellet cone, devastating up close.",
          "Sniper — slow trigger, lethal one-shot. (Phase 15 fixes the prior 0-damage bug via swept-line CCD.)",
          "SMG — highest fire rate, lowest per-shot damage.",
          "Rocket Launcher — heavy slow projectile, 14×14 hitbox.",
        ],
      },
      {
        heading: "05 / MATCH STATES",
        body: [
          "PLAYING   — normal authoritative match. Kills count. Leaderboard is live.",
          "POST_GAME — timer hit zero (or admin ended the match). Leaderboard is FROZEN. Players may keep killing & respawning in sandbox mode, but those kills no longer change the final standings.",
          "Admin RESET MATCH returns the world to PLAYING and wipes every stat / HP / penalty.",
        ],
      },
      {
        heading: "06 / ADMIN PANEL",
        body: [
          "Open the admin panel by tapping the lobby logo five times within 1.5 s, then enter the admin password (default: 0909).",
          "The admin panel can adjust HP, weapon allow-list, bot count, focus-fire cap, match timer, and trigger Reset Match / End Game Now.",
          "Phase 15 — the admin-only player roster now exposes each connected player's IP and User-Agent for moderation purposes. This information is never broadcast to other players.",
        ],
      },
    ],
  },
  "zh-TW": {
    title: "競技場 · 餘燼協定 操作手冊",
    subtitle: "Phase 15 版本 — 雙搖桿控制、賽後沙盒對戰",
    sections: [
      {
        heading: "01 / 遊戲概述",
        body: [
          "本專案是以大逃殺為基底的競技場遊戲：世界為單一 2560×1440 網格，沒有縮圈機制。比賽時長由管理員設定（預設無限時）。當倒數歸零，遊戲會切換到「賽後 · 沙盒對戰」狀態 — 排行榜立刻凍結，但戰鬥仍持續，玩家可繼續遊玩。",
        ],
      },
      {
        heading: "02 / 桌面操作",
        body: [
          "移動：    W A S D",
          "瞄準：    滑鼠游標（槍口會跟隨游標方向）",
          "射擊：    滑鼠左鍵（按住 = 連射）",
          "復活：    空白鍵（冷卻為 0 時可用）",
          "觀戰：    Tab",
        ],
      },
      {
        heading: "03 / 手機雙搖桿操作",
        body: [
          "左搖桿 — 「僅控制移動」。槍口不會再自動跟隨移動方向。",
          "右搖桿（AIM）— 拖曳即瞄準；短點為單發；按住並拖曳為連續射擊（射速冷卻由伺服器依各武器的 fire_rate 強制執行）。",
          "右搖桿已完全取代舊版紅色 FIRE 按鈕。",
        ],
      },
      {
        heading: "04 / 武器庫",
        body: [
          "手槍 — 平衡型副武器。",
          "突擊步槍 — 全自動主力。",
          "霰彈槍 — 六發扇形彈道，近戰毀滅性。",
          "狙擊槍 — 低射速、單發致命。（Phase 15 已修正先前「狙擊 0 傷害」bug，採用掃掠線 CCD 連續碰撞）。",
          "衝鋒槍 — 武器庫中最高射速、單發傷害最低。",
          "火箭筒 — 重型慢速彈，14×14 hitbox。",
        ],
      },
      {
        heading: "05 / 對戰狀態",
        body: [
          "PLAYING   — 一般權威比賽。擊殺計分、排行榜即時更新。",
          "POST_GAME — 時間到（或管理員手動結束）。排行榜「凍結」。玩家仍可繼續擊殺與重生（沙盒對戰），但這些擊殺不會再影響最終排行榜。",
          "管理員按下「重置對戰」會把世界切回 PLAYING，並清空所有計數 / 血量 / 懲罰。",
        ],
      },
      {
        heading: "06 / 管理員面板",
        body: [
          "在 1.5 秒內連點大廳 LOGO 五下，輸入管理員密碼（預設：0909）即可進入管理員面板。",
          "面板可調整：血量、武器允許清單、Bot 數量、集火上限、對戰倒數、立即結束、重置對戰…等。",
          "Phase 15 — 管理員專屬玩家列表新增「IP 與 User-Agent」欄位，方便巡守。此資訊絕不會廣播給其他玩家。",
        ],
      },
    ],
  },
};

const VALID_LANGS = new Set(["en", "zh-TW"]);

export default function Docs() {
  const params = useParams();
  const navigate = useNavigate();
  const lang = VALID_LANGS.has(params.lang) ? params.lang : "en";
  const data = CONTENT[lang];
  const switchTo = lang === "en" ? "zh-TW" : "en";

  // EN: Inject the keyframes ONE time (the page may unmount/remount when
  //     the user toggles language; we don't want to dupe the <style> tag).
  // zh-TW: 動畫 keyframes 只注入一次（切換語言時頁面會重掛載，避免重複塞
  //     <style> 標籤）。
  useEffect(() => {
    const id = "br-docs-keyframes";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      @keyframes brDocsBlink   { 0%,49% { opacity:1 } 50%,100% { opacity:0 } }
      @keyframes brDocsScan    { 0% { transform:translateY(-100%) } 100% { transform:translateY(100%) } }
      @keyframes brDocsRise    { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
      @keyframes brDocsGlow    { 0%,100% { text-shadow:0 0 12px rgba(34,211,238,0.55), 0 0 28px rgba(34,211,238,0.25) }
                                  50%     { text-shadow:0 0 18px rgba(34,211,238,0.85), 0 0 36px rgba(34,211,238,0.45) } }
    `;
    document.head.appendChild(s);
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(circle at 30% 0%, rgba(34,211,238,0.08), transparent 55%)," +
        "radial-gradient(circle at 80% 100%, rgba(255,59,92,0.08), transparent 55%)," +
        "#03070d",
      color: "#d8e6ff",
      fontFamily: "var(--br-font, system-ui, sans-serif)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* EN: Ambient grid + animated scanline overlay (cyberpunk).
          zh-TW: 環境格線 + 動態掃描線（賽博龐克風）。 */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage:
          "linear-gradient(rgba(34,211,238,0.05) 1px, transparent 1px)," +
          "linear-gradient(90deg, rgba(34,211,238,0.05) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />
      <div aria-hidden style={{
        position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", left: 0, right: 0, height: "8vh",
          background: "linear-gradient(transparent, rgba(34,211,238,0.06), transparent)",
          animation: "brDocsScan 6s linear infinite",
        }} />
      </div>

      <div style={{
        position: "relative", zIndex: 1,
        maxWidth: 960, margin: "0 auto", padding: "24px 18px 80px",
      }}>
        {/* Top bar */}
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12, marginBottom: 24,
        }}>
          <Link to="/" style={{
            color: "#22d3ee", textDecoration: "none",
            fontFamily: "var(--br-mono, ui-monospace)", fontSize: 12,
            letterSpacing: "0.18em",
            border: "1px solid rgba(34,211,238,0.45)",
            padding: "6px 14px", borderRadius: 999,
          }}>
            ◂ {lang === "en" ? "BACK TO LOBBY" : "返回大廳"}
          </Link>

          {/* EN: In-page language toggle (mirrors lobby pill style).
              zh-TW: 頁內語言切換（與大廳同款圓角樣式）。 */}
          <div style={{
            display: "inline-flex", gap: 6,
            background: "rgba(10,18,38,0.7)",
            border: "1px solid rgba(110,145,200,0.25)",
            borderRadius: 999, padding: 4,
          }}>
            <button
              onClick={() => navigate("/docs/en")}
              style={pillStyle(lang === "en")}
            >EN</button>
            <button
              onClick={() => navigate("/docs/zh-TW")}
              style={pillStyle(lang === "zh-TW")}
            >中文</button>
          </div>
        </header>

        {/* Title with typing effect + animated glow */}
        <h1 style={{
          fontFamily: "var(--br-display, system-ui, sans-serif)",
          fontWeight: 800,
          fontSize: "clamp(26px, 5vw, 44px)",
          letterSpacing: "0.16em",
          color: "#e6f7ff",
          margin: "0 0 6px",
          animation: "brDocsGlow 2.6s ease-in-out infinite",
        }}>
          <Typewriter text={data.title} />
          <span style={{
            display: "inline-block", width: "0.6ch",
            color: "#22d3ee",
            animation: "brDocsBlink 1s steps(1) infinite",
            marginLeft: 2,
          }}>▍</span>
        </h1>
        <p style={{
          color: "#91a3c4",
          fontFamily: "var(--br-mono, ui-monospace)",
          fontSize: 12, letterSpacing: "0.22em",
          margin: "0 0 36px",
        }}>
          {data.subtitle}
        </p>

        {/* Sections — each card animates in on mount */}
        {data.sections.map((sec, idx) => (
          <section
            key={sec.heading}
            style={{
              background: "rgba(10,18,38,0.78)",
              border: "1px solid rgba(110,145,200,0.18)",
              borderRadius: 12,
              padding: "18px 22px",
              marginBottom: 18,
              boxShadow: "0 0 0 1px rgba(34,211,238,0.06), 0 18px 36px -24px rgba(34,211,238,0.5)",
              animation: `brDocsRise 480ms ease-out ${idx * 90}ms backwards`,
            }}
          >
            <h2 style={{
              fontFamily: "var(--br-mono, ui-monospace)",
              fontSize: 13, letterSpacing: "0.32em",
              color: "#22d3ee", margin: "0 0 12px",
            }}>
              {sec.heading}
            </h2>
            <ul style={{
              margin: 0, padding: 0, listStyle: "none",
              display: "flex", flexDirection: "column", gap: 8,
              fontSize: 14.5, lineHeight: 1.65,
            }}>
              {sec.body.map((line, i) => (
                <li key={i} style={{
                  paddingLeft: 18, position: "relative",
                  color: "#d8e6ff",
                }}>
                  <span style={{
                    position: "absolute", left: 0, top: 9,
                    width: 8, height: 8, borderRadius: 2,
                    background: "linear-gradient(135deg, #22d3ee, #ff3b5c)",
                    boxShadow: "0 0 10px rgba(34,211,238,0.5)",
                  }} />
                  {line}
                </li>
              ))}
            </ul>
          </section>
        ))}

        <footer style={{
          marginTop: 32,
          color: "#5a6b8a",
          fontFamily: "var(--br-mono, ui-monospace)",
          fontSize: 11, letterSpacing: "0.2em",
          textAlign: "center",
        }}>
          ● BATTLE-ROYALE · PHASE 15 · {lang === "en" ? "DOCS" : "文件"}
        </footer>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
          <button
            onClick={() => navigate(`/docs/${switchTo}`)}
            style={{
              background: "rgba(34,211,238,0.1)",
              color: "#22d3ee",
              border: "1px solid rgba(34,211,238,0.4)",
              borderRadius: 999,
              padding: "10px 28px",
              fontFamily: "var(--br-display, system-ui)",
              fontWeight: 700,
              letterSpacing: "0.2em",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            ▸ {switchTo === "en" ? "READ IN ENGLISH" : "切換為繁體中文"}
          </button>
        </div>
      </div>
    </div>
  );
}

function pillStyle(active) {
  return {
    background: active ? "rgba(34,211,238,0.18)" : "transparent",
    color: active ? "#22d3ee" : "#91a3c4",
    border: active ? "1px solid rgba(34,211,238,0.55)" : "1px solid transparent",
    padding: "4px 14px", borderRadius: 999,
    fontFamily: "var(--br-mono, ui-monospace)",
    fontSize: 11, letterSpacing: "0.18em",
    cursor: "pointer",
  };
}

// EN: Pure-CSS / requestAnimationFrame typewriter. We avoid setState in a
//     tight loop by writing into a ref'd <span> directly. The effect resets
//     when `text` changes (i.e. when the user toggles language).
// zh-TW: 純 CSS / rAF 打字機效果。直接寫入 ref 的 <span>，避免 tight loop
//     觸發 React 重渲染。`text` 變動（切語言）時會自動重置。
function Typewriter({ text, speed = 40 }) {
  const spanRef = useRef(null);
  // memoise the chars so the effect deps stay stable per text change.
  const chars = useMemo(() => Array.from(text || ""), [text]);

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;
    el.textContent = "";
    let i = 0;
    let cancelled = false;
    const step = () => {
      if (cancelled) return;
      if (i >= chars.length) return;
      el.textContent = chars.slice(0, i + 1).join("");
      i += 1;
      setTimeout(() => requestAnimationFrame(step), speed);
    };
    requestAnimationFrame(step);
    return () => { cancelled = true; };
  }, [chars, speed]);

  return <span ref={spanRef} />;
}
