/**
 * docsContent.js — Phase 21 — Documentation Sync Protocol
 *
 * Single source-of-truth for all bilingual documentation.
 * Consumed by Docs.jsx (React SPA at /docs/en and /docs/zh-TW).
 *
 * Categories:
 *   gameManual — index, gameplayMechanics, uiComponents, mobileControls
 *   adminGuide — setup, deploymentGuide, modificationGuide
 *   techArch   — advancedSystems, routingGuide
 *   history    — developmentLog, designLog
 *
 * Phase 21 Documentation Sync Protocol:
 *   - This file is now the FRONTEND changelog source-of-truth.
 *   - Every feature add / bug fix MUST append a bilingual entry to the
 *     `history.developmentLog` section (both `en` and `zhTW`).
 *   - claude.md (root) is reserved for high-level milestones only.
 *
 * Phase 20 additions:
 *   - Bug fixes (admin toggle state sync, engine crash protection,
 *     reset_match stat clearing, leaderboard category isolation)
 *   - WebSocket rate limiter, /admin route, ErrorBoundary
 *   - Responsive HUD/minimap scaling, Teams feature removal
 */

export const docsContent = {
  // ═══════════════════════════════════════════════════════════════════
  //  ENGLISH
  // ═══════════════════════════════════════════════════════════════════
  en: {
    gameManual: {
      index: `# Project Overview

What is this? A 2D top-down multiplayer battle royale built as a project for the 1142 Advanced Programming course final.

**Architecture:** Authoritative server (FastAPI + WebSockets, 20 Hz tick), Thin client (React 18 + Vite + native Canvas 2D), OOP game engine (\`GameObject\`, polymorphic \`Weapon.fire\`).

**Production URL:** The game is deployed at \`ember.piyou.me\`. Documentation is served as a native React SPA — MkDocs has been fully deprecated.`,

      gameplayMechanics: `# Gameplay Mechanics — Continuous Ember Mode

## Mode Overview

The game runs as a **Continuous Ember Mode** inside a fixed rectangular arena (2560 × 1440 px). No shrinking zone.

## Respawn Timer (Phase 22 — Flat 4s)

Respawn is a **flat 4-second wait** for every player on every death. The Phase 15 dynamic penalty formula has been retired — the wait no longer scales with death count, so extended sandbox brawls feel fair instead of escalating.

\`\`\`
Wait Time = base_respawn_time(4s) + death_count × respawn_penalty(0s) = 4s
\`\`\`

> The \`base_respawn_time\` and \`respawn_penalty\` fields remain admin-tunable in the Game Settings panel for one-off match overrides.

## Six-Weapon Arsenal

| Weapon | Notes |
|---|---|
| Pistol | Balanced sidearm |
| Assault Rifle | Auto-fire workhorse |
| Shotgun | Six-pellet cone, devastating up close |
| Sniper | Slow trigger, lethal one-shot (CCD-corrected) |
| SMG | Highest fire-rate, lowest per-shot damage |
| Rocket Launcher | Heavy slow projectile, 14×14 hitbox |

Admin can override allowed weapons mid-match via the Admin Dashboard.

## Bot Focus-Fire Cap

\`bot_max_attack_limit\` restricts how many bots can simultaneously target one player.

## Post-Game Sandbox

When the match timer hits zero, the game enters \`POST_GAME\` state:

- The **leaderboard freezes** instantly — final standings are locked.
- Players can close the scoreboard and continue a **Sandbox Brawl** where kills and deaths no longer affect the final score.
- The Admin can click **Reset Match** to wipe all stats and transition back to \`PLAYING\`.`,

      uiComponents: `# UI Components — Mini-Map & QR Code

## QR Code

The Lobby generates a QR code dynamically using \`window.location.origin\`. Since the game is deployed to production at \`ember.piyou.me\`, anyone scanning the QR code joins the production server directly — no LAN configuration required.

## Global Mini-Map

- **Size:** 160×90 panel (16:9 aspect ratio) drawn directly in \`GameCanvas\` via \`rAF\`.
- **Performance:** O(N).
- **Indicators:** Green dot for local player, red for enemies.

## HUD Readout

Compact top-right panel (~50% scale): **Player · Alive · Awaiting Respawn · HP · Weapon · Kills · Deaths** (Kills/Deaths only visible during PLAYING state). The full leaderboard panel is scrollable; the local player’s row is highlighted in cyan.`,

      mobileControls: `# Mobile Controls — Twin-Stick System

## Layout

| Position | Control |
|---|---|
| Bottom-Left | Movement Joystick |
| Bottom-Right | Aim Joystick |

True twin-stick behavior — movement and aiming are fully independent.

## Component Breakdown

- \`Joystick.jsx\` — Left stick, movement only. Direction never auto-aims the weapon barrel.
- \`AimJoystick.jsx\` — Right stick, controls aiming angle (drag) and continuous firing (hold). Each weapon's fire-rate cap is enforced server-side.
- \`MobileControls.jsx\` — Layout wrapper

## Aim on Mobile

The right joystick angle determines the barrel direction:

\`\`\`js
angle = Math.atan2(aimDy, aimDx)
\`\`\`

> **Note:** The legacy \`FireButton.jsx\` has been fully replaced by the right aim joystick.`,
    },

    adminGuide: {
      setup: `# Setup · Environment

## Hardware Requirements

- Intel Core i7-10th Gen (or equivalent)
- 16 GB RAM

## Run Backend

\`\`\`bash
python -m venv .venv
source .venv/bin/activate        # or .venv\\Scripts\\activate on Windows
uvicorn main:app --reload --host 0.0.0.0 --port 8000
\`\`\`

## Run Frontend (Dev Mode)

\`\`\`bash
npm install
npm run dev    # vite --host
\`\`\`

> **Note:** In production, the React SPA is pre-built (\`vite build\`) and served directly by FastAPI from \`/app/frontend/dist\`. There is no separate frontend server.`,

      deploymentGuide: `# Deployment Guide — Railway

## Architecture

Single container strategy. FastAPI serves the React SPA from \`/app/frontend/dist\` and acts purely as an API + WebSocket server. All unknown routes fall back to \`index.html\` for SPA client-side routing.

## Production URL

The game is officially deployed at **ember.piyou.me**.

## Idle-Pause

\`GameEngine\` blocks on \`asyncio.Event\` when \`players=0\`. Consumes **0% CPU**.

## Network Egress Optimization

- \`TICK_RATE_HZ\` configurable (default 20).
- Minified single-character WebSocket keys (e.g., \`'x'\`, \`'y'\`, \`'h'\`).`,

      modificationGuide: `# Modification Guide

## Add a Weapon

1. Subclass \`Weapon\` in \`models/weapon.py\`.
2. Override \`fire()\`.
3. Register in \`WEAPON_REGISTRY\`.

## Change Map Size

Modify \`WORLD_W\` and \`WORLD_H\` in \`engine.py\`.

## Change Tick Rate

Set \`TICK_RATE_HZ\` (default was changed from 30 → 20).

> **Note:** Lower tick rates need client-side interpolation to maintain smooth visuals.

## Admin Device Tracking

The engine maintains \`engine.devices\` — a per-connection map of Player IP and User-Agent.

- **IP** is parsed from \`X-Forwarded-For\` behind a proxy, falling back to the socket peer address.
- **User-Agent** is captured from the WebSocket handshake headers.
- This data is visible **only** in the Admin Dashboard via the dedicated \`admin_snapshot\` frame — it is deliberately stripped from standard broadcast payloads for security.

## Admin Access Routes (Phase 20)

There are now **two** ways to reach the Admin Dashboard:

1. **Direct \`/admin\` route** — Open \`https://ember.piyou.me/admin\`. A dark-themed login screen prompts for the password and, on success, renders \`<AdminPanel>\` immediately.
2. **5-click lobby easter egg** — Click the lobby logo 5 times within 1.5 s, enter the password, and the lobby transitions to admin mode in-place.

Both flows hit the same server-side \`join_admin\` handshake and authenticate against \`engine.settings.admin_password\`.

## WebSocket Rate Limiting (Phase 20)

The \`/ws\` endpoint enforces a per-IP connection cap to deter bots and accidental reconnect storms. Limits are tunable via environment variables:

| Env Var | Default | Meaning |
|---|---|---|
| \`WS_RATE_LIMIT_PER_IP\` | \`10\` | Max connections per window from one IP |
| \`WS_RATE_LIMIT_WINDOW_SEC\` | \`5.0\` | Sliding window length in seconds |

When the cap is hit, the server closes the socket with WebSocket code \`1008\` (policy violation) **before** accepting the handshake.

## Admin Telemetry — Live Leaderboard (Phase 22)

A new **Live Leaderboard** card sits in the Admin Dashboard's right column alongside Live Telemetry. It consumes the same WebSocket \`snapshot\` payload the rest of the dashboard already polls and renders the top players sorted by the currently-selected leaderboard category (\`active_leaderboard_type\` — kills, deaths, damage dealt, or damage taken).

- Top 8 players are listed; bots are prefixed with 🤖, and each name's colour reflects state (alive / down / spectating).
- The widget re-renders on the existing 250 ms admin tick — no extra polling.
- Changing the leaderboard category in Game Settings instantly re-sorts this widget too, so the admin always sees the standings under the same lens players will see in the POST_GAME overlay.`,
    },

    techArch: {
      advancedSystems: `# Advanced Systems

## Hidden 5-Click Admin Trigger

Click the Lobby logo **5 times within 1.5 seconds**. React state prompts for password. Server validates.

> Default password: \`[REDACTED_PASSWORD]\`

## Spectator State Machine

\`\`\`
ALIVE → DEAD → SPECTATING
\`\`\`

Spectators cycle through alive players via Tab.

## Director View

URL Routing via \`?role=director\`. Read-only WebSocket connection — the director sees the full game canvas but cannot interact.

## Match State Machine

\`\`\`
PLAYING → POST_GAME → (Reset Match) → PLAYING
\`\`\`

- **PLAYING** — normal authoritative match, kills count, leaderboard live.
- **POST_GAME** — timer expired or admin ended early. Leaderboard frozen, sandbox combat continues.
- **Reset Match** — wipes all stats/HP/penalties back to a fresh PLAYING state.`,

      routingGuide: `# Routing Guide — SPA Architecture

## Backend Mounts

| Route | Purpose |
|---|---|
| \`/api-docs\` | Auto-generated API documentation |
| \`/api/settings\` | Game settings polling endpoint |
| \`/ws\` | WebSocket game endpoint |
| \`/assets\` | Static assets (built SPA) |
| \`*\` (catch-all) | \`index.html\` (SPA fallback) |

> **Note:** MkDocs is **fully deprecated**. Documentation is now a native React SPA (\`Docs.jsx\`) powered by \`docsContent.js\`. The old \`/docs/site\` mount has been removed.

## SPA Fallback

All unknown routes fall back to \`index.html\`, handled by React Router. Unmatched client-side routes render a cyberpunk 404 page (\`<NotFound />\`).

## Client-Side Routes

| Route | Component |
|---|---|
| \`/\` | Lobby |
| \`/admin\` | Admin login → AdminPanel (Phase 20) |
| \`/docs/en\` | English documentation |
| \`/docs/zh-TW\` | Traditional Chinese documentation |
| \`*\` | NotFound (cyberpunk 404) |`,
    },

    history: {
      developmentLog: `# Development Log

## Phase 1 — Backend

- **Stack:** FastAPI + OOP Engine
- **Design:** Authoritative server, 30 Hz game loop

## Phase 2 — Frontend

- **Stack:** React 18 + Canvas
- **Key Decision:** \`useRef\` for game state to bypass React renders

## Phase 9–12 — Production

- Railway deployment at \`ember.piyou.me\`
- Zero-idle CPU optimization
- Twin-stick mobile controls (\`AimJoystick.jsx\`)
- Dynamic weapons system

## Phase 15–16 — Polish

- Post-Game Sandbox (frozen leaderboard + sandbox brawl)
- Admin device tracking (\`engine.devices\`)
- MkDocs deprecated → native React SPA documentation
- CCD fix for sniper bullet tunneling

## Phase 17 — Global Pause & UI Polish

- **Admin Pause Screen:** New \`match_paused\` + \`pause_message\` in \`GameSettings\`. The Admin Dashboard has a toggle for “Pause Match (暫停比賽)” and a text input for the pause message. When activated, ALL clients see an unclosable full-screen overlay (“遊戲暫停 清掃戰場”) and no local input (movement/firing) is processed.
- **HUD Scaling:** The top-right HUD panel is scaled down ~50% (font 9px, panel width 150px, tight row spacing) for a compact, professional look.
- **HUD Match Stats:** Kills (擊殺) and Deaths (死亡) are now displayed on the HUD, but only during \`PLAYING\` state (hidden during POST_GAME sandbox).
- **Minimap 16:9:** \`MINIMAP_SIZE\` replaced with \`MINIMAP_W=160\` / \`MINIMAP_H=90\` matching the world’s 2560×1440 aspect ratio. No more square distortion.

## Phase 20 — Final Polish, Security & Stability

- **Critical Bug Squash:**
  - *Admin UI State Sync* — Toggles no longer glow ON before the server has spoken. \`AdminPanel\` now waits for the first \`state\` snapshot (\`hasSnapshot\` flag) and treats every boolean as \`false\` until the server is authoritative; after refresh the UI matches the backend exactly.
  - *Stuck on “Status: Open”* — The \`engine.run()\` tick body is now wrapped in \`try/except Exception\`. \`CancelledError\` is re-raised so FastAPI shutdown still works; every other exception is logged and the loop \`continue\`s, so a single bad tick can never freeze the server.
  - *Sandbox Stats Not Resetting* — \`admin_reset_match()\` explicitly iterates every player and zeros \`kills\`, \`deaths\`, \`damage_dealt\`, \`damage_taken\`, then sets \`hp = max_hp\` before calling \`respawn()\`.
  - *Leaderboards Merged* — \`FullLeaderboard\` renders ONLY the array dictated by \`GameSettings.active_leaderboard_type\` (with a \`kills\` fallback).
- **React ErrorBoundary:** New \`<CanvasErrorBoundary>\` in \`App.jsx\` wraps \`<GameCanvas>\`. Any render-time exception now shows a cyberpunk fallback with a Reload button — no more white screens.
- **WebSocket Rate Limiter:** \`/ws\` now enforces a per-IP connection cap (env-tunable \`WS_RATE_LIMIT_PER_IP\` default 10, \`WS_RATE_LIMIT_WINDOW_SEC\` default 5.0). Bots that exceed the cap are rejected with \`close(code=1008)\` BEFORE the handshake \`accept()\`.
- **New \`/admin\` Route:** A formal dark-themed login screen at \`/admin\`. Successful password auth renders the same \`<AdminPanel>\` as the 5-click lobby easter egg (which remains for backwards compatibility).
- **Responsive HUD & Minimap:** New \`getHudScale()\` returns \`0.5\` on mobile (\`<768 px\`) and \`1.0\` on desktop. HUD font, panel width, minimap dimensions, and minimap dot radii all scale — desktop is finally readable on a 1440p display.
- **Admin Table Polish:** The Device cell on the Player Roster applies Tailwind \`truncate max-w-xs\` to long User-Agent strings; the full IP + UA remain accessible via the \`title\` tooltip on hover.
- **Teams Feature Removed:** \`team\` field deleted from \`Player\`, \`team_mode\` removed from \`GameSettings\`, \`_sync_team_mode\` / \`_balance_with_bots\` / \`_next_team_assignment\` deleted from the engine, \`tm\` wire key removed from snapshots, team toggle removed from \`AdminPanel\`, team filter removed from bot AI and bullet collision, team colour removed from \`GameCanvas\`. Free-for-all is now the only supported mode.

## Phase 21 — Documentation Sync Protocol

- **Frontend Docs Rule:** \`src/data/docsContent.js\` is the authoritative changelog source. Every feature add or bug fix MUST append a bilingual entry to \`history.developmentLog\` (both \`en\` and \`zhTW\`).
- **\`claude.md\` Rule:** Reserved for *major milestones, architectural shifts, critical env vars, and major version bumps only*. Minor fixes, CSS tweaks, and typo corrections do not belong there.
- **Retroactive Sync:** Phase 20 entries above were retroactively added to bring this log up to date.

## Phase 22 — UI Hotfixes, Death Screen Alignment, Admin Telemetry & Respawn Logic

- **Mobile HUD / Minimap Regression Fix:** \`getHudScale()\` no longer trusts viewport width alone. Mobile scale (\`0.5×\`) now also fires when the primary pointer is coarse (touch), so landscape phones with \`innerWidth >= 768\` can never slip into the desktop branch and re-inflate the HUD and minimap.
- **Death Screen Cooldown Alignment:** The respawn button's countdown ring is now a strict \`relative\` flex container; the SVG is \`absolute inset-0\` and the countdown number sits inside the same container as the only flow child. Number and progress circle are natively centred — no manual margins, no more offset.
- **Admin Live Leaderboard Widget:** New \`<LiveLeaderboardCard>\` in the Admin Dashboard right column. Consumes the existing snapshot, sorts by \`active_leaderboard_type\`, and renders the top 8 players (bots flagged 🤖; row colour reflects state) on every 250 ms tick.
- **Flat 4-Second Respawn:** \`GameSettings.base_respawn_time\` → \`4.0\` and \`respawn_penalty\` → \`0.0\`. The Phase 15 dynamic formula \`base + deaths × penalty\` is retired; respawn is now a static 4 seconds regardless of death count. Admin can still override per match.
- **Version Bump:** \`APP_VERSION\` advanced to \`v2.6.0\` to reflect the new admin widget plus the respawn-mechanic change.

## Phase 23 — Leaderboard Unification, Reactive Sandbox & Security Hardening

- **Landscape-Mobile Final Leaderboard Rescue:** \`<FullLeaderboard>\` previously crushed its scrollable row area to ~0 px on short landscape phones (≤500 px tall) because the title clamped on \`vw\` and the scroll container used \`flex: 1 1 auto\`. Title now clamps on \`min(5vw, 5vh)\`, padding is vh-aware, the scroll container uses \`flex: 1 1 0\`, and a \`@media (max-height: 500px)\` block compresses surrounding chrome so the rows always win the height tug-of-war.
- **Reactive Sandbox Toggle:** Admin's "Post-Game Sandbox" switch now propagates live to every open POST_GAME overlay. Previously \`sandboxEnabled\` and \`activeType\` were read straight from \`stateRef.current\` inside the render IIFE, which only updated when something else triggered a React re-render. The 10 Hz overlay poll now writes both values into a new \`boardCfg\` React state. A companion effect re-opens the frozen leaderboard for any player still in the sandbox brawl the instant the admin disables sandbox.
- **Lower Default Player HP (50):** \`GameSettings.default_player_hp\` and the \`Player\` dataclass default both dropped from 200 → 50, matching bots and producing snappier default fights. AdminPanel fallback updated accordingly; admins can still override.
- **Leaderboard Settings Consolidated:** The Admin Dashboard's three overlapping leaderboard settings ("Sort Leaderboard", "Final Leaderboard Columns", "Leaderboard View") collapsed to ONE control: **Leaderboard View**, which now also drives the admin player-roster sort. The legacy \`leaderboard_sort_by\` / \`leaderboard_columns\` fields remain on \`GameSettings\` for wire-format stability but no UI surfaces them.
- **Director-Canvas Bugs:** Director view previously rendered every player green (leftover \`p.team\` branches kept fall-throughing after the Phase 20 Teams removal) and froze the game-over overlay's Close button (it never received \`sandboxEnabled\`, so \`closeLocked = !undefined = true\`). Both fixed.
- **Security & Firewall:**
  - *CORS Lockdown* — \`allow_origins\` defaults to \`["*"]\` only when \`ALLOWED_ORIGINS\` env var is unset; production deploys should pin to the public origin. Allowed methods narrowed to \`GET / POST / OPTIONS\`.
  - *Path-Traversal Hardening* — SPA fallback resolves \`candidate.resolve()\` and rejects any path that does not sit under \`_dist.resolve()\`, so crafted URLs cannot escape the dist tree.
  - *Brute-Force Throttle* — Both admin auth paths (\`join_admin\` + lobby easter-egg \`admin_auth\`) sleep 1 s before responding to a wrong password, slowing dictionary attacks. Combined with the existing per-IP WS rate limit, a single attacker is capped at ~120 attempts/min.
- **Version Bump:** \`APP_VERSION\` advanced to \`v2.7.0\`.`,

      designLog: `# Design Log — Battle Royale

## Key Decisions

| Decision | Rationale |
|---|---|
| Authoritative server over P2P | Cheat prevention, single source of truth |
| Dataclass OOP for weapons | Clean polymorphism via \`Weapon.fire()\` |
| AABB collisions | Simple, fast, sufficient for 2D top-down |
| Native React docs over MkDocs | Zero external dependency, cyberpunk-themed SPA |
| Twin-stick over auto-aim | Skill-based aiming, true dual-joystick feel |

## Deferred Features

- **Spatial hashing** — O(1) neighbor lookup for large player counts
- **Persistent DB matchmaking** — Ranked play, player profiles`,
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  //  繁體中文
  // ═══════════════════════════════════════════════════════════════════
  zhTW: {
    gameManual: {
      index: `# 專案總覽

專案是什麼？一款 2D 俯視角多人大逃殺，作為《1142 進階程式設計》課程期末作業的教學／展示專案。

**架構：** 權威伺服器（FastAPI + WebSockets，固定 20 Hz tick）、輕量客戶端（React 18 + Vite + 原生 Canvas 2D）、OOP 遊戲引擎（\`GameObject\`、多型 \`Weapon.fire\`）。

**正式網址：** 遊戲部署於 \`ember.piyou.me\`。文件以原生 React SPA 提供 — MkDocs 已完全棄用。`,

      gameplayMechanics: `# 遊戲機制 — 持續餘燼模式

## 模式總覽

遊戲以**持續餘燼模式**運行於固定矩形競技場（2560 × 1440 px）。無縮圈。

## 重生計時器（Phase 22 — 固定 4 秒）

每位玩家每次死亡都採用**固定 4 秒等待**。Phase 15 的動態懲罰公式已被移除——等待時間不再隨死亡次數遞增，使長時間沙盒對戰更公平、不再越死越久。

\`\`\`
等待時間 = 基礎重生時間(4s) + 死亡次數 × 重生懲罰(0s) = 4s
\`\`\`

> \`base_respawn_time\` 與 \`respawn_penalty\` 仍保留在遊戲設定面板中，方便管理員為特定場次臨時覆寫。

## 六種武器庫

| 武器 | 說明 |
|---|---|
| 手槍 | 平衡型副武器 |
| 突擊步槍 | 全自動主力武器 |
| 霰彈槍 | 六發扇形彈道，近戰毀滅性 |
| 狙擊槍 | 低射速、單發致命（已套用 CCD 修正） |
| 衝鋒槍 | 最高射速、單發傷害最低 |
| 火箭筒 | 重型慢速彈，14×14 hitbox |

管理員可透過管理員面板在比賽中強制改派可用武器。

## Bot 集火上限

\`bot_max_attack_limit\` 限制可同時鎖定同一名玩家的 Bot 數量。

## 賽後沙盒

當比賽倒數歸零時，遊戲進入 \`POST_GAME\` 狀態：

- **排行榜立即凍結** — 最終排名鎖定。
- 玩家可關閉計分板，繼續進行**沙盒對戰**，擊殺與死亡不再影響最終成績。
- 管理員可點擊**重置對戰**清空所有數據並切回 \`PLAYING\` 狀態。`,

      uiComponents: `# UI 元件 — 小地圖與 QR Code

## QR Code

大廳畫面使用 \`window.location.origin\` 動態生成 QR Code。由於遊戲已正式部署至 \`ember.piyou.me\`，掃描 QR Code 即可直接加入正式伺服器 — 無需任何區域網路設定。

## 全域小地圖

- **大小：** 160×90 面板（16:9 比例）直接在 \`GameCanvas\` 畫出。
- **效能：** O(N)。
- **標示：** 本機綠點、他人紅點。

## HUD 遙測面板

緊湊右上面板（縮小約 50%）：**玩家 · 存活人數 · 等待復活 · HP · 武器 · 擊殺數 · 死亡數**（擊殺/死亡僅在 PLAYING 狀態顯示）。完整排行榜面板可上下捲動；本機玩家所在列以青色高亮。`,

      mobileControls: `# 行動裝置操作 — 雙搖桿系統

## 版面配置

| 位置 | 控制 |
|---|---|
| 左下 | 移動搖桿 |
| 右下 | 瞄準搖桿 |

真正的雙搖桿行為 — 移動與瞄準完全獨立。

## 元件職責

- \`Joystick.jsx\` — 左搖桿，僅控制移動。方向不會自動帶動槍口。
- \`AimJoystick.jsx\` — 右搖桿，控制瞄準角度（拖曳）與連續射擊（按住）。各武器射速冷卻由伺服器強制。
- \`MobileControls.jsx\` — 版面包裝器

## 手機的瞄準

右搖桿角度決定槍口方向：

\`\`\`js
angle = Math.atan2(aimDy, aimDx)
\`\`\`

> **備註：** 舊版 \`FireButton.jsx\` 已被右搖桿完全取代。`,
    },

    adminGuide: {
      setup: `# 環境建置

## 硬體需求

- Intel Core i3（或同等級）
- 4 GB RAM

## 啟動後端

\`\`\`bash
python -m venv .venv
source .venv/bin/activate        # Windows 使用 .venv\\Scripts\\activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
\`\`\`

## 啟動前端（開發模式）

\`\`\`bash
npm install
npm run dev    # vite --host
\`\`\`

> **備註：** 正式環境中，React SPA 會預先建置（\`vite build\`），由 FastAPI 從 \`/app/frontend/dist\` 直接提供服務，不需要獨立的前端伺服器。`,

      deploymentGuide: `# 部署指南 — Railway

## 架構

單一容器策略。FastAPI 從 \`/app/frontend/dist\` 服務 React SPA，純粹作為 API + WebSocket 伺服器。所有未知路由回退至 \`index.html\` 以支援 SPA 客戶端路由。

## 正式網址

遊戲正式部署於 **ember.piyou.me**。

## 閒置暫停

0 玩家時 \`GameEngine\` 暫停，CPU **0%**。

## 出站頻寬節流

- \`TICK_RATE_HZ\` 可調（預設 20）。
- 短鍵線上格式（單字元鍵名，如 \`'x'\`、\`'y'\`、\`'h'\`）。`,

      modificationGuide: `# 修改指南

## 新增武器

1. 繼承 \`Weapon\`（位於 \`models/weapon.py\`）。
2. 覆寫 \`fire()\`。
3. 於 \`WEAPON_REGISTRY\` 註冊。

## 變更地圖大小

修改 \`engine.py\` 內的 \`WORLD_W\` 與 \`WORLD_H\`。

## 調整 Tick Rate

設定 \`TICK_RATE_HZ\`（預設由 30 改為 20）。

> **備註：** 低於 30Hz 需實作客戶端插值以維持流暢視覺。

## 管理員裝置追蹤

引擎維護 \`engine.devices\` — 每條連線的玩家 IP 與 User-Agent 對照表。

- **IP** 在反向代理後方時由 \`X-Forwarded-For\` 解析，無代理時退回 socket peer address。
- **User-Agent** 取自 WebSocket handshake header。
- 此資料**僅**在管理員面板中透過獨立的 \`admin_snapshot\` 訊框顯示 — 為安全考量，標準廣播封包中刻意移除。

## 管理員存取路徑（Phase 20）

目前提供**兩種**進入管理面板的方式：

1. **直接連線 \`/admin\`** — 開啟 \`https://ember.piyou.me/admin\`。深色登入畫面要求密碼，通過後立即渲染 \`<AdminPanel>\`。
2. **大廳 5 連點彩蛋** — 1.5 秒內點擊大廳 Logo 5 次，輸入密碼後大廳就地切換至管理員模式。

兩種流程都會走伺服器端的 \`join_admin\` handshake，並驗證 \`engine.settings.admin_password\`。

## WebSocket 連線速率限制（Phase 20）

\`/ws\` 端點強制執行每 IP 連線上限，阻擋惡意 bot 或意外的 reconnect 風暴。可透過環境變數調整：

| 環境變數 | 預設 | 說明 |
|---|---|---|
| \`WS_RATE_LIMIT_PER_IP\` | \`10\` | 單一 IP 在視窗內最大連線數 |
| \`WS_RATE_LIMIT_WINDOW_SEC\` | \`5.0\` | 滑動視窗長度（秒） |

當超過上限時，伺服器會在 \`accept()\` 前以 WebSocket close code \`1008\`（policy violation）關閉連線。

## 管理員遙測 — 即時排行榜（Phase 22）

管理員面板右欄新增一張**即時排行榜**卡片，與即時遙測卡並列。它共用整個面板既有的 WebSocket \`snapshot\` 輪詢，依目前選定的排行榜類別（\`active_leaderboard_type\` — 擊殺、死亡、造成傷害、承受傷害）即時排序顯示前幾名玩家。

- 列出前 8 名玩家；bot 以 🤖 標示，名字顏色直接反映狀態（存活 / 倒地 / 觀戰）。
- 透過管理員既有的 250 ms tick 被動更新，不額外輪詢。
- 在「遊戲設定」中切換排行榜類別時，本卡片會立即重新排序，讓管理員看到的排名與玩家在 POST_GAME 覆蓋層看到的視角一致。`,
    },

    techArch: {
      advancedSystems: `# 進階系統

## 五連點隱藏管理員觸發

1.5 秒內點擊 Logo **5 次**。React state 提示密碼。伺服器驗證。

> 預設密碼：\`[REDACTED_PASSWORD]\`

## 觀戰狀態機

\`\`\`
ALIVE → DEAD → SPECTATING
\`\`\`

觀戰者可透過 Tab 切換觀看存活玩家。

## 導播視角

透過 \`?role=director\` 路由。唯讀 WebSocket 連線 — 導播可看到完整遊戲畫面但無法互動。

## 對戰狀態機

\`\`\`
PLAYING → POST_GAME → (重置對戰) → PLAYING
\`\`\`

- **PLAYING** — 一般權威對戰，擊殺計分、排行榜即時更新。
- **POST_GAME** — 時間到或管理員提前結束。排行榜凍結，沙盒戰鬥持續。
- **重置對戰** — 清空所有計數/血量/懲罰，切回全新 PLAYING 狀態。`,

      routingGuide: `# 路由指南 — SPA 架構

## 後端掛載

| 路由 | 用途 |
|---|---|
| \`/api-docs\` | 自動產生的 API 文件 |
| \`/api/settings\` | 遊戲設定輪詢端點 |
| \`/ws\` | WebSocket 遊戲端點 |
| \`/assets\` | 靜態資源（已建置的 SPA） |
| \`*\`（catch-all） | \`index.html\`（SPA 回退） |

> **備註：** MkDocs 已**完全棄用**。文件現為原生 React SPA（\`Docs.jsx\`），由 \`docsContent.js\` 驅動。舊版 \`/docs/site\` 掛載已移除。

## SPA Fallback

所有未知路由回退至 \`index.html\`，由 React Router 處理。未匹配的客戶端路由渲染賽博龐克 404 頁面（\`<NotFound />\`）。

## 客戶端路由

| 路由 | 元件 |
|---|---|
| \`/\` | 大廳 |
| \`/admin\` | 管理員登入 → AdminPanel（Phase 20） |
| \`/docs/en\` | 英文文件 |
| \`/docs/zh-TW\` | 繁體中文文件 |
| \`*\` | NotFound（賽博龐克 404） |`,
    },

    history: {
      developmentLog: `# 開發歷程

## Phase 1 — 後端

- **技術棧：** FastAPI + OOP 引擎
- **設計：** 權威伺服器，30 Hz 迴圈

## Phase 2 — 前端

- **技術棧：** React 18 + Canvas
- **關鍵決策：** 以 \`useRef\` 儲存遊戲狀態避開 React 渲染

## Phase 9–12 — 生產環境

- Railway 部署至 \`ember.piyou.me\`
- 零閒置 CPU 優化
- 雙搖桿操控（\`AimJoystick.jsx\`）
- 動態武器系統

## Phase 15–16 — 完善

- 賽後沙盒（凍結排行榜 + 沙盒對戰）
- 管理員裝置追蹤（\`engine.devices\`）
- MkDocs 棄用 → 原生 React SPA 文件
- 狙擊子彈穿透 CCD 修正

## Phase 17 — 全域暫停與 UI 優化

- **管理員暫停畫面：** \`GameSettings\` 新增 \`match_paused\` 與 \`pause_message\`。管理員面板新增「暫停比賽」開關與暫停訊息輸入框。啟用後所有客戶端會看到不可關閉的全螢幕覆蓋層（「遊戲暫停 清掃戰場」），且不會處理任何本地輸入（移動/射擊）。
- **HUD 縮放：** 右上 HUD 縮小約 50%（字型 9px、寬度 150px、緊湊行高），緊湊專業。
- **HUD 比賽統計：** HUD 現在顯示擊殺數與死亡數，但僅在 \`PLAYING\` 狀態中顯示（賽後沙盒模式不顯示）。
- **小地圖 16:9：** \`MINIMAP_SIZE\` 替換為 \`MINIMAP_W=160\` / \`MINIMAP_H=90\`，與世界地圖 2560×1440 的寬高比一致，消除方形變形。

## Phase 20 — 最終完善、安全與穩定性

- **關鍵 Bug 修正：**
  - *管理員 UI 狀態同步* — toggle 不再在伺服器尚未回應前就先發光。\`AdminPanel\` 改為等到收到第一個 \`state\` 快照（\`hasSnapshot\` 旗標），boolean 在此之前一律視為 \`false\`，伺服器為唯一權威；重新整理後 UI 與後端完全一致。
  - *卡在「Status: Open」白畫面* — \`engine.run()\` 的 tick 主體已用 \`try/except Exception\` 包覆。\`CancelledError\` 仍原樣往外拋（FastAPI 關閉流程正常），其他例外紀錄後立即 \`continue\`，單一錯誤 tick 絕不會凍結伺服器。
  - *沙盒統計未重置* — \`admin_reset_match()\` 顯式遍歷每位玩家，歸零 \`kills\`、\`deaths\`、\`damage_dealt\`、\`damage_taken\`，再把 \`hp\` 設為 \`max_hp\` 並呼叫 \`respawn()\`。
  - *排行榜合併壞掉* — \`FullLeaderboard\` 改為僅渲染 \`GameSettings.active_leaderboard_type\` 指定的單一陣列（未知值 fallback 至 \`kills\`）。
- **React ErrorBoundary：** \`App.jsx\` 新增 \`<CanvasErrorBoundary>\` 包覆 \`<GameCanvas>\`。任何 render 階段例外都會顯示帶有 Reload 鈕的賽博龐克 fallback，不再白畫面。
- **WebSocket 速率限制：** \`/ws\` 端點啟用每 IP 連線上限（環境變數 \`WS_RATE_LIMIT_PER_IP\` 預設 10、\`WS_RATE_LIMIT_WINDOW_SEC\` 預設 5.0）。超出上限的 bot 會在 \`accept()\` 前以 \`close(code=1008)\` 拒絕。
- **新增 \`/admin\` 路由：** 正式深色登入畫面位於 \`/admin\`，密碼通過後渲染與大廳 5 連點彩蛋同一個 \`<AdminPanel>\`（彩蛋仍可使用以保留向下相容）。
- **響應式 HUD 與小地圖：** 新增 \`getHudScale()\`，手機（\`<768 px\`）回傳 \`0.5\`、桌面回傳 \`1.0\`。HUD 字型、面板寬度、小地圖尺寸與圓點半徑全數隨之縮放；1440p 桌面終於清晰可讀。
- **管理員列表優化：** 玩家列表 Device 欄位對長 User-Agent 字串套用 Tailwind \`truncate max-w-xs\`，完整 IP + UA 透過 \`title\` 屬性 hover 顯示。
- **完整移除隊伍功能：** Player 移除 \`team\` 欄位、GameSettings 移除 \`team_mode\`、引擎刪除 \`_sync_team_mode\` / \`_balance_with_bots\` / \`_next_team_assignment\`、快照移除 \`tm\` 線上鍵、AdminPanel 移除隊伍 toggle、Bot AI 與子彈碰撞移除隊伍過濾、GameCanvas 移除隊伍顏色。自由混戰為唯一支援模式。

## Phase 21 — 文件同步協議

- **前端文件規則：** \`src/data/docsContent.js\` 為變更紀錄的唯一權威來源。每次新增功能或修正錯誤都必須將雙語條目追加到 \`history.developmentLog\`（\`en\` 與 \`zhTW\` 兩側都要）。
- **\`claude.md\` 規則：** 僅保留 *重大里程碑、架構變動、關鍵環境變數、主要版本號跳躍*。次要修正、CSS 微調、錯字修正不應出現在 \`claude.md\` 中。
- **回填同步：** Phase 20 條目已回填至本日誌，使紀錄與目前程式碼一致。

## Phase 22 — UI 修補、死亡畫面對齊、管理員遙測與重生邏輯

- **行動裝置 HUD / 小地圖回歸修正：** \`getHudScale()\` 不再只看視窗寬度。當主指標為粗指標（觸控）時，即使 \`innerWidth >= 768\` 也會強制套用行動裝置縮放（\`0.5×\`），徹底解決手機橫向時誤判為桌面、HUD 與小地圖回到大尺寸的問題。
- **死亡畫面倒數對齊修正：** 重生按鈕的倒數圓環改用嚴格的 \`relative\` flex 容器；SVG 以 \`absolute inset-0\` 鋪滿，倒數數字是容器內唯一的 flow 子元素。數字與進度圓環現由 flex 原生置中，無需任何手動 margin，偏移問題已消失。
- **管理員即時排行榜小工具：** 管理員面板右欄新增 \`<LiveLeaderboardCard>\`。共用既有 snapshot，依 \`active_leaderboard_type\` 排序，顯示前 8 名玩家（bot 標 🤖、名字顏色反映狀態），每 250ms tick 重新渲染。
- **固定 4 秒重生：** \`GameSettings.base_respawn_time\` → \`4.0\`、\`respawn_penalty\` → \`0.0\`。Phase 15 的動態公式 \`基礎 + 死亡 × 懲罰\` 退役，現一律靜態 4 秒重生；管理員仍可逐場覆寫。
- **版本升版：** \`APP_VERSION\` 升至 \`v2.6.0\`，反映新增的管理員小工具與重生機制變更。

## Phase 23 — 排行榜統一化、即時沙盒與資安強化

- **手機橫向最終排行榜救援：** \`<FullLeaderboard>\` 先前在短橫向手機（≤500 px 高）幾乎把可捲動的列區壓成 0 px，原因是標題用 \`vw\` clamp、scroll 容器用 \`flex: 1 1 auto\`。標題改為 \`min(5vw, 5vh)\` clamp，padding 改為 vh 感知，scroll 容器改 \`flex: 1 1 0\`，再加上 \`@media (max-height: 500px)\` 區塊壓縮周邊 chrome，列區永遠贏得高度爭奪。
- **沙盒開關即時反應：** 管理員的「賽後沙盒」開關現在可即時傳達到所有已開啟的 POST_GAME 覆蓋層。先前 \`sandboxEnabled\` / \`activeType\` 在 render IIFE 中直接讀 \`stateRef.current\`，只有其他狀態觸發 re-render 時才更新；10 Hz overlay poll 現在將兩者寫進新的 \`boardCfg\` React state，並新增 effect：管理員一旦關閉沙盒，所有仍在沙盒對戰的玩家會立刻被拉回凍結排行榜覆蓋層。
- **玩家預設血量降為 50：** \`GameSettings.default_player_hp\` 與 \`Player\` dataclass 預設皆由 200 降為 50，與 Bot 同步，預設場次節奏更快。AdminPanel fallback 同步更新；管理員仍可逐場覆寫。
- **排行榜設定統一化：** 管理員面板三個彼此重疊的排行榜設定（「計分板排序」、「最終排行榜欄位」、「排行榜顯示類別」）合併為一個：**排行榜顯示類別**，同步驅動玩家名單排序。舊欄位 \`leaderboard_sort_by\` / \`leaderboard_columns\` 仍保留在 \`GameSettings\` 維持線上格式相容，但 UI 不再呈現。
- **DirectorCanvas Bug 修正：** 導播視角先前因 Phase 20 移除隊伍後仍殘留 \`p.team\` 分支，所有玩家都被畫成綠色；遊戲結束覆蓋層也因未傳 \`sandboxEnabled\` 導致 \`closeLocked = !undefined = true\`，按鈕永久 disable。兩者皆修正。
- **資訊安全與防火牆：**
  - *CORS 鎖定* — 僅當 \`ALLOWED_ORIGINS\` 環境變數未設定時 \`allow_origins\` 才退回 \`["*"]\`；正式部署請鎖定真實來源。允許方法收緊為 \`GET / POST / OPTIONS\`。
  - *路徑穿越強化* — SPA fallback 改以 \`candidate.resolve()\` 解析路徑，並拒絕任何不在 \`_dist.resolve()\` 子樹下的請求，避免被特製 URL 跳出 dist 目錄。
  - *暴力破解節流* — 兩條管理員驗證路徑（\`join_admin\` 與大廳 5 連點彩蛋走的 \`admin_auth\`）在密碼錯誤時延遲 1 秒回應，搭配既有的 per-IP WS 速率限制，單一攻擊者每分鐘最多約 120 次嘗試。
- **版本升版：** \`APP_VERSION\` 升至 \`v2.7.0\`。`,

      designLog: `# 設計日誌 — Battle Royale

## 設計決策

| 決策 | 理由 |
|---|---|
| 權威伺服器大於 P2P | 防作弊，單一事實來源 |
| 以 Dataclass 實作武器 OOP | 透過 \`Weapon.fire()\` 實現乾淨多型 |
| AABB 碰撞 | 簡單、快速、足以應付 2D 俯視角 |
| 原生 React 文件取代 MkDocs | 零外部相依，賽博龐克風格 SPA |
| 雙搖桿取代自動瞄準 | 技巧型瞄準，真正的雙搖桿體驗 |

## 延後事項

- **空間雜湊** — 大量玩家時的 O(1) 鄰近查詢
- **資料庫配對系統** — 排位賽、玩家檔案`,
    },
  },
};

export default docsContent;
