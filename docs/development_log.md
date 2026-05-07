# Development Log · 開發歷程

> A reconstruction of the conversation, prompts, and decisions made while building this project with an AI pair-programmer.
>
> 透過 AI 協作開發本專案的提示詞、決策與時間軸完整還原。

---

=== "English"

    ### Session metadata

    - **Date:** 2026-05-06
    - **Roles:** *User* — project lead / requirements; *AI* — Expert Full-Stack Developer.
    - **Global rules set up-front:** bilingual EN/zh-TW docs, docs-first running log, no basic-concept explanations, production-ready modular code only.

    ### Phase 1 — Backend (FastAPI + OOP Game Engine)

    **Prompt summary**
    > Build a FastAPI + websockets backend. Implement OOP `GameObject` / `Player` / `Weapon` (polymorphic `fire()`) / `Bullet` under `/models`. Create `engine.py` with a 30 Hz loop, AABB collisions, JSON broadcast. Create `main.py` for WebSocket connections.

    **What we produced**
    ```
    backend/
    ├── main.py                  FastAPI app, /ws endpoint, lifespan-managed engine task
    ├── engine.py                30 Hz loop, AABB collisions, snapshot broadcast
    ├── requirements.txt         fastapi, uvicorn[standard], websockets
    └── models/
        ├── __init__.py          package surface
        ├── game_object.py       GameObject + AABB intersection
        ├── player.py            Player(GameObject) — HP, speed, weapon, input buffer
        ├── weapon.py            Weapon base + Pistol / Rifle / Shotgun (overrides fire())
        └── bullet.py            Bullet(GameObject) — owner, damage, TTL
    ```

    **Decisions made**
    1. *Authoritative server.* Clients send only intent (`dx`, `dy`, `angle`, `fire`); the server is the single source of truth. Cheating surface stays small.
    2. *Dataclass-based OOP.* Each entity is a `@dataclass` so we get clean `__init__`, deterministic `to_dict()`-style serialization helpers, and easy default factories (e.g. `weapon: Weapon = field(default_factory=Pistol)`).
    3. *Polymorphic `Weapon.fire()`.* `Pistol`/`Rifle` inherit defaults; `Shotgun.fire()` overrides to emit multiple `Bullet`s with angular spread — the textbook example for the OOP requirement.
    4. *Tick model.* `engine.run()` lives inside FastAPI's `lifespan`; uses `asyncio.sleep(max(0, TICK_DT - elapsed))` so a slow tick doesn't drift forever. `dt` is *measured*, not assumed, so physics stays stable under jitter.
    5. *Wire protocol.* Compact JSON: `join` / `input` / `weapon` / `ping` from client; `welcome` / `state` / `pong` from server. Full-state snapshot per tick (delta encoding deferred until profiling demands it).
    6. *Collision.* `GameObject.collides_with` returns AABB intersection; `_resolve_bullet_hits` is an O(B·P) double loop — fine for the player counts we target.

    ### Phase 2 — Frontend (React 18 + Canvas)

    **Prompt summary**
    > React 18 + Vite. WebSocket via `useGameSocket.js`. `GameCanvas.jsx` must NOT use `setState` for player/bullet coordinates — store snapshots in `useRef`, render with `requestAnimationFrame` at 60 FPS. WASD + mouse click sends JSON.

    **What we produced**
    ```
    frontend/
    ├── index.html, package.json, vite.config.js   /ws proxy → ws://localhost:8000
    └── src/
        ├── main.jsx                StrictMode root
        ├── App.jsx                 Lobby (name + weapon) → mounts GameCanvas
        ├── hooks/useGameSocket.js  WS lifecycle; snapshots into stateRef.current
        └── components/GameCanvas.jsx
                                    rAF render loop @ ~60 FPS
                                    30 Hz input loop via setInterval
                                    camera follows local player
                                    drawGrid / drawPlayer / drawHUD helpers
    ```

    **Decisions made**
    1. *Game state stays out of React.* `stateRef.current = msg` on every WS message. The component never re-renders due to gameplay updates — only `status` and `playerId` (one-shot events) live in `useState`.
    2. *Two-clock model.* Server simulates @ 30 Hz, client paints @ display refresh. Interpolation deliberately skipped until visible jitter shows up.
    3. *Input loop @ 30 Hz.* `setInterval` reads `keysRef`/`mouseRef` and ships `{dx, dy, angle, fire}`. WASD is normalized to a unit vector to prevent diagonal speed-boost.
    4. *Aim is computed in world space.* Mouse client-coords + camera offset → world coords → `atan2()` to local player center. Without the camera transform, aim would lag behind movement.
    5. *Camera = local player center.* World bounds drawn red, grid offset by camera, HUD drawn directly on the canvas (no DOM overlay).

    ### Phase 3 — Documentation

    **Prompt summary**
    > Generate a static documentation site (MkDocs/VitePress) under `/docs`: `index.md`, `setup.md`, `development_log.md`, `modification_guide.md`. Both EN and zh-TW, separated within each file.

    **Choices**
    - **MkDocs Material**, single set of bilingual files (each file contains `[English Version]` and `[Traditional Chinese Version]` sections). Rationale: easier to keep parity than maintaining two parallel trees.
    - Architecture diagrams as ASCII boxes inside fenced code blocks — renders identically in MkDocs/VitePress/GitHub.
    - Hardware section explicit: i7-10th Gen / 16 GB RAM recommended (per project requirement).

    ### Phase 4 — Admin, AI & Deathmatch Refinement

    **Recent Updates (from Git log & commits)**
    - **UI & i18n Overhaul:** Added a standalone Admin Panel (`/` vs `/?role=director`), completely redesigned Lobby UI with dynamic language toggles (EN/zh-TW/VN).
    - **Admin Management Controls:** Implemented a non-combatant Admin role to connect via WebSocket. The admin can forcefully kill/respawn players, control the game timer, and tweak match settings.
    - **Bot AI Behavior:** Introduced `BotPlayer` with basic AI targeting. Bots move closer to players (within 200-300 units), limit grouping (max 2 bots per target), and feature randomized firing intervals for balanced gameplay.
    - **Deathmatch Mode:** Transitioned from a shrinking Battle Royale model to a continuous Deathmatch mode, removing the poison zone entirely.
    - **Dynamic Respawn Penalty:** Integrated a dynamic respawn penalty system based on player death counts (e.g., base wait + `deaths * penalty_multiplier`).

    ### Cross-phase architectural decisions (summary)

    | # | Decision | Rationale |
    |---|---|---|
    | 1 | Authoritative server | Anti-cheat + single source of truth |
    | 2 | 30 Hz simulation | Smooth enough for top-down shooter; halves bandwidth vs 60 Hz |
    | 3 | OOP via `@dataclass` | OOP requirement satisfied; less boilerplate than plain classes |
    | 4 | `Weapon.fire()` polymorphism | Direct demonstration of OO polymorphism (course requirement) |
    | 5 | AABB collisions | Simple, fast, sufficient for boxy entities |
    | 6 | `useRef` + rAF render | Avoids React reconciliation per tick — primary perf win |
    | 7 | Vite dev proxy `/ws` | Same-origin in dev = no CORS, same wiring as prod |
    | 8 | Bilingual single-file docs | Keep parity easy; readers see both languages side by side (Tabs) |

    ### Things deliberately deferred

    - Storm / shrinking play zone.
    - Spatial hashing (only matters past ~64 entities).
    - Client-side prediction + server reconciliation.
    - Persistent match results (DB).
    - Authentication / matchmaking.

