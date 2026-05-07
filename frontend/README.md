# Battle Royale — Frontend

## EN

React 18 + Vite + native Canvas client. Decoupled from React render — the WebSocket snapshot is stored in a `useRef` and the canvas is repainted in a `requestAnimationFrame` loop at ~60 FPS.

### Layout
```
frontend/
├── index.html
├── package.json
├── vite.config.js          # /ws proxy -> ws://localhost:8000
└── src/
    ├── main.jsx
    ├── App.jsx              # Lobby → GameCanvas
    ├── hooks/
    │   └── useGameSocket.js # WS lifecycle, writes snapshots to a ref
    └── components/
        └── GameCanvas.jsx   # rAF render loop + input capture
```

### Run
```bash
npm install
npm run dev    # http://localhost:5173 (proxies /ws to backend on :8000)
```

### Architecture decisions
- **No setState per tick.** `useGameSocket` mutates `stateRef.current` directly. React only re-renders on connection-status changes, never on game state.
- **rAF render loop.** `GameCanvas` reads `stateRef.current` each frame; client renders at the monitor's refresh rate while the server ticks at 30 Hz.
- **Input loop at 30 Hz.** WASD → unit vector, mouse → screen-space angle converted to world space using the local player's position.
- **Camera.** Local player centered; bullets/players/grid offset by camera. World bounds drawn red.

### Controls
- `W A S D` move
- Mouse aim, **left-click hold** to fire

---

## zh-TW

React 18 + Vite + 原生 Canvas 客戶端。為避免 React 重渲染造成卡頓，WebSocket 快照寫入 `useRef`，畫面以 `requestAnimationFrame` 迴圈以 ~60 FPS 重繪。

### 結構
```
frontend/
├── index.html
├── package.json
├── vite.config.js          # /ws 代理至 ws://localhost:8000
└── src/
    ├── main.jsx
    ├── App.jsx              # 大廳 → 進入 GameCanvas
    ├── hooks/
    │   └── useGameSocket.js # WebSocket 生命週期，將快照寫入 ref
    └── components/
        └── GameCanvas.jsx   # rAF 繪圖迴圈 + 輸入監聽
```

### 啟動方式
```bash
npm install
npm run dev    # http://localhost:5173 （/ws 代理至後端 :8000）
```

### 架構決策
- **每 tick 不使用 setState**：`useGameSocket` 直接寫入 `stateRef.current`。React 僅在連線狀態改變時重渲染，遊戲狀態完全不觸發。
- **rAF 繪圖迴圈**：`GameCanvas` 每幀讀取 `stateRef.current`；客戶端以螢幕更新率作畫，後端固定 30 Hz 模擬。
- **30 Hz 輸入迴圈**：WASD 轉成單位方向向量；滑鼠座標經由「本機玩家位置」轉成世界座標角度後傳出。
- **攝影機**：以本地玩家為中心，子彈／其他玩家／格線皆以攝影機偏移繪製，世界邊界以紅框標示。

### 操作方式
- `W A S D` 移動
- 滑鼠瞄準，**長按左鍵**射擊
