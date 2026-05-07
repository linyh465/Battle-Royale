from __future__ import annotations

import asyncio
import json
import os
import socket
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from engine import GameEngine
from models import ALL_WEAPON_IDS as _ALL_WEAPON_IDS_TUPLE

engine = GameEngine()


def detect_lan_ip() -> str:
    # EN: UDP-trick to learn the outbound LAN IP without sending a packet.
    # zh-TW: 用 UDP socket 取得對外 LAN IP（並未實際送封包）。
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    loop_task = asyncio.create_task(engine.run())
    try:
        yield
    finally:
        engine.stop()
        loop_task.cancel()
        try:
            await loop_task
        except asyncio.CancelledError:
            pass


# EN: Phase 10 — move FastAPI's interactive docs off /docs because we
#     now mount MkDocs at /docs (the public game docs site). Swagger UI
#     still works at /api-docs and ReDoc at /api-redoc.
# zh-TW: Phase 10 — FastAPI 內建 Swagger 文件改掛在 /api-docs，
#     讓 /docs 留給對外公開的 MkDocs 文件站。ReDoc 也順移到 /api-redoc。
app = FastAPI(
    title="Continuous Deathmatch Server",
    lifespan=lifespan,
    docs_url="/api-docs",
    redoc_url="/api-redoc",
    openapi_url="/api-docs/openapi.json",
    # EN: Move Swagger's OAuth2 redirect off /docs so it doesn't shadow the
    #     MkDocs mount.
    # zh-TW: 把 Swagger 的 OAuth2 redirect 從 /docs 移開，避免遮蔽 MkDocs 掛載點。
    swagger_ui_oauth2_redirect_url="/api-docs/oauth2-redirect",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"ok": True, "players": len(engine.players), "bullets": len(engine.bullets)}


@app.get("/api/lan-info")
async def lan_info():
    ip = detect_lan_ip()
    return {"lan_ip": ip, "vite_port": 5173, "client_url": f"http://{ip}:5173"}


@app.get("/api/settings")
async def public_settings():
    # EN: Phase 10 — public read-only view of the game settings the lobby
    #     needs *before* opening a WebSocket. Currently exposed:
    #       allowed_weapons — CSV whitelist driving the lobby's weapon picker.
    #       all_weapons     — every weapon ID the engine knows about (for the
    #                         admin checklist UI on first paint).
    #     Sensitive fields (admin password, internal timers) are deliberately
    #     omitted — anything truly private must stay behind the WS handshake.
    # zh-TW: Phase 10 — 大廳尚未開啟 WebSocket 之前需要的公開只讀設定。
    #     目前回傳：
    #       allowed_weapons — 大廳武器選單依此 CSV 白名單顯示。
    #       all_weapons     — 引擎已知的全部武器 ID（給管理員 checklist 第一次
    #                         渲染使用）。
    #     管理員密碼等敏感資訊一律不對外，全部留在 WebSocket 握手之後。
    return {
        "allowed_weapons": engine.settings.allowed_weapons,
        "all_weapons": list(_ALL_WEAPON_IDS_TUPLE),
    }


