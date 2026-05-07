# UI Components — Mini-Map & QR Code

---

=== "English"

    ### 1. QR Code on the lobby screen

    **Goal.** A classmate on the same Wi-Fi opens their phone camera, scans the QR, and lands directly in the lobby — no typing required.

    **How it works.**

    1. **Backend** exposes `GET /api/lan-info` (`backend/main.py`):
       - Opens a UDP socket toward `8.8.8.8:80`. The OS chooses the outbound interface and `getsockname()` returns the LAN-facing IP. No packet is actually sent.
       - Returns `{ "lan_ip": "192.168.x.y", "vite_port": 5173, "client_url": "http://192.168.x.y:5173" }`.
    2. **Vite dev server** binds `0.0.0.0` (`vite --host` in `package.json`) so phones can reach it.
    3. **Vite proxy** forwards `/api/*` and `/ws` to the FastAPI server (`vite.config.js`), so the phone's single connection to `:5173` covers both static assets and the API.
    4. **Lobby (`App.jsx`)** fetches `/api/lan-info` once on mount and renders `<QRCodeSVG value={clientUrl} />` from `qrcode.react`.

    **Why SVG instead of canvas QR.** SVG scales cleanly under DPR and exports to print/screenshot without aliasing.

    **Failure modes.**

    | Scenario | What happens | Mitigation |
    |---|---|---|
    | Server cannot reach `8.8.8.8` | Falls back to `127.0.0.1` | Lobby falls back to `location.host` |
    | Phone on different Wi-Fi / VPN | QR resolves but cannot connect | Make sure host & phone are on the same SSID; firewalls open on TCP 5173/8000 |
    | Multiple network interfaces (VM, VPN) | UDP trick may pick the wrong one | Hard-code the desired IP in `detect_lan_ip()` for that environment |

    ---

    ### 2. Global Mini-Map (top-left)

    **Goal.** Show the entire 2000×2000 world in a 180×180 panel: local player as a green dot, opponents as red dots, and a viewport rectangle indicating what the main camera currently shows.

    **Where it lives.**

    - Drawn directly in the main canvas inside the `requestAnimationFrame` loop — `drawMinimap(ctx, snap, me, W, H)` in `frontend/src/components/GameCanvas.jsx`.
    - **No separate canvas, no React component, no DOM node.** This is the cheapest possible implementation: every frame we already have `snap.players` in memory, so we just iterate again and draw circles.

    **Algorithm (per frame).**

    ```
    sx = MINIMAP_SIZE / snap.world.w        // x scale factor
    sy = MINIMAP_SIZE / snap.world.h        // y scale factor

    draw panel rect    (x0, y0, MINIMAP_SIZE, MINIMAP_SIZE)
    draw viewport rect (camera-centred, scaled by sx/sy)
    for p in players where p.alive:
        px = x0 + (p.x + p.w/2) * sx
        py = y0 + (p.y + p.h/2) * sy
        draw circle  (radius 4 if me else 3, green if me else red)
    ```

    **Performance.** O(N) where N = active players. For N ≤ 64 this is well under 0.1 ms per frame on the recommended hardware. If N grows, switch to one `Path2D` accumulator + a single `ctx.fill()` instead of one `arc/fill` per player.

    **Constants** (`GameCanvas.jsx`):

    ```js
    const MINIMAP_SIZE = 180;   // edge length in CSS px
    const MINIMAP_PAD  = 12;    // distance from canvas top-left
    ```

    To resize / reposition the minimap, change `MINIMAP_SIZE`/`MINIMAP_PAD` only — both `drawMinimap` and `drawHUD` already derive from them.

    ---

    ### 3. HUD repositioning (top-right)

    `drawHUD()` now takes the canvas width `W` and offsets the panel to `W - panelW - MINIMAP_PAD`. The minimap and HUD share the same vertical pad, so they line up visually across resolutions.

    To move the HUD elsewhere:

    | Position | Change inside `drawHUD()` |
    |---|---|
    | Top-Right (current) | `x0 = W - panelW - PAD; y0 = PAD;` |
    | Top-Left | `x0 = PAD; y0 = PAD;` (collides with minimap — move minimap) |
    | Bottom-Right | `x0 = W - panelW - PAD; y0 = H - panelH - PAD;` |
    | Bottom-Center | `x0 = (W - panelW) / 2; y0 = H - panelH - PAD;` |

