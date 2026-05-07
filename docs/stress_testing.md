# Stress Testing / 壓力測試

> **Phase 11** — Admin-controlled stress testing system with automatic cleanup.
>
> **Phase 11** — 管理員控制的壓力測試系統，含自動清理機制。

---

## Architecture Overview / 架構概觀

### EN

The stress-testing system allows administrators to simulate 1–100 concurrent players (bots) to load-test the server without needing real clients. The entire lifecycle is controlled from the Admin Panel's "Server Stress Test" section.

```
Admin Panel (React)
    ↓  WebSocket: { type: "admin_stress_test", bot_count: N, duration_seconds: S }
main.py  (FastAPI WS handler)
    ↓  engine.stress_test_start(N, S)
engine.py  (GameEngine)
    ├── Instantly spawns N × BotPlayer instances
    ├── Tracks their IDs in _stress_test_bot_ids
    └── Spawns asyncio background task → _stress_test_cleanup()
                                            ↓
                                      await asyncio.sleep(S)
                                            ↓
                                      Remove all stress-test bots
                                      Purge their bullets (GC)
                                      Free RAM / CPU
```

### zh-TW

壓力測試系統允許管理員模擬 1–100 個同時在線的玩家（Bot），用以負載測試伺服器，無需真實客戶端。整個生命週期由管理員面板的「伺服器壓力測試」區域控制。

```
管理員面板 (React)
    ↓  WebSocket: { type: "admin_stress_test", bot_count: N, duration_seconds: S }
main.py  (FastAPI WS 處理器)
    ↓  engine.stress_test_start(N, S)
engine.py  (GameEngine)
    ├── 立即生成 N 個 BotPlayer 實例
    ├── 將其 ID 追蹤於 _stress_test_bot_ids
    └── 生成 asyncio 背景任務 → _stress_test_cleanup()
                                            ↓
                                      await asyncio.sleep(S)
                                            ↓
                                      移除所有壓測 Bot
                                      清除其子彈 (GC)
                                      釋放 RAM / CPU
```

---

## How the Auto-Cleanup Prevents Memory Leaks / 自動清理如何防止記憶體洩漏

### EN

1. **Deterministic Lifetime**: Every stress-test batch has a fixed `duration_seconds` timer. The `asyncio` background task (`_stress_test_cleanup`) sleeps for exactly that duration, then unconditionally removes every bot from that batch.

2. **Eager Bullet Purge**: When bots are removed, their in-flight bullets are immediately filtered out of `engine.bullets`, preventing stale projectiles from lingering in memory or causing phantom hits.

3. **Cancellation Safety**: If the admin starts a new stress test while one is still running, the old cleanup task is cancelled via `task.cancel()`. The `finally` block in `_stress_test_cleanup` ensures the old batch's bots are removed immediately — no orphaned bots.

4. **Manual Override**: The "KICK ALL BOTS" button in the Danger Zone also clears `_stress_test_bot_ids`, providing a manual escape hatch if the timer is too long.

### zh-TW

1. **確定性生命週期**：每批壓測 Bot 都有固定的 `duration_seconds` 計時器。`asyncio` 背景任務（`_stress_test_cleanup`）精確等待該時間後，無條件移除該批次所有 Bot。

2. **積極清除子彈**：移除 Bot 時，其飛行中的子彈會立即從 `engine.bullets` 中過濾掉，防止過期彈頭滯留在記憶體中或造成幽靈命中。

3. **取消安全性**：若管理員在現有壓測進行中啟動新的壓測，舊的清理任務會透過 `task.cancel()` 取消。`_stress_test_cleanup` 中的 `finally` 區塊確保舊批次的 Bot 立即被移除 — 不會有孤兒 Bot。

4. **手動覆寫**：危險操作區的「踢出所有 BOT」按鈕也會清除 `_stress_test_bot_ids`，提供計時器過長時的手動逃生口。

---

## Configuration / 設定

| Parameter / 參數 | Default / 預設 | Range / 範圍 | Description / 說明 |
|---|---|---|---|
| `bot_count` | 50 | 1–100 | Number of stress-test bots to spawn / 要生成的壓測 Bot 數量 |
| `duration_seconds` | 60 | 5–600 | Seconds before auto-cleanup / 自動清理前的秒數 |

> **Note / 注意**: The 100-bot cap is a safety guard for Railway's Hobby tier (512 MB RAM). Each bot consumes roughly 2–5 KB of memory for its `Player` state + weapon. 100 bots ≈ 500 KB, which is negligible. The main load comes from the simulation tick and WebSocket broadcast to connected viewers.
>
> 100 Bot 上限是 Railway Hobby 方案（512 MB RAM）的安全保護。每個 Bot 約消耗 2–5 KB 記憶體（Player state + 武器）。100 個 Bot ≈ 500 KB，影響微乎其微。主要負載來自模擬 tick 和對已連線觀看者的 WebSocket 廣播。

---

## Usage / 使用方式

### EN

1. Open the Admin Panel (5-click logo trigger in lobby).
2. Scroll to the **"Server Stress Test"** card in the right column.
3. Set the desired **Bot Count** (default: 50) and **Duration** (default: 60s).
4. Click **"START STRESS TEST"** — a confirmation dialog will appear.
5. Observe the player roster fill up with stress bots.
6. After the timer expires, all stress-test bots are automatically removed.

### zh-TW

1. 打開管理員面板（大廳 Logo 連點 5 下觸發）。
2. 捲動到右側欄位的 **「伺服器壓力測試」** 卡片。
3. 設定想要的 **機器人數量**（預設：50）和 **持續時間**（預設：60 秒）。
4. 點擊 **「啟動壓力測試」** — 會出現確認對話框。
5. 觀察玩家名單中出現壓測 Bot。
6. 計時器到期後，所有壓測 Bot 會自動移除。

---

## Source Files / 原始碼檔案

| File / 檔案 | Changes / 變更 |
|---|---|
| [`engine.py`](../backend/engine.py) | `stress_test_start()`, `_stress_test_cleanup()`, `_stress_test_bot_ids` |
| [`main.py`](../backend/main.py) | `admin_stress_test` WS message handler (both admin paths) |
| [`AdminPanel.jsx`](../frontend/src/components/AdminPanel.jsx) | Stress test UI section with inputs + button |
| [`i18n.jsx`](../frontend/src/i18n.jsx) | Bilingual keys: `stressTest`, `stressTestDesc`, etc. |
