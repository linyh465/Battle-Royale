import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import docsContent from "../data/docsContent.js";

/**
 * EN: Docs.jsx (Phase 16.6) — interactive native React SPA documentation.
 *     Fully refactored to consume the Phase 16.5 nested-object data shape:
 *       docsContent.en.<category>.<document>  → Markdown string
 *       docsContent.zhTW.<category>.<document> → Markdown string
 *
 *     The old `categories[]` array is gone. Navigation is now two-level:
 *       1. Sidebar categories (gameManual, adminGuide, techArch, history)
 *       2. Sub-document tabs within each category (e.g. index, setup, etc.)
 *
 *     Markdown rendering is handled by a built-in lightweight renderer
 *     (no external dependency) supporting headings, bold, inline code,
 *     code blocks, tables, blockquotes, and lists.
 *
 *     Routes (unchanged from Phase 15):
 *       /docs        → Navigate to /docs/en
 *       /docs/en     → English tree
 *       /docs/zh-TW  → Traditional Chinese tree
 *
 * zh-TW: Docs.jsx（Phase 16.6）— 互動式原生 React SPA 文件。
 *     完全重構以讀取 Phase 16.5 的巢狀物件資料結構：
 *       docsContent.en.<分類>.<文件>  → Markdown 字串
 *       docsContent.zhTW.<分類>.<文件> → Markdown 字串
 *
 *     舊版 `categories[]` 陣列已移除。導覽改為兩層：
 *       1. 側欄分類（gameManual、adminGuide、techArch、history）
 *       2. 各分類內的子文件頁籤（如 index、setup 等）
 *
 *     Markdown 由內建輕量渲染器處理（無外部相依），支援標題、粗體、
 *     行內程式碼、程式碼區塊、表格、引用區塊及清單。
 */

const VALID_LANGS = new Set(["en", "zh-TW"]);

// ─────────────────────────────────────────────────────────────────────
// EN: Category metadata — maps object keys to display info.
//     The order here determines sidebar rendering order.
// zh-TW: 分類元資料 — 將物件鍵對應至顯示資訊。
//     此處順序決定側欄渲染順序。
// ─────────────────────────────────────────────────────────────────────
const CATEGORY_META = {
  gameManual: {
    icon: "▣",
    label: { en: "Game Manual", "zh-TW": "遊戲操作手冊" },
    tagline: {
      en: "Rules, controls, and HUD overview.",
      "zh-TW": "規則、操作方式與 HUD 介面說明。",
    },
  },
  adminGuide: {
    icon: "◆",
    label: { en: "Admin Guide", "zh-TW": "管理員指南" },
    tagline: {
      en: "Setup, deployment, and modification reference.",
      "zh-TW": "建置、部署與修改參考指南。",
    },
  },
  techArch: {
    icon: "▲",
    label: { en: "Tech Architecture", "zh-TW": "技術架構" },
    tagline: {
      en: "Advanced systems, routing, and internals.",
      "zh-TW": "進階系統、路由與內部結構。",
    },
  },
  history: {
    icon: "⌬",
    label: { en: "Dev History", "zh-TW": "開發歷程" },
    tagline: {
      en: "Development log and design decisions.",
      "zh-TW": "開發日誌與設計決策。",
    },
  },
};

// EN: Ordered list of category keys — controls sidebar render order.
// zh-TW: 分類鍵的排序列表 — 控制側欄渲染順序。
const CATEGORY_KEYS = Object.keys(CATEGORY_META);

