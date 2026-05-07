import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import docsContent from "../data/docsContent.js";

/**
 * EN: Docs.jsx (Phase 16) — interactive native React SPA documentation.
 *     Replaces the old MkDocs static site mounted at /docs. Pulls all
 *     copy from src/data/docsContent.js so the component stays focused
 *     on layout / animation. Strict mono-lingual rendering: /docs/en
 *     reads ONLY the `en` tree, /docs/zh-TW reads ONLY the `zh-TW`
 *     tree — no per-string fallback into the other language.
 *
 *     Layout:
 *       - Cyberpunk shell: ambient grid + animated scanline overlay
 *         (.br-docs-scan), neon glow on the title (typewriter effect).
 *       - Sidebar (desktop) / horizontal tab strip (mobile) navigates
 *         between the four top-level categories declared in
 *         docsContent.js (Game Manual / Admin Guide / Tech / Patch Notes).
 *       - Content cards use .br-glass styling from theme.css with a
 *         subtle entry animation (brDocsRise) staggered per section.
 *       - Patch-note sections support an optional `groups` shape so
 *         v1.5 can render Gameplay / Backend / Admin sub-headers.
 *
 *     Routes (App.jsx wires these — unchanged from Phase 15):
 *       /docs        → Navigate to /docs/en
 *       /docs/en     → English tree
 *       /docs/zh-TW  → Traditional Chinese tree
 *
 * zh-TW: Docs.jsx（Phase 16）— 互動式原生 React SPA 文件。
 *     完全取代舊版 MkDocs，所有文案集中在 src/data/docsContent.js，
 *     此元件只專注於排版 / 動畫。嚴格單一語系：/docs/en 只讀 `en` 子樹、
 *     /docs/zh-TW 只讀 `zh-TW` 子樹，不做任何單字串 fallback。
 *
 *     排版：
 *       - 賽博龐克外殼：環境格線 + 動態掃描線 overlay（.br-docs-scan），
 *         主標題使用霓虹光暈 + 打字機效果。
 *       - 桌面顯示為左側 sidebar、行動裝置切換為水平 tab，導覽
 *         docsContent.js 中宣告的四個頂層分類（遊戲操作手冊 /
 *         管理員指南 / 技術架構 / 更新日誌）。
 *       - 內容卡片沿用 theme.css 的 .br-glass 樣式，並加上分段錯開
 *         的進場動畫（brDocsRise）。
 *       - 更新日誌的 sections 支援 `groups` 結構，讓 v1.5 可以分群
 *         呈現「玩法與操作 / 後端與物理 / 管理員與追蹤」。
 */

const VALID_LANGS = new Set(["en", "zh-TW"]);

