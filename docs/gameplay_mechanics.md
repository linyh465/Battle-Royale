# Gameplay Mechanics — Continuous Deathmatch
# 遊戲機制 — 持續餘燼模式

> **Version / 版本:** Phase 2  
> **Last updated / 最後更新:** 2026-05-07

---

## Table of Contents / 目錄

1. [Mode Overview / 模式總覽](#1-mode-overview--模式總覽)
2. [Poison Zone Removal / 毒圈移除](#2-poison-zone-removal--毒圈移除)
3. [Dynamic Respawn & Penalty System / 動態重生與懲罰機制](#3-dynamic-respawn--penalty-system--動態重生與懲罰機制)
4. [Non-Combatant Admin Architecture / 非戰鬥管理員架構](#4-non-combatant-admin-architecture--非戰鬥管理員架構)
5. [Admin WebSocket Protocol / 管理員 WebSocket 協定](#5-admin-websocket-protocol--管理員-websocket-協定)
6. [Player State Machine / 玩家狀態機](#6-player-state-machine--玩家狀態機)
7. [Leaderboard & Stats / 排行榜與統計](#7-leaderboard--stats--排行榜與統計)

---

## 1. Mode Overview / 模式總覽

**EN:**  
The game runs as a **Continuous Deathmatch** inside a fixed rectangular arena (`2000 × 2000 px`). There is no battle royale phase, no shrinking zone, and no final circle. Players fight indefinitely, die, wait out a penalty timer, and respawn. The match continues until the admin explicitly stops the server.

**zh-TW:**  
遊戲以**持續餘燼模式**運行於固定矩形競技場（`2000 × 2000 px`）。沒有大逃殺階段、沒有縮圈、也沒有最終安全區。玩家持續戰鬥、死亡、等待懲罰計時器、然後重生。比賽持續進行，直到管理員明確停止伺服器為止。

---

## 2. Poison Zone Removal / 毒圈移除

**EN:**  
All references to `SafeZone`, poison circles, shrinking radii, and out-of-zone damage have been **completely removed** from the backend:

- The `SafeZone` dataclass no longer exists.
- `_update_safe_zone()` has been deleted from `GameEngine`.
- The `safe_zone` key is no longer present in the network snapshot.
- No damage-over-time is applied based on player position.

The arena boundary is a hard wall: players are clamped inside `[0, world_w] × [0, world_h]` but receive no damage from touching the edge.

**zh-TW:**  
所有與 `SafeZone`、毒圈、縮圈半徑及出圈傷害相關的引用已從後端**完全移除**：

- `SafeZone` 資料類別已不存在。
- `GameEngine` 中的 `_update_safe_zone()` 已刪除。
- 網路快照中不再包含 `safe_zone` 鍵值。
- 不再依據玩家位置施加持續傷害。

競技場邊界為硬牆：玩家被限制在 `[0, world_w] × [0, world_h]` 內，但觸碰邊緣不會受到傷害。

---

## 3. Dynamic Respawn & Penalty System / 動態重生與懲罰機制

### 3.1 Formula / 公式

```
Wait Time (seconds)  =  base_respawn_time  +  death_count × respawn_penalty
等待時間（秒）        =  基礎重生時間        +  死亡次數     × 重生懲罰
```

| Parameter / 參數       | Default / 預設 | Description / 描述                                        |
|------------------------|----------------|-----------------------------------------------------------|
| `base_respawn_time`    | **5.0 s**      | EN: Minimum wait after the first death. zh-TW: 首次死亡後的最短等待。 |
| `respawn_penalty`      | **3.0 s**      | EN: Extra wait per additional death. zh-TW: 每多一次死亡增加的等待。  |

**Example / 範例:**

| Death # / 第幾次死亡 | Wait / 等待     |
|---------------------|-----------------|
| 1                   | 5 + 1×3 = **8 s**  |
| 2                   | 5 + 2×3 = **11 s** |
| 3                   | 5 + 3×3 = **14 s** |
| 5                   | 5 + 5×3 = **20 s** |

### 3.2 Player Fields / 玩家欄位

| Field / 欄位     | Type / 型別 | Description / 描述                                                    |
|------------------|-------------|-----------------------------------------------------------------------|
| `kills`          | `int`       | EN: Total confirmed kills. zh-TW: 累計確認擊殺數。                     |
| `deaths`         | `int`       | EN: Total deaths. zh-TW: 累計死亡數。                                  |
| `damage_dealt`   | `float`     | EN: Total outgoing damage. zh-TW: 累計輸出傷害。                       |
| `damage_taken`   | `float`     | EN: Total incoming damage. zh-TW: 累計承受傷害。                       |
| `state` / `status` | `str`    | EN: `'alive'`, `'dead'`, or `'spectating'`. zh-TW: `'alive'`、`'dead'`、`'spectating'`。 |
| `respawn_at`     | `float`     | EN: `perf_counter` timestamp when respawn becomes available. zh-TW: 允許重生的 `perf_counter` 時間戳。 |

### 3.3 Respawn Flow / 重生流程

```
Player killed → state = DEAD, deaths++, respawn_at = now + wait
       │
       ├── Player sends "respawn" message → engine checks perf_counter ≥ respawn_at
       │       ├── YES → respawn at random position, state = ALIVE
       │       └── NO  → request silently ignored / 請求被靜默忽略
       │
       └── Player sends "spectate" message → state = SPECTATING (can still respawn later)
```

### 3.4 Admin Respawn Controls / 管理員重生控制

| Action / 動作                   | Message Type / 訊息類型          | Description / 描述                                           |
|---------------------------------|----------------------------------|--------------------------------------------------------------|
| Force respawn one player        | `admin_force_respawn`            | EN: Bypass timer for a single player. zh-TW: 跳過單一玩家的計時器。 |
| Force respawn all dead players  | `admin_force_respawn_all`        | EN: Immediately respawn every dead/spectating player. zh-TW: 立即重生所有已死亡/觀戰玩家。 |
| Batch reduce respawn timers     | `admin_batch_reduce_respawn`     | EN: Subtract N seconds from all dead players' timers. zh-TW: 將所有已陣亡玩家計時器減少 N 秒。 |
| Batch reset respawn timers      | `admin_batch_reset_respawn`      | EN: Set all dead players' timers to now (instant respawn). zh-TW: 將所有已陣亡玩家計時器歸零。 |

---

## 4. Non-Combatant Admin Architecture / 非戰鬥管理員架構

### 4.1 Design Principle / 設計原則

**EN:**  
An admin connected via the **`join_admin`** WebSocket handshake is a **non-combatant observer**:

- **No `Player` object is created.** The admin has no coordinates, no hitbox, and cannot be killed.
- The admin receives the same global game-state snapshot (`type: "state"`) every tick.
- The admin can send administrative payloads (change settings, force-respawn, etc.).
- An admin connection is tracked in `engine.admin_ws` (keyed by a unique `admin-XXXXXXXX` ID).

**zh-TW:**  
透過 **`join_admin`** WebSocket 握手連線的管理員為**非戰鬥觀察者**：

- **不建立 `Player` 物件。** 管理員沒有座標、沒有碰撞箱，無法被擊殺。
- 管理員每個 tick 接收與玩家相同的全域遊戲狀態快照（`type: "state"`）。
- 管理員可傳送管理指令（變更設定、強制重生等）。
- 管理員連線記錄於 `engine.admin_ws`（以唯一 `admin-XXXXXXXX` ID 為鍵值）。

### 4.2 Connection Flow / 連線流程

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
       └── On disconnect → engine.remove_admin(admin_id)
              (No Player to clean up / 無需清除 Player 物件)
```

### 4.3 Backward Compatibility / 向後相容

**EN:**  
A player that connected via the standard `join` handshake can still authenticate as admin in-game by sending `{ "type": "admin_auth", "password": "..." }`. In this case, the player **remains a combatant** on the map but gains admin privileges. This is the legacy flow and is kept for backward compatibility.

**zh-TW:**  
透過標準 `join` 握手連線的玩家仍可在遊戲中傳送 `{ "type": "admin_auth", "password": "..." }` 進行管理員驗證。在此情況下，玩家**仍為地圖上的戰鬥參與者**，但獲得管理員權限。此為舊版流程，保留供向後相容使用。

---

## 5. Admin WebSocket Protocol / 管理員 WebSocket 協定

### 5.1 Handshake Messages / 握手訊息

| Direction / 方向 | Message / 訊息                                                                 |
|------------------|--------------------------------------------------------------------------------|
| Client → Server  | `{ "type": "join_admin", "password": "<pwd>" }`                                |
| Server → Client  | `{ "type": "admin_ok", "admin_id": "...", "settings": {...} }` on success      |
| Server → Client  | `{ "type": "admin_fail" }` + WS close(4001) on failure                         |

### 5.2 Admin Command Messages / 管理員指令訊息

| Message Type / 訊息類型            | Payload / 承載資料                               | Description / 描述 |
|-------------------------------------|--------------------------------------------------|---------------------|
| `admin_set`                         | `{ "key": "<field>", "value": <val> }`           | EN: Set a `GameSettings` field. zh-TW: 設定 `GameSettings` 欄位。 |
| `admin_force_respawn`               | `{ "player_id": "<pid>" }`                       | EN: Force respawn one player. zh-TW: 強制重生指定玩家。 |
| `admin_force_respawn_all`           | `{}`                                             | EN: Force respawn all dead players. zh-TW: 強制重生所有死亡玩家。 |
| `admin_batch_reduce_respawn`        | `{ "seconds": <N> }`                             | EN: Reduce all respawn timers by N s. zh-TW: 減少所有重生計時器 N 秒。 |
| `admin_batch_reset_respawn`         | `{}`                                             | EN: Reset all respawn timers to now. zh-TW: 重設所有重生計時器。 |
| `admin_password`                    | `{ "value": "<new_pw>" }`                        | EN: Change admin password. zh-TW: 變更管理員密碼。 |
| `ping`                              | `{ "t": <timestamp> }`                           | EN: Heartbeat. zh-TW: 心跳。 |

---

## 6. Player State Machine / 玩家狀態機

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

**EN:** The `SPECTATING` state is optional — a dead player can choose to spectate while waiting for the respawn timer. They can still issue a `"respawn"` message once the timer expires.

**zh-TW:** `SPECTATING` 狀態為可選 — 死亡玩家可在等待重生計時器期間選擇觀戰。計時器到期後仍可發送 `"respawn"` 訊息重生。

---

## 7. Leaderboard & Stats / 排行榜與統計

**EN:**  
The leaderboard can be sorted by any of the following fields (configurable by admin via `admin_set` → `leaderboard_sort_by`):

**zh-TW:**  
排行榜可依以下欄位排序（管理員可透過 `admin_set` → `leaderboard_sort_by` 設定）：

| Sort Key / 排序鍵 | Description / 描述 |
|--------------------|--------------------|
| `kills`            | EN: Total kills. zh-TW: 累計擊殺。 |
| `deaths`           | EN: Total deaths. zh-TW: 累計死亡。 |
| `damage_dealt`     | EN: Total damage output. zh-TW: 累計輸出傷害。 |
| `damage_taken`     | EN: Total damage received. zh-TW: 累計承受傷害。 |