// EN: Maps camelCase document keys to human-readable labels.
// zh-TW: 將 camelCase 文件鍵對應為人類可讀標籤。
const DOC_LABELS = {
  index:              { en: "Overview",          "zh-TW": "總覽" },
  gameplayMechanics:  { en: "Gameplay",          "zh-TW": "遊戲機制" },
  uiComponents:       { en: "UI Components",     "zh-TW": "UI 元件" },
  mobileControls:     { en: "Mobile Controls",   "zh-TW": "行動操作" },
  setup:              { en: "Setup",             "zh-TW": "環境建置" },
  deploymentGuide:    { en: "Deployment",        "zh-TW": "部署指南" },
  modificationGuide:  { en: "Modifications",     "zh-TW": "修改指南" },

  advancedSystems:    { en: "Advanced Systems",  "zh-TW": "進階系統" },
  routingGuide:       { en: "Routing",           "zh-TW": "路由指南" },
  developmentLog:     { en: "Dev Log",           "zh-TW": "開發日誌" },
  designLog:          { en: "Design Log",        "zh-TW": "設計日誌" },
};

// ─────────────────────────────────────────────────────────────────────
// EN: Site-level metadata (bilingual).
// zh-TW: 網站層級元資料（雙語）。
// ─────────────────────────────────────────────────────────────────────
const SITE_META = {
  en: {
    title: "BATTLE ROYALE · OPERATIONS MANUAL",
    subtitle: "Build 1.5 · Twin-stick combat · Sandbox brawl",
    build: "v1.5",
  },
  "zh-TW": {
    title: "競技場 · 餘燼協定 操作手冊",
    subtitle: "v1.5 版本 · 雙搖桿戰鬥 · 賽後沙盒",
    build: "v1.5",
  },
};

