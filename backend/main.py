from __future__ import annotations

import asyncio
import json
import os
import socket
import time
import uuid
from collections import deque
from contextlib import asynccontextmanager
from pathlib import Path
from threading import Lock

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from engine import GameEngine
from models import ALL_WEAPON_IDS as _ALL_WEAPON_IDS_TUPLE

engine = GameEngine()


# ── Phase 20: WebSocket connection rate limiter ────────────────────────────
# EN: Basic anti-bot / anti-DoS rate limiter for the /ws endpoint. We keep a
#     sliding window of recent connection timestamps per client IP and reject
#     any handshake that would exceed the cap. This is intentionally simple
#     (no Redis, no external state) — it's enough to stop a single host from
#     opening hundreds of sockets per second to spam the game loop. Limits:
#       WS_RATE_LIMIT_PER_IP     — max connections per window
#       WS_RATE_LIMIT_WINDOW_SEC — window length in seconds
#     Both are tunable via environment variables.
# zh-TW: /ws 端點的基本防 bot / 防 DoS 連線速率限制。針對每個來源 IP 維護一個
#     最近連線時間戳的滑動視窗，超過上限的 handshake 直接拒絕。設計刻意極簡
#     （不依賴 Redis 或外部狀態），目的是阻止單一主機每秒打開上百個 socket
#     刷爆遊戲迴圈。可透過環境變數調整：
#       WS_RATE_LIMIT_PER_IP     — 視窗內最大連線數
#       WS_RATE_LIMIT_WINDOW_SEC — 視窗長度（秒）
_WS_RATE_LIMIT_PER_IP = int(os.environ.get("WS_RATE_LIMIT_PER_IP", "10"))
_WS_RATE_LIMIT_WINDOW_SEC = float(os.environ.get("WS_RATE_LIMIT_WINDOW_SEC", "5.0"))
_ws_rate_buckets: dict[str, deque[float]] = {}
_ws_rate_lock = Lock()


def _ws_rate_limit_ok(ip: str) -> bool:
    # EN: Return True if a connection from `ip` is allowed right now, else False.
    #     Empty IP (unknown peer) is always allowed — we don't want to lock out
    #     legitimate clients behind misconfigured proxies. The bucket is pruned
    #     of stale entries on every call so memory stays bounded.
    # zh-TW: 若此 IP 此刻允許建立連線回傳 True，否則 False。空 IP（未知 peer）
    #     一律放行，避免代理設定錯誤把正常使用者鎖在外面。每次呼叫都會修剪
    #     過期紀錄，確保記憶體用量有界。
    if not ip:
        return True
    now = time.monotonic()
    cutoff = now - _WS_RATE_LIMIT_WINDOW_SEC
    with _ws_rate_lock:
        bucket = _ws_rate_buckets.setdefault(ip, deque())
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= _WS_RATE_LIMIT_PER_IP:
            return False
        bucket.append(now)
        # EN: Lightweight GC: occasionally drop empty buckets so the dict
        #     doesn't grow without bound for one-off visitors.
        # zh-TW: 輕量 GC：偶爾清掉空 bucket，避免一次性訪客讓 dict 無限成長。
        if len(_ws_rate_buckets) > 1024:
            for stale_ip in [k for k, v in _ws_rate_buckets.items() if not v]:
                _ws_rate_buckets.pop(stale_ip, None)
        return True


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


