# ─── Stage 1: Frontend build (Vite + React) ─────────────────────────────────
# EN: Use the official Node 20 Alpine image (small footprint) to install
#     frontend dependencies and produce the static bundle in /frontend/dist.
#     We copy package*.json first so Docker can cache the npm install layer
#     across rebuilds where only source files change.
# zh-TW: 使用官方 Node 20 Alpine 映像（體積小）安裝前端依賴，
#         並在 /frontend/dist 產出靜態 bundle。
#         先複製 package*.json，讓 Docker 在只改原始碼時可以重用 npm install 快取。
FROM node:20-alpine AS frontend-build

WORKDIR /frontend

# EN: Install dependencies. Falls back to `npm install` if the lockfile is
#     out of sync, so first-time builds still succeed without manual fix-ups.
# zh-TW: 安裝依賴。lockfile 不同步時回退到 npm install，避免首次建置卡住。
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci || npm install

COPY frontend/ ./
RUN npm run build


# ─── Stage 2: Python runtime (FastAPI + Uvicorn) ─────────────────────────────
# EN: Python 3.12 slim — Railway counts image size against build minutes,
#     so the runtime stage stays minimal.
#     Environment knobs:
#       PORT             — provided by Railway, Uvicorn binds to it.
#       TICK_RATE_HZ     — server tick rate (default 20 Hz, see engine.py).
#       FRONTEND_DIST_DIR — where main.py looks for built SPA (set explicitly
#                          to avoid path-relative ambiguity inside the container).
# zh-TW: 採 Python 3.12 slim — Railway 會把映像大小計入 build 時數，
#         runtime stage 越精簡越好。
#         環境變數：
#           PORT             — Railway 注入，Uvicorn 綁定該 port。
#           TICK_RATE_HZ     — 伺服器 tick 頻率（預設 20 Hz，見 engine.py）。
#           FRONTEND_DIST_DIR — main.py 用來定位 SPA build 目錄
#                              （明確指定，避免容器內相對路徑解析誤差）。
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TICK_RATE_HZ=20 \
    FRONTEND_DIST_DIR=/app/frontend/dist

WORKDIR /app

# EN: Install Python deps first to leverage layer caching.
# zh-TW: 先裝 Python 依賴以利用 Docker layer cache。
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# EN: Copy backend source (excluding tests / dev clutter via .dockerignore).
# zh-TW: 複製後端原始碼（透過 .dockerignore 排除測試 / 開發雜物）。
COPY backend/ /app/backend/

# EN: Bring in the compiled SPA from the frontend stage.
# zh-TW: 從前端 stage 帶入已 build 完成的 SPA。
COPY --from=frontend-build /frontend/dist /app/frontend/dist

# EN: Drop privileges. Railway runs containers as root by default, but a
#     non-root user reduces blast radius if anything ever escapes the sandbox.
# zh-TW: 卸除權限。Railway 預設以 root 執行容器，
#         但改用非 root 使用者可降低意外逃逸時的影響範圍。
RUN useradd --system --uid 1001 --no-create-home appuser \
    && chown -R appuser:appuser /app
USER appuser

# EN: Default Railway exposes $PORT. Locally fall back to 8000 if unset.
# zh-TW: Railway 會注入 $PORT；本機跑時若未設定則退回 8000。
EXPOSE 8000
WORKDIR /app/backend
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --proxy-headers --forwarded-allow-ips='*'"]