export default function Docs() {
  const params = useParams();
  const navigate = useNavigate();
  const lang = VALID_LANGS.has(params.lang) ? params.lang : "en";

  // EN: Resolve the data key — URL uses "zh-TW" but the object key is "zhTW".
  // zh-TW: 解析資料鍵 — URL 使用 "zh-TW" 但物件鍵是 "zhTW"。
  const dataKey = lang === "zh-TW" ? "zhTW" : "en";
  const data = docsContent[dataKey];
  const meta = SITE_META[lang];
  const switchTo = lang === "en" ? "zh-TW" : "en";

  // EN: Active category. Defaults to the first key.
  // zh-TW: 目前選中的分類。預設第一個。
  const [activeCatKey, setActiveCatKey] = useState(CATEGORY_KEYS[0]);

  // EN: Active document within the selected category.
  //     Resets to the first doc when switching categories.
  // zh-TW: 選中分類內的活躍文件。切換分類時重設為第一份文件。
  const [activeDocKey, setActiveDocKey] = useState(() => {
    const catData = data[CATEGORY_KEYS[0]];
    return catData ? Object.keys(catData)[0] : "";
  });

  // EN: When category changes, reset active doc to the first one in that category.
  // zh-TW: 切換分類時，將活躍文件重設為該分類的第一份。
  useEffect(() => {
    const catData = data[activeCatKey];
    if (catData) {
      setActiveDocKey(Object.keys(catData)[0]);
    }
  }, [activeCatKey, data]);

  const catMeta = CATEGORY_META[activeCatKey];
  const catData = data[activeCatKey] || {};
  const docKeys = Object.keys(catData);
  const markdownContent = catData[activeDocKey] || "";

  // EN: Inject keyframes once.
  // zh-TW: keyframes 只注入一次。
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
          <Typewriter text={meta.title} />
          <span className="br-docs-caret">▍</span>
        </h1>
        <p className="br-docs-subtitle">
          <span className="br-docs-build">{meta.build}</span>
          <span className="br-docs-sep">·</span>
          {meta.subtitle}
        </p>

        {/* Body — sidebar nav + content */}
        <div className="br-docs-body">
          {/* EN: Sidebar — categories + sub-docs.
              zh-TW: 側欄 — 分類 + 子文件。 */}
          <nav className="br-docs-nav" aria-label="Categories">
            {CATEGORY_KEYS.map((catKey) => {
              const cm = CATEGORY_META[catKey];
              const isActiveCat = catKey === activeCatKey;
              return (
                <div key={catKey}>
                  <button
                    onClick={() => setActiveCatKey(catKey)}
                    className={`br-docs-nav-btn ${isActiveCat ? "is-active" : ""}`}
                  >
                    <span className="br-docs-nav-icon">{cm.icon}</span>
                    <span className="br-docs-nav-label">{cm.label[lang]}</span>
                  </button>

                  {/* EN: Sub-doc tabs — shown only for the active category.
                      zh-TW: 子文件頁籤 — 僅顯示於選中的分類。 */}
                  {isActiveCat && (
                    <div className="br-docs-subdocs">
                      {Object.keys(data[catKey] || {}).map((dk) => (
                        <button
                          key={dk}
                          onClick={() => setActiveDocKey(dk)}
                          className={`br-docs-subdoc-btn ${dk === activeDocKey ? "is-active" : ""}`}
                        >
                          {(DOC_LABELS[dk] && DOC_LABELS[dk][lang]) || dk}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Content area */}
          <main className="br-docs-content" key={`${activeCatKey}-${activeDocKey}`}>
            <div className="br-docs-cat-head">
              <span className="br-docs-cat-icon">{catMeta.icon}</span>
              <div>
                <h2 className="br-docs-cat-title">{catMeta.label[lang]}</h2>
                <p className="br-docs-cat-tagline">{catMeta.tagline[lang]}</p>
              </div>
            </div>

            {/* EN: Render the selected Markdown document.
                zh-TW: 渲染選取的 Markdown 文件。 */}
            <section
              className="br-docs-card"
              style={{ animation: "brDocsRise 480ms ease-out backwards" }}
            >
              <div className="br-glass-corner br-glass-corner--cyan br-glass-corner--tl" />
              <div className="br-glass-corner br-glass-corner--cyan br-glass-corner--tr" />
              <div className="br-glass-corner br-glass-corner--cyan br-glass-corner--bl" />
              <div className="br-glass-corner br-glass-corner--cyan br-glass-corner--br" />
              <MarkdownRenderer content={markdownContent} />
            </section>
          </main>
        </div>

        {/* Footer */}
        <footer className="br-docs-foot">
          <span>● BATTLE-ROYALE</span>
          <span className="br-docs-sep">·</span>
          <span>{meta.build}</span>
          <span className="br-docs-sep">·</span>
          <span>{lang === "en" ? "DOCS" : "文件"}</span>
        </footer>

        <div className="br-docs-switch-wrap">
          <button
            className="br-docs-switch"
            onClick={() => navigate(`/docs/${switchTo}`)}
          >
            ▸ {switchTo === "en" ? "READ IN ENGLISH" : "切換為繁體中文"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EN: Lightweight built-in Markdown renderer. Supports:
//       # ## ### headings, **bold**, `inline code`, ```code blocks```,
//       | tables |, > blockquotes, - unordered lists.
//     No external dependencies required.
// zh-TW: 內建輕量 Markdown 渲染器。支援：
//       # ## ### 標題、**粗體**、`行內程式碼`、```程式碼區塊```、
//       | 表格 |、> 引用區塊、- 無序清單。
//     無須外部相依。
// ---------------------------------------------------------------------------
function MarkdownRenderer({ content }) {
  const elements = useMemo(() => parseMarkdown(content || ""), [content]);
  return <div className="br-md">{elements}</div>;
}

function parseMarkdown(md) {
  const lines = md.split("\n");
  const elements = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // --- Code block ---
    if (line.trimStart().startsWith("```")) {
      const lang = line.trimStart().slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <pre key={key++} className="br-md-pre">
          <code className={`br-md-code ${lang ? `language-${lang}` : ""}`}>
            {codeLines.join("\n")}
          </code>
        </pre>
      );
      continue;
    }

    // --- Table ---
    if (line.includes("|") && line.trim().startsWith("|")) {
      const tableLines = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length >= 2) {
        // First line = header, second line = separator, rest = body rows
        const parseRow = (row) =>
          row.split("|").filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(c => c.trim());
        const headers = parseRow(tableLines[0]);
        const bodyRows = tableLines.slice(2).map(parseRow);
        elements.push(
          <div key={key++} className="br-md-table-wrap">
            <table className="br-md-table">
              <thead>
                <tr>
                  {headers.map((h, hi) => (
                    <th key={hi}>{renderInline(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci}>{renderInline(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // --- Heading ---
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const Tag = level === 1 ? "h3" : level === 2 ? "h4" : "h5";
      const className =
        level === 1 ? "br-md-h1" : level === 2 ? "br-md-h2" : "br-md-h3";
      elements.push(
        <Tag key={key++} className={className}>{renderInline(text)}</Tag>
      );
      i++;
      continue;
    }

    // --- Blockquote ---
    if (line.trimStart().startsWith("> ")) {
      const quoteLines = [];
      while (i < lines.length && lines[i].trimStart().startsWith("> ")) {
        quoteLines.push(lines[i].trimStart().replace(/^>\s?/, ""));
        i++;
      }
      elements.push(
        <blockquote key={key++} className="br-md-blockquote">
          {quoteLines.map((ql, qi) => (
            <p key={qi}>{renderInline(ql)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    // --- Unordered list ---
    if (line.match(/^\s*[-*]\s+/)) {
      const listItems = [];
      while (i < lines.length && lines[i].match(/^\s*[-*]\s+/)) {
        listItems.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      elements.push(
        <ul key={key++} className="br-docs-list">
          {listItems.map((li, liIdx) => (
            <li key={liIdx} className="br-docs-list-item">
              <span className="br-docs-bullet" aria-hidden />
              <span>{renderInline(li)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // --- Ordered list ---
    if (line.match(/^\s*\d+\.\s+/)) {
      const listItems = [];
      while (i < lines.length && lines[i].match(/^\s*\d+\.\s+/)) {
        listItems.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      elements.push(
        <ol key={key++} className="br-md-ol">
          {listItems.map((li, liIdx) => (
            <li key={liIdx}>{renderInline(li)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // --- Blank line ---
    if (line.trim() === "") {
      i++;
      continue;
    }

    // --- Paragraph ---
    elements.push(
      <p key={key++} className="br-md-p">{renderInline(line)}</p>
    );
    i++;
  }

  return elements;
}

// EN: Inline Markdown rendering — handles **bold**, `code`, and plain text.
// zh-TW: 行內 Markdown 渲染 — 處理 **粗體**、`程式碼`、純文字。
function renderInline(text) {
  if (!text) return text;
  // Split on inline patterns: **bold** and `code`
  const parts = [];
  let remaining = text;
  let k = 0;

  while (remaining.length > 0) {
    // Find earliest match
    const boldIdx = remaining.indexOf("**");
    const codeIdx = remaining.indexOf("`");

    if (boldIdx === -1 && codeIdx === -1) {
      parts.push(remaining);
      break;
    }

    // Handle whichever comes first
    const firstBold = boldIdx >= 0 ? boldIdx : Infinity;
    const firstCode = codeIdx >= 0 ? codeIdx : Infinity;

    if (firstBold <= firstCode) {
      // Bold
      if (boldIdx > 0) parts.push(remaining.slice(0, boldIdx));
      const endBold = remaining.indexOf("**", boldIdx + 2);
      if (endBold === -1) {
        parts.push(remaining.slice(boldIdx));
        break;
      }
      parts.push(
        <strong key={`b${k++}`} className="br-md-bold">
          {remaining.slice(boldIdx + 2, endBold)}
        </strong>
      );
      remaining = remaining.slice(endBold + 2);
    } else {
      // Inline code
      if (codeIdx > 0) parts.push(remaining.slice(0, codeIdx));
      const endCode = remaining.indexOf("`", codeIdx + 1);
      if (endCode === -1) {
        parts.push(remaining.slice(codeIdx));
        break;
      }
      parts.push(
        <code key={`c${k++}`} className="br-md-inline-code">
          {remaining.slice(codeIdx + 1, endCode)}
        </code>
      );
      remaining = remaining.slice(endCode + 1);
    }
  }

  return parts.length === 1 ? parts[0] : parts;
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
