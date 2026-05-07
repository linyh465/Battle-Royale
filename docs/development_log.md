# Development Log · 開發紀錄

> **Format / 格式:** Keep-a-Changelog inspired, grouped by phase.
> **Source of truth / 資料來源:** `git log --oneline --date=short` on `main`.
> **Last updated / 最後更新:** 2026-05-07

---

## Overview · 總覽

### [English Version]

This page is a **human-readable changelog** rebuilt from the project's actual
git commit history. Commits are clustered into **logical phases** rather than
listed one-by-one, so the chronology matches the way the engine was actually
designed: a slim core first, then layered features, then UX polish. Each
phase entry calls out:

- **Highlight** — the headline feature that defines the phase.
- **Changes** — bullet-listed patch notes (Added / Changed / Removed / Fixed).
- **Commits** — the underlying SHA(s) for traceability.

### [繁體中文版]

本頁是依據專案真實 git commit 歷史重新整理的**人類可讀變更紀錄**。Commits
以**邏輯階段**分群，而非逐筆列出，這樣時序才符合引擎實際的設計過程：先骨幹、
再堆功能、最後做 UX 打磨。每個階段條目都會標出：

- **重點**：定義此階段的標誌性功能。
- **變更**：條列式 patch notes（新增 / 變更 / 移除 / 修復）。
- **對應 Commit**：底層 SHA，方便回溯。

---

## [Phase 13] — Mobile UX Hardening · 行動裝置 UX 強化

> **Date / 日期:** 2026-05-07

### [English Version]

**Highlight.** Disable text selection, long-press menus, and browser-default
swipe / pinch gestures across the play surface so mobile players cannot
accidentally hijack their own input.

**Changed**

- `frontend/src/theme.css` — added `user-select: none`,
  `-webkit-user-select: none`, `-webkit-touch-callout: none`, and
  `touch-action: none` rules scoped to `<canvas>`, the joystick, and the fire
  button.
- HUD overlays (countdown, leaderboard, spectator bar) inherit the same rule
  set, eliminating accidental highlighting under aggressive multi-touch.

**Underlying commit / 對應 commit**

| SHA       | Subject                                                            |
|-----------|--------------------------------------------------------------------|
| `ed1c72a` | feat: initialize esports-themed CSS variables and utility components |

### [繁體中文版]

**重點。** 在整個遊戲表面停用文字選取、長按選單，以及瀏覽器預設的滑動 /
雙指縮放手勢，讓行動裝置玩家不會誤觸自己的操作。

**變更**

- `frontend/src/theme.css` — 加上 `user-select: none`、
  `-webkit-user-select: none`、`-webkit-touch-callout: none`、
  `touch-action: none` 規則，套用於 `<canvas>`、搖桿、射擊鍵。
- HUD overlay（倒數、排行榜、觀戰列）共用同一組規則，避免多點觸控下意外
  反白。

---

## [Phase 12] — Routing, Toggle Sync, Stress-Test Cleanup · 路由、Toggle 同步、壓力測試清理

> **Date / 日期:** 2026-05-07

### [English Version]

**Highlight.** Replace the silent SPA fallback with a deliberate cyberpunk
404 page; fix admin toggle flicker; remove the obsolete stress-test code
path.

**Added**

- React Router v6 (`<BrowserRouter>` + `<NotFound />`) for deterministic deep
  linking.
- Cyberpunk 404 page (`components/NotFound.jsx`) with **Return to Lobby** and
  **Operator Manual** CTAs.
- `bot_max_attack_limit` admin field — caps the number of bots that may
  simultaneously focus-fire on the same human player. Default `2`,
  `0` = unlimited.

**Changed**

- All admin toggles (Weapons / Leaderboard columns / Team Mode / Bots
  Enabled) now use **optimistic-with-confirmation**: writes a pending value
  to a local override the moment the click happens, clears it as soon as the
  next snapshot confirms. No more sub-second flicker.
- `engine.admin_set` calls `setattr(...)` **before** any sync helpers so the
  next 30 Hz tick already carries the new value.
- Reserved-prefix list (`api/`, `api-docs`, `api-redoc`, `ws`, `health`,
  `docs`, `assets`) returns hard `404` instead of falling through to
  `index.html`.

**Removed**

- `engine.stress_test_start`, `_stress_test_cleanup`, the
  `admin_stress_test` WebSocket handler, and the corresponding Admin Panel
  section. Use `admin_kick_bots` for ad-hoc cleanup.

### [繁體中文版]

**重點。** 用刻意設計的賽博龐克 404 頁面取代沉默的 SPA fallback；修正
管理員 toggle 閃爍；移除過時的壓力測試程式碼。

**新增**

- React Router v6（`<BrowserRouter>` + `<NotFound />`），讓深層連結行為可
  預測。
