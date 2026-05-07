# Battle Royale · 專案概觀

> **Version / 版本:** Phase 13
> **Last updated / 最後更新:** 2026-05-07

---

## 1. Project Summary · 專案摘要

### [English Version]

**Battle Royale** is a 2D top-down multiplayer arena shooter delivered as the
final project for *1142 Advanced Programming*. The codebase intentionally
favours a **classic, server-authoritative architecture** over modern
client-side prediction so that the data flow is easy to teach, audit, and
extend.

The deployment is a **single Uvicorn process** that simultaneously serves the
React SPA, a MkDocs documentation site, an OpenAPI Swagger UI, and the
real-time game WebSocket — production and demo use the same image.

### [繁體中文版]

**Battle Royale** 是一款 2D 俯視角多人競技射擊遊戲，作為《1142 進階程式設計》
期末作業繳交。整個程式碼刻意選擇**經典的伺服器權威架構**，而非現代化的
客戶端預測模型，目的是讓資料流清晰易教、易稽核、易擴充。

部署形式為**單一 Uvicorn 行程**，同時對外提供 React SPA、MkDocs 文件站、
OpenAPI Swagger UI、以及即時遊戲 WebSocket — 正式環境與展示環境共用同一個
image。

---

## 2. Tech Stack at a Glance · 技術棧速覽

### [English Version]

| Layer / 層級           | Stack                                                          |
|------------------------|----------------------------------------------------------------|
| Server runtime         | **Python 3.11**, FastAPI, Uvicorn, `asyncio`                   |
| Game loop              | Pure-Python `GameEngine`, fixed **30 Hz** tick                 |
| Real-time transport    | Native WebSockets at `/ws` (text JSON, minified payload)       |
| Client runtime         | **React 18** + Vite + native Canvas 2D, `requestAnimationFrame` |
| Routing                | React Router DOM v6 (`BrowserRouter` + history fallback)       |
| Styling                | Hand-rolled CSS variables (esports-themed palette)             |
| Documentation          | MkDocs Material, served at `/docs` from the same Uvicorn       |
| CI / Deployment        | Multi-stage Dockerfile (frontend build → docs build → runtime) |

### [繁體中文版]

| 層級                   | 技術選型                                                       |
|------------------------|----------------------------------------------------------------|
| 伺服器運行環境         | **Python 3.11**、FastAPI、Uvicorn、`asyncio`                   |
| 遊戲迴圈               | 純 Python `GameEngine`，固定 **30 Hz** tick                    |
| 即時通訊               | 原生 WebSocket（`/ws`，純文字 JSON、最小化 payload）           |
| 客戶端運行環境         | **React 18** + Vite + 原生 Canvas 2D、`requestAnimationFrame`  |
| 路由                   | React Router DOM v6（`BrowserRouter` + history fallback）      |
| 樣式                   | 手刻 CSS 變數（電競風格配色）                                  |
| 文件                   | MkDocs Material，由同一支 Uvicorn 掛在 `/docs`                 |
| CI / 部署              | 多階段 Dockerfile（前端 build → 文件 build → runtime）         |

---

## 3. High-Level Architecture · 系統高階架構

### [English Version]

The backend is the single source of truth. The browser is a thin renderer
that ships keystrokes upstream and paints snapshots downstream. There is no
client-side prediction, no rollback, and no peer-to-peer traffic.

```
┌──────────────────────────┐                    ┌─────────────────────────────┐
│         Browser          │                    │       FastAPI Server        │
│                          │   WebSocket /ws    │                             │
│  ┌────────────────────┐  │  ◀─────state──────  │  ┌───────────────────────┐  │
│  │   GameCanvas.jsx   │  │  ─────input─────▶   │  │   GameEngine (30 Hz)  │  │
│  │   rAF @ refresh    │  │                    │  │  step() / broadcast() │  │
│  └─────────┬──────────┘  │                    │  └──────────┬────────────┘  │
│            │ reads        │                    │             │               │
│  ┌─────────▼──────────┐  │                    │  ┌──────────▼────────────┐  │
│  │ stateRef (useRef)  │  │                    │  │   models/             │  │
│  │   (no setState!)   │  │                    │  │   GameObject          │  │
│  └────────────────────┘  │                    │  │   Player / Bullet     │  │
│                          │                    │  │   Weapon (poly.)      │  │
│  ┌────────────────────┐  │                    │  └───────────────────────┘  │
│  │  useGameSocket.js  │  │                    │                             │
│  └────────────────────┘  │                    │                             │
└──────────────────────────┘                    └─────────────────────────────┘
```

