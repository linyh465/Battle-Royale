from __future__ import annotations

import asyncio
import json
import math
import random
import time
from dataclasses import dataclass
from typing import Dict, List, Set

from models import (
    Bullet,
    Player,
    BotPlayer,
    Pistol,
    Rifle,
    Shotgun,
    STATE_ALIVE,
    STATE_DEAD,
    STATE_SPECTATING,
)

TICK_RATE = 30
TICK_DT = 1.0 / TICK_RATE
WORLD_W = 2560
WORLD_H = 1440

WEAPON_REGISTRY = {
    "pistol": Pistol,
    "rifle": Rifle,
    "shotgun": Shotgun,
}


@dataclass
class GameSettings:
    admin_password: str = "0909"
    team_mode: bool = False
    leaderboard_sort_by: str = "kills"
    base_respawn_time: float = 5.0
    respawn_penalty: float = 3.0
    game_duration: float = 0.0
    leaderboard_columns: str = "kills,deaths,damage_dealt,damage_taken"
    # HP defaults
    default_player_hp: float = 200.0
    default_bot_hp: float = 50.0
    bot_respawn_time: float = 15.0
    bot_atk_speed_min: float = 0.2
    bot_atk_speed_max: float = 1.0
    # Standalone bot management
    bots_enabled: bool = False
    bot_count: int = 0


# ── NOTE: SafeZone / Poison Zone has been REMOVED in Phase 2. ──
# ── 備註：SafeZone / 毒圈已在 Phase 2 中完全移除。           ──


