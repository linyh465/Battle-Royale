from __future__ import annotations

import asyncio
import json
import socket
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from engine import GameEngine

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
async def lifespan(app: FastAPI):
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


app = FastAPI(title="Continuous Deathmatch Server", lifespan=lifespan)
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
