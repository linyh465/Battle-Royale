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

---

## Phase 9 — Production Deployment & Extreme Resource Optimization · 生產部署與極致資源最佳化

=== "English"

    ### Session metadata

    - **Date:** 2026-05-07
    - **Goal:** Land the project on Railway's $5/mo Hobby tier without ever
      crossing into a paid plan, even with 40–60 concurrent players.

    ### What we shipped

    1. **Single-container architecture.** A new root-level multi-stage
       `Dockerfile` builds the Vite SPA in a Node 20 Alpine stage, then
       copies `frontend/dist` into the Python 3.12 slim runtime. FastAPI
       (in `backend/main.py`) now mounts the SPA via `StaticFiles` at
       `/assets` plus a catch-all `index.html` SPA fallback. A non-root
       `appuser` runs Uvicorn on `$PORT`.
    2. **Idle-pause game loop.** `GameEngine.run()` blocks on a fresh
       `asyncio.Event` whenever `len(self.players) == 0`. The event is set
       inside `add_player()` / `add_bot()`, so the loop wakes on the first
       connection. Stale bullets are flushed during the idle gap, and
       `remove_player()` eagerly drops bullets owned by the disconnecting
       player. CPU usage at zero players ≈ 0%.
    3. **Configurable tick rate.** `TICK_RATE_HZ` env knob (clamped 5–60,
       default 20). Canvas interpolation hides the tick reduction; the
       broadcast volume drops linearly with tick rate.
    4. **Minified WebSocket wire format.** Snapshots now use single-letter
       keys (`ps`, `bs`, `i`, `nm`, `x`, `y`, `h`, `mh`, `a`, `k`, `d`,
       `dd`, `dt`, `wp`, `s`, `ra`, `b`, `tm`, `kn`, `kw`, `al`, …).
       Bullet w/h are constants restored client-side. `json.dumps(...,
       separators=(",", ":"))` strips whitespace. A new
       `frontend/src/hooks/expandSnapshot.js` re-hydrates the descriptive
       shape so renderer code stays unchanged. ~35–45% bandwidth reduction
       vs. the descriptive-key payload.
    5. **Bilingual deployment guide.** New `docs/deployment_guide.md`
       covers the architecture, idle-pause smoke test, GitHub→Railway
       step-by-step, local production parity, and Hobby-tier sizing.

    ### Decisions made

    - **Single container, not two.** Railway charges per service; one
      container collapses the cost.
    - **Constants over wire bytes.** Player/bullet hitbox dimensions never
      change at runtime (Phase 9 — uniform 28×28 / 6×6), so the client
      restores them from constants instead of paying for `w`/`h` on every
      broadcast.
    - **Adapter, not rewrite.** `expandSnapshot()` keeps ~1.6k lines of
      rendering code untouched; the wire format change is invisible above
      the WS receive layer.

=== "繁體中文"

    ### Session metadata

    - **日期：** 2026-05-07
    - **目標：** 把專案塞進 Railway $5/月 Hobby Plan，
      40–60 人同時上線也不破預算。

    ### 這次交付的內容

    1. **單一容器架構。** 新增根目錄的多階段 `Dockerfile`：
       Node 20 Alpine 階段 build Vite SPA，
       Python 3.12 slim 階段把 `frontend/dist` 複製進去。
       `backend/main.py` 用 `StaticFiles` 把 SPA 掛在 `/assets`，
       並加上 catch-all 的 `index.html` SPA fallback。
       非 root 使用者 `appuser` 跑 Uvicorn 並綁定 `$PORT`。
    2. **閒置暫停遊戲迴圈。** `GameEngine.run()` 在
       `len(self.players) == 0` 時 await 一個 `asyncio.Event`。
       事件由 `add_player()` / `add_bot()` 觸發，第一個連線進來就喚醒。
       閒置期間順手清空殘留子彈；`remove_player()` 也會立即把該玩家的
       子彈從場上拔掉。0 玩家時 CPU ≈ 0%。
    3. **可調 tick 頻率。** 環境變數 `TICK_RATE_HZ`（5–60 區間，
       預設 20）。前端 Canvas 內插填補低 tick 的視覺差距，
       廣播量隨 tick 線性下降。
    4. **短鍵 WebSocket 線上格式。** 快照改用單字元鍵
       （`ps`、`bs`、`i`、`nm`、`x`、`y`、`h`、`mh`、`a`、`k`、`d`、
       `dd`、`dt`、`wp`、`s`、`ra`、`b`、`tm`、`kn`、`kw`、`al` …）。
       子彈寬高為常數，由前端還原；`json.dumps(...,
       separators=(",", ":"))` 拿掉多餘空白。
       新增 `frontend/src/hooks/expandSnapshot.js` 把短鍵還原回長鍵格式，
       渲染端程式不必改動。相比舊版描述性鍵名約節省 35–45% 頻寬。
    5. **雙語部署指南。** 新增 `docs/deployment_guide.md`，內容涵蓋
       架構說明、閒置暫停冒煙測試、GitHub→Railway 步驟、本機生產
       parity，以及 Hobby Plan 容量估算。

    ### 關鍵決策

    - **一個容器，不是兩個。** Railway 是「每個服務都計費」，
      合併成單一容器最直接省錢。
    - **能用常數就不要走線上。** Phase 9 的玩家／子彈 hitbox 是固定值
      （28×28 / 6×6），由前端常數還原，不必每筆廣播都帶 w/h。
    - **加 adapter，不重寫。** `expandSnapshot()` 讓約 1600 行的渲染碼
       完全不必改動；線上格式變動只在 WS 接收層之前看得到。