export default function Docs() {
  const params = useParams();
  const navigate = useNavigate();
  const lang = VALID_LANGS.has(params.lang) ? params.lang : "en";
  const data = docsContent[lang];
  const switchTo = lang === "en" ? "zh-TW" : "en";

  // EN: Active sidebar category. Defaults to the first one declared in
  //     docsContent.js. Reset whenever the lang switch unmounts/remounts.
  // zh-TW: 目前選中的分類。預設取 docsContent.js 中宣告的第一個分類。
  //     語言切換時頁面會 unmount 重掛載，state 自動歸零。
  const [activeId, setActiveId] = useState(data.categories[0].id);
  const activeCategory =
    data.categories.find((c) => c.id === activeId) || data.categories[0];

  // EN: Inject keyframes once. The page may unmount/remount on lang
  //     toggle; we don't want duplicated <style> tags piling up.
  // zh-TW: keyframes 只注入一次。語言切換時頁面會重掛載，避免重複 style。
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

  const switchLabel =
    switchTo === "en" ? "READ IN ENGLISH" : "切換為繁體中文";
  const backLabel = lang === "en" ? "BACK TO LOBBY" : "返回大廳";

  return (
    <div className="br-docs-root">
      {/* EN: Ambient grid + animated scanline.
          zh-TW: 環境格線 + 動態掃描線。 */}
      <div className="br-docs-grid" aria-hidden />
      <div className="br-docs-scan-wrap" aria-hidden>
        <div className="br-docs-scan" />
      </div>
      {/* EN: Static repeating-line overlay (cyberpunk noise).
          zh-TW: 靜態重複線 overlay（賽博龐克噪點）。 */}
      <div className="br-docs-noise" aria-hidden />

      <div className="br-docs-shell">
        {/* Top bar */}
        <header className="br-docs-topbar">
          <Link to="/" className="br-docs-back">◂ {backLabel}</Link>

          <div className="br-lang-toggle" aria-label="Documentation language">
            <div className="br-lang-pills">
              <button
                onClick={() => navigate("/docs/en")}
                className={`br-lang-pill ${lang === "en" ? "is-active" : ""}`}
              >EN</button>
              <button
                onClick={() => navigate("/docs/zh-TW")}
                className={`br-lang-pill ${lang === "zh-TW" ? "is-active" : ""}`}
              >中文</button>
            </div>
          </div>
        </header>

        {/* Title block — animated typewriter + glow */}
        <h1 className="br-docs-title">
          <Typewriter text={data.meta.title} />
          <span className="br-docs-caret">▍</span>
        </h1>
        <p className="br-docs-subtitle">
          <span className="br-docs-build">{data.meta.build}</span>
          <span className="br-docs-sep">·</span>
          {data.meta.subtitle}
        </p>

        {/* Body — sidebar nav + content */}
        <div className="br-docs-body">
          {/* EN: Nav. On desktop this becomes a vertical sidebar via CSS;
                 on mobile it rolls up into a horizontal tab strip.
              zh-TW: 導覽。桌面為垂直 sidebar、行動裝置為水平 tab。 */}
          <nav className="br-docs-nav" aria-label="Categories">
            {data.categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveId(cat.id)}
                className={`br-docs-nav-btn ${cat.id === activeId ? "is-active" : ""}`}
              >
                <span className="br-docs-nav-icon">{cat.icon}</span>
                <span className="br-docs-nav-label">{cat.label}</span>
              </button>
            ))}
          </nav>

          {/* Content area */}
          <main className="br-docs-content" key={activeCategory.id}>
            <div className="br-docs-cat-head">
              <span className="br-docs-cat-icon">{activeCategory.icon}</span>
              <div>
                <h2 className="br-docs-cat-title">{activeCategory.label}</h2>
                <p className="br-docs-cat-tagline">{activeCategory.tagline}</p>
              </div>
            </div>

            {activeCategory.sections.map((sec, idx) => (
              <SectionCard key={sec.heading} section={sec} index={idx} />
            ))}
          </main>
        </div>

        {/* Footer */}
        <footer className="br-docs-foot">
          <span>● BATTLE-ROYALE</span>
          <span className="br-docs-sep">·</span>
          <span>{data.meta.build}</span>
          <span className="br-docs-sep">·</span>
          <span>{lang === "en" ? "DOCS" : "文件"}</span>
        </footer>

        <div className="br-docs-switch-wrap">
          <button
            className="br-docs-switch"
            onClick={() => navigate(`/docs/${switchTo}`)}
          >
            ▸ {switchLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EN: One section card. Supports both the simple `body: string[]` shape and
//     the grouped `groups: [{ title, body }]` shape used by Patch Notes.
// zh-TW: 單一段落卡片。同時支援簡單 `body: string[]` 與更新日誌使用的
//     分組 `groups: [{ title, body }]` 結構。
// ---------------------------------------------------------------------------
function SectionCard({ section, index }) {
  return (
    <section
      className="br-docs-card"
      style={{ animation: `brDocsRise 480ms ease-out ${index * 90}ms backwards` }}
    >
      <div className="br-glass-corner br-glass-corner--cyan br-glass-corner--tl" />
      <div className="br-glass-corner br-glass-corner--cyan br-glass-corner--tr" />
      <div className="br-glass-corner br-glass-corner--cyan br-glass-corner--bl" />
      <div className="br-glass-corner br-glass-corner--cyan br-glass-corner--br" />

      <h3 className="br-docs-card-h">{section.heading}</h3>

      {section.groups ? (
        <div className="br-docs-groups">
          {section.groups.map((g) => (
            <div key={g.title} className="br-docs-group">
              <h4 className="br-docs-group-h">{g.title}</h4>
              <BulletList lines={g.body} />
            </div>
          ))}
        </div>
      ) : (
        <BulletList lines={section.body} />
      )}
    </section>
  );
}

function BulletList({ lines }) {
  return (
    <ul className="br-docs-list">
      {lines.map((line, i) => (
        <li key={i} className="br-docs-list-item">
          <span className="br-docs-bullet" aria-hidden />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// EN: Pure-rAF typewriter — writes characters into a ref'd <span> directly
//     so we never trigger React re-renders inside the tight loop. The effect
//     resets when `text` changes (i.e. when the user toggles language).
// zh-TW: 純 rAF 打字機效果 — 直接寫入 ref 的 <span>，避免 tight loop 觸發
//     React 重渲染。`text` 變動（切換語言）時自動重置。
// ---------------------------------------------------------------------------
function Typewriter({ text, speed = 40 }) {
  const spanRef = useRef(null);
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
