/**
 * docsContent.js — Phase 16.8 Drift-Corrected Migration
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
 * Phase 16.8 drift corrections applied:
 *   - QR Code: removed LAN/UDP refs, production URL is ember.piyou.me
 *   - Architecture: MkDocs deprecated, docs are native React SPA
 *   - Mobile: twin-stick AimJoystick.jsx replaces FireButton.jsx
 *   - stressTesting: removed (deprecated feature)
 *   - Added: Post-Game Sandbox, Admin Device Tracking
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

## Dynamic Respawn Penalty

\`\`\`
Wait Time = base_respawn_time(5s) + death_count × respawn_penalty(3s)
\`\`\`

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

- **Size:** 180×180 panel drawn directly in \`GameCanvas\` via \`rAF\`.
- **Performance:** O(N).
- **Indicators:** Green dot for local player, red for enemies.

## HUD Readout

Five always-on telemetry tiles: **HP · Weapon · Kills · Match Timer · Players Alive**. The full leaderboard panel is scrollable; the local player's row is highlighted in cyan.`,

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
- This data is visible **only** in the Admin Dashboard via the dedicated \`admin_snapshot\` frame — it is deliberately stripped from standard broadcast payloads for security.`,
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
- CCD fix for sniper bullet tunneling`,

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

## 動態重生與懲罰機制

\`\`\`
等待時間 = 基礎重生時間(5s) + 死亡次數 × 重生懲罰(3s)
\`\`\`

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

- **大小：** 180×180 面板直接在 \`GameCanvas\` 畫出。
- **效能：** O(N)。
- **標示：** 本機綠點、他人紅點。

## HUD 遙測面板

五項常駐遙測：**HP · 武器 · 擊殺數 · 對戰倒數 · 存活玩家數**。完整排行榜面板可上下捲動；本機玩家所在列以青色高亮。`,

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
- 此資料**僅**在管理員面板中透過獨立的 \`admin_snapshot\` 訊框顯示 — 為安全考量，標準廣播封包中刻意移除。`,
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
- 狙擊子彈穿透 CCD 修正`,

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