# EN: Phase 15 — FastAPI's auto-generated docs continue to live at /api-docs
#     so they don't shadow the React SPA route /docs/* (which is now served
#     entirely by the frontend, see frontend/src/components/Docs.jsx).
# zh-TW: Phase 15 — FastAPI 內建文件仍掛在 /api-docs，避免與前端 /docs/* 路由衝突
#     （/docs 已改由 React SPA 中的 Docs.jsx 全權處理）。
app = FastAPI(
    title="Continuous Deathmatch Server",
    lifespan=lifespan,
    docs_url="/api-docs",
    redoc_url="/api-redoc",
    openapi_url="/api-docs/openapi.json",
    swagger_ui_oauth2_redirect_url="/api-docs/oauth2-redirect",
)
# EN: Phase 23 — CORS lockdown. The default was `allow_origins=["*"]` which
#     happily authorised any third-party site to call /api/* and embed the
#     game. Production deploys should pin this to the front-door origins via
#     the `ALLOWED_ORIGINS` env var (comma-separated). Empty / unset falls
#     back to the historical wildcard for local LAN development only.
# zh-TW: Phase 23 — CORS 強化。原本 `allow_origins=["*"]` 等於允許任何第三方
#     站台呼叫 /api/* 或內嵌遊戲。正式部署可透過 `ALLOWED_ORIGINS` 環境變數
#     （逗號分隔）鎖定來源，未設定時保留 wildcard 以便本機 / LAN 開發。
_allowed_origins_raw = os.environ.get("ALLOWED_ORIGINS", "").strip()
_allowed_origins = (
    [o.strip() for o in _allowed_origins_raw.split(",") if o.strip()]
    if _allowed_origins_raw else ["*"]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["GET", "POST", "OPTIONS"],
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
    return {
        "allowed_weapons": engine.settings.allowed_weapons,
        "all_weapons": list(_ALL_WEAPON_IDS_TUPLE),
    }


# ── Helper: build the current admin settings dict ──
def _admin_settings_dict() -> dict:
    # EN: Phase 20 — `team_mode` removed alongside the Teams feature.
    # zh-TW: Phase 20 — 隨著隊伍功能移除，已刪除 `team_mode`。
    return {
        "leaderboard_sort_by": engine.settings.leaderboard_sort_by,
        "base_respawn_time": engine.settings.base_respawn_time,
        "respawn_penalty": engine.settings.respawn_penalty,
        "game_duration": engine.settings.game_duration,
        "leaderboard_columns": engine.settings.leaderboard_columns,
        "bots_enabled": engine.settings.bots_enabled,
        "bot_count": engine.settings.bot_count,
        "default_player_hp": engine.settings.default_player_hp,
        "default_bot_hp": engine.settings.default_bot_hp,
        "bot_max_attack_limit": engine.settings.bot_max_attack_limit,
    }


def _client_ip(ws: WebSocket) -> str:
    # EN: Phase 15 — derive a best-effort client IP. Prefer the standard
    #     proxy headers (X-Forwarded-For / X-Real-IP) since Railway terminates
    #     TLS at an edge proxy, then fall back to the raw socket peer.
    #     This value goes into engine.devices and is shown ONLY in the admin
    #     panel — it is never broadcast to other players.
    # zh-TW: Phase 15 — 盡可能取得真實客戶端 IP。優先讀取代理標頭
    #     （X-Forwarded-For / X-Real-IP），因為 Railway 等平台會在邊緣
    #     終止 TLS；找不到再退回 socket peer。此值僅進入 engine.devices，
    #     只會出現在管理員面板，絕不廣播給其他玩家。
    headers = {k.lower(): v for k, v in ws.headers.items()}
    fwd = headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    real = headers.get("x-real-ip", "")
    if real:
        return real.strip()
    client = ws.client
    return client.host if client else ""


def _client_ua(ws: WebSocket) -> str:
    # EN: Phase 15 — User-Agent of the joining socket. Used only for the
    #     admin device-tracking column.
    # zh-TW: Phase 15 — 加入此 socket 的 User-Agent。僅供管理員設備追蹤欄使用。
    return ws.headers.get("user-agent", "") or ""


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    # EN: Phase 20 — rate-limit connections by client IP BEFORE accepting the
    #     handshake. A malicious bot trying to open hundreds of sockets per
    #     second from one host will hit the cap and get a 1008 close instead
    #     of being able to inject join_admin / join_director attempts. The
    #     IP is derived using the same proxy-aware helper used for the admin
    #     panel device fingerprint.
    # zh-TW: Phase 20 — 在 accept 之前先依來源 IP 做連線速率限制。惡意 bot 試圖
    #     從同一台主機每秒開上百個 socket 時會被擋下並收到 1008 close，無法
    #     灌注 join_admin / join_director 等 handshake。IP 取得方式與管理員面板
    #     設備指紋共用同一個代理感知 helper。
    ip = _client_ip(ws)
    if not _ws_rate_limit_ok(ip):
        # EN: 1008 = policy violation. We deliberately do NOT accept first;
        #     a non-accepted reject is cheaper for the server and exposes
        #     less surface to an attacker.
        # zh-TW: 1008 = 政策違反。刻意不先 accept；直接拒絕對伺服器更便宜，
        #     也減少攻擊面。
        await ws.close(code=1008)
        return

    await ws.accept()
    try:
        raw = await ws.receive_text()
        hello = json.loads(raw)
    except (WebSocketDisconnect, json.JSONDecodeError):
        await ws.close()
        return

    htype = hello.get("type")

    # ─── Director handshake ───
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

    # ─── Non-Combatant Admin handshake ───
    if htype == "join_admin":
        pwd = str(hello.get("password", ""))
        if pwd != engine.settings.admin_password:
            # EN: Phase 23 — sleep before responding so a brute-force attacker
            #     cannot blast through the password space at network speed.
            #     One second per attempt + the existing WS rate limit
            #     (10 connections / 5 s / IP) caps a single attacker at
            #     ~120 attempts/min, raising the cost of guessing a weak
            #     default password substantially. Legit admins typing the
            #     right password the first time pay zero penalty.
            # zh-TW: Phase 23 — 在回應失敗前刻意延遲，避免攻擊者以網路速度
            #     高速嘗試密碼。每次失敗延遲 1 秒，搭配既有的 WS 速率限制
            #     （每個 IP 5 秒最多 10 連線），單一攻擊者每分鐘最多約 120
            #     次嘗試，大幅提高暴力破解預設弱密碼的代價。正確密碼
            #     一次過關的合法管理員完全沒有額外延遲。
            await asyncio.sleep(1.0)
            await ws.send_text(json.dumps({"type": "admin_fail"}))
            await ws.close(code=4001)
            return

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
                    engine.admin_set(msg.get("key"), msg.get("value"))
                elif mtype == "admin_force_respawn":
                    engine.admin_force_respawn(msg.get("player_id"))
                elif mtype == "admin_force_respawn_all":
                    engine.admin_force_respawn_all()
                elif mtype == "admin_batch_reduce_respawn":
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
    if htype != "join":
        await ws.close(code=4000)
        return

    # EN: Phase 15 — capture device fingerprint (IP + User-Agent) for the
    #     admin panel. Stored on engine.devices, NEVER broadcast.
    # zh-TW: Phase 15 — 擷取設備指紋（IP + User-Agent）給管理員面板。
    #     存於 engine.devices，絕不廣播。
    player = engine.add_player(
        hello.get("name", "anon"),
        ws,
        ip=_client_ip(ws),
        user_agent=_client_ua(ws),
    )
    if hello.get("weapon"):
        engine.set_weapon(player.id, hello["weapon"])
    await ws.send_text(json.dumps({"type": "welcome", "player_id": player.id}))

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
                if str(msg.get("password", "")) == engine.settings.admin_password:
                    is_admin = True
                    engine.admin_conns.add(player.id)
                    await ws.send_text(json.dumps({
                        "type": "admin_ok",
                        "settings": _admin_settings_dict(),
                    }))
                else:
                    # EN: Phase 23 — same 1-second brute-force throttle as
                    #     the dedicated join_admin handshake. The lobby
                    #     5-click easter-egg path lands here, so the cost
                    #     of guessing must be uniform regardless of entry.
                    # zh-TW: Phase 23 — 與獨立 join_admin handshake 相同的
                    #     1 秒延遲。大廳 5 連點彩蛋走的就是這條路徑，
                    #     必須與另一條入口共用一致的延遲，才不會被當作旁路。
                    await asyncio.sleep(1.0)
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


# ─── Static SPA mount ───
# EN: Phase 15 — MkDocs static mount has been REMOVED. The /docs route is
#     now owned entirely by the React SPA (Docs.jsx) — see App.jsx routes
#     /docs/en and /docs/zh-TW. The SPA fallback below already returns
#     index.html for any unknown path, which lets React Router pick up
#     /docs/* and render the Docs component.
# zh-TW: Phase 15 — 已完全移除 MkDocs 靜態掛載。/docs 路由全部交給 React SPA
#     接手（Docs.jsx），見 App.jsx 中的 /docs/en 與 /docs/zh-TW。下方
#     SPA fallback 已會把未知路徑回傳 index.html，React Router 會自動
#     接管 /docs/* 並渲染 Docs 元件。
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


_dist = _resolve_frontend_dist()
if _dist is not None:
    assets_dir = _dist / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    # EN: Phase 15 — `docs` is REMOVED from the reserved-prefixes list so
    #     /docs/en and /docs/zh-TW fall through to the SPA index.html and
    #     React Router renders the new Docs component.
    # zh-TW: Phase 15 — 從保留路徑清單移除 `docs`，讓 /docs/en 與 /docs/zh-TW
    #     直接落到 SPA fallback（index.html），由 React Router 渲染新的
    #     Docs 元件。
    _RESERVED_PREFIXES = (
        "api/", "api-docs", "api-redoc",
        "ws", "health",
        "assets/",
    )

    # EN: Phase 23 — path-traversal hardening. Previously the handler did
    #     `candidate = _dist / filename; if candidate.is_file(): return …`,
    #     which a crafted URL like `/../etc/passwd` could potentially walk
    #     above `_dist`. We now `.resolve()` the candidate and require it
    #     to be a descendant of `_dist.resolve()`; anything outside the
    #     dist tree falls back to `index.html` (the safe SPA behaviour).
    # zh-TW: Phase 23 — 路徑穿越強化。先前 handler 直接以 `_dist / filename`
    #     組路徑後檢查 `is_file()`，被特製 URL（如 `/../etc/passwd`）打中時
    #     可能跳出 `_dist`。改為先 `.resolve()` 再要求結果必須位於
    #     `_dist.resolve()` 之下；不在 dist 子樹的請求一律退回 SPA 的
    #     `index.html`。
    _dist_resolved = _dist.resolve()

    @app.get("/{filename:path}", include_in_schema=False)
    async def spa_fallback(filename: str):
        if filename.startswith(_RESERVED_PREFIXES):
            raise HTTPException(status_code=404)
        if filename:
            try:
                candidate = (_dist / filename).resolve()
            except (OSError, ValueError):
                candidate = None
            if candidate is not None:
                try:
                    candidate.relative_to(_dist_resolved)
                    inside = True
                except ValueError:
                    inside = False
                if inside and candidate.is_file():
                    return FileResponse(candidate)
        return FileResponse(_dist / "index.html")