# ── Helper: build the current admin settings dict ──
# ── 輔助函式：組合目前的管理員設定字典 ──
def _admin_settings_dict() -> dict:
    return {
        "team_mode": engine.settings.team_mode,
        "leaderboard_sort_by": engine.settings.leaderboard_sort_by,
        "base_respawn_time": engine.settings.base_respawn_time,
        "respawn_penalty": engine.settings.respawn_penalty,
        "game_duration": engine.settings.game_duration,
        "leaderboard_columns": engine.settings.leaderboard_columns,
        "bots_enabled": engine.settings.bots_enabled,
        "bot_count": engine.settings.bot_count,
        "default_player_hp": engine.settings.default_player_hp,
        "default_bot_hp": engine.settings.default_bot_hp,
    }


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    try:
        raw = await ws.receive_text()
        hello = json.loads(raw)
    except (WebSocketDisconnect, json.JSONDecodeError):
        await ws.close()
        return

    htype = hello.get("type")

    # ─── Director handshake ───
    # EN: Director — read-only spectator that bypasses player creation.
    # zh-TW: 導播 — 唯讀觀戰，不建立玩家實體。
    if htype == "join_director":
        engine.directors.append(ws)
        await ws.send_text(json.dumps({
            "type": "welcome_director",
            "world": {"w": engine.world_w, "h": engine.world_h},
        }))
        try:
            while True:
                raw = await ws.receive_text()
                msg = json.loads(raw)
                if msg.get("type") == "ping":
                    await ws.send_text(json.dumps({"type": "pong", "t": msg.get("t")}))
        except Exception:
            pass
        finally:
            if ws in engine.directors:
                engine.directors.remove(ws)
        return

    # ─── Non-Combatant Admin handshake (Phase 2 — 5-click lobby login) ───
    # EN: If the client connects with type "join_admin", authenticate with the
    #     admin password. Do NOT create a Player object — the admin is strictly
    #     a non-combatant observer with admin controls.
    # zh-TW: 若客戶端以 "join_admin" 連線，驗證管理員密碼。
    #     不建立 Player 物件 — 管理員為純觀察者，不參與戰鬥。
    if htype == "join_admin":
        pwd = str(hello.get("password", ""))
        if pwd != engine.settings.admin_password:
            await ws.send_text(json.dumps({"type": "admin_fail"}))
            await ws.close(code=4001)
            return

        # EN: Assign a unique admin ID (not tied to any Player).
        # zh-TW: 指派唯一管理員 ID（不與任何 Player 關聯）。
        admin_id = f"admin-{uuid.uuid4().hex[:8]}"
        engine.admin_ws[admin_id] = ws
        engine.admin_conns.add(admin_id)

        await ws.send_text(json.dumps({
            "type": "admin_ok",
            "admin_id": admin_id,
            "settings": _admin_settings_dict(),
        }))
        try:
            while True:
                raw = await ws.receive_text()
                msg = json.loads(raw)
                mtype = msg.get("type")

                if mtype == "admin_set":
                    # EN: Change a GameSettings field.
                    # zh-TW: 修改 GameSettings 欄位。
                    engine.admin_set(msg.get("key"), msg.get("value"))
                elif mtype == "admin_force_respawn":
                    # EN: Force-respawn a single player by player_id.
                    # zh-TW: 依 player_id 強制重生單一玩家。
                    engine.admin_force_respawn(msg.get("player_id"))
                elif mtype == "admin_force_respawn_all":
                    # EN: Force-respawn all dead/spectating players.
                    # zh-TW: 強制重生所有已陣亡/觀戰中的玩家。
                    engine.admin_force_respawn_all()
                elif mtype == "admin_batch_reduce_respawn":
                    # EN: Reduce all dead players' respawn timers by N seconds.
                    # zh-TW: 將所有已陣亡玩家的重生計時器減少 N 秒。
                    secs = float(msg.get("seconds", 0))
                    engine.admin_batch_reduce_respawn(secs)
                elif mtype == "admin_batch_reset_respawn":
                    engine.admin_batch_reset_respawn()
                elif mtype == "admin_force_kill":
                    engine.admin_force_kill(msg.get("player_id"))
                elif mtype == "admin_reset_match":
                    engine.admin_reset_match()
                elif mtype == "admin_kick_bots":
                    engine.admin_kick_bots()
                elif mtype == "admin_set_game_timer":
                    engine.admin_set_game_timer(float(msg.get("seconds", 0)))
                elif mtype == "admin_adjust_game_timer":
                    engine.admin_adjust_game_timer(float(msg.get("delta", 0)))
                elif mtype == "admin_end_game_now":
                    engine.admin_end_game_now()
                elif mtype == "admin_set_all_hp":
                    engine.admin_set_all_hp(float(msg.get("hp", 100)), msg.get("target", "all"))
                elif mtype == "admin_set_player_hp":
                    engine.admin_set_player_hp(msg.get("player_id"), float(msg.get("hp", 100)))
                elif mtype == "admin_password":
                    new_pw = str(msg.get("value", "")).strip()
                    if new_pw:
                        engine.settings.admin_password = new_pw
                elif mtype == "ping":
                    await ws.send_text(json.dumps({"type": "pong", "t": msg.get("t")}))
        except WebSocketDisconnect:
            pass
        except Exception:
            pass
        finally:
            engine.remove_admin(admin_id)
        return

    # ─── Normal player handshake ───
    # EN: Standard player join — creates a Player object on the map.
    # zh-TW: 標準玩家加入 — 在地圖上建立 Player 物件。
    if htype != "join":
        await ws.close(code=4000)
        return

    player = engine.add_player(hello.get("name", "anon"), ws)
    if hello.get("weapon"):
        engine.set_weapon(player.id, hello["weapon"])
    await ws.send_text(json.dumps({"type": "welcome", "player_id": player.id}))

    # EN: In-game admin authentication is still possible for a player that
    #     connected normally (backward compat), but the recommended path
    #     is the dedicated "join_admin" handshake above.
    # zh-TW: 已正常連線的玩家仍可透過訊息驗證管理員身份（向後相容），
    #     但推薦使用上方的 "join_admin" 專用握手流程。
    is_admin = False
    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            mtype = msg.get("type")

            if mtype == "input":
                engine.apply_input(player.id, msg)
            elif mtype == "weapon":
                engine.set_weapon(player.id, msg.get("name", "pistol"))
            elif mtype == "respawn":
                engine.request_respawn(player.id)
            elif mtype == "spectate":
                engine.request_spectate(player.id)
            elif mtype == "admin_auth":
                # EN: Legacy in-game admin auth — player still exists on the map.
                # zh-TW: 舊式遊戲中管理員驗證 — 玩家仍存在於地圖上。
                if str(msg.get("password", "")) == engine.settings.admin_password:
                    is_admin = True
                    engine.admin_conns.add(player.id)
                    await ws.send_text(json.dumps({
                        "type": "admin_ok",
                        "settings": _admin_settings_dict(),
                    }))
                else:
                    await ws.send_text(json.dumps({"type": "admin_fail"}))
            elif mtype == "admin_set" and is_admin:
                engine.admin_set(msg.get("key"), msg.get("value"))
            elif mtype == "admin_force_respawn" and is_admin:
                engine.admin_force_respawn(msg.get("player_id"))
            elif mtype == "admin_force_respawn_all" and is_admin:
                engine.admin_force_respawn_all()
            elif mtype == "admin_batch_reduce_respawn" and is_admin:
                secs = float(msg.get("seconds", 0))
                engine.admin_batch_reduce_respawn(secs)
            elif mtype == "admin_batch_reset_respawn" and is_admin:
                engine.admin_batch_reset_respawn()
            elif mtype == "admin_force_kill" and is_admin:
                engine.admin_force_kill(msg.get("player_id"))
            elif mtype == "admin_reset_match" and is_admin:
                engine.admin_reset_match()
            elif mtype == "admin_kick_bots" and is_admin:
                engine.admin_kick_bots()
            elif mtype == "admin_set_game_timer" and is_admin:
                engine.admin_set_game_timer(float(msg.get("seconds", 0)))
            elif mtype == "admin_adjust_game_timer" and is_admin:
                engine.admin_adjust_game_timer(float(msg.get("delta", 0)))
            elif mtype == "admin_end_game_now" and is_admin:
                engine.admin_end_game_now()
            elif mtype == "admin_set_all_hp" and is_admin:
                engine.admin_set_all_hp(float(msg.get("hp", 100)), msg.get("target", "all"))
            elif mtype == "admin_set_player_hp" and is_admin:
                engine.admin_set_player_hp(msg.get("player_id"), float(msg.get("hp", 100)))
            elif mtype == "admin_password" and is_admin:
                new_pw = str(msg.get("value", "")).strip()
                if new_pw:
                    engine.settings.admin_password = new_pw
            elif mtype == "ping":
                await ws.send_text(json.dumps({"type": "pong", "t": msg.get("t")}))
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        engine.remove_player(player.id)


