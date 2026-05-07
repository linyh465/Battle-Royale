/**
 * docsContent.js — Phase 16.5 Ultimate Migration
 *
 * Single source-of-truth for all bilingual documentation, converted from
 * legacy MkDocs Markdown into a structured JS data file consumed by Docs.jsx.
 *
 * Structure:
 *   docsContent.en.<category>.<document>   → Markdown string
 *   docsContent.zhTW.<category>.<document> → Markdown string
 *
 * Categories:
 *   gameManual — index, gameplayMechanics, uiComponents, mobileControls
 *   adminGuide — setup, deploymentGuide, modificationGuide, stressTesting
 *   techArch   — advancedSystems, routingGuide
 *   history    — developmentLog, designLog
 */

export const docsContent = {
  // ═══════════════════════════════════════════════════════════════════
  //  ENGLISH
  // ═══════════════════════════════════════════════════════════════════
  en: {
    // ─────────────────────────────────────────────────────────────────
    //  gameManual (遊戲操作手冊)
    //  Sources: index.md, gameplay_mechanics.md, ui_components.md,
    //           mobile_controls.md
    // ─────────────────────────────────────────────────────────────────
    gameManual: {
      index: `# Project Overview

What is this? A 2D top-down multiplayer battle royale built as a teaching/demo project for the 1142 Advanced Programming course final.

**Architecture:** Authoritative server (FastAPI + WebSockets, 30 Hz), Thin client (React 18 + Vite + native Canvas 2D), OOP game engine (\`GameObject\`, \`Weapon.fire\`).`,

      gameplayMechanics: `# Gameplay Mechanics — Continuous Deathmatch

## Mode Overview

The game runs as a **Continuous Deathmatch** inside a fixed rectangular arena (2000 × 2000 px). No shrinking zone.

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
| Sniper | Slow trigger, lethal one-shot |
| SMG | Highest fire-rate, lowest per-shot damage |
| Rocket Launcher | Heavy slow projectile |

Admin can override allowed weapons mid-match.

## Bot Focus-Fire Cap

\`bot_max_attack_limit\` restricts how many bots target one player.`,

      uiComponents: `# UI Components — Mini-Map & QR Code

## QR Code

Scanned on the lobby screen. Falls back to \`location.host\` if UDP ping to \`8.8.8.8\` fails.

## Global Mini-Map

- **Size:** 180×180 panel drawn directly in \`GameCanvas\` via \`rAF\`.
- **Performance:** O(N).
- **Indicators:** Green dot for local player, red for enemies.

## HUD Repositioning

\`drawHUD()\` offset via \`W - panelW - MINIMAP_PAD\`.`,

      mobileControls: `# Mobile Controls — Touch Joystick & Fire Button

## Layout

| Position | Control |
|---|---|
| Bottom-Left | Joystick |
| Bottom-Right | Fire Button |

Twin-stick behavior.

## Component Breakdown

- \`Joystick.jsx\` — Movement input
- \`FireButton.jsx\` — Fire trigger
- \`MobileControls.jsx\` — Layout wrapper

## Aim on Mobile

Aim follows movement direction:

\`\`\`js
angle = Math.atan2(dy, dx)
\`\`\``,
    },

    // ─────────────────────────────────────────────────────────────────
    //  adminGuide (管理員指南)
    //  Sources: setup.md, deployment_guide.md, modification_guide.md,
    //           stress_testing.md
    // ─────────────────────────────────────────────────────────────────
    adminGuide: {
      setup: `# Setup · Environment

## Hardware Requirements

- Intel Core i7-10th Gen
- 16 GB RAM

## Run Backend

\`\`\`bash
python -m venv .venv
source .venv/bin/activate        # or .venv\\Scripts\\activate on Windows
uvicorn main:app --reload --host 0.0.0.0 --port 8000
\`\`\`

## Run Frontend

\`\`\`bash
npm install
npm run dev    # vite --host
\`\`\``,

      deploymentGuide: `# Deployment Guide — Railway One-Click Deploy

## Architecture

Single container strategy. FastAPI serves the React SPA from \`/app/frontend/dist\`.

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

> **Note:** Lower tick rates need client-side interpolation to maintain smooth visuals.`,

      stressTesting: `# Stress Testing

## Phase 11 — Admin-Spawned Bots

Admin-spawned bots (1–100) via WebSocket payload.

- Auto cleanup after \`duration_seconds\` to prevent memory leaks.

> **Note:** This feature was **removed in Phase 12** for production cleanup.`,
    },

    // ─────────────────────────────────────────────────────────────────
    //  techArch (技術架構)
    //  Sources: advanced_systems.md, routing_guide.md
    // ─────────────────────────────────────────────────────────────────
    techArch: {
      advancedSystems: `# Advanced Systems

## Hidden 5-Click Admin Trigger

Click the Lobby logo **5 times within 1.5 seconds**. React state prompts for password. Server validates.

> Default password: \`[REDACTED_PASSWORD]\`

## Spectator State Machine

\`\`\`
ALIVE → DEAD → SPECTATING
\`\`\`

Spectators cycle through alive players.

## Director View

URL Routing via \`?role=director\`. Read-only WebSocket connection.`,

      routingGuide: `# Routing Guide — SPA · 404 · MkDocs

## Backend Mounts

| Route | Purpose |
|---|---|
| \`/api-docs\` | API documentation |
| \`/ws\` | WebSocket endpoint |
| \`/docs\` | MkDocs static files |
| \`/assets\` | Static assets |
| \`*\` (catch-all) | \`index.html\` (SPA fallback) |

## SPA Fallback

Routes like \`/some/path\` fall back to \`index.html\`, handled by React Router.

Unmatched routes render a cyberpunk 404 page (\`<NotFound />\`).`,
    },

    // ─────────────────────────────────────────────────────────────────
    //  history (開發歷程)
    //  Sources: development_log.md, design_log.md
    // ─────────────────────────────────────────────────────────────────
    history: {
      developmentLog: `# Development Log

## Phase 1 — Backend

- **Stack:** FastAPI + OOP Engine
- **Design:** Authoritative server, 30 Hz game loop

## Phase 2 — Frontend

- **Stack:** React 18 + Canvas
- **Key Decision:** \`useRef\` for game state to bypass React renders

## Phase 9–12 — Production

- Railway deployment
- Zero-idle CPU optimization
- Twin-stick mobile controls
- Dynamic weapons system`,

      designLog: `# Design Log — Battle Royale

## Key Decisions

| Decision | Rationale |
|---|---|
| Authoritative server over P2P | Cheat prevention, single source of truth |
| Dataclass OOP for weapons | Clean polymorphism via \`Weapon.fire()\` |
| AABB collisions | Simple, fast, sufficient for 2D top-down |

## Deferred Features

- **Spatial hashing** — O(1) neighbor lookup for large player counts
- **Persistent DB matchmaking** — Ranked play, player profiles`,
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  //  繁體中文
  // ═══════════════════════════════════════════════════════════════════
  zhTW: {
    // ─────────────────────────────────────────────────────────────────
    //  gameManual (遊戲操作手冊)
    // ─────────────────────────────────────────────────────────────────
    gameManual: {
      index: `# 專案總覽

專案是什麼？一款 2D 俯視角多人大逃殺，作為《1142 進階程式設計》課程期末作業的教學／展示專案。

**架構：** 權威伺服器（FastAPI + WebSockets，固定 30 Hz）、輕量客戶端（React 18 + Vite + 原生 Canvas 2D）、OOP 遊戲引擎（\`GameObject\`、多型 \`Weapon.fire\`）。`,

      gameplayMechanics: `# 遊戲機制 — 持續餘燼模式

## 模式總覽

遊戲以**持續餘燼模式**運行於固定矩形競技場（2000 × 2000 px）。無縮圈。

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
| 狙擊槍 | 低射速、單發致命 |
| 衝鋒槍 | 最高射速、單發傷害最低 |
| 火箭筒 | 重型慢速彈 |

管理員可在比賽中強制改派可用武器。

## Bot 集火上限

\`bot_max_attack_limit\` 限制可同時鎖定同一名玩家的 Bot 數量。`,

      uiComponents: `# UI 元件 — 小地圖與 QR Code

## 大廳畫面的 QR Code

在同 Wi-Fi 掃描進入。若 UDP 失敗退回 \`location.host\`。

## 全域小地圖

- **大小：** 180×180 面板直接在 \`GameCanvas\` 畫出。
- **效能：** O(N)。
- **標示：** 本機綠點、他人紅點。

## HUD 重新定位

\`drawHUD()\` 以 \`W - panelW - MINIMAP_PAD\` 定位。`,

      mobileControls: `# 行動裝置操作 — 觸控搖桿與射擊鈕

## 版面配置

| 位置 | 控制 |
|---|---|
| 左下 | 搖桿 |
| 右下 | 射擊鈕 |

雙搖桿行為。

## 元件職責

- \`Joystick.jsx\` — 移動輸入
- \`FireButton.jsx\` — 射擊觸發
- \`MobileControls.jsx\` — 版面包裝器

## 手機的瞄準

瞄準方向跟著移動方向：

\`\`\`js
angle = Math.atan2(dy, dx)
\`\`\``,
    },

    // ─────────────────────────────────────────────────────────────────
    //  adminGuide (管理員指南)
    // ─────────────────────────────────────────────────────────────────
    adminGuide: {
      setup: `# 環境建置

## 硬體需求

- Intel Core i7 第 10 代
- 16 GB RAM

## 啟動後端

\`\`\`bash
python -m venv .venv
source .venv/bin/activate        # Windows 使用 .venv\\Scripts\\activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
\`\`\`

## 啟動前端

\`\`\`bash
npm install
npm run dev    # vite --host
\`\`\``,

      deploymentGuide: `# 部署指南 — Railway 一鍵部署

## 架構

單一容器策略。FastAPI 直接服務 React SPA（\`/app/frontend/dist\`）。

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

> **備註：** 低於 30Hz 需實作客戶端插值以維持流暢視覺。`,

      stressTesting: `# 壓力測試

## Phase 11 — 管理員生成 Bot

管理員透過 WebSocket 生成 Bots（1–100）。

- 到達時間後自動清理防止 RAM 洩漏。

> **備註：** 此功能已於 **Phase 12** 為了生產環境清理而移除。`,
    },

    // ─────────────────────────────────────────────────────────────────
    //  techArch (技術架構)
    // ─────────────────────────────────────────────────────────────────
    techArch: {
      advancedSystems: `# 進階系統

## 五連點隱藏管理員觸發

1.5 秒內點擊 Logo **5 次**。React state 提示密碼。伺服器驗證。

> 預設密碼：\`[REDACTED_PASSWORD]\`

## 觀戰狀態機

\`\`\`
ALIVE → DEAD → SPECTATING
\`\`\`

觀戰者可切換觀看存活玩家。

## 導播視角

透過 \`?role=director\` 路由。唯讀 WebSocket 連線。`,

      routingGuide: `# 路由指南 — SPA · 404 · MkDocs

## 後端掛載

| 路由 | 用途 |
|---|---|
| \`/api-docs\` | API 文件 |
| \`/ws\` | WebSocket 端點 |
| \`/docs\` | MkDocs 靜態檔 |
| \`/assets\` | 靜態資源 |
| \`*\`（catch-all） | \`index.html\`（SPA 回退） |

## SPA Fallback

\`/some/path\` 等路徑由 React Router 接管。

未匹配路由渲染賽博龐克 404 頁面（\`<NotFound />\`）。`,
    },

    // ─────────────────────────────────────────────────────────────────
    //  history (開發歷程)
    // ─────────────────────────────────────────────────────────────────
    history: {
      developmentLog: `# 開發歷程

## Phase 1 — 後端

- **技術棧：** FastAPI + OOP 引擎
- **設計：** 權威伺服器，30 Hz 迴圈

## Phase 2 — 前端

- **技術棧：** React 18 + Canvas
- **關鍵決策：** 以 \`useRef\` 儲存遊戲狀態避開 React 渲染

## Phase 9–12 — 生產環境

- Railway 部署
- 零閒置 CPU 優化
- 雙搖桿控制
- 動態武器系統`,

      designLog: `# 設計日誌 — Battle Royale

## 設計決策

| 決策 | 理由 |
|---|---|
| 權威伺服器大於 P2P | 防作弊，單一事實來源 |
| 以 Dataclass 實作武器 OOP | 透過 \`Weapon.fire()\` 實現乾淨多型 |
| AABB 碰撞 | 簡單、快速、足以應付 2D 俯視角 |

## 延後事項

- **空間雜湊** — 大量玩家時的 O(1) 鄰近查詢
- **資料庫配對系統** — 排位賽、玩家檔案`,
    },
  },
};

export default docsContent;