- 賽博龐克 404 頁面（`components/NotFound.jsx`），提供「返回大廳」與「操作
  手冊」兩個 CTA。
- `bot_max_attack_limit` 管理員欄位 — 限制可同時鎖定同一名玩家的 Bot 數量。
  預設 `2`，設 `0` 代表不限。

**變更**

- 所有管理員 toggle（Weapons / Leaderboard 欄位 / Team Mode / Bots Enabled）
  改採**樂觀更新 + 確認後清除**：點擊瞬間寫入本地 pending override，下一個
  snapshot 確認後即清除。再也沒有亞秒級閃爍。
- `engine.admin_set` 一律先 `setattr(...)` 再跑 sync helper，下一個 30 Hz
  tick 必定帶上新值。
- 保留前綴清單（`api/`、`api-docs`、`api-redoc`、`ws`、`health`、`docs`、
  `assets`）回硬 `404`，不再 fallback 到 `index.html`。

**移除**

- `engine.stress_test_start`、`_stress_test_cleanup`、`admin_stress_test`
  WebSocket handler，以及前端管理員面板對應區塊。如需臨時清除 Bot，請改用
  `admin_kick_bots`。

---

## [Phase 10–11] — Six-Weapon Arsenal & Mid-Match Override · 六種武器與比賽中強制改派

> **Date / 日期:** 2026-05-07

### [English Version]

**Highlight.** Expand the arsenal from 3 to 6 distinct weapons with an
admin-controlled whitelist; reroll players' weapons on-the-fly when the admin
disables their current pick.

**Added**

- Six weapons: `pistol`, `rifle`, `shotgun` (6-pellet 14° cone), `sniper`,
  `smg`, `rocket` (oversized 14×14 hitbox transmitted on the wire).
- `GameSettings.allowed_weapons` CSV whitelist + Command Center toggles.
- `_sync_allowed_weapons()` walks alive players each settings change and
  force-reassigns anyone holding a now-disabled weapon.
- Lobby polls `/api/settings` every 3 s and greys out disabled weapon cards.

**Changed**

- `add_player()`, `set_weapon()`, and `request_respawn()` all enforce the
  whitelist defensively — the client picker is purely UX.
- Network snapshot ships `bw` / `bh` only when bullet hitbox ≠ 6×6, keeping
  the broadcast payload small.

### [繁體中文版]

**重點。** 武器庫從 3 種擴展到 6 種互異武器；新增管理員可控制的白名單；
管理員停用某把武器時，立即把所有手持該武器的存活玩家強制改派。

**新增**

- 六種武器：`pistol`、`rifle`、`shotgun`（6 顆 14° 扇形彈丸）、`sniper`、
  `smg`、`rocket`（線上傳輸 14×14 加大 hitbox）。
- `GameSettings.allowed_weapons` CSV 白名單 + 指揮中心切換 UI。
- `_sync_allowed_weapons()` 在每次設定變更時遍歷存活玩家，強制改派持有
  已停用武器者。
- 大廳每 3 秒輪詢 `/api/settings`，將停用武器卡片變灰。

**變更**

- `add_player()`、`set_weapon()`、`request_respawn()` 三處皆做白名單強制 —
  前端武器選單純粹是 UX。
- 網路快照僅在子彈 hitbox ≠ 6×6 時才送 `bw` / `bh`，縮小廣播 payload。

---

## [Phase 9] — Server Simulation: Idle-Pause & Minified Payloads · 閒置暫停與最小化封包

> **Date / 日期:** 2026-05-07

### [English Version]

**Highlight.** When zero clients are connected, `engine.step()` is paused so
the Uvicorn process idles at near-zero CPU. JSON payloads are minified to
the shortest practical key set.

**Added**

- Idle-pause logic — the 30 Hz tick suspends when both `connections` and
  `directors` are empty, then resumes on the first `welcome` handshake.
- Minified JSON keys for the per-tick snapshot (`x`, `y`, `hp`, `w`, `bw`,
  `bh`, `now`, …) so a 50-player snapshot fits well under 8 KB.

**Changed**

- Initial frontend integration of the minified protocol — `useGameSocket.js`
  decodes the short keys back into legible field names before storing in
  `stateRef`.

**Underlying commit / 對應 commit**

| SHA       | Subject                                                                                                  |
|-----------|----------------------------------------------------------------------------------------------------------|
| `d76d20a` | feat: implement Phase 9 server simulation with idle-pause logic, minified WebSocket payloads, and initial frontend integration. |

### [繁體中文版]

**重點。** 當沒有任何客戶端連線時，`engine.step()` 會暫停，讓 Uvicorn
行程閒置時 CPU 幾乎歸零。JSON payload 已最小化至最短實用鍵組。

