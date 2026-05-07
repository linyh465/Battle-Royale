/**
 * EN: NotFound.jsx — Phase 12 custom 404 page.
 *     Cyberpunk / esports aesthetic that matches the lobby & admin panel
 *     styling. Rendered by the React Router catch-all route (`*`) whenever
 *     the URL does not match a known SPA path. The backend's SPA fallback
 *     (main.py) returns index.html for unknown routes so React Router can
 *     mount this component instead of the server emitting a hard 404.
 *
 * zh-TW: NotFound.jsx — Phase 12 自訂 404 頁面。
 *     沿用大廳與管理員面板的賽博龐克／電競風格。當網址無法對應 SPA 已知
 *     路徑時，由 React Router 的 catch-all 路由（`*`）渲染此元件。後端
 *     main.py 的 SPA fallback 會把未知路徑回傳 index.html，
 *     讓 React Router 接手渲染此元件，而不是讓伺服器直接吐 404。
 */
import { Link } from "react-router-dom";
import { useI18n } from "../i18n.jsx";

export default function NotFound() {
  const { t } = useI18n();

  return (
    <div className="br-lobby flex flex-col items-center justify-center min-h-screen px-4">
      {/* EN: ambient grid + scanlines (same as the lobby) for visual continuity.
          zh-TW: 沿用大廳的格線與掃描線，維持視覺一致性。 */}
      <div className="br-bg-grid" aria-hidden />
      <div className="br-bg-glow br-bg-glow--cyan" aria-hidden />
      <div className="br-bg-glow br-bg-glow--crimson" aria-hidden />
      <div className="br-scanlines" aria-hidden />

      <main
        className="br-glass br-glass--danger relative z-10 text-center
                   w-full max-w-2xl px-6 py-10
                   md:px-12 md:py-14"
        style={{ borderColor: "rgba(255,59,92,0.45)" }}
      >
        <div className="br-glass-corner br-glass-corner--tl" />
        <div className="br-glass-corner br-glass-corner--tr" />
        <div className="br-glass-corner br-glass-corner--bl" />
        <div className="br-glass-corner br-glass-corner--br" />

        {/* EN: Glitchy 404 numerals — pure CSS / SVG; no external assets.
            zh-TW: 純 CSS / SVG 故障風 404，避免額外資源依賴。 */}
        <div
          className="text-5xl md:text-7xl font-bold tracking-widest"
          style={{
            fontFamily: "var(--br-display)",
            color: "var(--br-crimson-2)",
            textShadow: "0 0 16px rgba(255,59,92,0.55), 0 0 36px rgba(255,59,92,0.3)",
            letterSpacing: "0.18em",
          }}
        >
          404
        </div>

        <h1
          className="mt-3 text-xl md:text-3xl font-semibold"
          style={{
            fontFamily: "var(--br-display)",
            color: "var(--br-text)",
            letterSpacing: "0.28em",
          }}
        >
          {t.zoneLost}
        </h1>

        <p
          className="mt-4 text-sm md:text-base"
          style={{ color: "var(--br-text-2)", lineHeight: 1.6 }}
        >
          {t.zoneLostDesc}
        </p>

        {/* EN: Wire path so the player understands which URL was rejected.
            zh-TW: 顯示原始路徑，讓玩家知道是哪個網址被拒絕。 */}
        <code
          className="mt-5 inline-block px-3 py-1 rounded text-xs md:text-sm"
          style={{
            background: "rgba(3,7,13,0.6)",
            border: "1px solid rgba(255,59,92,0.35)",
            color: "var(--br-crimson-2)",
            fontFamily: "var(--br-mono)",
          }}
        >
          <span style={{ color: "var(--br-mute)" }}>$ path</span>{" "}
          {typeof window !== "undefined" ? window.location.pathname : "/"}
        </code>

        <div className="mt-8 flex flex-col md:flex-row items-center justify-center gap-3">
          <Link to="/" className="br-cta" style={{ textDecoration: "none" }}>
            <span className="br-cta-arrow">▸</span>
            <span>{t.returnLobby}</span>
            <span className="br-cta-glint" aria-hidden />
          </Link>
          <a
            href="/docs"
            className="br-btn br-btn--ghost"
            style={{ textDecoration: "none" }}
          >
            {t.openDocs}
          </a>
        </div>
      </main>

      <footer
        className="relative z-10 mt-6 text-xs"
        style={{ color: "var(--br-mute)", fontFamily: "var(--br-mono)" }}
      >
        <span>● ERROR 404</span>
        <span className="mx-2">·</span>
        <span>AREA RESTRICTED</span>
      </footer>
    </div>
  );
}
