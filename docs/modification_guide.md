# Modification Guide · 修改指南

---

=== "English"

    ### 1. Add a new Weapon class (OOP)

    A weapon is a `@dataclass` that subclasses `Weapon` and (optionally) overrides `fire()`. Three steps:

    **Step 1.1 — Create the class** in `backend/models/weapon.py`:

    ```python
    @dataclass
    class SniperRifle(Weapon):
        name: str = "sniper"
        damage: float = 75.0
        fire_rate: float = 0.8        # 1 shot every 1.25 s
        bullet_speed: float = 1400.0
        bullet_ttl: float = 2.5
        # Default fire() is fine — single high-damage round.
    ```

    For non-trivial behaviour (multi-shot, piercing, charged…), override `fire()`:

    ```python
    @dataclass
    class BurstRifle(Weapon):
        name: str = "burst"
        damage: float = 6.0
        fire_rate: float = 2.5
        burst_count: int = 3
        burst_gap: float = math.radians(2)

        def fire(self, owner_id, x, y, angle, now):
            if not self.can_fire(now):
                return []
            self._last_shot = now
            return [
                Bullet.spawn(owner_id, x, y,
                             angle + (i - 1) * self.burst_gap,
                             self.damage, self.bullet_speed, self.bullet_ttl)
                for i in range(self.burst_count)
            ]
    ```

    **Step 1.2 — Export it** in `backend/models/__init__.py`:

    ```python
    from .weapon import Weapon, Pistol, Shotgun, Rifle, SniperRifle, BurstRifle
    __all__ = [..., "SniperRifle", "BurstRifle"]
    ```

    **Step 1.3 — Register it** in `backend/engine.py`:

    ```python
    WEAPON_REGISTRY = {
        "pistol": Pistol,
        "rifle": Rifle,
        "shotgun": Shotgun,
        "sniper": SniperRifle,
        "burst": BurstRifle,
    }
    ```

    **Step 1.4 — Add it to the lobby dropdown** in `frontend/src/App.jsx`:

    ```jsx
    <option value="sniper">Sniper</option>
    <option value="burst">Burst Rifle</option>
    ```

    No protocol change needed — the client sends `{type:"weapon", name:"sniper"}` and the server constructs the right class.

    ---

    ### 2. Change the map size

    The map is 2000 × 2000 pixels by default. It is set in **one place** in the backend and consumed by the client via the broadcast snapshot — no client constant to update.

    `backend/engine.py`:

    ```python
    WORLD_W = 4000     # was 2000
    WORLD_H = 4000     # was 2000
    ```

    The client reads `snap.world.{w,h}` from the broadcast and `drawWorldBounds()` automatically renders the new boundary. Spawn distribution scales with world size in `add_player()` already.

    > Tip: if you increase the map dramatically (>8000²) consider adding a spatial hash to `_resolve_bullet_hits` — see *Development Log → Things deferred*.

    ### 3. Change UI elements

    Three layers, choose the right one:

    **3a. Lobby (HTML/React)** — `frontend/src/App.jsx`. Standard JSX/CSS; the inline `styles` object holds the look.

    **3b. HUD (Canvas overlay)** — `drawHUD()` in `frontend/src/components/GameCanvas.jsx`. Drawn each frame; tweak font, position, panel colour:

    ```js
    function drawHUD(ctx, snap, me, status) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(12, 12, 240, 86);   // panel rect
      // ... text rows
    }
    ```

    **3c. Player / bullet visuals** — `drawPlayer()` and the inline bullet block in `GameCanvas.jsx`. Replace `ctx.fillRect` with `ctx.drawImage(...)` to use sprites; preload via `new Image()` once at module top.

    ### 4. Adjust the WebSocket Tick Rate

    The server tick rate controls simulation frequency *and* broadcast frequency.

    `backend/engine.py`:

    ```python
    TICK_RATE = 30          # change to 20 / 60 / etc.
    TICK_DT   = 1.0 / TICK_RATE
    ```

    Client-side input cadence is independent and lives in `frontend/src/components/GameCanvas.jsx`:

    ```js
    const INPUT_HZ = 30;
    const INPUT_DT = 1000 / INPUT_HZ;
    ```

    **Trade-offs**

    | Tick rate | Bandwidth (per player) | CPU | Smoothness | Notes |
    |---|---|---|---|---|
    | 20 Hz | low | low | noticeable jitter | OK for slow-paced games |
    | **30 Hz** (default) | medium | medium | good | sweet spot for this project |
    | 60 Hz | 2× | 2× | excellent | needs interpolation skipped, but client can keep up |
    | 120 Hz | 4× | 4× | excellent | only worth it with snapshot delta encoding |

    Practical guidance:

    - Going **above 30 Hz**: keep input loop at 30 Hz (don't spam the server) and consider implementing snapshot delta encoding to keep bandwidth manageable.
    - Going **below 30 Hz**: implement client-side interpolation (`render_t = now − INTERP_BUFFER`) or movement will look choppy.
    - Keep `TICK_DT` derived from `TICK_RATE` — never hard-code dt in `step()`.

=== "繁體中文"

    ### 1. 新增一個 Weapon 類別（OOP）

    武器就是繼承 `Weapon` 的 `@dataclass`，必要時覆寫 `fire()`，共三步：

    **1.1 — 建立類別** （`backend/models/weapon.py`）：

    ```python
    @dataclass
    class SniperRifle(Weapon):
        name: str = "sniper"
        damage: float = 75.0
        fire_rate: float = 0.8        # 每 1.25 秒一發
        bullet_speed: float = 1400.0
        bullet_ttl: float = 2.5
        # 預設 fire() 即可 — 單發高傷害。
    ```

    若行為較特殊（多發、穿透、蓄力…），覆寫 `fire()`：

    ```python
    @dataclass
    class BurstRifle(Weapon):
        name: str = "burst"
        damage: float = 6.0
        fire_rate: float = 2.5
        burst_count: int = 3
        burst_gap: float = math.radians(2)

        def fire(self, owner_id, x, y, angle, now):
            if not self.can_fire(now):
                return []
            self._last_shot = now
            return [
                Bullet.spawn(owner_id, x, y,
                             angle + (i - 1) * self.burst_gap,
                             self.damage, self.bullet_speed, self.bullet_ttl)
                for i in range(self.burst_count)
            ]
    ```

    **1.2 — 在 `backend/models/__init__.py` 匯出**：

    ```python
    from .weapon import Weapon, Pistol, Shotgun, Rifle, SniperRifle, BurstRifle
    __all__ = [..., "SniperRifle", "BurstRifle"]
    ```

    **1.3 — 在 `backend/engine.py` 註冊**：

    ```python
    WEAPON_REGISTRY = {
        "pistol": Pistol,
        "rifle": Rifle,
        "shotgun": Shotgun,
        "sniper": SniperRifle,
        "burst": BurstRifle,
    }
    ```

    **1.4 — 在 `frontend/src/App.jsx` 大廳新增選項**：

    ```jsx
    <option value="sniper">Sniper</option>
    <option value="burst">Burst Rifle</option>
    ```

    通訊協定不需改動 — 客戶端發送 `{type:"weapon", name:"sniper"}`，伺服器就會建立正確的子類。

    ---

    ### 2. 變更地圖大小

    地圖預設為 2000 × 2000 像素。**只需要改後端一處**，客戶端會從廣播快照取得，不必同步常數。

    `backend/engine.py`：

    ```python
    WORLD_W = 4000     # 原本 2000
    WORLD_H = 4000     # 原本 2000
    ```

    客戶端從快照讀 `snap.world.{w,h}`，`drawWorldBounds()` 會自動畫出新邊界；`add_player()` 內出生點分佈也會跟著放大。

    > 提示：若大幅放大（>8000²），請考慮為 `_resolve_bullet_hits` 加上空間雜湊（spatial hash），詳見《Development Log → 刻意延後的事項》。

    ### 3. 修改 UI 元素

    三個層次，按需求選擇：

    **3a. 大廳（HTML/React）** — `frontend/src/App.jsx`。標準 JSX/CSS，外觀由內聯 `styles` 物件控制。

    **3b. HUD（Canvas overlay）** — `frontend/src/components/GameCanvas.jsx` 內的 `drawHUD()`。每幀繪製，可調字體、位置、面板顏色：

    ```js
    function drawHUD(ctx, snap, me, status) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(12, 12, 240, 86);   // 面板矩形
      // ... 文字列
    }
    ```

    **3c. 玩家／子彈外觀** — `GameCanvas.jsx` 中的 `drawPlayer()` 與子彈 inline 區塊。把 `ctx.fillRect` 換成 `ctx.drawImage(...)` 即可使用精靈圖；於模組頂端用 `new Image()` 預載一次即可。

    ### 4. 調整 WebSocket Tick Rate

    伺服器的 tick rate 同時決定模擬頻率與廣播頻率。

    `backend/engine.py`：

    ```python
    TICK_RATE = 30          # 可改為 20 / 60 等
    TICK_DT   = 1.0 / TICK_RATE
    ```

    客戶端的輸入頻率獨立設定，位於 `frontend/src/components/GameCanvas.jsx`：

    ```js
    const INPUT_HZ = 30;
    const INPUT_DT = 1000 / INPUT_HZ;
    ```

    **取捨對照**

    | Tick rate | 頻寬（每玩家） | CPU | 流暢度 | 備註 |
    |---|---|---|---|---|
    | 20 Hz | 低 | 低 | 可見抖動 | 慢節奏遊戲可接受 |
    | **30 Hz**（預設） | 中 | 中 | 良好 | 本專案最佳平衡點 |
    | 60 Hz | 2× | 2× | 優秀 | 客戶端通常跟得上，但頻寬翻倍 |
    | 120 Hz | 4× | 4× | 優秀 | 唯有實作差分編碼後才划算 |

    實務建議：

    - **超過 30 Hz**：輸入迴圈仍維持 30 Hz（不要洗 server），並考慮加入快照差分編碼壓縮頻寬。
    - **低於 30 Hz**：必須實作客戶端插值（`render_t = now − INTERP_BUFFER`），否則移動會卡頓。
    - `TICK_DT` 必須由 `TICK_RATE` 推導，不要在 `step()` 內寫死 dt。