# ─── Static SPA mount (Phase 9 — single-container deploy) ───
# EN: When a built frontend bundle exists (e.g., `frontend/dist` produced by
#     Vite during the Docker build) we serve it from the same Uvicorn process.
#     This lets Railway run a single container — no separate static host.
#     Resolution order:
#       1. $FRONTEND_DIST_DIR override (absolute path).
#       2. ../frontend/dist relative to this file (production layout).
#       3. /app/frontend/dist (Docker layout where backend lives at /app/backend).
#     If none exist (pure dev mode) we silently skip the mount and let Vite
#     serve the frontend on :5173.
# zh-TW: 若已存在前端 build 輸出（例如 Docker build 階段由 Vite 產生的
#     `frontend/dist`），同一個 Uvicorn 行程直接靜態托管，這樣 Railway 只需要
#     跑一個容器，省下另一個靜態 host 的成本。
#     解析順序：
#       1. $FRONTEND_DIST_DIR 環境變數（絕對路徑）。
#       2. 與本檔同層的 ../frontend/dist（一般生產佈局）。
#       3. /app/frontend/dist（Docker 佈局，後端在 /app/backend）。
#     若都不存在（純 dev 模式）則靜默跳過，由 Vite 在 :5173 服務前端。
def _resolve_frontend_dist() -> Path | None:
    candidates: list[Path] = []
    env_path = os.environ.get("FRONTEND_DIST_DIR")
    if env_path:
        candidates.append(Path(env_path))
    here = Path(__file__).resolve().parent
    candidates.append(here.parent / "frontend" / "dist")
    candidates.append(Path("/app/frontend/dist"))
    for p in candidates:
        if p.is_dir() and (p / "index.html").is_file():
            return p
    return None


