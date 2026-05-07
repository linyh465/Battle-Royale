# Routing Guide — SPA · 404 · MkDocs
# 路由指南 — SPA · 404 · MkDocs

> **Version / 版本:** Phase 12
> **Last updated / 最後更新:** 2026-05-07

---

## 1. Overview / 總覽

**EN:**
Battle Royale ships a single Uvicorn process that simultaneously serves:

- the **React SPA** (Vite-built bundle) at `/` and any deep-link path,
- the **MkDocs site** at `/docs/**`,
- the **FastAPI Swagger / ReDoc** at `/api-docs` and `/api-redoc`,
- the game **WebSocket** at `/ws`,
- assorted JSON endpoints under `/api/**` and `/health`.

A dedicated cyberpunk **404 page** (`NotFound.jsx`) is rendered by
React Router whenever the URL does not match a known SPA path.

**zh-TW:**
Battle Royale 以單一 Uvicorn 行程同時提供：

- `/` 與任何深層連結 — **React SPA**（Vite build 產物），
- `/docs/**` — **MkDocs 站台**，
- `/api-docs`、`/api-redoc` — **FastAPI Swagger / ReDoc**，
- `/ws` — 遊戲 **WebSocket**，
- `/api/**`、`/health` — JSON API 端點。

當網址無法對應 SPA 已知路徑時，由 React Router 渲染專屬的賽博龐克
**404 頁面**（`NotFound.jsx`）。

---

## 2. Backend Path Resolution / 後端路徑解析

**EN:**
`backend/main.py` mounts paths in a **specific order** because mount
priority is "first wins":

| Order / 順序 | Mount / 掛載點          | Source / 來源                         |
|--------------|-------------------------|---------------------------------------|
| 1            | `/api-docs`, `/api-redoc` | FastAPI internal Swagger / ReDoc      |
| 2            | `/api/**`, `/health`, `/ws` | FastAPI route decorators            |
| 3            | `/docs`                 | `StaticFiles(...)` → MkDocs site      |
| 4            | `/assets`               | `StaticFiles(...)` → Vite asset bundle |
| 5            | `/{filename:path}` (catch-all) | SPA fallback → `index.html`     |

The MkDocs path is resolved by `_resolve_mkdocs_site()` which checks,
in order, the `MKDOCS_SITE_DIR` env var, `../docs/site` relative to
`main.py`, and `/app/docs/site` (Docker layout). Each candidate is
turned into an absolute path via `Path.resolve()` so the mount works
regardless of the process CWD.

**zh-TW:**
`backend/main.py` 嚴格依特定順序掛載路徑（先掛載者優先）：

| 順序 | 掛載點                  | 來源                                  |
|------|-------------------------|---------------------------------------|
| 1    | `/api-docs`、`/api-redoc` | FastAPI 內建 Swagger / ReDoc          |
| 2    | `/api/**`、`/health`、`/ws` | FastAPI route decorator             |
| 3    | `/docs`                 | `StaticFiles(...)` → MkDocs 站台      |
| 4    | `/assets`               | `StaticFiles(...)` → Vite 資源 bundle |
| 5    | `/{filename:path}`（catch-all） | SPA fallback → `index.html`   |

MkDocs 目錄由 `_resolve_mkdocs_site()` 依序檢查
`MKDOCS_SITE_DIR` 環境變數、與 `main.py` 同層的 `../docs/site`、以及
`/app/docs/site`（Docker 佈局）。每個候選路徑都會經過 `Path.resolve()`
轉成絕對路徑，無論 process CWD 為何都能正確掛載。

---

## 3. SPA Fallback Logic / SPA Fallback 邏輯

**EN:**
The catch-all (`@app.get("/{filename:path}")` in `main.py`) has three
mutually-exclusive branches:

1. **Reserved path** (`api/`, `api-docs`, `api-redoc`, `ws`, `health`,
   `docs`, `docs/`, `assets/`) → return a hard `404`. We refuse to fall
   through to `index.html` so a typo in an API route surfaces the bug
   instead of being hidden behind a React 404 page.
2. **Real file under `dist/`** → `FileResponse(...)` for that file
   (favicon, robots.txt, …).
3. **Anything else** → `FileResponse(dist/index.html)`. The browser
   then loads the SPA, React Router parses the URL, and the catch-all
   route renders `<NotFound />`.

This is the conventional "history fallback" pattern that any modern
SPA uses to support deep linking.

**zh-TW:**
catch-all（`main.py` 中的 `@app.get("/{filename:path}")`）共三條互斥
分支：

1. **保留路徑**（`api/`、`api-docs`、`api-redoc`、`ws`、`health`、
   `docs`、`docs/`、`assets/`）→ 直接回 `404`。刻意不 fallback 到
   `index.html`，以免 API 路徑打錯時被 React 404 頁面靜默吞掉。
2. **`dist/` 下實際存在的檔案** → `FileResponse(...)`（favicon、
   robots.txt 等）。
3. **其餘所有路徑** → `FileResponse(dist/index.html)`。瀏覽器載入 SPA
   後由 React Router 解析網址；catch-all 路由會渲染 `<NotFound />`。

這是現代 SPA 普遍採用的「history fallback」做法，用來支援深層連結。

---

