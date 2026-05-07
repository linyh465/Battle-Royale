# Deployment Guide — Railway 一鍵部署 (Phase 9)

> **EN:** Production deployment guide for the Battle Royale stack on
> [Railway](https://railway.app/). Uses a **single container** strategy
> (FastAPI serves the React SPA), an **idle-pause** game loop that consumes
> zero CPU when the lobby is empty, and a **minified WebSocket wire format**
> to keep egress under the Hobby plan.
>
> **zh-TW：** Battle Royale 部署到 [Railway](https://railway.app/) 的生產指南。
> 採用「單一容器」策略（FastAPI 直接服務 React SPA）、
> 「閒置暫停」遊戲迴圈（沒人時 CPU 完全 0%），以及
> 「短鍵 WebSocket 線上格式」，把 Hobby Plan 的出站流量壓到最小。

---

## 1. Architecture — 單一容器策略

### EN
We deploy the FastAPI backend **and** the built React bundle inside the same
Docker container, served by the same Uvicorn process. Railway charges per
service, so collapsing two services into one is the single biggest cost lever.

```
┌─────────────────── Single Railway Container ───────────────────┐
│                                                                │
│  Uvicorn (asyncio)                                             │
│   ├── /ws            → GameEngine WebSocket                    │
│   ├── /health        → liveness probe                          │
│   ├── /api/lan-info  → LAN helper (no-op in prod)              │
│   ├── /assets/*      → StaticFiles (Vite-hashed JS/CSS)        │
│   └── /*  (catch-all)→ FileResponse(index.html)  [SPA fallback]│
│                                                                │
│  Built once at image-build time:  /app/frontend/dist           │
└────────────────────────────────────────────────────────────────┘
```

The mount logic lives in [`backend/main.py`](../backend/main.py) under
`_resolve_frontend_dist()` and the `spa_fallback` route. Resolution order:

1. `$FRONTEND_DIST_DIR` env override (the Dockerfile sets this).
2. `../frontend/dist` relative to `main.py` (local production layout).
3. `/app/frontend/dist` (Docker layout).

If none exist, the mount is silently skipped — local `npm run dev` still
serves the SPA on `http://localhost:5173` via Vite's WebSocket proxy.

### zh-TW
我們把 FastAPI 後端**與**已 build 完成的 React bundle 放進同一個 Docker
容器，由同一支 Uvicorn 行程提供服務。Railway 是「每個服務都計費」的，
合併成單一容器是最直接的省錢手段。

```
┌─────────────────── 單一 Railway 容器 ──────────────────────────┐
│                                                                │
│  Uvicorn (asyncio)                                             │
│   ├── /ws            → GameEngine WebSocket                    │
│   ├── /health        → 存活探針                                │
│   ├── /api/lan-info  → LAN 輔助（生產環境無作用）              │
│   ├── /assets/*      → StaticFiles（Vite hash 過的 JS/CSS）    │
│   └── /*  (catch-all)→ FileResponse(index.html)  [SPA fallback]│
│                                                                │
│  影像 build 階段預先產出：/app/frontend/dist                  │
└────────────────────────────────────────────────────────────────┘
```

掛載邏輯在 [`backend/main.py`](../backend/main.py) 的
`_resolve_frontend_dist()` 與 `spa_fallback` 路由。解析順序：

1. `$FRONTEND_DIST_DIR` 環境變數覆寫（Dockerfile 已設定）。
2. 相對於 `main.py` 的 `../frontend/dist`（本機生產佈局）。
3. `/app/frontend/dist`（Docker 佈局）。

三者都不存在時直接略過掛載 — 本機 `npm run dev` 仍可走 Vite 的 WS proxy
在 `http://localhost:5173` 開啟前端。

---

## 2. Idle-Pause Game Loop — 閒置暫停

### EN
The simulation loop in [`backend/engine.py`](../backend/engine.py) used to
spin at the full tick rate even with zero players. On Railway that burns
metered CPU minutes for nothing.

The new `GameEngine.run()` blocks on an `asyncio.Event` whenever
`self.players` is empty. The event is set inside `add_player()` /
`add_bot()`, so the moment the first connection joins the loop wakes up
and resumes ticking. While idle, the engine also flushes any leftover
bullets so a brand-new match starts clean.

```python
while self._running:
    if not self.players:
        if self.bullets:
            self.bullets = []   # flush stale projectiles
        self._wake.clear()
        await self._wake.wait()  # 0% CPU until add_player() sets the event
        last = time.perf_counter()
        continue
    # … normal tick …
```

Wake-up triggers:
- A real player connects via the `join` handshake → `add_player()` → wake.
- An admin enables bots (`bots_enabled=true`, `bot_count>0`) → `add_bot()`
  → wake.
- Director / admin connects alone? → **no wake.** They observe an empty
  arena until a real player or bot arrives.

### zh-TW
[`backend/engine.py`](../backend/engine.py) 的模擬 loop，原本就算 0 名玩家也
會以滿 tick 頻率空轉。Railway 會把這段空轉計入 CPU 計費 — 純浪費錢。

新版 `GameEngine.run()` 在 `self.players` 為空時改為 `await` 一個
`asyncio.Event`。這個事件會在 `add_player()` 與 `add_bot()` 內被 set，
所以第一個連線一進來就會喚醒 loop 繼續運轉。閒置期間還會順手清掉殘留子彈，
讓新一局乾淨開始。

```python
while self._running:
    if not self.players:
        if self.bullets:
            self.bullets = []   # 清除殘留子彈
        self._wake.clear()
        await self._wake.wait()  # CPU 0% 直到 add_player() set 事件
        last = time.perf_counter()
        continue
    # … 一般 tick …
```

喚醒觸發點：
- 真人玩家透過 `join` 握手連線 → `add_player()` → 喚醒。
- 管理員打開 bot（`bots_enabled=true` 且 `bot_count>0`）→ `add_bot()` → 喚醒。
- 只有導播 / 管理員在線？→ **不會喚醒。** 他們會看到空場景，直到第一個玩家或 bot 加入。

> **GC 強化 / GC tightening：** `remove_player()` 現在會立即把該玩家名下
> 所有子彈丟掉，避免一名退場玩家的子彈在 RAM 裡飄到自然 TTL 結束。

---

## 3. Network Egress Optimization — 出站頻寬節流

### EN
Two changes in concert:

#### 3.1 Configurable tick rate
Set via the `TICK_RATE_HZ` environment variable, default `20` (was hard-coded
to `30`). Reading code:

```python
def _read_tick_rate() -> int:
    try:
        v = int(os.environ.get("TICK_RATE_HZ", "20"))
        return max(5, min(60, v))
    except (TypeError, ValueError):
        return 20
```

Lower tick → less broadcast volume. The Canvas already interpolates between
snapshots so 20 Hz looks just as smooth as 30 Hz from the player's POV.
Tune to taste in Railway's Variables tab.

#### 3.2 Minified wire format
The broadcast payload now uses single-character keys. Shape:

| Top-level | Meaning            | Player keys      | Meaning             | Bullet keys | Meaning            |
| --------- | ------------------ | ---------------- | ------------------- | ----------- | ------------------ |
| `type`    | always `"state"`   | `i`              | id                  | `i`         | id                 |
| `t`       | tick               | `nm`             | name                | `x`,`y`     | position           |
| `n`       | server `now`       | `x`,`y`          | position            | `o`         | owner_id           |
| `wo`      | world `{w,h}`      | `h`              | hp                  | `dm`        | damage             |
| `st`      | settings (verbose) | `mh`             | max_hp              | `al`        | alive (1/0)        |
| `go`      | game_over          | `a`              | angle               |             |                    |
| `tr`      | time_remaining     | `k`,`d`          | kills, deaths       |             |                    |
| `rs`      | reset_seq          | `dd`,`dt`        | dmg_dealt / taken   |             |                    |
| `ps`      | players[]          | `wp`             | weapon name         |             |                    |
| `bs`      | bullets[]          | `s`              | state string        |             |                    |
|           |                    | `ra`             | respawn_at          |             |                    |
|           |                    | `b`              | is_bot (1/0)        |             |                    |
|           |                    | `tm`             | team                |             |                    |
|           |                    | `kn`,`kw`        | killed_by_*         |             |                    |
|           |                    | `al`             | alive (1/0)         |             |                    |

Width / height never travel — they're constants restored client-side
(player 28×28, bullet 6×6).

`json.dumps(..., separators=(",", ":"))` strips whitespace from the encoded
string for a few extra bytes saved per broadcast.

The frontend doesn't need a giant rewrite: a single helper
[`frontend/src/hooks/expandSnapshot.js`](../frontend/src/hooks/expandSnapshot.js)
re-hydrates the long-key shape that rendering code expects, and it's wired
into all three WS receivers (player hook, admin WS in `App.jsx`,
director via the same hook). The helper is a no-op when an old long-key
payload arrives, so rolling deploys can't break either side.

### zh-TW
兩個變動互相搭配：

#### 3.1 可設定的 tick 頻率
透過 `TICK_RATE_HZ` 環境變數調整，預設 `20`（原本硬編碼 `30`）。讀取邏輯：

```python
def _read_tick_rate() -> int:
    try:
        v = int(os.environ.get("TICK_RATE_HZ", "20"))
        return max(5, min(60, v))
    except (TypeError, ValueError):
        return 20
```

tick 越低 → 廣播量越少。Canvas 已有 snapshot 內插，玩家肉眼下 20 Hz 與
30 Hz 看不出差別。請在 Railway 的 Variables 分頁依需求微調。

#### 3.2 短鍵線上格式
廣播封包改用單字元鍵名。對照表：

| 最上層 | 意義                | 玩家鍵      | 意義                    | 子彈鍵   | 意義          |
| ------ | ------------------- | ----------- | ----------------------- | -------- | ------------- |
| `type` | 永遠為 `"state"`    | `i`         | id                      | `i`      | id            |
| `t`    | tick                | `nm`        | 名稱                    | `x`,`y`  | 座標          |
| `n`    | 伺服器 `now`        | `x`,`y`     | 座標                    | `o`      | 擁有者 id     |
| `wo`   | 世界 `{w,h}`        | `h`         | hp                      | `dm`     | 傷害          |
| `st`   | settings（長鍵）    | `mh`        | max_hp                  | `al`     | 是否存活(1/0) |
| `go`   | game_over           | `a`         | 角度                    |          |               |
| `tr`   | 剩餘時間            | `k`,`d`     | 擊殺 / 死亡             |          |               |
| `rs`   | reset_seq           | `dd`,`dt`   | 輸出 / 承受傷害         |          |               |
| `ps`   | 玩家陣列            | `wp`        | 武器名稱                |          |               |
| `bs`   | 子彈陣列            | `s`         | 狀態字串                |          |               |
|        |                     | `ra`        | respawn_at              |          |               |
|        |                     | `b`         | 是否 Bot（1/0）         |          |               |
|        |                     | `tm`        | 隊伍                    |          |               |
|        |                     | `kn`,`kw`   | killed_by_*             |          |               |
|        |                     | `al`        | 是否存活（1/0）         |          |               |

寬高不再線上傳輸 — 由前端常數還原（玩家 28×28、子彈 6×6）。

`json.dumps(..., separators=(",", ":"))` 會把 JSON 內的多餘空白拿掉，
每筆廣播又能再省幾個 byte。

前端不需要大改：單一 helper
[`frontend/src/hooks/expandSnapshot.js`](../frontend/src/hooks/expandSnapshot.js)
會把短鍵還原為渲染端期望的長鍵結構，並且接到三個 WS 接收點（玩家
hook、`App.jsx` 的 admin WS、以及共用同一 hook 的導播）。
若收到舊版長鍵格式，helper 會 no-op 直接放行，部署滾動更新不會兩邊打架。

---

## 4. Step-by-step — Connect GitHub → Railway

### EN
1. **Push the project to GitHub** (public or private repo — Railway supports
   both via your GitHub OAuth).
2. **Create a Railway account** → click **New Project** → **Deploy from
   GitHub repo** → pick this repository.
3. Railway auto-detects the `Dockerfile` at the repo root and uses it as the
   build pipeline. Wait for the build (~3–5 min the first time, ~30 s on
   incremental rebuilds thanks to layer caching).
4. Open the service → **Settings → Networking → Generate Domain**. Railway
   issues a `*.up.railway.app` URL.
5. **Variables tab** — set as needed:
   - `TICK_RATE_HZ` — `20` (lower for tighter budget; e.g. `15` if you
     anticipate >50 concurrent players).
   - `PORT` is **injected automatically** by Railway. Do not set manually.
   - `FRONTEND_DIST_DIR` is already pre-set inside the Dockerfile to
     `/app/frontend/dist`; no override needed.
6. Open the generated domain in your browser. You should see the cyberpunk
   lobby. Connect a phone to the same URL — the QR code will already show
   the deployed origin.
7. **Verify health:** `curl https://<your-domain>/health` →
   `{"ok": true, "players": 0, "bullets": 0}`.

#### Idle-pause smoke test
1. Disconnect every client. Wait 30 s.
2. Open Railway's **Metrics** tab → **CPU usage** should drop to ~0%.
3. Reconnect a client → CPU spikes back up within one tick (~50 ms at
   20 Hz). The loop is awake.

### zh-TW
1. **把專案推上 GitHub**（公開 / 私人皆可，Railway 都能透過你的 GitHub
   OAuth 讀取）。
2. **註冊 Railway** → 點 **New Project** → **Deploy from GitHub repo** →
   選擇此 repo。
3. Railway 會自動偵測 repo 根目錄的 `Dockerfile` 並當作 build pipeline。
   等 build 完成（首次約 3~5 分鐘，後續因 layer cache 約 30 秒）。
4. 開啟服務 → **Settings → Networking → Generate Domain**，Railway 會
   產生一組 `*.up.railway.app` 網址。
5. **Variables 分頁**依需求設定：
   - `TICK_RATE_HZ` — `20`（預期 >50 人同時在線可降到 `15` 以省頻寬）。
   - `PORT` Railway 會**自動注入**，不要手動設定。
   - `FRONTEND_DIST_DIR` 已在 Dockerfile 預先寫成 `/app/frontend/dist`，
     不需另外覆寫。
6. 用瀏覽器打開生成的網址，應該看到賽博龐克大廳。手機掃 QR Code 也會直接
   指向部署網址。
7. **健康檢查：** `curl https://<your-domain>/health` →
   `{"ok": true, "players": 0, "bullets": 0}`。

#### 閒置暫停冒煙測試
1. 把所有 client 斷線，等 30 秒。
2. 打開 Railway 的 **Metrics** 分頁 → **CPU usage** 應該掉到接近 0%。
3. 重新連線 → CPU 在一個 tick 內（20 Hz 約 50 ms）就會跳回正常值，代表
   loop 已被喚醒。

---

## 5. Local production parity — 本機跑生產 build

### EN
You don't need Railway to test the production stack. From the repo root:

```bash
docker build -t battle-royale:prod .
docker run --rm -p 8000:8000 -e TICK_RATE_HZ=20 battle-royale:prod
# → http://localhost:8000
```

Or, without Docker:

```bash
cd frontend && npm install && npm run build && cd ..
cd backend && pip install -r requirements.txt
TICK_RATE_HZ=20 uvicorn main:app --host 0.0.0.0 --port 8000
```

`main.py` will pick up `../frontend/dist` automatically.

### zh-TW
不需要 Railway 也能跑生產堆疊。在 repo 根目錄：

```bash
docker build -t battle-royale:prod .
docker run --rm -p 8000:8000 -e TICK_RATE_HZ=20 battle-royale:prod
# → http://localhost:8000
```

或不用 Docker：

```bash
cd frontend && npm install && npm run build && cd ..
cd backend && pip install -r requirements.txt
TICK_RATE_HZ=20 uvicorn main:app --host 0.0.0.0 --port 8000
```

`main.py` 會自動找到 `../frontend/dist`。

---

## 6. Cost & sizing notes — 成本與容量備忘

### EN
- **Hobby tier** ($5/mo) gives ~500 hours and 8 GB egress. With idle-pause
  enabled, a server with no players consumes ~0% CPU, so the bottleneck
  becomes egress — minified wire format buys you roughly 35–45% bandwidth
  reduction vs. the previous descriptive-key payload.
- Empirical estimate at 20 Hz × 40 players × 1 viewer-each:
  `~1.0–1.2 KB/tick × 20 = ~20–24 KB/s/viewer`. 60 minutes of full match
  ≈ 70–85 MB egress per viewer. 8 GB / month ≈ ~95 player-hours of
  full lobby gameplay (plenty of headroom for 40–60 concurrent players,
  intermittent sessions).
- If you run into the egress ceiling: drop `TICK_RATE_HZ` to `15` (`-25%`)
  before considering an upgrade.

### zh-TW
- **Hobby Plan**（$5/月）約有 500 小時與 8 GB 出站流量。開啟閒置暫停後，
  沒人時 CPU ≈ 0%，瓶頸會落在出站流量 — 短鍵格式相比舊的描述性鍵名約可省
  35–45% 頻寬。
- 大致估算：20 Hz × 40 名玩家 × 各帶 1 名觀眾 ≈
  `~1.0–1.2 KB/tick × 20 = ~20–24 KB/s/觀眾`。
  滿場 60 分鐘 ≈ 每位觀眾 70–85 MB。8 GB / 月約等於 ~95 個滿員 player-hour
  （40–60 人同時在線 + 間歇開局，餘裕充足）。
- 真的撞到出站上限時：先把 `TICK_RATE_HZ` 降到 `15`（再省 25%），不用急著升 Plan。

---

## 7. Files touched in Phase 9 — 變更清單

### EN / zh-TW
| File | EN | zh-TW |
| ---- | -- | ----- |
| [`backend/engine.py`](../backend/engine.py) | Idle-pause loop, configurable tick rate, minified snapshot, eager bullet GC | 閒置暫停 loop、可調 tick、短鍵 snapshot、即時清子彈 |
| [`backend/main.py`](../backend/main.py) | StaticFiles mount + SPA fallback | 靜態檔掛載 + SPA fallback |
| [`frontend/src/hooks/expandSnapshot.js`](../frontend/src/hooks/expandSnapshot.js) | New helper — short-key → long-key | 新增 helper：短鍵 → 長鍵展開 |
| [`frontend/src/hooks/useGameSocket.js`](../frontend/src/hooks/useGameSocket.js) | Calls expandSnapshot on every state msg | 每筆 state 都呼叫 expandSnapshot |
| [`frontend/src/App.jsx`](../frontend/src/App.jsx) | Admin WS now expands snapshots | Admin WS 也走 expandSnapshot |
| [`Dockerfile`](../Dockerfile) | New — multi-stage Node + Python build | 新增 — Node + Python 多階段 build |
| [`.dockerignore`](../.dockerignore) | New — keep build context lean | 新增 — 縮小 build context |
