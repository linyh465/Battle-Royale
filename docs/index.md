# Project Overview · 專案總覽

---

=== "English"

    ### What is this?

    A **2D top-down multiplayer battle royale** built as a teaching/demo project for the *1142 Advanced Programming* course final. The architecture is intentionally classic and minimal:

    - **Authoritative server** — FastAPI + WebSockets, 30 Hz simulation tick.
    - **Thin client** — React 18 + Vite + native Canvas 2D, rendered at the monitor's refresh rate via `requestAnimationFrame`.
    - **OOP game engine** — `GameObject` base class, polymorphic `Weapon.fire()`, AABB collisions.

    ### High-level architecture

    ```
    ┌──────────────────────────┐                    ┌─────────────────────────────┐
    │         Browser          │                    │       FastAPI Server        │
    │                          │   WebSocket /ws    │                             │
    │  ┌────────────────────┐  │  ◀─────state──────  │  ┌───────────────────────┐  │
    │  │   GameCanvas.jsx   │  │  ─────input─────▶   │  │   GameEngine (30Hz)   │  │
    │  │   rAF @ 60 FPS     │  │                    │  │  step() / broadcast() │  │
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

    ### Data flow per tick (server-authoritative)

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

    ### Repository layout

    ```
    Battle Royale/
    ├── backend/        FastAPI app + 30 Hz GameEngine + OOP models
    ├── frontend/       React 18 + Vite + Canvas client
    ├── docs/           This documentation site (MkDocs)
    └── mkdocs.yml      MkDocs config
    ```

    ### Pages

    - **[Setup](setup.md)** — install deps, run server + client, hardware requirements.
    - **[Development Log](development_log.md)** — full creation process, prompts used, decisions taken.
    - **[Modification Guide](modification_guide.md)** — adding weapons, resizing the map, tuning the tick rate.
    - **[Design Log (raw)](design_log.md)** — running notes captured during development.

=== "繁體中文"

    ### 專案是什麼？

    一款 **2D 俯視角多人大逃殺**，作為《1142 進階程式設計》課程期末作業的教學／展示專案。架構刻意維持「經典且最小可行」：

    - **權威伺服器**：FastAPI + WebSockets，固定 30 Hz 模擬。
    - **輕量客戶端**：React 18 + Vite + 原生 Canvas 2D，以 `requestAnimationFrame` 跟隨螢幕刷新率作畫。
    - **OOP 遊戲引擎**：`GameObject` 基底類別、多型 `Weapon.fire()`、AABB 碰撞。

    ### 系統高階架構圖

    ```
    ┌──────────────────────────┐                    ┌─────────────────────────────┐
    │         瀏覽器            │                    │       FastAPI 伺服器          │
    │                          │   WebSocket /ws    │                             │
    │  ┌────────────────────┐  │  ◀──── 狀態 ──────  │  ┌───────────────────────┐  │
    │  │   GameCanvas.jsx   │  │  ──── 輸入 ─────▶   │  │   GameEngine (30Hz)   │  │
    │  │   rAF @ 60 FPS     │  │                    │  │  step() / broadcast() │  │
    │  └─────────┬──────────┘  │                    │  └──────────┬────────────┘  │
    │            │ 讀取         │                    │             │               │
    │  ┌─────────▼──────────┐  │                    │  ┌──────────▼────────────┐  │
    │  │ stateRef (useRef)  │  │                    │  │   models/             │  │
    │  │  （不用 setState）  │  │                    │  │   GameObject          │  │
    │  └────────────────────┘  │                    │  │   Player / Bullet     │  │
    │                          │                    │  │   Weapon (多型)        │  │
    │  ┌────────────────────┐  │                    │  └───────────────────────┘  │
    │  │  useGameSocket.js  │  │                    │                             │
    │  └────────────────────┘  │                    │                             │
    └──────────────────────────┘                    └─────────────────────────────┘
    ```

    ### 每個 Tick 的資料流（伺服器權威）

    ```
    客戶端鍵鼠輸入 ──► input 訊息 ──► engine.apply_input()
                                          │
                                          ▼
                               engine.step(dt, now)
                                 ├── Player.update()
                                 ├── weapon.fire() → Bullet[]
                                 ├── Bullet.update()
                                 └── _resolve_bullet_hits() （AABB）
                                          │
                                          ▼
                               engine.broadcast()  （JSON 快照，30 Hz）
                                          │
                                          ▼
                               ws.onmessage → stateRef.current
                                          │
                               requestAnimationFrame ──► Canvas 重繪
    ```

    ### 專案目錄結構

    ```
    Battle Royale/
    ├── backend/        FastAPI 應用 + 30 Hz GameEngine + OOP 模型
    ├── frontend/       React 18 + Vite + Canvas 客戶端
    ├── docs/           本文件站（MkDocs）
    └── mkdocs.yml      MkDocs 設定檔
    ```

    ### 文件頁面導覽

    - **[Setup（環境建置）](setup.md)**：相依套件安裝、伺服器與客戶端啟動、硬體建議。
    - **[Development Log（開發歷程）](development_log.md)**：完整建構過程、所用提示詞與決策紀錄。
    - **[Modification Guide（修改指南）](modification_guide.md)**：新增武器、調整地圖大小、修改 Tick Rate。
    - **[Design Log（原始紀錄）](design_log.md)**：開發過程隨手紀錄的設計筆記。