### [繁體中文版]

後端是唯一的真實來源（single source of truth），瀏覽器只是輕量渲染器：把
按鍵往上游送、把快照往下游畫。沒有客戶端預測、沒有 rollback、也沒有
P2P 流量。

```
┌──────────────────────────┐                    ┌─────────────────────────────┐
│         瀏覽器            │                    │      FastAPI 伺服器           │
│                          │   WebSocket /ws    │                             │
│  ┌────────────────────┐  │  ◀──── 狀態 ──────  │  ┌───────────────────────┐  │
│  │   GameCanvas.jsx   │  │  ──── 輸入 ─────▶   │  │   GameEngine (30 Hz)  │  │
│  │  rAF（隨螢幕更新） │  │                    │  │  step() / broadcast() │  │
│  └─────────┬──────────┘  │                    │  └──────────┬────────────┘  │
│            │ 讀取         │                    │             │               │
│  ┌─────────▼──────────┐  │                    │  ┌──────────▼────────────┐  │
│  │ stateRef (useRef)  │  │                    │  │   models/             │  │
│  │  （不用 setState） │  │                    │  │   GameObject          │  │
│  └────────────────────┘  │                    │  │   Player / Bullet     │  │
│                          │                    │  │   Weapon (多型)        │  │
│  ┌────────────────────┐  │                    │  └───────────────────────┘  │
│  │  useGameSocket.js  │  │                    │                             │
│  └────────────────────┘  │                    │                             │
└──────────────────────────┘                    └─────────────────────────────┘
```

---

## 4. Per-Tick Data Flow · 每個 Tick 的資料流

### [English Version]

```
client kbd/mouse ──► input msg ──► engine.apply_input()
                                       │
                                       ▼
                            engine.step(dt, now)
                              ├── Player.update()
                              ├── weapon.fire() → Bullet[]
                              ├── Bullet.update()
                              └── _resolve_bullet_hits()  (AABB)
                                       │
                                       ▼
                            engine.broadcast()  (JSON snapshot, 30 Hz)
                                       │
                                       ▼
                            ws.onmessage → stateRef.current
                                       │
                            requestAnimationFrame ──► canvas paint
```

### [繁體中文版]

```
客戶端鍵鼠輸入 ──► input 訊息 ──► engine.apply_input()
                                      │
                                      ▼
                           engine.step(dt, now)
                             ├── Player.update()
                             ├── weapon.fire() → Bullet[]
                             ├── Bullet.update()
                             └── _resolve_bullet_hits()（AABB）
                                      │
                                      ▼
                           engine.broadcast()（JSON 快照，30 Hz）
                                      │
                                      ▼
                           ws.onmessage → stateRef.current
                                      │
                           requestAnimationFrame ──► Canvas 重繪
```

---

## 5. Headline Features · 重點特色

### [English Version]

- **Continuous Deathmatch** — no shrinking zone, no final circle, infinite respawn loop until the admin stops the server.
- **Dynamic Respawn Penalty** — wait time grows linearly with the per-player death count (`5 + 3·deaths` seconds by default).
- **Six-Weapon Arsenal** — Pistol, Rifle, Shotgun (6-pellet cone), Sniper, SMG, and Rocket Launcher (oversized 14×14 hitbox).
- **Spectator Mode** — dead players can cycle through alive players with `‹` / `›` while the server tracks no spectator state.
- **Director God Mode** — `?role=director` opens a read-only canvas with full map, drag-pan, and wheel-zoom for broadcasters.
- **Hidden Admin Trigger** — five clicks on the lobby logo within 1.5 s prompts for the admin password.
- **SPA + 404 Routing** — React Router renders a cyberpunk 404 for unknown paths; `api/`, `docs/`, `assets/` reserved prefixes return hard 404 instead of being swallowed by the SPA.
- **i18n Toggle** — single English / 繁體中文 switch persists in `localStorage`.
- **Mobile UX Polish** — anti-selection CSS disables long-press menus, swipe gestures, and accidental text selection during gameplay.

