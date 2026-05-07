# Design Log — Battle Royale

> Running log of design decisions. Final compilation will go into `/docs` (MkDocs structure) in a later phase.

---

## Phase 1 — Backend (FastAPI + OOP Engine)

### EN

**Date:** 2026-05-06
**Stack:** Python 3.11+, FastAPI, `websockets`, `uvicorn`.

**Decisions**
1. **Authoritative server.** Clients send only intent; server runs the only simulation that counts.
2. **OOP hierarchy** under `backend/models/`:
   - `GameObject` — base entity (position, velocity, AABB, alive flag).
   - `Player(GameObject)` — HP, speed, weapon slot, input buffer.
   - `Weapon` — polymorphic `fire()` returns a list of `Bullet`. Subclasses: `Pistol`, `Rifle`, `Shotgun` (overrides `fire()` for spread).
   - `Bullet(GameObject)` — owner, damage, TTL.
3. **Tick rate:** 30 Hz fixed step (`TICK_DT = 1/30`). Measured `dt` is passed to `update()` so physics is robust to scheduler jitter.
4. **Collision:** AABB intersection on `GameObject.bbox`; `_resolve_bullet_hits` loops bullets × players, ignores owner.
5. **Networking:**
   - One WebSocket endpoint `/ws`.
   - Handshake message `join` → server replies `welcome` with `player_id`.
   - Per-tick full-state broadcast (`type: state`). Delta-encoding deferred until profiling shows need.
6. **Concurrency:** `engine.run()` is started in FastAPI `lifespan`; `asyncio.sleep` keeps the loop cooperative.

**Open questions / Phase-2 candidates**
- Shrinking play zone (storm).
- Spatial hash for bullet/player broad phase if N grows.
- Server reconciliation + client prediction.
- Persistent match results (DB).

---

## Phase 2 — Frontend (React 18 + Vite + Canvas)

### EN

**Stack:** React 18, Vite 5, native `<canvas>` 2D context.

**Decisions**
1. **Render path is OUT of React.** WebSocket snapshots are written to `useRef.current` in `useGameSocket`; `setState` is reserved for connection status / `player_id`. The canvas repaints inside a `requestAnimationFrame` loop reading the ref every frame.
2. **Two-clock model.** Server simulates @ 30 Hz, client renders @ display refresh (typically 60+). No interpolation yet — added if visible jitter shows up.
3. **Input loop @ 30 Hz** via `setInterval`. WASD becomes a unit vector; mouse position is converted to a world-space angle using the local player's center plus camera offset.
4. **Camera follows local player.** Bullets, players, grid, and world bounds are translated by camera.
5. **No game-state in React tree.** `App` only owns lobby form fields. `GameCanvas` mounts after Join and never re-renders due to game updates.
6. **Vite dev proxy** forwards `/ws` to `ws://localhost:8000`, so the same origin works in dev and prod-like deploys.

### zh-TW

**技術棧：** React 18、Vite 5、原生 `<canvas>` 2D。

**設計決策**
1. **繪圖路徑不走 React 重渲染**：WebSocket 快照在 `useGameSocket` 裡直接寫進 `useRef.current`；`setState` 只用於連線狀態與 `player_id`。Canvas 在 `requestAnimationFrame` 迴圈內每幀讀 ref。
2. **雙時鐘模型**：伺服器固定 30 Hz 模擬，客戶端依顯示器更新率作畫（通常 60+）。目前尚未做插值（interpolation），若觀察到抖動再補上。
3. **輸入迴圈 30 Hz**：使用 `setInterval`。WASD 轉成單位向量；滑鼠座標透過本機玩家中心加攝影機偏移轉成世界座標再算角度。
4. **攝影機跟隨本機玩家**：子彈、玩家、格線、世界邊界皆套用攝影機偏移。
5. **遊戲狀態不進 React 樹**：`App` 只維護大廳表單。`GameCanvas` 掛載後完全不因遊戲狀態更新而重渲染。
6. **Vite dev 代理**：`/ws` 轉發到 `ws://localhost:8000`，開發與類正式部署皆同源。

---

### Phase-1 zh-TW (kept below for reference)

**日期：** 2026-05-06
**技術棧：** Python 3.11+、FastAPI、`websockets`、`uvicorn`。

**設計決策**
1. **權威伺服器**：客戶端只傳輸入意圖，伺服器是唯一的真實模擬來源，避免作弊。
2. **OOP 階層**（位於 `backend/models/`）：
   - `GameObject`：基底實體（座標、速度、AABB、存活旗標）。
   - `Player(GameObject)`：HP、速度、武器槽、輸入緩衝。
   - `Weapon`：多型 `fire()` 回傳 `Bullet` 列表。子類：`Pistol`、`Rifle`、`Shotgun`（覆寫 `fire()` 以產生散射彈）。
   - `Bullet(GameObject)`：擁有者、傷害、存活時間（TTL）。
3. **Tick 頻率**：固定 30 Hz（`TICK_DT = 1/30`），實際 `dt` 量測後傳入 `update()`，避免排程抖動造成模擬不穩。
4. **碰撞偵測**：`GameObject.bbox` 進行 AABB 相交；`_resolve_bullet_hits` 雙層迴圈，跳過擁有者本人。
5. **網路通訊**：
   - 單一 WebSocket 端點 `/ws`。
   - 以 `join` 訊息握手，伺服器回覆 `welcome` 並帶上 `player_id`。
   - 每 tick 廣播完整世界快照（`type: state`）。差分編碼延後到效能瓶頸出現時再做。
6. **併發模型**：`engine.run()` 於 FastAPI `lifespan` 啟動；以 `asyncio.sleep` 讓出執行緒。

**待解 / Phase-2 候選議題**
- 縮圈機制（毒圈／風暴）。
- 空間雜湊（spatial hash）作為碰撞 broad phase，因應玩家數成長。
- 伺服器調和（reconciliation）＋客戶端預測（client prediction）。
- 比賽結果持久化（資料庫）。