---

## Phase 10 — Production Bug Fixes, React Performance & Six-Weapon Arsenal · 生產修錯、React 效能與六種武器系統

=== "English"

    ### Session metadata

    - **Date:** 2026-05-07
    - **Live domain:** `gun.piyou.me` (Railway).
    - **Triggers:** Admin Panel input lag in production, broken QR code
      origin on the live domain, MkDocs not reachable, and a request to
      expand the arsenal.

    ### What we shipped

    1. **Admin input lag fix (CRITICAL).** Admin Panel inputs were
       fighting a 250 ms re-render driven by the 20 Hz state ref. Every
       keystroke snapped the input back to the server's last broadcast.
       Fixed by introducing a memoised `<NumSetting>` component that
       owns its local `value` state and only syncs from the server when
       the user is **not** focused; commits go to the server on blur or
       Enter, never on keystroke. `<PasswordChangeRow>` and
       `<TimerSetTextRow>` follow the same pattern.
    2. **QR code origin fix.** The lobby used to seed the QR with
       `/api/lan-info`'s LAN IP, which is meaningless in production
       (no Vite dev server). The lobby now uses
       `window.location.origin` whenever the host is not loopback, so
       phones scanning the QR on `gun.piyou.me` get the right URL
       instantly. The `value` prop also falls back to
       `window.location.origin` synchronously, removing the "detecting…"
       flash.
    3. **MkDocs routing.** FastAPI's interactive docs moved to
       `/api-docs` and `/api-redoc` (with `swagger_ui_oauth2_redirect_url`
       moved to `/api-docs/oauth2-redirect`). MkDocs is now mounted at
       `/docs` via `StaticFiles(html=True)`. The SPA catch-all
       explicitly skips `/docs`, `/api-docs`, `/api-redoc`. Dockerfile
       grew a third stage that runs `mkdocs build --strict` against
       `mkdocs-material 9.*` and copies `docs/site` into the runtime
       image.
    4. **Six-weapon arsenal.** `models/weapon.py` now defines six
       distinct subclasses: `Pistol`, `Rifle` (Assault Rifle), `Shotgun`,
       `Sniper`, `SMG`, `RocketLauncher`. Each has unique
       (damage, fire_rate, bullet_speed, ttl); `RocketLauncher` also
       declares an oversized 14×14 hitbox carried on the wire as
       `bw`/`bh` only when non-default. `models/__init__.py` exports
       `ALL_WEAPON_IDS` for cross-module reuse.
    5. **Allowed-weapons whitelist + mid-match override.**
       `GameSettings.allowed_weapons` (CSV) gates `add_player()`,
       `set_weapon()`, and `request_respawn()`. When the admin updates
       the list, `_sync_allowed_weapons()` walks every alive player and
       force-reassigns anyone holding a just-disabled weapon to a random
       allowed one — no respawn required. The empty-list edge case
       silently falls back to "all enabled" so the lobby never bricks.
    6. **Reactive lobby weapon picker.** A new `/api/settings` endpoint
       exposes (`allowed_weapons`, `all_weapons`). The lobby polls it
       every 3 s, renders all six weapon cards, and greys out disabled
       ones. If the player's pick gets disabled mid-poll, it auto-snaps
       to the first allowed weapon.
    7. **Admin Weapon Arsenal UI.** Admin Panel grew a **WEAPON ARSENAL**
       checklist that toggles the six weapons via `admin_set
       allowed_weapons`. The UI refuses to drop the list to zero
       (defence-in-depth even though the engine handles that case too).
    8. **Bilingual gameplay docs update.** `docs/gameplay_mechanics.md`
       gained a new section "Six-Weapon Arsenal & Mid-Match Override"
       with stats table, override pseudocode, and lobby reactivity notes.

    ### Decisions made

    - **Local input state with focus-aware sync.** The simplest fix that
      survives 20 Hz state churn — no debounce, no hand-rolled diffing,
      no `React.memo`-with-equality-fn games. The user is the source of
      truth while focused; the server takes over again on blur.
    - **CSV whitelist, not array.** `leaderboard_columns` already used a
      CSV string and `admin_set` knows how to round-trip strings;
      reusing the pattern avoids touching the admin protocol layer.
    - **Server is the gate.** All four player-weapon paths
      (`add_player`, `set_weapon`, `request_respawn`,
      `_sync_allowed_weapons`) re-validate against the whitelist. The
      lobby UI is purely UX.
    - **/api/settings, not WS.** Lobby clients haven't connected a
      WebSocket yet. A 3 s poll on a tiny JSON endpoint is far cheaper
      than wiring a transient WS just for one CSV field.