def _resolve_mkdocs_site() -> Path | None:
    # EN: Phase 10 — locate the built MkDocs static site
    #     (mkdocs build → docs/site by default). Resolution mirrors
    #     `_resolve_frontend_dist` so the same env-override pattern works:
    #       1. $MKDOCS_SITE_DIR override (Dockerfile sets this).
    #       2. ../docs/site relative to this file.
    #       3. /app/docs/site (Docker layout).
    #     Returns None if the docs were never built — the route is then
    #     skipped silently (dev mode without `mkdocs build`).
    # zh-TW: Phase 10 — 找到 MkDocs build 出來的靜態站台目錄
    #     （mkdocs build 預設 → docs/site）。解析順序與 `_resolve_frontend_dist`
    #     相同：
    #       1. $MKDOCS_SITE_DIR 環境變數覆寫（Dockerfile 已設定）。
    #       2. 相對本檔的 ../docs/site。
    #       3. /app/docs/site（Docker 佈局）。
    #     若文件尚未 build 出來則回傳 None，路由會被靜默略過
    #     （本機未跑 mkdocs build 時）。
    candidates: list[Path] = []
    env_path = os.environ.get("MKDOCS_SITE_DIR")
    if env_path:
        candidates.append(Path(env_path))
    here = Path(__file__).resolve().parent
    candidates.append(here.parent / "docs" / "site")
    candidates.append(Path("/app/docs/site"))
    for p in candidates:
        if p.is_dir() and (p / "index.html").is_file():
            return p
    return None


# ─── /docs — MkDocs static site (Phase 10) ───
# EN: Mount BEFORE the SPA catch-all so /docs/** resolves to the MkDocs site
#     instead of falling back to React's index.html. `html=True` lets
#     StaticFiles serve `/docs/foo/` as `/docs/foo/index.html`.
# zh-TW: 在 SPA catch-all 之前掛載，這樣 /docs/** 會命中 MkDocs 而非
#     React 的 index.html。`html=True` 會自動把 `/docs/foo/` 解析為
#     `/docs/foo/index.html`。
_mkdocs_site = _resolve_mkdocs_site()
if _mkdocs_site is not None:
    app.mount(
        "/docs",
        StaticFiles(directory=str(_mkdocs_site), html=True),
        name="mkdocs",
    )


_dist = _resolve_frontend_dist()
if _dist is not None:
    # EN: Mount /assets first so hashed JS/CSS resolve correctly.
    # zh-TW: 先掛載 /assets，讓 Vite 產生的雜湊資源能正確命中。
    assets_dir = _dist / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    # EN: Static files at the dist root (favicon, robots.txt, etc.).
    # zh-TW: dist 根目錄下的靜態資源（favicon、robots.txt 等）。
    @app.get("/{filename:path}", include_in_schema=False)
    async def spa_fallback(filename: str):
        # EN: Skip API/WS-style and docs-style paths so they don't collide
        #     with this catch-all. /docs is served by the MkDocs StaticFiles
        #     mount above; /api-docs and /api-redoc are FastAPI's own.
        # zh-TW: 跳過 API/WS 與文件相關路徑，避免與 catch-all 衝突。
        #     /docs 由上面的 MkDocs StaticFiles 提供；
        #     /api-docs、/api-redoc 由 FastAPI 自己處理。
        if filename.startswith((
            "api/", "api-docs", "api-redoc",
            "ws", "health", "docs", "docs/",
        )):
            raise HTTPException(status_code=404)
        candidate = _dist / filename
        if filename and candidate.is_file():
            return FileResponse(candidate)
        # EN: SPA history fallback — return index.html for any unknown route.
        # zh-TW: SPA 歷史路由 fallback — 任何未知路徑都回 index.html。
        return FileResponse(_dist / "index.html")
