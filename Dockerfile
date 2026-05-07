# ─── Stage 1: Frontend build (Vite + React) ─────────────────────────────────
# EN: Use the official Node 20 Alpine image (small footprint) to install
#     frontend dependencies and produce the static bundle in /frontend/dist.
#     Phase 15 — the React SPA now owns /docs/* (Docs.jsx) so we no longer
#     need a separate MkDocs build stage.
# zh-TW: 使用官方 Node 20 Alpine 映像（體積小）安裝前端依賴，
#     並在 /frontend/dist 產出靜態 bundle。
#     Phase 15 — React SPA 已接管 /docs/* 路由（Docs.jsx），
#     移除獨立的 MkDocs build stage。
FROM node:20-alpine AS frontend-build

WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci || npm install

COPY frontend/ ./
RUN npm run build


# ─── Stage 2: Python runtime (FastAPI + Uvicorn) ─────────────────────────────
# EN: Python 3.12 slim — Railway counts image size against build minutes,
#     so the runtime stage stays minimal. Phase 15 dropped the docs-build
#     stage and the MKDOCS_SITE_DIR env var; only FRONTEND_DIST_DIR remains.
# zh-TW: Python 3.12 slim — Railway 會把映像大小計入 build 時數，
#     runtime stage 越精簡越好。Phase 15 已刪除 docs-build stage 與
#     MKDOCS_SITE_DIR 環境變數，僅保留 FRONTEND_DIST_DIR。
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TICK_RATE_HZ=20 \
    FRONTEND_DIST_DIR=/app/frontend/dist

WORKDIR /app

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend/ /app/backend/

COPY --from=frontend-build /frontend/dist /app/frontend/dist

RUN useradd --system --uid 1001 --no-create-home appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
WORKDIR /app/backend
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --proxy-headers --forwarded-allow-ips='*'"]