=== "繁體中文"

    ### 對談元資料

    - **日期：** 2026-05-06
    - **角色：** *使用者* — 專案負責人／需求方；*AI* — 全端工程師助理。
    - **全域規則**（一開始就確立）：EN/zh-TW 雙語文件、文件先行的 running log、不解釋基本概念、只給可上線的模組化程式碼。

    ### Phase 1 — 後端（FastAPI + OOP 遊戲引擎）

    **提示詞重點**
    > 建立 FastAPI + websockets 後端。在 `/models` 內實作 OOP `GameObject` / `Player` / `Weapon`（多型 `fire()`）/ `Bullet`。`engine.py` 提供 30 Hz 迴圈、AABB 碰撞、JSON 廣播。`main.py` 處理 WebSocket 連線。

    **最終產出**
    ```
    backend/
    ├── main.py                  FastAPI 應用、/ws 端點、以 lifespan 管理引擎任務
    ├── engine.py                30 Hz 迴圈、AABB 碰撞、快照廣播
    ├── requirements.txt         fastapi、uvicorn[standard]、websockets
    └── models/
        ├── __init__.py          套件對外介面
        ├── game_object.py       GameObject + AABB 相交檢查
        ├── player.py            Player(GameObject) — HP、速度、武器、輸入緩衝
        ├── weapon.py            Weapon 基底 + Pistol / Rifle / Shotgun（覆寫 fire()）
        └── bullet.py            Bullet(GameObject) — 擁有者、傷害、存活時間
    ```

    **決策**
    1. *權威伺服器*：客戶端只送意圖（`dx`、`dy`、`angle`、`fire`），伺服器是唯一真實狀態，作弊面縮到最小。
    2. *以 `@dataclass` 實作 OOP*：每個實體都是 `@dataclass`，自帶 `__init__`、可序列化、預設工廠（例如 `weapon: Weapon = field(default_factory=Pistol)`）。
    3. *多型 `Weapon.fire()`*：`Pistol`/`Rifle` 共用預設行為；`Shotgun.fire()` 覆寫產生多顆有角度散射的 `Bullet`，是課程「多型」最直接的範例。
    4. *Tick 模型*：`engine.run()` 在 FastAPI `lifespan` 內啟動；使用 `asyncio.sleep(max(0, TICK_DT - elapsed))` 避免長期漂移；`dt` 為實測值，非假設值，模擬在抖動下仍穩定。
    5. *通訊協定*：精簡 JSON — 客戶端 `join` / `input` / `weapon` / `ping`；伺服器 `welcome` / `state` / `pong`。每 tick 廣播完整快照，差分編碼延後處理。
    6. *碰撞偵測*：`GameObject.collides_with` 為 AABB 相交；`_resolve_bullet_hits` 為 O(B·P) 雙層迴圈，目前玩家數規模綽綽有餘。

    ### Phase 2 — 前端（React 18 + Canvas）

    **提示詞重點**
    > React 18 + Vite。WebSocket 透過 `useGameSocket.js`。`GameCanvas.jsx` 嚴格禁止用 `setState` 更新玩家/子彈座標；快照存入 `useRef`，以 `requestAnimationFrame` 60 FPS 重繪。WASD + 滑鼠點擊送出 JSON。

    **最終產出**
    ```
    frontend/
    ├── index.html、package.json、vite.config.js   /ws 代理至 ws://localhost:8000
    └── src/
        ├── main.jsx                StrictMode 進入點
        ├── App.jsx                 大廳（名字 + 武器）→ 掛載 GameCanvas
        ├── hooks/useGameSocket.js  WebSocket 生命週期；快照寫入 stateRef.current
        └── components/GameCanvas.jsx
                                    rAF 繪圖迴圈 @ 約 60 FPS
                                    setInterval 30 Hz 輸入迴圈
                                    攝影機跟隨本機玩家
                                    drawGrid / drawPlayer / drawHUD 輔助函式
    ```

    **決策**
    1. *遊戲狀態不進 React 樹*：每次 WS 訊息直接 `stateRef.current = msg`。元件不會因遊戲狀態更新而重渲染；只有 `status` 與 `playerId`（一次性事件）使用 `useState`。
    2. *雙時鐘模型*：伺服器 30 Hz 模擬，客戶端依顯示器刷新作畫。插值（interpolation）刻意延後，看到明顯抖動再加。
    3. *30 Hz 輸入迴圈*：`setInterval` 讀取 `keysRef`/`mouseRef` 並發送 `{dx, dy, angle, fire}`。WASD 規範化為單位向量，避免斜向加速。
    4. *瞄準在世界座標計算*：滑鼠 client 座標 + 攝影機偏移 → 世界座標 → 對玩家中心 `atan2()`。沒做攝影機轉換的話，瞄準會落後於移動。
    5. *攝影機 = 本機玩家中心*：世界邊界紅框、格線依攝影機偏移、HUD 直接畫在 Canvas 上（無 DOM overlay）。

    ### Phase 3 — 文件

    **提示詞重點**
    > 在 `/docs` 下生成靜態文件站（MkDocs／VitePress）：`index.md`、`setup.md`、`development_log.md`、`modification_guide.md`。EN 與 zh-TW 必須在每份檔案內清楚分區。

    **選擇**
    - **MkDocs Material**，單一檔案內含雙語區塊（`[English Version]` 與 `[Traditional Chinese Version]`）。理由：比維護兩棵平行樹更容易保持版本同步。
    - 架構圖以 ASCII 框 + fenced code 呈現 — 在 MkDocs/VitePress/GitHub 都同樣顯示。
    - 硬體段明示：建議 i7 第 10 代 / 16 GB RAM（依專案要求）。

    ### Phase 4 — 管理員、AI 與餘燼模式重構
    
    **近期更新與修復（基於 Git 日誌與提交）**
    - **UI 與多語系（i18n）大改版：** 新增獨立的管理員面板路由，重新設計大廳 UI，並加入即時語系切換功能（EN/zh-TW/VN）。
    - **管理員控制系統：** 實作「非戰鬥員」管理員角色。管理員可透過 WebSocket 連線，強制玩家死亡／重生、控制遊戲時間、調整對戰設定檔與管理機器人。
    - **機器人 AI 行為：** 引入 `BotPlayer` 具備基礎 AI 鎖定與移動邏輯。機器人會主動靠近玩家（約 200-300 單位），限制最多 2 隻機器人圍攻同一玩家，並加入隨機射擊間隔避免火力過猛。
    - **餘燼模式：** 將原本的「大逃殺」縮圈機制移除，轉換為無間斷的「持續餘燼模式」（Continuous Deathmatch），徹底移除毒圈邏輯。
    - **動態重生懲罰：** 導入基於死亡次數的重生延遲懲罰系統（例如：基礎等待時間 + `死亡次數 * 懲罰倍率`）。
    
    ### 跨 Phase 架構決策（總表）

    | # | 決策 | 理由 |
    |---|---|---|
    | 1 | 權威伺服器 | 防作弊 + 單一真實來源 |
    | 2 | 30 Hz 模擬 | 俯視角射擊夠用；頻寬約為 60 Hz 的一半 |
    | 3 | 以 `@dataclass` 實作 OOP | 滿足 OOP 要求，減少樣板碼 |
    | 4 | `Weapon.fire()` 多型 | 直接展示 OO 多型（課程要求） |
    | 5 | AABB 碰撞 | 簡單快速，方塊實體足夠 |
    | 6 | `useRef` + rAF 繪圖 | 避免每 tick 觸發 React reconciliation，主要效能來源 |
    | 7 | Vite 開發代理 `/ws` | 同源開發，無 CORS，與正式環境一致 |
    | 8 | 雙語單檔文件 | 同步維護容易，讀者可同頁對照 |

    ### 刻意延後的事項

    - 縮圈（毒圈／風暴）。
    - 空間雜湊（約 64 個實體以上才有意義）。
    - 客戶端預測 + 伺服器調和。
    - 比賽結果持久化（資料庫）。
    - 身分驗證與配對系統。
