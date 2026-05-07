# Setup · 環境建置

---

=== "English"

    ### Hardware requirements

    | Resource | Recommended | Minimum |
    |---|---|---|
    | CPU | Intel Core **i7-10th Gen** (or AMD Ryzen 5 3600) | Intel Core i5-8th Gen |
    | RAM | **16 GB** | 8 GB |
    | Disk | 2 GB free SSD | 1 GB free |
    | GPU | Integrated (UHD 630) — game uses 2D Canvas, no GPU required | — |
    | Network | Loopback / LAN < 30 ms RTT for smooth play | — |

    The 30 Hz authoritative tick + 60 FPS canvas is comfortable on the recommended spec for ~16 concurrent players. Beyond that, see *Modification Guide → Tick Rate*.

    ### Software prerequisites

    | Tool | Version |
    |---|---|
    | Python | **3.11+** |
    | Node.js | **18.18+** or **20+** |
    | npm | bundled with Node |
    | Git | any recent version |
    | OS | Windows 10/11, macOS 13+, or modern Linux |

    ---

    ### Step 1 — Clone

    ```bash
    git clone <your-repo-url>
    cd "Final-Project_1142AdvProgramming/Battle Royale"
    ```

    ### Step 2 — Run the FastAPI server

    ```bash
    cd backend
    python -m venv .venv
    # Windows PowerShell
    .\.venv\Scripts\Activate.ps1
    # macOS / Linux
    source .venv/bin/activate

    pip install -r requirements.txt
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
    ```

    Verify: open `http://localhost:8000/health` — should return `{"ok": true, ...}`.
    Also verify `http://localhost:8000/api/lan-info` — should return your `client_url` (used by the lobby QR code).

    ### Step 3 — Install frontend dependencies

    ```bash
    cd frontend
    npm install
    ```

    > **Dependency fix — `qrcode.react`**
    > The lobby renders the join-by-QR code with [`qrcode.react`](https://www.npmjs.com/package/qrcode.react). It is already declared in `package.json`, so `npm install` picks it up. If you upgraded an older checkout and see `Failed to resolve import "qrcode.react"`, install it explicitly:
    >
    > ```bash
    > npm install qrcode.react
    > ```
    >
    > Then restart `npm run dev`. Vite caches resolved modules; a stale cache is the most common cause of the import error after a fresh pull.

    ### Step 4 — Configure Vite to expose the LAN IP (`--host`)

    For phones on the same Wi-Fi to reach the dev server, Vite must bind `0.0.0.0` instead of `localhost`. The repo already does this — confirm both pieces are present:

    `frontend/package.json` (scripts):
    ```json
    {
      "scripts": {
        "dev": "vite --host",
        "build": "vite build",
        "preview": "vite preview --host"
      }
    }
    ```

    `frontend/vite.config.js`:
    ```js
    export default defineConfig({
      server: {
        port: 5173,
        host: true,                                 // bind 0.0.0.0
        proxy: {
          "/ws":  { target: "ws://localhost:8000", ws: true },
          "/api": { target: "http://localhost:8000", changeOrigin: true },
        },
      },
    });
    ```

    Either `--host` (CLI) or `host: true` (config) is sufficient on its own; we set both so neither path is fragile.

    If your firewall blocks inbound connections, allow TCP **5173** (Vite) and **8000** (FastAPI) on your local network profile.

    ### Step 5 — Run the React client

    ```bash
    npm run dev
    ```

    Vite will print **two** URLs:

    ```
      ➜  Local:   http://localhost:5173/
      ➜  Network: http://192.168.x.y:5173/    ← scan this on a phone
    ```

    Open the **Network** URL on the host browser too — that way the QR shown in the lobby resolves to a phone-reachable address.

    ### Step 6 — Lobby & QR Code

    1. Open `http://<your-LAN-IP>:5173`.
    2. The lobby shows a QR encoding `http://<lan_ip>:5173` (fetched from `/api/lan-info`).
    3. **Type a nickname** (the *Enter Game* button stays disabled until you do).
    4. Pick a weapon → **Enter Game**.
    5. Phones on the same Wi-Fi: open the camera, point at the QR, tap the suggestion → they land on the same lobby and join through the same WS endpoint.

    ### Step 7 — Controls

    - **Desktop:** `W A S D` to move, mouse to aim, **left-click hold** to fire.
    - **Mobile:** Bottom-left joystick to move, bottom-right red button to fire. Aim auto-follows movement direction.
    - **Force-show touch UI on desktop for testing:** append `?touch=1` to the URL.

    ### Step 8 — Build the docs site (optional)

    ```bash
    pip install mkdocs-material
    mkdocs serve --dev-addr 127.0.0.1:8001    # avoid the backend's :8000
    mkdocs build                               # static site in ./site/
    ```

    ### Troubleshooting

    | Symptom | Fix |
    |---|---|
    | `Failed to resolve import "qrcode.react"` | `npm install qrcode.react`, then restart `npm run dev`. |
    | Lobby shows "detecting LAN IP…" forever | Backend not running, or `/api/lan-info` not proxied. Confirm both servers are up and `vite.config.js` has the `/api` proxy entry. |
    | QR resolves but phone cannot connect | Not on the same Wi-Fi, or firewall blocks TCP 5173/8000. Disable VPN; allow inbound on the LAN network profile. |
    | Vite only prints `Local:` (no `Network:`) | `--host` flag missing. Re-check `package.json` scripts. |
    | `ModuleNotFoundError: models` | Run `uvicorn` from inside `backend/`, not the repo root. |
    | WebSocket immediately closes | Confirm port 8000 is free; check DevTools → Network → WS tab. |
    | Canvas blank, status stays `connecting` | Vite proxy not running — use `npm run dev`, not `vite preview` (preview doesn't apply the dev proxy). |
    | High CPU on client | Background tab — browsers throttle rAF; switch back. |

=== "繁體中文"

    ### 硬體需求

    | 資源 | 建議規格 | 最低規格 |
    |---|---|---|
    | CPU | Intel Core **i7 第 10 代**（或 AMD Ryzen 5 3600） | Intel Core i5 第 8 代 |
    | 記憶體 | **16 GB** | 8 GB |
    | 硬碟 | 2 GB SSD 可用空間 | 1 GB 可用 |
    | 顯示卡 | 內顯（UHD 630）即可 — 純 Canvas 2D，不需獨顯 | — |
    | 網路 | 本機或 LAN，RTT < 30 ms 體驗最佳 | — |

    在建議規格下，30 Hz 伺服器 tick 與 60 FPS 客戶端可流暢支援約 16 位同時連線玩家。

    ### 軟體前置需求

    | 工具 | 版本 |
    |---|---|
    | Python | **3.11 以上** |
    | Node.js | **18.18 以上** 或 **20 以上** |
    | npm | 隨 Node 安裝 |
    | Git | 任何近期版本 |
    | 作業系統 | Windows 10/11、macOS 13+、現代 Linux |

    ---

    ### 步驟一 — Clone 專案

    ```bash
    git clone <your-repo-url>
    cd "Final-Project_1142AdvProgramming/Battle Royale"
    ```

    ### 步驟二 — 啟動 FastAPI 伺服器

    ```bash
    cd "C:\文件夾\backend"
    python -m venv .venv
    # Windows PowerShell
    .\.venv\Scripts\Activate.ps1
    # macOS / Linux
    source .venv/bin/activate

    pip install -r requirements.txt
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
    ```

    驗證：開啟 `http://localhost:8000/health` 應回傳 `{"ok": true, ...}`；
    另外確認 `http://localhost:8000/api/lan-info` 會回傳 `client_url`（大廳 QR Code 所需）。

    ### 步驟三 — 安裝前端相依套件

    ```bash
    cd "C:\文件夾\frontend"
    npm install
    ```

    > **相依套件修正 — `qrcode.react`**
    > 大廳的 QR Code 由 [`qrcode.react`](https://www.npmjs.com/package/qrcode.react) 產生，已寫進 `package.json`，`npm install` 會自動裝。
    > 若你從舊版 checkout 升級後出現 `Failed to resolve import "qrcode.react"`，請手動安裝：
    >
    > ```bash
    > npm install qrcode.react
    > ```
    >
    > 然後重啟 `npm run dev`。Vite 模組解析會被快取，pull 完新分支後最常見的 import 錯誤就是這個。

    ### 步驟四 — 設定 Vite 開放 LAN IP（`--host`）

    要讓同一 Wi-Fi 的手機連得到 dev server，Vite 必須綁 `0.0.0.0`，不能只綁 `localhost`。本專案已設好，請確認以下兩處都在：

    `frontend/package.json`（scripts 區段）：
    ```json
    {
      "scripts": {
        "dev": "vite --host",
        "build": "vite build",
        "preview": "vite preview --host"
      }
    }
    ```

    `frontend/vite.config.js`：
    ```js
    export default defineConfig({
      server: {
        port: 5173,
        host: true,                                 // 綁 0.0.0.0
        proxy: {
          "/ws":  { target: "ws://localhost:8000", ws: true },
          "/api": { target: "http://localhost:8000", changeOrigin: true },
        },
      },
    });
    ```

    `--host`（CLI）或 `host: true`（設定檔）擇一即可生效；本專案兩者皆設，避免任一路徑壞掉時整個失效。

    若防火牆阻擋連入，請於本機網路設定檔開放 TCP **5173**（Vite）與 **8000**（FastAPI）。

    ### 步驟五 — 啟動 React 客戶端

    ```bash
    npm run dev
    ```

    Vite 會印出 **兩個** URL：

    ```
      ➜  Local:   http://localhost:5173/
      ➜  Network: http://192.168.x.y:5173/    ← 手機掃 QR 進到的就是這個
    ```

    主機端瀏覽器**也用 Network 那個網址**開啟，這樣大廳顯示的 QR 才會解析到手機可以連到的位址。

    ### 步驟六 — 大廳與 QR Code

    1. 開啟 `http://<你的 LAN IP>:5173`。
    2. 大廳會顯示一個 QR，內容為 `http://<lan_ip>:5173`（從 `/api/lan-info` 取得）。
    3. **輸入暱稱**（未輸入時 *Enter Game* 按鈕為灰色不可點）。
    4. 選擇武器 → 點 **Enter Game**。
    5. 同 Wi-Fi 的手機：開相機掃 QR → 點開連結 → 落在同一個大廳，透過同一 WS 端點加入遊戲。

    ### 步驟七 — 操作方式

    - **桌機**：`W A S D` 移動、滑鼠瞄準、**長按左鍵**射擊。
    - **手機**：左下虛擬搖桿移動、右下紅色按鈕射擊；瞄準會自動跟著移動方向。
    - **桌機強制顯示觸控 UI**（測試用）：網址後加 `?touch=1`。

    ### 步驟八 — 建置文件站（選用）

    ```bash
    pip install mkdocs-material
    mkdocs serve --dev-addr 127.0.0.1:8001    # 避開後端 8000 埠
    mkdocs build                               # 輸出靜態站於 ./site/
    ```

    ### 疑難排解

    | 症狀 | 解法 |
    |---|---|
    | `Failed to resolve import "qrcode.react"` | 執行 `npm install qrcode.react` 後重啟 `npm run dev`。 |
    | 大廳一直顯示「detecting LAN IP…」 | 後端未啟動或 `/api/lan-info` 沒被代理。確認兩個 server 都在跑，且 `vite.config.js` 有 `/api` 代理項。 |
    | QR 解析得出但手機連不到 | 不在同一 Wi-Fi 或防火牆擋 TCP 5173/8000。關 VPN；允許區域網路連入。 |
    | Vite 只印 `Local:`、沒有 `Network:` | `--host` 沒帶到。回頭檢查 `package.json` 的 scripts。 |
    | `ModuleNotFoundError: models` | 必須在 `backend/` 內執行 `uvicorn`，不要在 repo 根目錄。 |
    | WebSocket 連上立即斷線 | 確認 8000 埠未被佔用；DevTools → Network → WS 看訊息。 |
    | Canvas 空白、狀態一直顯示 `connecting` | 沒跑 `npm run dev`（用了 `vite preview` 不會套用 dev 代理）。 |
    | 客戶端 CPU 飆高 | 分頁切到背景被瀏覽器降頻，切回即恢復。 |
