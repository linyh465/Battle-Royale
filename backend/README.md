# Battle Royale — Backend

## EN

FastAPI + WebSocket authoritative server for a 2D top-down battle royale.

### Layout
```
backend/
├── main.py          # FastAPI app + /ws WebSocket endpoint
├── engine.py        # 30 Hz game loop, AABB collisions, broadcast
├── models/
│   ├── game_object.py   # GameObject base + AABB
│   ├── player.py        # Player (HP, movement, input)
│   ├── weapon.py        # Weapon base + Pistol / Rifle / Shotgun
│   └── bullet.py        # Bullet projectile
└── requirements.txt
```

### Run
```bash
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Wire protocol
Client → Server:
- `{"type":"join","name":"alice","weapon":"rifle"}`
- `{"type":"input","dx":1,"dy":0,"angle":0.7,"fire":true}`
- `{"type":"weapon","name":"shotgun"}`
- `{"type":"ping","t":<ms>}`

Server → Client:
- `{"type":"welcome","player_id":"..."}`
- `{"type":"state","tick":N,"world":{...},"players":[...],"bullets":[...]}` — broadcast at 30 Hz
- `{"type":"pong","t":<ms>}`

### Design notes
- **Authoritative server**: clients send intent (dx/dy/angle/fire), server simulates.
- **Tick**: 30 Hz fixed step via `asyncio.sleep`; `dt` measured per tick to stay robust.
- **Collisions**: AABB intersection in `GameObject.collides_with`.
- **Polymorphism**: `Weapon.fire()` overridden by `Shotgun` for spread pellets.
- **State broadcast**: full snapshot per tick (delta encoding deferred to Phase 2 if needed).

---

## zh-TW

FastAPI + WebSocket 權威伺服器，用於 2D 俯視角大逃殺遊戲。

### 結構
```
backend/
├── main.py          # FastAPI 應用程式 + /ws WebSocket 端點
├── engine.py        # 30 Hz 遊戲迴圈、AABB 碰撞、狀態廣播
├── models/
│   ├── game_object.py   # GameObject 基底類別 + AABB
│   ├── player.py        # Player（HP、移動、輸入）
│   ├── weapon.py        # Weapon 基底類別 + Pistol / Rifle / Shotgun
│   └── bullet.py        # Bullet 子彈
└── requirements.txt
```

### 啟動方式
```bash
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 通訊協定
客戶端 → 伺服器：
- `{"type":"join","name":"alice","weapon":"rifle"}`：加入房間
- `{"type":"input","dx":1,"dy":0,"angle":0.7,"fire":true}`：每幀輸入
- `{"type":"weapon","name":"shotgun"}`：切換武器
- `{"type":"ping","t":<ms>}`：延遲量測

伺服器 → 客戶端：
- `{"type":"welcome","player_id":"..."}`：分配玩家 ID
- `{"type":"state",...}`：30 Hz 廣播全世界快照
- `{"type":"pong","t":<ms>}`：延遲回應

### 設計重點
- **權威伺服器**：客戶端只傳意圖（方向、瞄準、開火），所有模擬在伺服器完成，避免作弊。
- **Tick 機制**：固定 30 Hz，使用實際量測的 `dt` 確保模擬穩定。
- **碰撞偵測**：AABB（軸對齊邊界框）相交檢查，實作於 `GameObject.collides_with`。
- **多型**：`Weapon.fire()` 為基底方法，`Shotgun` 覆寫產生散射彈。
- **狀態廣播**：每 tick 廣播完整快照（差分壓縮延後到 Phase 2 視效能再加）。