class GameEngine:
    """EN: Authoritative server-side simulation, 30 Hz tick.
       Continuous Deathmatch — no shrinking zone.
       zh-TW: 伺服器端權威模擬，30 Hz tick。
       持續餘燼模式 — 無縮圈。"""

    def __init__(self, world_w: int = WORLD_W, world_h: int = WORLD_H) -> None:
        self.world_w = world_w
        self.world_h = world_h
        self.players: Dict[str, Player] = {}
        self.bullets: List[Bullet] = []
        # EN: Player WebSocket connections (mapped by player ID).
        # zh-TW: 玩家 WebSocket 連線（以玩家 ID 為鍵值）。
        self.connections: Dict[str, "WebSocketLike"] = {}
        # EN: Director WS connections — receive snapshots, send no inputs.
        # zh-TW: 導播連線只收快照、不送輸入。
        self.directors: List["WebSocketLike"] = []

        # EN: Non-combatant admin WebSocket connections.
        #     Admins do NOT have a Player object — they cannot be killed
        #     and have no map coordinates.  They receive the global game
        #     state and can send administrative payloads.
        # zh-TW: 非戰鬥管理員 WebSocket 連線。
        #     管理員沒有 Player 物件 — 無法被擊殺，也沒有地圖座標。
        #     管理員接收全域遊戲狀態並可送出管理指令。
        self.admin_ws: Dict[str, "WebSocketLike"] = {}
        # EN: Legacy set kept for backward-compat checks elsewhere.
        # zh-TW: 舊版集合，保留供其他模組向後相容使用。
        self.admin_conns: Set[str] = set()

        self.settings = GameSettings()
        # EN: Poison zone removed — continuous open arena.
        # zh-TW: 毒圈已移除 — 持續開放競技場。
        self._running = False
        self._tick = 0
        self.game_end_time: float = 0.0
        self.game_over: bool = False
        self.reset_seq: int = 0
        self._standalone_bot_ids: Set[str] = set()

    # ──────────── Spawning / 生成 ────────────
    def _spawn_position(self) -> tuple[float, float]:
        # EN: Random position within world bounds (60 px margin).
        # zh-TW: 在世界邊界內隨機位置（留 60 px 邊距）。
        return (
            random.uniform(60, self.world_w - 60),
            random.uniform(60, self.world_h - 60),
        )

    def add_player(self, name: str, ws) -> Player:
        # EN: Creates a new combatant Player and registers the WS connection.
        # zh-TW: 建立新的戰鬥玩家並註冊其 WebSocket 連線。
        x, y = self._spawn_position()
        p = Player(name=name or "anon", x=x, y=y)
        p.max_hp = self.settings.default_player_hp
        p.hp = p.max_hp
        if self.settings.team_mode:
            p.team = self._next_team_assignment()
        self.players[p.id] = p
        self.connections[p.id] = ws
        if self.settings.team_mode:
            self._balance_with_bots()
        return p

    def add_bot(self, team: str = "") -> BotPlayer:
        x, y = self._spawn_position()
        bot = BotPlayer(name="", x=x, y=y, team=team)
        bot.max_hp = self.settings.default_bot_hp
        bot.hp = bot.max_hp
        self.players[bot.id] = bot
        return bot

    def remove_player(self, pid: str) -> None:
        # EN: Remove a combatant player and their connection.
        # zh-TW: 移除戰鬥玩家及其連線。
        self.players.pop(pid, None)
        self.connections.pop(pid, None)
        self.admin_conns.discard(pid)
        if self.settings.team_mode:
            self._balance_with_bots()

    def remove_admin(self, admin_id: str) -> None:
        # EN: Remove a non-combatant admin connection (no Player to clean up).
        # zh-TW: 移除非戰鬥管理員連線（無需清除 Player 物件）。
        self.admin_ws.pop(admin_id, None)
        self.admin_conns.discard(admin_id)

    def set_weapon(self, pid: str, weapon_name: str) -> None:
        p = self.players.get(pid)
        cls = WEAPON_REGISTRY.get(weapon_name)
        if p and cls:
            p.weapon = cls()

    def apply_input(self, pid: str, msg: dict) -> None:
        p = self.players.get(pid)
        if not p or p.state != STATE_ALIVE:
            return
        p.apply_input(
            dx=float(msg.get("dx", 0.0)),
            dy=float(msg.get("dy", 0.0)),
            angle=float(msg.get("angle", 0.0)),
            fire=bool(msg.get("fire", False)),
        )

    # ──────────── Respawn / spectate / 重生 / 觀戰 ────────────
    def request_respawn(self, pid: str) -> None:
        # EN: Player-initiated respawn — blocked until respawn_at has passed.
        # zh-TW: 玩家主動重生 — 必須等到 respawn_at 後才能執行。
        p = self.players.get(pid)
        if not p or p.state == STATE_ALIVE:
            return
        if time.perf_counter() < p.respawn_at:
            return
        x, y = self._spawn_position()
        p.max_hp = self.settings.default_bot_hp if p.is_bot else self.settings.default_player_hp
        p.respawn(x, y)

    def request_spectate(self, pid: str) -> None:
        p = self.players.get(pid)
        if not p:
            return
        if p.state == STATE_DEAD:
            p.state = STATE_SPECTATING

    # ──────────── Admin controls / 管理員控制 ────────────
    def admin_force_respawn(self, target_pid: str) -> None:
        # EN: Force-respawn a specific player, bypassing the penalty timer.
        # zh-TW: 強制重生指定玩家，跳過懲罰計時器。
        p = self.players.get(target_pid)
        if not p:
            return
        x, y = self._spawn_position()
        p.max_hp = self.settings.default_bot_hp if p.is_bot else self.settings.default_player_hp
        p.respawn(x, y)

    def admin_force_respawn_all(self) -> None:
        # EN: Force-respawn every dead / spectating player immediately.
        # zh-TW: 立即強制重生所有已陣亡 / 觀戰中的玩家。
        for p in self.players.values():
            if p.state in (STATE_DEAD, STATE_SPECTATING):
                x, y = self._spawn_position()
                p.max_hp = self.settings.default_bot_hp if p.is_bot else self.settings.default_player_hp
                p.respawn(x, y)

    def admin_batch_reduce_respawn(self, seconds: float) -> None:
        # EN: Reduce every dead player's remaining respawn timer by *seconds*.
        #     If the timer drops below now, it becomes immediately respawnable.
        # zh-TW: 將所有已陣亡玩家的剩餘重生計時器減少 *seconds* 秒。
        #     若計時器低於當前時間，則可立即重生。
        now = time.perf_counter()
        for p in self.players.values():
            if p.state in (STATE_DEAD, STATE_SPECTATING) and p.respawn_at > now:
                p.respawn_at = max(now, p.respawn_at - seconds)

    def admin_batch_reset_respawn(self) -> None:
        # EN: Reset every dead player's respawn timer to *now* (instant respawn).
        # zh-TW: 將所有已陣亡玩家的重生計時器歸零（可立即重生）。
        now = time.perf_counter()
        for p in self.players.values():
            if p.state in (STATE_DEAD, STATE_SPECTATING):
                p.respawn_at = now

    def admin_force_kill(self, target_pid: str) -> None:
        # EN: Admin force-kill a specific alive player.
        # zh-TW: 管理員強制擊殺指定的存活玩家。
        p = self.players.get(target_pid)
        if not p or p.state != STATE_ALIVE:
            return
        now = time.perf_counter()
        self._kill(p, None, now)

    def admin_reset_match(self) -> None:
        # EN: Reset all player stats and respawn everyone.
        # zh-TW: 重置所有玩家統計並全部重生。
        self.reset_seq += 1
        self.game_over = False
        if self.settings.game_duration > 0:
            self.game_end_time = time.perf_counter() + self.settings.game_duration
        else:
            self.game_end_time = 0.0
        for p in self.players.values():
            p.kills = 0
            p.deaths = 0
            p.damage_dealt = 0.0
            p.damage_taken = 0.0
            p.killed_by_name = ""
            p.killed_by_weapon = ""
            x, y = self._spawn_position()
            p.max_hp = self.settings.default_bot_hp if p.is_bot else self.settings.default_player_hp
            p.respawn(x, y)

    def admin_kick_bots(self) -> None:
        # EN: Remove all bot players from the match.
        # zh-TW: 將所有 Bot 踢出比賽。
        bot_ids = [pid for pid, p in list(self.players.items()) if p.is_bot]
        for pid in bot_ids:
            self.players.pop(pid, None)
            self.connections.pop(pid, None)

    def admin_set_game_timer(self, seconds: float) -> None:
        # EN: Set a new game countdown timer. 0 = disable.
        # zh-TW: 設定新的遊戲倒數計時器。0 = 停用。
        now = time.perf_counter()
        if seconds <= 0:
            self.settings.game_duration = 0.0
            self.game_end_time = 0.0
            self.game_over = False
        else:
            self.settings.game_duration = seconds
            self.game_end_time = now + seconds
            self.game_over = False

    def admin_adjust_game_timer(self, delta: float) -> None:
        # EN: Extend (+) or shorten (-) the remaining game time.
        # zh-TW: 延長（+）或縮短（-）剩餘遊戲時間。
        if self.settings.game_duration <= 0 or self.game_end_time <= 0:
            return
        now = time.perf_counter()
        self.game_end_time = max(now + 1, self.game_end_time + delta)

    def admin_end_game_now(self) -> None:
        self.game_over = True
        self.game_end_time = 0.0

    def admin_set_all_hp(self, hp: float, target: str = "all") -> None:
        # EN: Bulk-set max HP for all players / all bots / everyone.
        # zh-TW: 批次設定所有玩家 / 所有 Bot / 全體的最大 HP。
        for p in self.players.values():
            if target == "players" and p.is_bot:
                continue
            if target == "bots" and not p.is_bot:
                continue
            p.max_hp = hp
            p.hp = hp

    def admin_set_player_hp(self, pid: str, hp: float) -> None:
        # EN: Set max HP and current HP for a single player.
        # zh-TW: 設定單一玩家的最大與當前 HP。
        p = self.players.get(pid)
        if not p:
            return
        p.max_hp = hp
        p.hp = hp

    def _sync_standalone_bots(self) -> None:
        # EN: Add / remove standalone bots to match the configured bot_count.
        # zh-TW: 新增或移除獨立 Bot，使其數量符合設定的 bot_count。
        target = self.settings.bot_count if self.settings.bots_enabled else 0
        current = [pid for pid in list(self._standalone_bot_ids) if pid in self.players]
        self._standalone_bot_ids = set(current)

        while len(current) > target:
            pid = current.pop()
            self.players.pop(pid, None)
            self.connections.pop(pid, None)
            self._standalone_bot_ids.discard(pid)

        while len(current) < target:
            bot = self.add_bot()
            bot.max_hp = self.settings.default_bot_hp
            bot.hp = bot.max_hp
            self._standalone_bot_ids.add(bot.id)
            current.append(bot.id)

    def admin_set(self, key: str, value) -> None:
        # EN: Generic admin setter for GameSettings fields.
        # zh-TW: 泛用管理員設定器，修改 GameSettings 欄位。
        if not key or not hasattr(self.settings, key):
            return
        cur = getattr(self.settings, key)
        try:
            if isinstance(cur, bool):
                value = bool(value)
            elif isinstance(cur, int) and not isinstance(cur, bool):
                value = int(value)
            elif isinstance(cur, float):
                value = float(value)
            else:
                value = str(value)
            setattr(self.settings, key, value)
        except (TypeError, ValueError):
            return
        if key == "team_mode":
            self._sync_team_mode()
        elif key in ("bots_enabled", "bot_count"):
            self._sync_standalone_bots()

    def _sync_team_mode(self) -> None:
        if self.settings.team_mode:
            for p in list(self.players.values()):
                if not p.is_bot and not p.team:
                    p.team = self._next_team_assignment()
            self._balance_with_bots()
        else:
            # EN: tear down teams + remove every bot.
            # zh-TW: 解散隊伍並移除全部 bot。
            for pid, p in list(self.players.items()):
                if p.is_bot:
                    self.players.pop(pid, None)
                else:
                    p.team = ""

    def _next_team_assignment(self) -> str:
        red = sum(1 for p in self.players.values() if p.team == "red")
        blue = sum(1 for p in self.players.values() if p.team == "blue")
        return "red" if red <= blue else "blue"

    def _balance_with_bots(self) -> None:
        # EN: keep red/blue head-counts equal by adding bots to the underdog.
        # zh-TW: 以 Bot 補滿少的那一隊，保持紅藍人數相等。
        red = sum(1 for p in self.players.values() if p.team == "red")
        blue = sum(1 for p in self.players.values() if p.team == "blue")
        while red < blue:
            self.add_bot(team="red"); red += 1
        while blue < red:
            self.add_bot(team="blue"); blue += 1

    # ──────────── Simulation / 模擬 ────────────
    def step(self, dt: float, now: float) -> None:
        self._tick += 1

        # EN: Check game timer expiry.
        # zh-TW: 檢查遊戲計時器是否到期。
        if (not self.game_over
                and self.settings.game_duration > 0
                and self.game_end_time > 0
                and now >= self.game_end_time):
            self.game_over = True

        if self.game_over:
            return

        all_players = list(self.players.values())
        for p in all_players:
            if isinstance(p, BotPlayer):
                if p.state == STATE_DEAD and now >= p.respawn_at:
                    x, y = self._spawn_position()
                    p.max_hp = self.settings.default_bot_hp
                    p.respawn(x, y)
                else:
                    p.ai_step(all_players, self.world_w, self.world_h, now, self.settings.bot_atk_speed_min, self.settings.bot_atk_speed_max)

        for p in self.players.values():
            p.update(dt)
            if p.state == STATE_ALIVE:
                self._clamp_to_world(p)

        for p in list(self.players.values()):
            self.bullets.extend(p.shoot(now))

        for b in self.bullets:
            b.update(dt)
            if b.x < 0 or b.y < 0 or b.x > self.world_w or b.y > self.world_h:
                b.alive = False

        self._resolve_bullet_hits(now)
        # EN: Poison zone step removed — continuous deathmatch, no zone damage.
        # zh-TW: 毒圈步驟已移除 — 持續餘燼模式，無圈外傷害。
        self.bullets = [b for b in self.bullets if b.alive]

    def _clamp_to_world(self, p: Player) -> None:
        p.x = max(0.0, min(self.world_w - p.w, p.x))
        p.y = max(0.0, min(self.world_h - p.h, p.y))

    def _resolve_bullet_hits(self, now: float) -> None:
        for b in self.bullets:
            if not b.alive:
                continue
            owner = self.players.get(b.owner_id)
            for p in self.players.values():
                if p.state != STATE_ALIVE or p.id == b.owner_id:
                    continue
                # EN: friendly fire off in team mode.
                # zh-TW: team mode 下不誤傷友軍。
                if (self.settings.team_mode and owner and owner.team
                        and owner.team == p.team):
                    continue
                if b.collides_with(p):
                    killed = p.take_damage(b.damage)
                    if owner is not None:
                        owner.damage_dealt += b.damage
                    b.alive = False
                    if killed:
                        self._kill(p, owner, now)
                    break

    # EN: _update_safe_zone removed — no poison zone in Continuous Deathmatch.
    # zh-TW: _update_safe_zone 已移除 — 持續餘燼模式無毒圈。

    def _kill(self, victim: Player, killer, now: float) -> None:
        # EN: Mark victim as dead, apply respawn penalty.
        # zh-TW: 將受害者標記為死亡，套用重生懲罰。
        victim.alive = False
        victim.state = STATE_DEAD
        victim.deaths += 1
        # EN: penalty respawn formula — Wait = base + deaths * penalty.
        # zh-TW: 重生懲罰公式 — 等待 = 基礎 + 死亡次數 × 懲罰。
        if victim.is_bot:
            wait = self.settings.bot_respawn_time
        else:
            wait = (
                self.settings.base_respawn_time
                + victim.deaths * self.settings.respawn_penalty
            )
        victim.respawn_at = now + wait
        if killer is not None and killer is not victim:
            killer.kills += 1
            victim.killed_by_name = killer.name
            victim.killed_by_weapon = killer.weapon.name
        else:
            victim.killed_by_name = ""
            victim.killed_by_weapon = ""

    # ──────────── Networking / 網路通訊 ────────────
    def snapshot(self) -> dict:
        # EN: Build the authoritative state snapshot broadcast each tick.
        # zh-TW: 建構每 tick 廣播的權威狀態快照。
        now = time.perf_counter()
        if self.settings.game_duration > 0 and self.game_end_time > 0 and not self.game_over:
            time_remaining = round(max(0.0, self.game_end_time - now), 1)
        else:
            time_remaining = 0.0
        return {
            "type": "state",
            "tick": self._tick,
            "now": now,
            "world": {"w": self.world_w, "h": self.world_h},
            "settings": {
                "team_mode": self.settings.team_mode,
                "leaderboard_sort_by": self.settings.leaderboard_sort_by,
                "base_respawn_time": self.settings.base_respawn_time,
                "respawn_penalty": self.settings.respawn_penalty,
                "game_duration": self.settings.game_duration,
                "leaderboard_columns": self.settings.leaderboard_columns,
                "bots_enabled": self.settings.bots_enabled,
                "bot_count": self.settings.bot_count,
                "bot_respawn_time": self.settings.bot_respawn_time,
                "bot_atk_speed_min": self.settings.bot_atk_speed_min,
                "bot_atk_speed_max": self.settings.bot_atk_speed_max,
                "default_player_hp": self.settings.default_player_hp,
                "default_bot_hp": self.settings.default_bot_hp,
            },
            "game_over": self.game_over,
            "game_time_remaining": time_remaining,
            "reset_seq": self.reset_seq,
            "players": [p.to_dict() for p in self.players.values()],
            "bullets": [b.to_dict() for b in self.bullets],
        }

    async def broadcast(self) -> None:
        # EN: Send the snapshot to all player, admin, and director connections.
        # zh-TW: 將快照廣播給所有玩家、管理員與導播連線。
        payload = json.dumps(self.snapshot())
        dead_pids: List[str] = []
        for pid, ws in self.connections.items():
            try:
                await ws.send_text(payload)
            except Exception:
                dead_pids.append(pid)
        # EN: Broadcast to non-combatant admins.
        # zh-TW: 廣播給非戰鬥管理員。
        dead_admins: List[str] = []
        for aid, ws in self.admin_ws.items():
            try:
                await ws.send_text(payload)
            except Exception:
                dead_admins.append(aid)
        dead_directors: List = []
        for ws in list(self.directors):
            try:
                await asyncio.wait_for(ws.send_text(payload), timeout=0.05)
            except Exception:
                dead_directors.append(ws)
        for ws in dead_directors:
            if ws in self.directors:
                self.directors.remove(ws)
        for pid in dead_pids:
            self.remove_player(pid)
        for aid in dead_admins:
            self.remove_admin(aid)

    async def run(self) -> None:
        self._running = True
        last = time.perf_counter()
        while self._running:
            now = time.perf_counter()
            dt = now - last
            last = now
            self.step(dt, now)
            await self.broadcast()
            elapsed = time.perf_counter() - now
            await asyncio.sleep(max(0.0, TICK_DT - elapsed))

    def stop(self) -> None:
        self._running = False


class WebSocketLike:
    async def send_text(self, data: str) -> None: ...
    async def receive_text(self) -> str: ...