**新增**

- 閒置暫停邏輯 — 當 `connections` 與 `directors` 同時為空時，30 Hz tick
  會暫停，下次 `welcome` 握手時恢復。
- 每個 tick 快照採用最短 JSON 鍵（`x`、`y`、`hp`、`w`、`bw`、`bh`、`now`
  …），50 名玩家的快照可控制在 8 KB 以內。

**變更**

- 前端整合最小化通訊協定 — `useGameSocket.js` 在寫入 `stateRef` 前先把短鍵
  解回可讀欄位名稱。

---

## [Phase 6–8] — Multi-View Architecture · 多視角架構

> **Date / 日期:** 2026-05-07

### [English Version]

**Highlight.** Three distinct front-end roles — Player, Admin, Director —
multiplexed onto the single `/ws` endpoint. Hidden admin entry; read-only
director god view; runtime weapon settings sync.

**Added**

- `?role=director` URL flag → `<DirectorCanvas>` component (drag-pan,
  wheel-zoom, full god view, no input rights).
- `<AdminPanel>` dashboard inside the player canvas, gated by the 5-click
  hidden trigger on the lobby logo (≥ 5 clicks within 1.5 s).
- `join_admin` and `join_director` WebSocket handshakes — the first message
  determines the actor's role for the session.
- Dynamic weapon settings sync: changes to `allowed_weapons` propagate to
  every connected lobby and in-game UI within one polling cycle.

**Underlying commit / 對應 commit**

| SHA       | Subject                                                                                          |
|-----------|--------------------------------------------------------------------------------------------------|
| `e8b02cd` | feat: implement multi-view architecture with admin panel, director mode, and dynamic weapon settings sync |

### [繁體中文版]

**重點。** 前端三種角色 — Player、Admin、Director — 多路複用至同一支
`/ws`。隱藏管理員觸發、唯讀導播上帝視角、執行期武器設定同步。

**新增**

- `?role=director` URL flag → `<DirectorCanvas>` 元件（拖曳平移、滾輪縮放、
  完整上帝視角、無輸入權）。
- 玩家畫布內的 `<AdminPanel>` 儀表板，由大廳 logo 的 5 連點隱藏觸發開啟
  （1.5 秒內 ≥ 5 次點擊）。
- `join_admin` 與 `join_director` WebSocket 握手 — 連線後首則訊息決定該
  session 的角色。
- 動態武器設定同步：`allowed_weapons` 變更後一個輪詢週期內傳達至所有大廳
  與遊戲 UI。

---

## [Phase 1–5] — Core Engine & Frontend Scaffolding · 核心引擎與前端骨幹

> **Date / 日期:** 2026-05-07

### [English Version]

**Highlight.** Authoritative 30 Hz `GameEngine`, OOP `GameObject` /
`Player` / `Bullet` / `Weapon` hierarchy, AABB collisions, React 18 + Vite
canvas client, esports-themed CSS variables, and a documentation site
served from the same Uvicorn process.

**Added — backend**

- `GameEngine` running at fixed 30 Hz with `step(dt, now)` / `broadcast()`
  separation.
- `GameObject` base class with polymorphic `update()`; `Player`, `Bullet`,
  `Weapon` subclasses; AABB hit resolution in `_resolve_bullet_hits()`.
- `GameSettings` dataclass exposing all admin-tunable knobs in one place.
- Static MkDocs site mounted at `/docs`; FastAPI Swagger at `/api-docs`,
  ReDoc at `/api-redoc`.

**Added — frontend**

- React 18 + Vite SPA; `<GameCanvas>` rendering at the monitor refresh rate
  via `requestAnimationFrame`, reading from `stateRef` (a `useRef`, NOT
  `useState`, to avoid render storms).
- `useGameSocket.js` custom hook — single source of WebSocket lifecycle,
  reconnect logic, and snapshot decoding.
- Esports-themed CSS variable palette (`theme.css`) and a kit of utility
  components (panels, buttons, HUD chrome).

**Underlying commits / 對應 commits**

| SHA       | Subject                                                                                          |
|-----------|--------------------------------------------------------------------------------------------------|
| `cf6d9f6` | feat: add static documentation site support and initialize backend server structure              |
| `1caf3f8` | feat: initialize backend engine, frontend scaffolding, and documentation structure               |
| `8402de5` | feat: implement core game engine, administrative management, and frontend infrastructure for Battle Royale simulation |

### [繁體中文版]

**重點。** 權威 30 Hz `GameEngine`、OOP `GameObject` / `Player` / `Bullet`
/ `Weapon` 繼承樹、AABB 碰撞、React 18 + Vite Canvas 客戶端、電競風 CSS
變數，以及由同一支 Uvicorn 提供的文件站。

