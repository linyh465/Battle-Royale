# Advanced Systems · 進階系統

> **Version / 版本:** Phase 13
> **Last updated / 最後更新:** 2026-05-07

> Respawn-penalty math, the hidden 5-click admin trigger, the spectator state
> machine, and the URL-routed Director View — the four "Phase 6" systems that
> are not obvious from skimming the source.
>
> 重生懲罰公式、5 連點隱藏管理員觸發、觀戰狀態機，以及由 URL 控制的導播視角
> — 四個無法單看程式碼直接理解的「Phase 6」系統。

---

## Table of Contents · 目錄

1. [WebSocket Connection Flow (Mermaid) · WebSocket 連線流程（Mermaid 圖）](#1-websocket-connection-flow--websocket-連線流程)
2. [Penalty Respawn — The Math · 重生懲罰公式](#2-penalty-respawn--the-math--重生懲罰公式)
3. [Hidden 5-Click Admin Trigger · 5 連點隱藏管理員觸發](#3-hidden-5-click-admin-trigger--5-連點隱藏管理員觸發)
4. [Spectator State Machine · 觀戰狀態機](#4-spectator-state-machine--觀戰狀態機)
5. [Director View — URL Routing · 導播視角的 URL 路由](#5-director-view--url-routing--導播視角的-url-路由)

---

## 1. WebSocket Connection Flow · WebSocket 連線流程

### [English Version]

The diagram below shows how three different actor types — Player, Admin, and
Director — multiplex onto the **single `/ws` endpoint** in `backend/main.py`.
The first message after the WebSocket opens determines the actor's role for
the rest of the session.

```mermaid
sequenceDiagram
    autonumber
    participant P as Player Browser
    participant A as Admin Browser
    participant D as Director Browser
    participant S as FastAPI /ws
    participant E as GameEngine (30 Hz)

    Note over P,A,D: All three connect to the same /ws endpoint
    P->>S: WebSocket open
    S-->>P: { type: "welcome", world_w, world_h, settings }
    P->>S: { type: "join", name, color, weapon }
    S->>E: engine.add_player(...)
    E-->>S: Player object created
    S-->>P: { type: "you", id }

    A->>S: WebSocket open
    A->>S: { type: "join_admin", password: "0909" }
    S->>S: validate against engine.settings.admin_password
    alt password OK
        S-->>A: { type: "admin_ok", admin_id, settings }
        S->>E: engine.add_admin(admin_id, ws)
    else password FAIL
        S-->>A: { type: "admin_fail" }
        S->>A: WS close(4001)
    end

    D->>S: WebSocket open (?role=director)
    D->>S: { type: "join_director" }
    S->>E: engine.directors.append(ws)
    S-->>D: { type: "welcome_director", world_w, world_h }

    loop Every 1/30 s
        E->>E: step(dt, now)
        E-->>P: snapshot { type: "state", players, bullets, now }
        E-->>A: snapshot (same shape, no input rights revoked)
        E-->>D: snapshot (read-only, full god view)
    end

    P->>S: { type: "input", keys, mouse }
    S->>E: engine.apply_input(player_id, ...)

    A->>S: { type: "admin_set", key: "respawn_penalty", value: 5 }
    S->>E: engine.admin_set("respawn_penalty", 5)

    Note over D,S: Director never sends input or admin_set —<br/>only ping is honoured

    P-xS: WebSocket close
    S->>E: engine.remove_player(player_id)

    A-xS: WebSocket close
    S->>E: engine.remove_admin(admin_id)

    D-xS: WebSocket close
    S->>E: engine.directors.remove(ws)
```

### [繁體中文版]

下圖呈現 Player、Admin、Director 三種不同角色如何**多路複用**至
`backend/main.py` 中**單一 `/ws` 端點**。WebSocket 連線開啟後的**第一則
訊息**決定該連線後續整個 session 的角色。

```mermaid
sequenceDiagram
    autonumber
    participant P as 玩家瀏覽器
    participant A as 管理員瀏覽器
    participant D as 導播瀏覽器
    participant S as FastAPI /ws
    participant E as GameEngine（30 Hz）

    Note over P,A,D: 三者連到同一支 /ws 端點
    P->>S: WebSocket 連線
    S-->>P: { type: "welcome", world_w, world_h, settings }
    P->>S: { type: "join", name, color, weapon }
    S->>E: engine.add_player(...)
    E-->>S: 建立 Player 物件
    S-->>P: { type: "you", id }

    A->>S: WebSocket 連線
    A->>S: { type: "join_admin", password: "0909" }
    S->>S: 比對 engine.settings.admin_password
    alt 密碼正確
        S-->>A: { type: "admin_ok", admin_id, settings }
        S->>E: engine.add_admin(admin_id, ws)
    else 密碼錯誤
        S-->>A: { type: "admin_fail" }
        S->>A: WS close(4001)
    end

    D->>S: WebSocket 連線 (?role=director)
    D->>S: { type: "join_director" }
    S->>E: engine.directors.append(ws)
    S-->>D: { type: "welcome_director", world_w, world_h }

    loop 每 1/30 秒
        E->>E: step(dt, now)
        E-->>P: 快照 { type: "state", players, bullets, now }
        E-->>A: 快照（同樣形狀，未撤銷任何輸入權限）
        E-->>D: 快照（唯讀，上帝視角全圖）
    end

    P->>S: { type: "input", keys, mouse }
    S->>E: engine.apply_input(player_id, ...)

    A->>S: { type: "admin_set", key: "respawn_penalty", value: 5 }
    S->>E: engine.admin_set("respawn_penalty", 5)

    Note over D,S: 導播從不送 input 或 admin_set —<br/>僅接受 ping

    P-xS: WebSocket 關閉
    S->>E: engine.remove_player(player_id)

    A-xS: WebSocket 關閉
    S->>E: engine.remove_admin(admin_id)

    D-xS: WebSocket 關閉
    S->>E: engine.directors.remove(ws)
```

---

## 2. Penalty Respawn — The Math · 重生懲罰公式

### [English Version]

When a player dies (HP ≤ 0 from a bullet hit), the engine in
`backend/engine.py` records the death and computes the **respawn deadline**:

```python
wait = settings.base_respawn_time + victim.deaths * settings.respawn_penalty
victim.respawn_at = now + wait
```

| Constant            | Symbol               | Default |
|---------------------|----------------------|---------|
| Base time           | `base_respawn_time`  | **5 s** |
| Per-death penalty   | `respawn_penalty`    | **3 s** |

`deaths` is incremented **before** the formula is evaluated, so the
cumulative wait grows linearly:

| Death # | `deaths` field | Wait time           |
|---------|----------------|---------------------|
| 1st     | 1              | 5 + 1·3 = **8 s**   |
| 2nd     | 2              | 5 + 2·3 = **11 s**  |
| 3rd     | 3              | 5 + 3·3 = **14 s**  |
| Nth     | N              | **5 + 3N s**        |

This is intentional friction: the more often you die, the longer you wait,
which discourages reckless play and gives the surviving players a wider lead.
Both constants are admin-tunable at runtime via the dashboard.

**Server vs client clocks.** `respawn_at` is stamped in
`time.perf_counter()` on the server and broadcast in every snapshot under
`snap.now`. The client computes the displayed countdown as
`respawn_at - snap.now` so clock-drift between machines is irrelevant — the
countdown is always correct relative to the server.

**Force-respawn override.** `admin_force_respawn(player_id)` bypasses
`respawn_at` entirely and respawns the target at a fresh random position
immediately.

### [繁體中文版]

玩家因子彈命中而 HP ≤ 0 時，`backend/engine.py` 中的引擎會紀錄死亡並計算
**重生時刻**：

```python
wait = settings.base_respawn_time + victim.deaths * settings.respawn_penalty
victim.respawn_at = now + wait
```

| 常數                  | 變數                 | 預設     |
|-----------------------|----------------------|----------|
| 基礎等待時間          | `base_respawn_time`  | **5 秒** |
| 每次死亡懲罰          | `respawn_penalty`    | **3 秒** |

`deaths` **先加 1 再代入公式**，因此累計等待時間呈線性成長：

| 第幾次死亡 | `deaths` | 等待時間              |
|-----------|----------|----------------------|
| 第 1 次   | 1        | 5 + 1·3 = **8 秒**   |
| 第 2 次   | 2        | 5 + 2·3 = **11 秒**  |
| 第 3 次   | 3        | 5 + 3·3 = **14 秒**  |
| 第 N 次   | N        | **5 + 3N 秒**        |

設計意圖：死越多等越久，懲罰魯莽戰鬥、拉開倖存玩家的優勢。兩個常數皆可在
管理員儀表板即時調整。

**伺服器 vs 客戶端時鐘**：`respawn_at` 以伺服器 `time.perf_counter()` 為
基準寫入，並隨每次快照以 `snap.now` 一起送給前端。前端顯示倒數 =
`respawn_at - snap.now`，因此完全不受兩台機器時鐘漂移影響。

**強制重生**：`admin_force_respawn(player_id)` 直接忽略 `respawn_at`，立即
把目標重生到隨機位置。

---

## 3. Hidden 5-Click Admin Trigger · 5 連點隱藏管理員觸發

### [English Version]

The lobby logo (`<h1>Battle Royale</h1>` in `App.jsx`) listens for clicks.
The handler keeps a ring of recent click timestamps and arms when the
**last 5 clicks all happened within 1.5 s**:

```js
const onLogoClick = () => {
  const now = Date.now();
  const recent = clickStampsRef.current.filter(t => now - t < 1500);
  recent.push(now);
  clickStampsRef.current = recent;
  if (recent.length >= 5) {
    clickStampsRef.current = [];                  // disarm
    const pw = window.prompt("Admin password / 管理員密碼：");
    if (pw) setAdminPasswordPending(pw);
  }
};
```

Why this design:

- **Discoverable but non-obvious.** A casual user will not stumble into it; a TA who knows about it can reveal it on demand.
- **Stateless on the network.** The password is **not** validated client-side — there is no hash to leak or constant to hard-code. The string is held only in React state.
- **Server-authoritative auth.** `<GameCanvas>` sends `{type:"admin_auth", password}` over the same WebSocket as the player join. The server (in `backend/main.py`) compares against `engine.settings.admin_password` and replies with either `admin_ok` (which gates the dashboard) or `admin_fail` (which fires an `alert()` and silently does nothing else).
- **Rotatable.** The admin can change the password from inside the dashboard via `{type:"admin_password", value}`, which mutates `GameSettings.admin_password` in-process. The default `"0909"` lives in `GameSettings`.

```
┌──────────┐   5 clicks   ┌─────────────┐   prompt    ┌──────────┐
│  <h1>    │  in 1500 ms  │ click ring  │  password   │  React   │
│  logo    │ ───────────▶ │ rolling buf │ ──────────▶ │  state   │
└──────────┘              └─────────────┘             └────┬─────┘
                                                            │ Enter Game
                                                            ▼
                                              ┌──────────────────────┐
                                              │ GameCanvas mounts.   │
                                              │ On WS open + welcome │
                                              │ → send admin_auth.   │
                                              └─────────┬────────────┘
                                                        ▼
                                              admin_ok | admin_fail
```

### [繁體中文版]

大廳的 logo（`App.jsx` 內 `<h1>Battle Royale</h1>`）綁了點擊事件。處理函式
維護一個「最近點擊時間環狀緩衝」，**最後 5 次點擊都在 1.5 秒內**才會觸發：

```js
const onLogoClick = () => {
  const now = Date.now();
  const recent = clickStampsRef.current.filter(t => now - t < 1500);
  recent.push(now);
  clickStampsRef.current = recent;
  if (recent.length >= 5) {
    clickStampsRef.current = [];                  // 解除已觸發狀態
    const pw = window.prompt("Admin password / 管理員密碼：");
    if (pw) setAdminPasswordPending(pw);
  }
};
```

設計考量：

- **可發現但不顯眼**：一般玩家不會誤觸；知道暗門的 TA 可隨時叫出。
- **網路無狀態**：密碼**不在前端驗證** — 沒有 hash 可洩漏、也沒有寫死的常數。字串只存在 React state。
- **權威驗證在伺服器**：`<GameCanvas>` 沿著玩家加入用的同一條 WebSocket 送出 `{type:"admin_auth", password}`。後端（`backend/main.py`）比對 `engine.settings.admin_password`，回 `admin_ok`（開啟儀表板）或 `admin_fail`（彈窗提示，其餘無動作）。
- **可輪換**：管理員可在儀表板內以 `{type:"admin_password", value}` 即時換掉密碼，直接寫入 `GameSettings.admin_password`。預設 `"0909"` 在 `GameSettings` 裡定義。

```
┌──────────┐  5 次點擊   ┌─────────────┐   提示框    ┌──────────┐
│  <h1>    │  1500 毫秒  │ 環狀緩衝     │   輸入密碼   │ React    │
│  logo    │ ───────────▶│ 自動過期     │ ──────────▶│ state    │
└──────────┘             └─────────────┘             └────┬─────┘
                                                          │ Enter Game
                                                          ▼
                                              ┌──────────────────────┐
                                              │ GameCanvas 掛載       │
                                              │ WS open + welcome 後  │
                                              │ → 送 admin_auth      │
                                              └─────────┬────────────┘
                                                        ▼
                                              admin_ok | admin_fail
```

---

## 4. Spectator State Machine · 觀戰狀態機

### [English Version]

A player's `state` field on the server is one of three values:

```
        kill                    request_spectate
ALIVE ────────▶ DEAD ────────────────────────▶ SPECTATING
   ▲              │                              │
   │ respawn      │ respawn (timer up)            │ respawn
   └──────────────┴──────────────────────────────┘
```

#### Transitions

| From         | To           | Trigger                         | Server check                |
|--------------|--------------|---------------------------------|-----------------------------|
| `alive`      | `dead`       | HP reaches 0                    | `_kill()` in engine         |
| `dead`       | `alive`      | Client `{type:"respawn"}`       | `now >= respawn_at`         |
| `dead`       | `spectating` | Client `{type:"spectate"}`      | always allowed              |
| `spectating` | `alive`      | Client `{type:"respawn"}`       | always allowed (no countdown 2nd time) |

#### Client UI per state

| `state`                   | Renders                                                              |
|---------------------------|----------------------------------------------------------------------|
| `alive`                   | Mobile joystick + fire button. Camera follows me.                    |
| `dead` (countdown > 0)    | Centered overlay with the big number ticking down.                   |
| `dead` (countdown = 0)    | Same overlay but with `[Respawn]` and `[Spectate]` buttons.          |
| `spectating`              | Bottom bar: `[‹ Previous]`, `SPECTATING`, `[Next ›]`, `[Rejoin]`.    |

#### Spectator camera

`spectateTargetRef` (a `useRef`) stores the id of the player currently being
followed. `cycleSpectate(±1)` finds the index in the live `alive[]` array and
rotates. The render loop reads the ref each frame and sets `camTarget` to
that player; if the target was killed, it falls back to `alive[0]`.

This is intentionally **client-side only** — the server doesn't care who you
spectate. That keeps the protocol minimal and means two spectators can
independently follow different players without coordination.

### [繁體中文版]

伺服器端玩家 `state` 欄位有三種值：

```
        擊殺                   request_spectate
ALIVE ────────▶ DEAD ────────────────────────▶ SPECTATING
   ▲             │                              │
   │ 重生         │ 重生（倒數結束）              │ 重生
   └─────────────┴──────────────────────────────┘
```

#### 狀態轉移

| 從           | 至           | 觸發                            | 伺服器檢查                    |
|--------------|--------------|---------------------------------|-------------------------------|
| `alive`      | `dead`       | HP 歸零                         | 引擎 `_kill()`                |
| `dead`       | `alive`      | 前端 `{type:"respawn"}`         | `now >= respawn_at`           |
| `dead`       | `spectating` | 前端 `{type:"spectate"}`        | 永遠允許                      |
| `spectating` | `alive`      | 前端 `{type:"respawn"}`         | 永遠允許（已無倒數）          |

#### 不同狀態下前端 UI

| `state`                   | 顯示                                                                 |
|---------------------------|----------------------------------------------------------------------|
| `alive`                   | 行動端搖桿與射擊鈕；攝影機跟隨自己。                                 |
| `dead`（倒數 > 0）        | 置中 overlay 顯示倒數大數字。                                        |
| `dead`（倒數 = 0）        | overlay 換成 `[Respawn]` 與 `[Spectate]` 兩顆按鈕。                  |
| `spectating`              | 下方工具列：`[‹ Previous]`、`SPECTATING`、`[Next ›]`、`[Rejoin]`。   |

#### 觀戰攝影機

`spectateTargetRef`（`useRef`）儲存目前跟拍對象的 ID。`cycleSpectate(±1)`
在 `alive[]` 陣列中找到當前索引並前後切換。rAF 迴圈每幀讀 ref，將
`camTarget` 設為該玩家；若目標已死，就回退到 `alive[0]`。

這部份**完全在前端處理** — 伺服器不關心你正在看誰。協定保持精簡，兩位
觀戰者也能各自獨立追不同的玩家、互不干擾。

---

## 5. Director View — URL Routing · 導播視角的 URL 路由

### [English Version]

The `?role=director` query parameter is the entire routing layer. There is no
React Router state-machine, no client-side history manipulation, and no
per-route data fetcher.

```js
// App.jsx (within RootRoute, the `/` path)
const ROLE = new URLSearchParams(location.search).get("role");

if (ROLE === "director") return <DirectorCanvas wsUrl={WS_URL} />;
return <Lobby wsUrl={WS_URL} />;
```

The query parameter is read **once at mount** — opening a director window
via `window.open('/?role=director', '_blank')` (the AdminPanel button) loads
a fresh document, which re-evaluates this line.

#### Server-side handling

`DirectorCanvas` connects to the same `/ws` endpoint with a different first
message:

```json
{ "type": "join_director" }
```

`backend/main.py` short-circuits before any player creation:

```python
if htype == "join_director":
    engine.directors.append(ws)
    await ws.send_text(json.dumps({"type": "welcome_director", ...}))
    while True:
        # only ping is honoured; no input/admin commands accepted.
```

The engine's `broadcast()` ships every snapshot to both `connections` (real
players) **and** `directors` (read-only observers). A director never appears
in the player list and never affects the simulation.

#### God-mode rendering

The director canvas:

- **Fits the whole world** to the viewport on the first frame after world dimensions arrive.
- **Pans on mouse drag**, **zooms on wheel**.
- **Sees every player** (no fog of war), every projectile, every team color, full HP bars and aim lines.

This split — read-only WS handshake + dedicated component + URL-flag routing
— keeps the director viewer perfectly isolated. You can have one, ten, or
zero directors connected at any time without altering gameplay.

### [繁體中文版]

整個路由層就是 `?role=director` 一個 query parameter。沒有 React Router
狀態機、沒有 history 操作、沒有單獨的資料載入器。

```js
// App.jsx（位於 RootRoute，`/` 路徑下）
const ROLE = new URLSearchParams(location.search).get("role");

if (ROLE === "director") return <DirectorCanvas wsUrl={WS_URL} />;
return <Lobby wsUrl={WS_URL} />;
```

這個 query 在**元件掛載時讀一次**就好 — 用
`window.open('/?role=director', '_blank')`（管理員儀表板的按鈕）開的新分頁
會重新載入 document，這行會重新求值。

#### 後端處理

`DirectorCanvas` 連到同一支 `/ws`，但首訊息不同：

```json
{ "type": "join_director" }
```

`backend/main.py` 在建立玩家前就分流：

```python
if htype == "join_director":
    engine.directors.append(ws)
    await ws.send_text(json.dumps({"type": "welcome_director", ...}))
    while True:
        # 只回應 ping；input / admin 指令一律不接。
```

引擎的 `broadcast()` 會把每個快照同時送到 `connections`（玩家）與
`directors`（唯讀觀察者）。導播不會出現在玩家清單，也不會影響模擬。

#### 上帝視角繪製

導播畫面：

- 拿到世界尺寸後**自動縮放整張地圖到視口**。
- **拖曳平移、滾輪縮放**。
- **看到全部玩家**（無戰爭迷霧），所有子彈、隊伍顏色、HP 條、瞄準線。

這套設計（唯讀握手 + 獨立元件 + URL flag 路由）讓導播視角完全與遊戲解耦：
可以同時掛 1 個、10 個、或 0 個導播都不影響玩家體驗。
