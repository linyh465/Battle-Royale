import { useState } from "react";
import { useI18n } from "../i18n.jsx";

export default function DeathScreen({
  respawnRemaining = 0,
  canRespawn = false,
  killerName = "",
  killerWeapon = "rifle",
  onSpectate,
  onRespawn,
}) {
  const { t } = useI18n();
  const seconds = Math.ceil(respawnRemaining);
  const [initialTotal] = useState(() => Math.max(1, respawnRemaining));
  const ratio = respawnRemaining > 0 ? Math.min(1, respawnRemaining / initialTotal) : 0;

  const R = 46; // smaller ring for mobile friendliness
  const C = 2 * Math.PI * R;
  const dash = C * (1 - ratio);
  const displayKiller = killerName || "?";

  return (
    <div className="br-death" style={{ overflowY: "auto" }}>
      <div className="br-bg-grid" aria-hidden />
      <div className="br-bg-glow br-bg-glow--crimson" aria-hidden />
      <div className="br-vignette" aria-hidden />
      <div className="br-scanlines" aria-hidden />

      <div className="br-death-card" style={{
        /* Constrain card so it never exceeds viewport, and allow scrolling if needed */
        maxHeight: "calc(100vh - 32px)",
        overflowY: "auto",
        width: "min(460px, calc(100vw - 24px))",
        padding: "clamp(16px, 4vw, 32px)",
        boxSizing: "border-box",
      }}>
        {/* Headline */}
        <div className="br-death-headline" style={{ marginBottom: "clamp(8px, 2vh, 16px)" }}>
          <span className="br-death-eyebrow" style={{ fontSize: "clamp(10px, 2.5vw, 13px)" }}>
            {t.eliminated}
          </span>
          <h1 className="br-death-title" style={{ fontSize: "clamp(28px, 8vw, 52px)", margin: "4px 0" }}>
            <span className="br-death-glitch" data-text={t.kia}>{t.kia}</span>
          </h1>
        </div>

        {/* EN: Phase 18 — Action buttons ABOVE the kill card for better UX.
                Reduced padding-y for thinner buttons.
            zh-TW: Phase 18 — 動作按鈕移到擊殺資訊「上方」，改善 UX。
                減少垂直內距讓按鈕更薄。 */}
        <div className="br-death-actions" style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          gap: "clamp(8px, 2vw, 14px)",
          justifyContent: "center",
          alignItems: "center",
          marginBottom: "clamp(8px, 2vh, 16px)",
        }}>
          {/* EN: Phase 22 — countdown ring + number now share a single strict
                  flex container (`relative` + `flex items-center justify-center`).
                  The SVG ring is positioned `absolute inset-0 w-full h-full` so it
                  fills the parent without affecting layout, and the inner label
                  stack is the only flow content — meaning the text and progress
                  circle are natively centered with NO manual margins.
              zh-TW: Phase 22 — 倒數圓環與數字現在共用一個嚴格的 flex 容器
                  （`relative` + `flex items-center justify-center`）。SVG 圓環以
                  `absolute inset-0 w-full h-full` 鋪滿父層、不影響排版；內部
                  文字堆疊是唯一的 flow 內容，因此數字與進度圓環會原生置中，
                  無需任何手動 margin。 */}
          <button
            className={`br-death-btn br-death-btn--respawn ${canRespawn ? "is-ready" : "is-cooling"}`}
            onClick={canRespawn ? onRespawn : undefined}
            disabled={!canRespawn}
            style={{
              flex: "1 1 120px", minWidth: 100, maxWidth: 180,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              padding: "clamp(4px, 1vh, 8px) clamp(8px, 2vw, 16px)",
            }}
          >
            <span
              className="br-death-btn-ring"
              aria-hidden
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "clamp(64px, 14vw, 96px)",
                height: "clamp(64px, 14vw, 96px)",
              }}
            >
              <svg
                viewBox="0 0 108 108"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                }}
              >
                <circle cx="54" cy="54" r={R} stroke="rgba(34,211,238,0.18)" strokeWidth="3" fill="none" />
                <circle
                  cx="54" cy="54" r={R}
                  stroke="currentColor" strokeWidth="3" fill="none"
                  strokeDasharray={C}
                  strokeDashoffset={dash}
                  strokeLinecap="round"
                  transform="rotate(-90 54 54)"
                  style={{ transition: "stroke-dashoffset 100ms linear" }}
                />
              </svg>
              <span
                className="br-death-btn-inner"
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                  textAlign: "center",
                }}
              >
                {canRespawn ? (
                  <>
                    <span className="br-death-btn-icon">▸</span>
                    <span className="br-death-btn-label" style={{ fontSize: "clamp(11px, 3vw, 14px)" }}>
                      {t.respawn}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="br-death-btn-count" style={{ fontSize: "clamp(16px, 4vw, 24px)" }}>
                      {seconds}
                    </span>
                    <span className="br-death-btn-label" style={{ fontSize: "clamp(10px, 2.5vw, 12px)" }}>
                      {t.cooldown}
                    </span>
                  </>
                )}
              </span>
            </span>
          </button>

          {/* Spectate button — thinner padding */}
          <button
            className="br-death-btn br-death-btn--spectate"
            onClick={onSpectate}
            style={{
              flex: "1 1 120px", minWidth: 100, maxWidth: 180,
              padding: "clamp(4px, 1vh, 8px) clamp(8px, 2vw, 16px)",
            }}
          >
            <span className="br-death-btn-inner">
              <span className="br-death-btn-icon">
                <svg viewBox="0 0 24 16" width="clamp(18px,4vw,24px)" height="clamp(12px,3vw,16px)" aria-hidden>
                  <path d="M1 8 C5 2 19 2 23 8 C19 14 5 14 1 8 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="12" cy="8" r="3" fill="currentColor" />
                </svg>
              </span>
              <span className="br-death-btn-label" style={{ fontSize: "clamp(11px, 3vw, 14px)" }}>
                {t.spectate}
              </span>
            </span>
          </button>
        </div>

        {/* Kill card — now BELOW the action buttons */}
        <div className="br-death-killcard" style={{ marginBottom: "clamp(8px, 2vh, 12px)" }}>
          <span className="br-death-kc-label" style={{ fontSize: "clamp(9px, 2vw, 11px)" }}>
            {t.eliminatedBy}
          </span>
          <div className="br-death-kc-row" style={{ gap: "clamp(6px, 2vw, 12px)", flexWrap: "wrap" }}>
            <KillerSkull />
            <div className="br-death-kc-name" style={{ fontSize: "clamp(14px, 4vw, 20px)" }}>
              {displayKiller}
            </div>
            <div className="br-death-kc-weapon" style={{ fontSize: "clamp(10px, 2.5vw, 13px)" }}>
              {killerWeapon.toUpperCase()}
            </div>
          </div>
        </div>

        <p className="br-death-foot" style={{ fontSize: "clamp(10px, 2.5vw, 12px)", textAlign: "center" }}>
          <span className="br-kbd">SPACE</span> {t.spaceRespawn}
          {" · "}
          <span className="br-kbd">TAB</span> {t.tabSpectate}
        </p>
      </div>
    </div>
  );
}

function KillerSkull() {
  return (
    <svg viewBox="0 0 32 32" className="br-skull"
      style={{ width: "clamp(20px, 5vw, 28px)", height: "clamp(20px, 5vw, 28px)" }}
      aria-hidden>
      <path d="M8 6 C8 2 24 2 24 6 V14 C24 17 22 18 22 20 V24 H20 V22 H18 V24 H14 V22 H12 V24 H10 V20 C10 18 8 17 8 14 Z"
        fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="13" cy="11" r="2" fill="currentColor" />
      <circle cx="19" cy="11" r="2" fill="currentColor" />
      <path d="M14 16 L16 18 L18 16" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