=== "繁體中文"

    ### Session metadata

    - **日期：** 2026-05-07
    - **生產網域：** `gun.piyou.me`（Railway）。
    - **觸發點：** 生產環境的 Admin Panel 嚴重打字 lag、QR Code 仍指向
      LAN IP、MkDocs 路由打不開，以及擴充武器系統的需求。

    ### 這次交付的內容

    1. **管理員輸入 lag 修正（重大）。** Admin Panel 的輸入框被 20 Hz 的
       state ref 透過 250 ms tick 一直 re-render，導致每打一個字都會被
       拉回伺服器最後一次廣播的值。改寫為 memoised 的 `<NumSetting>`
       元件：自管 local `value`，只在使用者**沒** focus 時才從伺服器
       同步；失焦或按 Enter 才送伺服器，不會每打一個字就送一次。
       `<PasswordChangeRow>` 與 `<TimerSetTextRow>` 也比照辦理。
    2. **QR Code 網址修正。** 大廳原本用 `/api/lan-info` 回傳的 LAN IP
       做 QR — 這個值在生產環境（沒有 Vite dev server）毫無意義。
       現在主機名不是 loopback 時，QR 直接使用
       `window.location.origin`，手機掃 `gun.piyou.me` 立即得到正確
       URL；`value` 也會同步 fallback 到 `window.location.origin`，
       不再出現「偵測中…」的閃爍。
    3. **MkDocs 路由。** FastAPI 內建 docs 改掛在 `/api-docs` 與
       `/api-redoc`（`swagger_ui_oauth2_redirect_url` 也改到
       `/api-docs/oauth2-redirect`）。MkDocs 透過
       `StaticFiles(html=True)` 掛在 `/docs`；SPA catch-all 明確跳過
       `/docs`、`/api-docs`、`/api-redoc`。Dockerfile 新增第三 stage：
       用 `mkdocs-material 9.*` 跑 `mkdocs build --strict`，
       並把 `docs/site` 複製進 runtime image。
    4. **六種武器庫。** `models/weapon.py` 拆出六個獨立子類：
       `Pistol`、`Rifle`（突擊步槍）、`Shotgun`、`Sniper`、
       `SMG`、`RocketLauncher`，
       傷害／射速／彈速／TTL 各自不同；
       `RocketLauncher` 另外聲明 14×14 加大 hitbox，
       只在非預設時透過 `bw`/`bh` 走線。
       `models/__init__.py` 匯出 `ALL_WEAPON_IDS` 供跨模組共用。
    5. **武器白名單 + 比賽中強制改派。**
       `GameSettings.allowed_weapons`（CSV）在
       `add_player()`、`set_weapon()`、`request_respawn()` 都會驗證；
       管理員調整白名單後，`_sync_allowed_weapons()` 立刻遍歷所有
       存活玩家，把持「剛被禁掉武器」者隨機改派到還允許的武器，
       **無須重生**。空清單會保底還原成全開，避免大廳卡死。
    6. **大廳武器選單即時反應。** 新增 `/api/settings` 端點，
       回傳 (`allowed_weapons`、`all_weapons`)。大廳每 3 秒輪詢、
       渲染六張武器卡，被禁的卡片變灰；玩家的選擇若在輪詢間被禁，
       自動切到第一個還允許的武器。
    7. **管理員武器啟用清單 UI。** Admin Panel 多了 **WEAPON ARSENAL**
       checklist，會送 `admin_set allowed_weapons`；UI 不允許清單
       變空（雖然引擎也會保底，但前端先擋住更省事）。
    8. **雙語遊戲機制文件更新。** `docs/gameplay_mechanics.md` 新增
       「六種武器與比賽中即時覆寫」章節，附完整數值表、覆寫邏輯
       pseudocode、與大廳即時反應說明。

    ### 關鍵決策

    - **focus-aware 的 local input state。** 在 20 Hz 高頻 state 下能撐住
      最簡單的解 — 不用 debounce、不用手寫 diff、不用 React.memo 比較
      函式。使用者 focus 時以前端為準，blur 後伺服器才接手。
    - **用 CSV，不用陣列。** `leaderboard_columns` 已經用 CSV，
      `admin_set` 也已支援字串往返。沿用同模式可以完全不動 admin 協定層。
    - **伺服器是最終把關。** 玩家武器的四個出入口
      （`add_player`、`set_weapon`、`request_respawn`、
      `_sync_allowed_weapons`）都會比對白名單。前端武器選單純粹 UX。
    - **/api/settings 而不是 WS。** 大廳玩家還沒開 WebSocket，
      3 秒一次的 tiny JSON polling 比為了一個 CSV 欄位就拉一條臨時 WS
      划算得多。