### [繁體中文版]

- **持續餘燼模式** — 沒有縮圈、沒有最終安全區，玩家無限重生直到管理員停服。
- **動態重生懲罰** — 等待時間隨個人死亡次數線性成長（預設 `5 + 3·deaths` 秒）。
- **六種武器** — 手槍、突擊步槍、霰彈槍（6 顆扇形彈丸）、狙擊槍、衝鋒槍、火箭筒（加大 14×14 hitbox）。
- **觀戰模式** — 死亡玩家可用 `‹` / `›` 在存活玩家間切換，伺服器不記錄觀戰狀態。
- **導播上帝視角** — `?role=director` 開啟唯讀畫布，看到完整地圖、可拖曳平移、滾輪縮放，為轉播使用。
- **隱藏管理員觸發** — 1.5 秒內連點大廳 logo 五次即彈出密碼輸入框。
- **SPA + 404 路由** — 未知路徑由 React Router 渲染賽博龐克 404；`api/`、`docs/`、`assets/` 等保留前綴回硬 404，不會被 SPA 吞掉。
- **多語切換** — 單鍵切換 English / 繁體中文，選擇永久存於 `localStorage`。
- **行動裝置 UX 強化** — 反選取 CSS 停用長按選單、滑動手勢與遊戲中誤觸文字選取。

---

## 6. Repository Layout · 專案目錄結構

### [English Version]

```
Battle-Royale/
├── backend/        FastAPI app + 30 Hz GameEngine + OOP models
├── frontend/       React 18 + Vite + Canvas client
├── docs/           This documentation site (MkDocs Material)
├── Dockerfile      Multi-stage build: frontend → docs → runtime
└── mkdocs.yml      MkDocs configuration
```

### [繁體中文版]

```
Battle-Royale/
├── backend/        FastAPI 應用 + 30 Hz GameEngine + OOP 模型
├── frontend/       React 18 + Vite + Canvas 客戶端
├── docs/           本文件站（MkDocs Material）
├── Dockerfile      多階段 build：前端 → 文件 → runtime
└── mkdocs.yml      MkDocs 設定檔
```

---

## 7. Where to Go Next · 下一步閱讀指南

### [English Version]

| Audience / 讀者          | Start here / 從這裡開始                                                  |
|--------------------------|--------------------------------------------------------------------------|
| First-time contributor   | [Setup](setup.md) → [Gameplay Mechanics](gameplay_mechanics.md)          |
| Operator / DevOps        | [Deployment Guide](deployment_guide.md) → [Routing Guide](routing_guide.md) |
| Game designer            | [Gameplay Mechanics](gameplay_mechanics.md) → [Modification Guide](modification_guide.md) |
| Engine deep-dive         | [Advanced Systems](advanced_systems.md) → [Development Log](development_log.md) |
| UI / UX hacker           | [UI Components](ui_components.md) → [Mobile Controls](mobile_controls.md) |

### [繁體中文版]

| 讀者                      | 從這裡開始                                                               |
|--------------------------|--------------------------------------------------------------------------|
| 首次貢獻者               | [環境建置](setup.md) → [遊戲機制](gameplay_mechanics.md)                 |
| 維運 / DevOps            | [部署指南](deployment_guide.md) → [路由指南](routing_guide.md)           |
| 遊戲設計師               | [遊戲機制](gameplay_mechanics.md) → [修改指南](modification_guide.md)    |
| 引擎深入研究             | [進階系統](advanced_systems.md) → [開發紀錄](development_log.md)         |
| UI / UX 開發者           | [介面元件](ui_components.md) → [行動裝置控制](mobile_controls.md)        |