## 4. React Router Setup / React Router 設定

**EN:**
`frontend/src/App.jsx` wraps the app in `<BrowserRouter>` and declares
two routes:

```jsx
<BrowserRouter>
  <Routes>
    <Route path="/" element={<RootRoute />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
</BrowserRouter>
```

`RootRoute` keeps the existing director / lobby / player / admin state
machine intact — it still keys off `?role=director` and the 5-click
admin trigger. `NotFound` is the cyberpunk 404 component
(`components/NotFound.jsx`) and is only rendered for paths that do not
match `/`.

`NotFound` reads `window.location.pathname` so the rejected URL is
shown back to the user, and it offers two CTAs:

- **Return to Lobby (返回大廳)** → `<Link to="/">` so the SPA
  navigates without a full reload.
- **Operator Manual (操作手冊)** → `<a href="/docs">` so MkDocs takes
  over the navigation and SSR-renders its own page.

**zh-TW:**
`frontend/src/App.jsx` 將整個 app 包在 `<BrowserRouter>` 內，宣告兩條
路由：

```jsx
<BrowserRouter>
  <Routes>
    <Route path="/" element={<RootRoute />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
</BrowserRouter>
```

`RootRoute` 保留原本的導播 / 大廳 / 玩家 / 管理員狀態機 — 仍依
`?role=director` 與 5 連點切換管理員模式。`NotFound` 為賽博龐克 404
元件（`components/NotFound.jsx`），僅在網址無法對應 `/` 時渲染。

`NotFound` 會讀取 `window.location.pathname` 以顯示被拒絕的網址，
並提供兩個 CTA：

- **返回大廳** → `<Link to="/">`，SPA 內部導覽，不會 full reload。
- **操作手冊** → `<a href="/docs">`，交由 MkDocs 接手，伺服器端
  渲染對應頁面。

---

## 5. Dockerfile Guarantees / Dockerfile 保證

**EN:**
The multi-stage Dockerfile guarantees `/docs` is always available in
production:

1. **Stage 2 — `docs-build`** runs `mkdocs build --site-dir
   /build/site` and immediately checks that `index.html` exists. If
   `mkdocs build` failed silently the `docker build` step exits
   non-zero rather than producing an image where `/docs` 404s at
   runtime.
2. **Stage 3 — `runtime`** copies `/build/site` from `docs-build` into
   `/app/docs/site` and exports `MKDOCS_SITE_DIR=/app/docs/site` so
   `main.py`'s resolver hits it on the first candidate.

If the docs site is somehow missing at runtime, `main.py` prints a
clear `[main] WARNING: MkDocs site not found …` line at import-time so
ops can find it in container logs.

**zh-TW:**
多階段 Dockerfile 保證 `/docs` 在 production 一定可用：

1. **Stage 2 — `docs-build`** 執行 `mkdocs build --site-dir
   /build/site`，並立即檢查 `index.html` 是否存在。`mkdocs build`
   若靜默失敗，`docker build` 會直接 exit non-zero，避免產出在
   runtime 才 404 的 image。
2. **Stage 3 — `runtime`** 把 `/build/site` 從 `docs-build` 複製到
   `/app/docs/site`，並設定 `MKDOCS_SITE_DIR=/app/docs/site`，
   讓 `main.py` 的 resolver 第一個候選就命中。

若 runtime 仍找不到文件，`main.py` 會在 import 時印出
`[main] WARNING: MkDocs site not found …`，方便運維在 container
log 中發現問題。

---

## 6. End-to-end Behaviour / 端到端行為

**EN:**

| URL                 | Server response                       | Browser sees                                |
|---------------------|---------------------------------------|---------------------------------------------|
| `/`                 | `index.html`                          | Lobby                                       |
| `/?role=director`   | `index.html`                          | DirectorCanvas                              |
| `/docs`             | MkDocs `index.html`                   | MkDocs site                                 |
| `/docs/setup/`      | MkDocs static page                    | MkDocs sub-page                             |
| `/api-docs`         | FastAPI Swagger UI                    | Swagger UI                                  |
| `/health`           | `{"ok": true, ...}`                   | JSON                                        |
| `/some/random/path` | `index.html` (SPA fallback)           | React Router → `<NotFound />` (cyberpunk 404)|
| `/api/typo`         | `404 Not Found` (reserved prefix)     | hard 404 (no SPA, no React render)          |

**zh-TW:**

| URL                 | 伺服器回應                            | 瀏覽器顯示                                  |
|---------------------|---------------------------------------|---------------------------------------------|
| `/`                 | `index.html`                          | 大廳                                        |
| `/?role=director`   | `index.html`                          | DirectorCanvas                              |
| `/docs`             | MkDocs `index.html`                   | MkDocs 站台                                 |
| `/docs/setup/`      | MkDocs 靜態頁                         | MkDocs 子頁                                 |
| `/api-docs`         | FastAPI Swagger UI                    | Swagger UI                                  |
| `/health`           | `{"ok": true, ...}`                   | JSON                                        |
| `/some/random/path` | `index.html`（SPA fallback）          | React Router → `<NotFound />`（賽博龐克 404）|
| `/api/typo`         | `404 Not Found`（保留前綴）           | 硬 404（不會跑 SPA、不會渲染 React）        |