=== "繁體中文"

    ### 1. 大廳畫面的 QR Code

    **目的**：同學在同一 Wi-Fi 下用手機相機掃 QR，直接進入大廳，免手動輸入網址。

    **運作方式**：

    1. **後端** `GET /api/lan-info`（`backend/main.py`）：
       - 開一個 UDP socket 連向 `8.8.8.8:80`，作業系統選好對外介面後，`getsockname()` 即可取得 LAN IP，整個過程其實不會送任何封包。
       - 回傳 `{ "lan_ip": "192.168.x.y", "vite_port": 5173, "client_url": "http://192.168.x.y:5173" }`。
    2. **Vite 開發伺服器** 綁定 `0.0.0.0`（`package.json` 中的 `vite --host`），手機才能連得到。
    3. **Vite 代理** 將 `/api/*` 與 `/ws` 轉發至 FastAPI（`vite.config.js`），手機只要連到 `:5173` 就同時取得靜態資源與 API。
    4. **大廳（`App.jsx`）** 掛載時呼叫 `/api/lan-info`，把 `client_url` 餵給 `qrcode.react` 的 `<QRCodeSVG />`。

    **為什麼用 SVG 而非 Canvas QR**：SVG 在不同 DPR 縮放清晰，列印或截圖也不會有鋸齒。

    **失敗情境與對策**：

    | 情境 | 結果 | 處理方式 |
    |---|---|---|
    | 伺服器連不到 `8.8.8.8` | 退回 `127.0.0.1` | 大廳前端再退回 `location.host` |
    | 手機與主機不同 Wi-Fi / 走 VPN | QR 解析得出但連不到 | 確認同一 SSID，並開放 TCP 5173/8000 防火牆 |
    | 多網卡（VM、VPN） | UDP 技巧可能選錯介面 | 在 `detect_lan_ip()` 內針對該環境寫死正確 IP |

    ---

    ### 2. 全域小地圖（左上角）

    **目的**：把整張 2000×2000 世界縮在 180×180 面板裡，本機玩家綠點、其他玩家紅點、再加一個攝影機視野方框。

    **程式位置**：

    - 直接在主 Canvas 的 `requestAnimationFrame` 內繪製 — `frontend/src/components/GameCanvas.jsx` 中的 `drawMinimap(ctx, snap, me, W, H)`。
    - **沒有獨立 Canvas、沒有 React 子元件、沒有 DOM 節點。** 每幀 `snap.players` 本來就在記憶體裡，再迭代一次畫圓，是最便宜的實作。

    **每幀演算法**：

    ```
    sx = MINIMAP_SIZE / snap.world.w
    sy = MINIMAP_SIZE / snap.world.h

    繪製面板矩形    (x0, y0, MINIMAP_SIZE, MINIMAP_SIZE)
    繪製視野方框    （以攝影機中心，依 sx/sy 縮放）
    迴圈 players 且 alive：
        px = x0 + (p.x + p.w/2) * sx
        py = y0 + (p.y + p.h/2) * sy
        畫圓（半徑：本機 4、他人 3；顏色：本機綠、他人紅）
    ```

    **效能**：O(N)，N 為存活玩家數。在建議硬體上，N ≤ 64 時每幀小於 0.1 ms。若 N 顯著成長，改用單一 `Path2D` 累積後再呼叫一次 `ctx.fill()`。

    **常數**（`GameCanvas.jsx`）：

    ```js
    const MINIMAP_SIZE = 180;   // 邊長（CSS 像素）
    const MINIMAP_PAD  = 12;    // 距離 Canvas 左上的內距
    ```

    只需改這兩個常數即可同時調整小地圖與 HUD 對齊位置。

    ---

    ### 3. HUD 重新定位（右上角）

    `drawHUD()` 現在接收 Canvas 寬度 `W`，把面板位置設為 `W - panelW - MINIMAP_PAD`。小地圖與 HUD 共用相同的垂直內距，不同解析度下視覺對齊。

    若要把 HUD 搬到其他角落：

    | 位置 | 修改 `drawHUD()` |
    |---|---|
    | 右上（目前） | `x0 = W - panelW - PAD; y0 = PAD;` |
    | 左上 | `x0 = PAD; y0 = PAD;`（會與小地圖衝突，記得搬走小地圖） |
    | 右下 | `x0 = W - panelW - PAD; y0 = H - panelH - PAD;` |
    | 下方置中 | `x0 = (W - panelW) / 2; y0 = H - panelH - PAD;` |