**新增 — 後端**

- 固定 30 Hz 的 `GameEngine`，明確切分 `step(dt, now)` 與 `broadcast()`。
- `GameObject` 基底類別搭配多型 `update()`；`Player`、`Bullet`、`Weapon`
  子類別；`_resolve_bullet_hits()` 處理 AABB 命中判定。
- `GameSettings` dataclass，把所有管理員可調參數集中在一處。
- `/docs` 掛載靜態 MkDocs 站台；`/api-docs` 提供 FastAPI Swagger，
  `/api-redoc` 提供 ReDoc。

**新增 — 前端**

- React 18 + Vite SPA；`<GameCanvas>` 透過 `requestAnimationFrame` 依螢幕
  更新率作畫，從 `stateRef`（`useRef`，**非** `useState`，避免 render
  風暴）讀取狀態。
- `useGameSocket.js` 自訂 hook — WebSocket 生命週期、重連邏輯、快照解碼的
  唯一來源。
- 電競風 CSS 變數調色盤（`theme.css`）與一組工具元件（面板、按鈕、HUD
  chrome）。

---

## [Phase 0] — Bootstrap & Railway Deployment · 啟動與 Railway 部署

> **Date / 日期:** 2026-05-07

### [English Version]

**Highlight.** Repo skeleton, multi-stage Dockerfile, and a clean
`.gitignore` so the first push to Railway is reproducible from a fresh
clone.

**Added**

- Multi-stage `Dockerfile`: Stage 1 builds the Vite bundle, Stage 2 runs
  `mkdocs build` (verifies `index.html` exists), Stage 3 is the slim
  runtime that copies both bundles in.
- `.gitignore` excluding build artifacts (`dist/`, `site/`),
  dependencies (`node_modules/`, `__pycache__/`), and environment files
  (`.env`).

**Underlying commits / 對應 commits**

| SHA       | Subject                                                                                          |
|-----------|--------------------------------------------------------------------------------------------------|
| `f341fc8` | chore: add .gitignore to exclude build artifacts, dependencies, and environment variables        |
| `f6beb19` | Initial commit: Ready for Railway deployment                                                     |

### [繁體中文版]

**重點。** Repo 骨架、多階段 Dockerfile、乾淨的 `.gitignore`，確保第一次
push 到 Railway 即可從乾淨 clone 重現。

**新增**

- 多階段 `Dockerfile`：Stage 1 build Vite bundle、Stage 2 跑
  `mkdocs build`（並驗證 `index.html` 存在）、Stage 3 為精簡 runtime，
  把兩個 bundle 複製進去。
- `.gitignore` 排除 build 產物（`dist/`、`site/`）、相依套件
  （`node_modules/`、`__pycache__/`）、環境檔（`.env`）。

---

## Cross-Reference Table · 對照表

### [English Version]

| Phase    | Theme                                  | Headline file(s)                                            |
|----------|----------------------------------------|-------------------------------------------------------------|
| 13       | Mobile UX hardening                    | `frontend/src/theme.css`                                    |
| 12       | Routing + Toggle sync + Stress cleanup | `frontend/src/components/NotFound.jsx`, `backend/engine.py` |
| 10–11    | Six-weapon arsenal                     | `backend/models/weapons.py`, `backend/engine.py`            |
| 9        | Idle-pause + minified payloads         | `backend/engine.py`, `frontend/src/hooks/useGameSocket.js`  |
| 6–8      | Multi-view architecture                | `frontend/src/App.jsx`, `frontend/src/DirectorCanvas.jsx`   |
| 1–5      | Core engine + scaffolding              | `backend/engine.py`, `backend/models/`, `frontend/src/`     |
| 0        | Bootstrap                              | `Dockerfile`, `.gitignore`                                  |

### [繁體中文版]

| 階段     | 主題                                   | 對應主要檔案                                                |
|----------|----------------------------------------|-------------------------------------------------------------|
| 13       | 行動裝置 UX 強化                       | `frontend/src/theme.css`                                    |
| 12       | 路由 + Toggle 同步 + 壓力測試清理      | `frontend/src/components/NotFound.jsx`、`backend/engine.py` |
| 10–11    | 六種武器庫                             | `backend/models/weapons.py`、`backend/engine.py`            |
| 9        | 閒置暫停 + 最小化封包                  | `backend/engine.py`、`frontend/src/hooks/useGameSocket.js`  |
| 6–8      | 多視角架構                             | `frontend/src/App.jsx`、`frontend/src/DirectorCanvas.jsx`   |
| 1–5      | 核心引擎 + 骨幹                        | `backend/engine.py`、`backend/models/`、`frontend/src/`     |
| 0        | 啟動                                   | `Dockerfile`、`.gitignore`                                  |
