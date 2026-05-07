# Gameplay Mechanics · 遊戲機制

> **Version / 版本:** Phase 13
> **Last updated / 最後更新:** 2026-05-07

---

## Table of Contents · 目錄

1. [Mode Overview · 模式總覽](#1-mode-overview--模式總覽)
2. [Poison Zone Removal · 毒圈移除](#2-poison-zone-removal--毒圈移除)
3. [Dynamic Respawn & Penalty System · 動態重生與懲罰機制](#3-dynamic-respawn--penalty-system--動態重生與懲罰機制)
4. [Non-Combatant Admin Architecture · 非戰鬥管理員架構](#4-non-combatant-admin-architecture--非戰鬥管理員架構)
5. [Admin WebSocket Protocol · 管理員 WebSocket 協定](#5-admin-websocket-protocol--管理員-websocket-協定)
6. [Player State Machine · 玩家狀態機](#6-player-state-machine--玩家狀態機)
7. [Leaderboard & Stats · 排行榜與統計](#7-leaderboard--stats--排行榜與統計)
8. [Six-Weapon Arsenal · 六種武器庫](#8-six-weapon-arsenal--六種武器庫)
9. [Bot AI & Focus-Fire Cap · Bot AI 與集火上限](#9-bot-ai--focus-fire-cap--bot-ai-與集火上限)
10. [Phase 12+ Updates · Phase 12 之後的更新](#10-phase-12-updates--phase-12-之後的更新)

---

## 1. Mode Overview · 模式總覽

### [English Version]

The game runs as a **Continuous Deathmatch** inside a fixed rectangular arena
(`2000 × 2000 px`). There is no battle royale phase, no shrinking zone, and no
final circle. Players fight indefinitely, die, wait out a penalty timer, and
respawn. The match continues until the admin explicitly stops the server.

The arena boundary is a **hard wall** — players are clamped inside
`[0, world_w] × [0, world_h]`. Touching the edge applies no damage; it simply
prevents further movement in that direction.

### [繁體中文版]

遊戲以**持續餘燼模式**運行於固定矩形競技場（`2000 × 2000 px`）。沒有大逃殺
階段、沒有縮圈、也沒有最終安全區。玩家持續戰鬥、死亡、等待懲罰計時器、然後
重生。比賽持續進行，直到管理員明確停止伺服器為止。

競技場邊界為**硬牆** — 玩家被限制在 `[0, world_w] × [0, world_h]` 內。觸碰
邊緣不會造成傷害，僅單純阻擋該方向的繼續移動。

---

## 2. Poison Zone Removal · 毒圈移除

### [English Version]

All references to `SafeZone`, poison circles, shrinking radii, and
out-of-zone damage have been **completely removed** from the backend:

- The `SafeZone` dataclass no longer exists.
- `_update_safe_zone()` has been deleted from `GameEngine`.
- The `safe_zone` key is no longer present in the network snapshot.
- No damage-over-time is applied based on player position.

### [繁體中文版]

所有與 `SafeZone`、毒圈、縮圈半徑及出圈傷害相關的引用已從後端**完全移除**：

- `SafeZone` 資料類別已不存在。
- `GameEngine` 中的 `_update_safe_zone()` 已刪除。
- 網路快照中不再包含 `safe_zone` 鍵值。
- 不再依據玩家位置施加持續傷害。

---

## 3. Dynamic Respawn & Penalty System · 動態重生與懲罰機制

### 3.1 Formula · 公式

### [English Version]

```
Wait Time (seconds) = base_respawn_time + death_count × respawn_penalty
```

| Parameter             | Default | Description                                    |
|-----------------------|---------|------------------------------------------------|
| `base_respawn_time`   | **5.0 s** | Minimum wait after the first death.          |
| `respawn_penalty`     | **3.0 s** | Extra wait per additional death.             |

**Example:**

| Death # | Wait                |
|---------|---------------------|
| 1       | 5 + 1×3 = **8 s**   |
| 2       | 5 + 2×3 = **11 s**  |
| 3       | 5 + 3×3 = **14 s**  |
| N       | **5 + 3N s**        |

### [繁體中文版]

```
等待時間（秒）= 基礎重生時間 + 死亡次數 × 重生懲罰
```

| 參數                  | 預設     | 描述                                |
|-----------------------|----------|-------------------------------------|
| `base_respawn_time`   | **5.0 秒** | 首次死亡後的最短等待。              |
| `respawn_penalty`     | **3.0 秒** | 每多一次死亡增加的等待。            |

**範例：**

| 第幾次死亡 | 等待                |
|-----------|---------------------|
| 第 1 次   | 5 + 1×3 = **8 秒**  |
| 第 2 次   | 5 + 2×3 = **11 秒** |
| 第 3 次   | 5 + 3×3 = **14 秒** |
| 第 N 次   | **5 + 3N 秒**       |

---

### 3.2 Player Fields · 玩家欄位

### [English Version]

| Field              | Type    | Description                                                  |
|--------------------|---------|--------------------------------------------------------------|
| `kills`            | `int`   | Total confirmed kills.                                       |
| `deaths`           | `int`   | Total deaths.                                                |
| `damage_dealt`     | `float` | Total outgoing damage.                                       |
| `damage_taken`     | `float` | Total incoming damage.                                       |
| `state` / `status` | `str`   | One of `'alive'`, `'dead'`, or `'spectating'`.               |
| `respawn_at`       | `float` | `perf_counter` timestamp when respawn becomes available.     |

### [繁體中文版]

| 欄位               | 型別    | 描述                                                         |
|--------------------|---------|--------------------------------------------------------------|
| `kills`            | `int`   | 累計確認擊殺數。                                             |
| `deaths`           | `int`   | 累計死亡數。                                                 |
| `damage_dealt`     | `float` | 累計輸出傷害。                                               |
| `damage_taken`     | `float` | 累計承受傷害。                                               |
| `state` / `status` | `str`   | 為 `'alive'`、`'dead'`、`'spectating'` 三者之一。            |
| `respawn_at`       | `float` | 允許重生時的 `perf_counter` 時間戳。                         |

---

### 3.3 Respawn Flow · 重生流程

### [English Version]

```
Player killed → state = DEAD, deaths++, respawn_at = now + wait
       │
       ├── Player sends "respawn" → engine checks perf_counter ≥ respawn_at
       │       ├── YES → respawn at random position, state = ALIVE
       │       └── NO  → request silently ignored
       │
       └── Player sends "spectate" → state = SPECTATING (can still respawn later)
```

### [繁體中文版]

```
玩家陣亡 → state = DEAD、deaths++、respawn_at = now + wait
       │
       ├── 玩家送出 "respawn" → 引擎檢查 perf_counter ≥ respawn_at
       │       ├── 是 → 在隨機位置重生，state = ALIVE
       │       └── 否 → 請求被靜默忽略
       │
       └── 玩家送出 "spectate" → state = SPECTATING（之後仍可重生）
```

---

### 3.4 Admin Respawn Controls · 管理員重生控制

### [English Version]

| Action                         | Message Type                  | Description                                              |
|--------------------------------|-------------------------------|----------------------------------------------------------|
| Force respawn one player       | `admin_force_respawn`         | Bypass timer for a single player.                        |
| Force respawn all dead players | `admin_force_respawn_all`     | Immediately respawn every dead/spectating player.        |
| Batch reduce respawn timers    | `admin_batch_reduce_respawn`  | Subtract N seconds from all dead players' timers.        |
| Batch reset respawn timers     | `admin_batch_reset_respawn`   | Set all dead players' timers to now (instant respawn).   |

### [繁體中文版]

| 動作                          | 訊息類型                      | 描述                                                     |
|-------------------------------|-------------------------------|----------------------------------------------------------|
| 強制重生單一玩家              | `admin_force_respawn`         | 跳過單一玩家的計時器。                                   |
| 強制重生所有死亡玩家          | `admin_force_respawn_all`     | 立即重生所有已死亡/觀戰玩家。                            |
| 批次減少重生計時器            | `admin_batch_reduce_respawn`  | 將所有已陣亡玩家計時器減少 N 秒。                        |
| 批次重設重生計時器            | `admin_batch_reset_respawn`   | 將所有已陣亡玩家計時器歸零（立即重生）。                 |

---

## 4. Non-Combatant Admin Architecture · 非戰鬥管理員架構

### 4.1 Design Principle · 設計原則

### [English Version]

An admin connected via the **`join_admin`** WebSocket handshake is a
**non-combatant observer**:

- **No `Player` object is created.** The admin has no coordinates, no hitbox, and cannot be killed.
- The admin receives the same global game-state snapshot (`type: "state"`) every tick.
- The admin can send administrative payloads (change settings, force-respawn, etc.).
- An admin connection is tracked in `engine.admin_ws` (keyed by a unique `admin-XXXXXXXX` ID).

### [繁體中文版]

透過 **`join_admin`** WebSocket 握手連線的管理員為**非戰鬥觀察者**：

- **不建立 `Player` 物件。** 管理員沒有座標、沒有碰撞箱，無法被擊殺。
- 管理員每個 tick 接收與玩家相同的全域遊戲狀態快照（`type: "state"`）。
- 管理員可傳送管理指令（變更設定、強制重生等）。
- 管理員連線記錄於 `engine.admin_ws`（以唯一 `admin-XXXXXXXX` ID 為鍵值）。

---

### 4.2 Connection Flow · 連線流程

### [English Version]

```
Client (5-click lobby) ──WebSocket──▶ Server /ws
  │
  ├── Send: { "type": "join_admin", "password": "0909" }
  │
  ├── Server validates password
  │     ├── FAIL → { "type": "admin_fail" } + close(4001)
  │     └── OK   → { "type": "admin_ok", "admin_id": "admin-abc12345", "settings": {...} }
  │
  └── Admin loop: receive admin commands, send game state
       │
       └── On disconnect → engine.remove_admin(admin_id)   (no Player to clean up)
```

### [繁體中文版]

```
客戶端（5 連點大廳）──WebSocket──▶ 伺服器 /ws
  │
  ├── 送出：{ "type": "join_admin", "password": "0909" }
  │
  ├── 伺服器驗證密碼
  │     ├── 失敗 → { "type": "admin_fail" } + close(4001)
  │     └── 成功 → { "type": "admin_ok", "admin_id": "admin-abc12345", "settings": {...} }
  │
  └── 管理員迴圈：接收管理指令、傳送遊戲狀態
       │
       └── 連線中斷 → engine.remove_admin(admin_id)（無 Player 物件需清除）
```

---

### 4.3 Backward Compatibility · 向後相容

### [English Version]

A player that connected via the standard `join` handshake can still
authenticate as admin in-game by sending
`{ "type": "admin_auth", "password": "..." }`. In this case, the player
**remains a combatant** on the map but gains admin privileges. This is the
legacy flow and is kept for backward compatibility.

### [繁體中文版]

透過標準 `join` 握手連線的玩家仍可在遊戲中傳送
`{ "type": "admin_auth", "password": "..." }` 進行管理員驗證。在此情況下，
玩家**仍為地圖上的戰鬥參與者**，但獲得管理員權限。此為舊版流程，保留供
向後相容使用。

---

## 5. Admin WebSocket Protocol · 管理員 WebSocket 協定

### 5.1 Handshake Messages · 握手訊息

### [English Version]

| Direction       | Message                                                                      |
|-----------------|------------------------------------------------------------------------------|
| Client → Server | `{ "type": "join_admin", "password": "<pwd>" }`                              |
| Server → Client | `{ "type": "admin_ok", "admin_id": "...", "settings": {...} }` on success    |
| Server → Client | `{ "type": "admin_fail" }` + WS close(4001) on failure                       |

### [繁體中文版]

| 方向            | 訊息                                                                         |
|-----------------|------------------------------------------------------------------------------|
| Client → Server | `{ "type": "join_admin", "password": "<pwd>" }`                              |
| Server → Client | 成功時：`{ "type": "admin_ok", "admin_id": "...", "settings": {...} }`       |
| Server → Client | 失敗時：`{ "type": "admin_fail" }` 並 WS close(4001)                         |

---

### 5.2 Admin Command Messages · 管理員指令訊息

### [English Version]

| Message Type                    | Payload                                  | Description                                            |
|---------------------------------|------------------------------------------|--------------------------------------------------------|
| `admin_set`                     | `{ "key": "<field>", "value": <val> }`   | Set a `GameSettings` field.                            |
| `admin_force_respawn`           | `{ "player_id": "<pid>" }`               | Force respawn one player.                              |
| `admin_force_respawn_all`       | `{}`                                     | Force respawn all dead players.                        |
| `admin_batch_reduce_respawn`    | `{ "seconds": <N> }`                     | Reduce all respawn timers by N s.                      |
| `admin_batch_reset_respawn`     | `{}`                                     | Reset all respawn timers to now.                       |
| `admin_password`                | `{ "value": "<new_pw>" }`                | Change admin password.                                 |
| `ping`                          | `{ "t": <timestamp> }`                   | Heartbeat for latency measurement.                     |

### [繁體中文版]

| 訊息類型                        | 承載資料                                 | 描述                                                   |
|---------------------------------|------------------------------------------|--------------------------------------------------------|
| `admin_set`                     | `{ "key": "<field>", "value": <val> }`   | 設定 `GameSettings` 欄位。                             |
| `admin_force_respawn`           | `{ "player_id": "<pid>" }`               | 強制重生指定玩家。                                     |
| `admin_force_respawn_all`       | `{}`                                     | 強制重生所有死亡玩家。                                 |
| `admin_batch_reduce_respawn`    | `{ "seconds": <N> }`                     | 將所有重生計時器減少 N 秒。                            |
| `admin_batch_reset_respawn`     | `{}`                                     | 重設所有重生計時器至現在。                             |
| `admin_password`                | `{ "value": "<new_pw>" }`                | 變更管理員密碼。                                       |
| `ping`                          | `{ "t": <timestamp> }`                   | 心跳，用於測量延遲。                                   |

---

## 6. Player State Machine · 玩家狀態機

### [English Version]

```
            ┌──────────────────────────────────────────┐
            │                                          │
    spawn   ▼                                          │  respawn (timer expired
 ──────▶ [ALIVE] ──── take lethal damage ────▶ [DEAD] ─┤  OR admin force)
                                                │      │
                                                │      │
                                          "spectate"   │
                                                │      │
                                                ▼      │
                                         [SPECTATING] ─┘
                                         (can still respawn)
```

The `SPECTATING` state is **optional** — a dead player can choose to spectate
while waiting for the respawn timer. They can still issue a `"respawn"`
message once the timer expires.

### [繁體中文版]

```
            ┌──────────────────────────────────────────┐
            │                                          │
    spawn   ▼                                          │  重生（倒數結束
 ──────▶ [ALIVE] ──── 受致命傷害 ──────────▶ [DEAD] ──┤  或管理員強制）
                                                │      │
                                                │      │
                                          "spectate"   │
                                                │      │
                                                ▼      │
                                         [SPECTATING] ─┘
                                         （仍可重生）
```

`SPECTATING` 狀態為**可選** — 死亡玩家可在等待重生計時器期間選擇觀戰。
計時器到期後仍可發送 `"respawn"` 訊息重生。

---

## 7. Leaderboard & Stats · 排行榜與統計

### [English Version]

The leaderboard can be sorted by any of the following fields, configurable by
the admin via `admin_set` → `leaderboard_sort_by`:

| Sort Key       | Description                                |
|----------------|--------------------------------------------|
| `kills`        | Total kills.                               |
| `deaths`       | Total deaths.                              |
| `damage_dealt` | Total damage output.                       |
| `damage_taken` | Total damage received.                     |

### [繁體中文版]

排行榜可依下列任一欄位排序，管理員透過 `admin_set` → `leaderboard_sort_by`
設定：

| 排序鍵         | 描述                                       |
|----------------|--------------------------------------------|
| `kills`        | 累計擊殺。                                 |
| `deaths`       | 累計死亡。                                 |
| `damage_dealt` | 累計輸出傷害。                             |
| `damage_taken` | 累計承受傷害。                             |

---

## 8. Six-Weapon Arsenal · 六種武器庫

### 8.1 Arsenal Specifications · 武器規格

### [English Version]

Phase 10 expands the arsenal from three to six weapons. Every weapon has its
own fire-rate, damage, projectile speed, and time-to-live (TTL).
TTL × bullet-speed gives the effective range.

| ID         | Name              | Damage         | Fire-rate     | Bullet speed | TTL   | Hitbox   | Notes                                  |
|------------|-------------------|----------------|---------------|--------------|-------|----------|----------------------------------------|
| `pistol`   | Pistol            | 12             | 5 shots/s     | 600 px/s     | 0.7 s | 6×6      | Reliable sidearm, balanced.            |
| `rifle`    | Assault Rifle     | 8              | 11 shots/s    | 750 px/s     | 0.7 s | 6×6      | Workhorse auto, low-damage spam.       |
| `shotgun`  | Shotgun           | 6 × 6 pellets  | 1.6 shots/s   | 600 px/s     | 0.5 s | 6×6      | 6-pellet 14° cone — devastating close. |
| `sniper`   | Sniper            | 60             | 0.8 shots/s   | 1500 px/s    | 1.5 s | 6×6      | Cross-map one-shot threat.             |
| `smg`      | SMG               | 5              | 16 shots/s    | 700 px/s     | 0.45 s| 6×6      | Highest RPM, short range.              |
| `rocket`   | Rocket Launcher   | 80             | 0.6 shots/s   | 350 px/s     | 2.0 s | **14×14**| Heavy slow projectile, oversized hitbox.|

The Rocket's 14×14 hitbox is the **only** one that travels on the wire
(`bw` / `bh` keys); all others rely on the client-side 6×6 default to keep the
broadcast payload small.

### [繁體中文版]

Phase 10 把武器庫從三種擴展到六種，每把武器有獨立的射速、傷害、彈速與彈道
存活時間（TTL）；TTL × 彈速即為有效射程。

| ID         | 名稱              | 傷害           | 射速          | 彈速         | TTL   | 彈體     | 備註                                   |
|------------|-------------------|----------------|---------------|--------------|-------|----------|----------------------------------------|
| `pistol`   | 手槍              | 12             | 5 發/秒       | 600 px/秒    | 0.7 秒 | 6×6      | 穩定副武器，平衡型。                   |
| `rifle`    | 突擊步槍          | 8              | 11 發/秒      | 750 px/秒    | 0.7 秒 | 6×6      | 主力全自動，低單發、靠連射壓制。       |
| `shotgun`  | 霰彈槍            | 6 × 6 彈丸     | 1.6 發/秒     | 600 px/秒    | 0.5 秒 | 6×6      | 6 顆彈丸 14° 扇形，近戰毀滅。          |
| `sniper`   | 狙擊槍            | 60             | 0.8 發/秒     | 1500 px/秒   | 1.5 秒 | 6×6      | 跨圖一發致命。                         |
| `smg`      | 衝鋒槍            | 5              | 16 發/秒      | 700 px/秒    | 0.45 秒| 6×6      | 最高射速，短射程。                     |
| `rocket`   | 火箭筒            | 80             | 0.6 發/秒     | 350 px/秒    | 2.0 秒 | **14×14**| 重型慢速彈體，加大 hitbox。            |

只有火箭筒的 14×14 hitbox 會出現在線上（`bw` / `bh` 鍵），其餘武器都靠
前端的 6×6 預設值，藉此縮小廣播封包。

---

### 8.2 Allowed-Weapons Whitelist · 武器啟用白名單

### [English Version]

A `GameSettings.allowed_weapons` field stores a CSV of weapon IDs the engine
is allowed to hand out. Default: every weapon enabled. The admin toggles each
weapon on/off in **Command Center → Weapon Arsenal**; the panel will refuse
to drop the list to zero (the engine treats an empty list as "all-enabled"
anyway, as a defensive fallback).

### [繁體中文版]

`GameSettings.allowed_weapons` 欄位以逗號分隔的 CSV 紀錄引擎允許派發的
武器 ID。預設全 6 種開放。管理員可在**指揮中心 → 武器啟用清單**逐一切換；
UI 不會讓清單變空（即便真的變空，引擎也會保底還原成全開）。

---

### 8.3 Mid-Match Override — Automatic Reassign · 比賽中強制改派

### [English Version]

When the admin disables a weapon, the backend immediately walks every alive
player. Anyone still holding the just-disabled weapon is **force-reassigned**
to a random currently-allowed weapon — no respawn required. Dead/spectating
players are not touched mid-match; their stored weapon is validated and (if
necessary) re-rolled at respawn.

```python
# backend/engine.py
def _sync_allowed_weapons(self) -> None:
    allowed = self._allowed_weapons_set()
    for p in self.players.values():
        if p.state != STATE_ALIVE:
            continue
        if p.weapon.name not in allowed:
            cls = WEAPON_REGISTRY.get(self._pick_random_allowed_weapon())
            if cls:
                p.weapon = cls()
```

Three other call-sites enforce the whitelist defensively:
`add_player()` (joiner snaps to a legal weapon), `set_weapon()` (in-game
switch), and `request_respawn()` (post-mortem switch). The client-side weapon
picker is purely UX — the server is the authoritative gate.

### [繁體中文版]

管理員停用某把武器時，後端會立即遍歷所有存活玩家，凡仍持有該武器者會被
**強制改派**為當前還允許的隨機武器，**無須等到重生**。死亡 / 觀戰中的玩家
在比賽中不會被觸碰；他們的武器會在重生時被驗證、必要時再隨機改派。

```python
# backend/engine.py
def _sync_allowed_weapons(self) -> None:
    allowed = self._allowed_weapons_set()
    for p in self.players.values():
        if p.state != STATE_ALIVE:
            continue
        if p.weapon.name not in allowed:
            cls = WEAPON_REGISTRY.get(self._pick_random_allowed_weapon())
            if cls:
                p.weapon = cls()
```

另有三個呼叫點同樣會做最終強制：`add_player()`（加入時自動切到合法武器）、
`set_weapon()`（遊戲中切換武器）、以及 `request_respawn()`（重生前驗證）。
前端武器選單純粹是 UX，伺服器才是最終把關者。

---

### 8.4 Lobby Reactivity · 大廳即時反應

### [English Version]

The lobby polls `/api/settings` every 3 s and renders all six weapon cards.
Cards whose ID is *not* in `allowed_weapons` are greyed out and non-clickable.
If the player's currently-selected weapon is disabled mid-poll, the lobby
snaps the selection to the first allowed weapon automatically.

### [繁體中文版]

大廳每 3 秒輪詢 `/api/settings`，並渲染全部六張武器卡。ID 不在
`allowed_weapons` 中的卡片會變灰且無法點擊；若玩家目前選中的武器在輪詢期間
被停用，大廳會自動切到第一個還允許的武器。

---

## 9. Bot AI & Focus-Fire Cap · Bot AI 與集火上限

### [English Version]

A `GameSettings.bot_max_attack_limit` field caps the number of bots that may
simultaneously target the same human player. The previous hard-coded value
of `2` (in `models/bot.py`) is gone — the engine reads the admin-tunable cap
each tick and passes it into `BotPlayer.ai_step`.

- A value of `0` disables the cap entirely (bots will swarm the closest player).
- Default: **`2`**.

The Admin Panel exposes this as a numeric input under
**Bot Management → Bots Targeting One Player (max)**.

### [繁體中文版]

`GameSettings.bot_max_attack_limit` 欄位限制可同時鎖定同一名玩家的 Bot 數量。
原本寫死於 `models/bot.py` 的 `2` 已移除 — 引擎每 tick 把管理員可調的上限
傳入 `BotPlayer.ai_step`。

- 設為 `0` 代表不限制（所有 Bot 會圍攻最近的玩家）。
- 預設：**`2`**。

管理員面板於「機器人管理 → 單一玩家可被多少 Bot 集火」中提供數字輸入。

---

## 10. Phase 12+ Updates · Phase 12 之後的更新

### 10.1 Admin Toggle State Sync · 管理員 Toggle 狀態同步

### [English Version]

Phase 12 fixes a long-standing flicker where toggles (Weapons / Leaderboard
columns / Team Mode / Bots Enabled) briefly snapped back to their old value
between the click and the next server snapshot. The fix is
**optimistic-with-confirmation**:

1. Each toggleable setting writes a *pending* value to a local override the moment the admin clicks it.
2. The local override is read in preference to the snapshot.
3. Once a snapshot reports the same value the override clears; the UI transitions back to the canonical server state with no visible flicker.

The backend mirrors this guarantee: `engine.admin_set` now calls
`setattr(...)` BEFORE running any sync helpers, so the very next broadcast
tick already carries the new value.

### [繁體中文版]

Phase 12 修正 toggle 在點擊到伺服器確認之間短暫閃回舊值的長期問題。修法為
**樂觀更新 + 伺服器確認後清除**：

1. 點擊瞬間就把 pending 值寫入本地 override。
2. 渲染時 override 優先於 snapshot。
3. 下一個 snapshot 回報相同值即清除 override，UI 自然過渡回伺服器權威狀態，肉眼看不到閃爍。

後端同步強化：`engine.admin_set` 一律先 `setattr(...)` 再跑 sync helper，
下一個 broadcast tick 必定帶上新值。

---

### 10.2 Stress Test Removal · 壓力測試移除

### [English Version]

The Phase 11 server stress test (admin-spawned bot wave + auto cleanup) has
been removed in Phase 12. Both the backend code paths
(`engine.stress_test_start`, `_stress_test_cleanup`, the
`admin_stress_test` WS handler) and the frontend Admin Panel section have
been deleted. `admin_kick_bots` still works for ad-hoc cleanup of all bots.

### [繁體中文版]

Phase 11 伺服器壓力測試（管理員生成 Bot 波 + 自動清理）已於 Phase 12 完整
移除。後端 `engine.stress_test_start`、`_stress_test_cleanup`、
`admin_stress_test` WebSocket 處理器，以及前端管理員面板對應區塊全部刪除。
如需臨時清掉所有 Bot，仍可使用 `admin_kick_bots`。

---

### 10.3 Custom 404 — Cyberpunk Routing · 自訂 404 — 賽博龐克路由

### [English Version]

Phase 12 also introduces a cyberpunk-styled 404 page rendered by React Router
for any URL the SPA does not own. The frontend & backend wiring is documented
in **[Routing Guide](routing_guide.md)**.

### [繁體中文版]

Phase 12 同時新增了賽博龐克風格的 404 頁面，由 React Router 針對任何 SPA
沒有定義的網址渲染。前後端串接細節記載於
**[路由指南](routing_guide.md)**。

---

### 10.4 Mobile UX Polish — Anti-Selection · 行動裝置反選取

### [English Version]

Phase 13 hardens mobile touch behaviour during gameplay:

- `user-select: none` and `-webkit-user-select: none` on the `<canvas>` and
  HUD layers prevent text-selection magnifiers from popping up under
  intense joystick + fire input.
- `touch-action: none` on the joystick and fire button blocks the browser's
  default scroll, pinch-zoom, and double-tap-to-zoom gestures from hijacking
  the input.
- `-webkit-touch-callout: none` disables the iOS long-press image / link
  context menu on the canvas surface.
- Settings live in `frontend/src/theme.css` so the rule set is applied
  globally without per-component duplication.

### [繁體中文版]

Phase 13 強化行動裝置在遊戲過程中的觸控行為：

- 對 `<canvas>` 與 HUD 圖層加上 `user-select: none` 與
  `-webkit-user-select: none`，避免在搖桿與射擊鍵同時操作下彈出文字選取
  放大鏡。
- 對搖桿與射擊鈕加上 `touch-action: none`，阻擋瀏覽器預設的滾動、雙指縮放、
  雙擊放大手勢搶輸入。
- 加上 `-webkit-touch-callout: none`，停用 iOS 對 canvas 表面長按時跳出的
  圖片 / 連結右鍵選單。
- 設定統一寫於 `frontend/src/theme.css`，免去各元件重複套用。
