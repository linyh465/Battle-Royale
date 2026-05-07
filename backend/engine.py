from __future__ import annotations

import asyncio
import json
import os
import random
import time
from dataclasses import dataclass
from typing import Dict, List, Set

from models import (
    ALL_WEAPON_IDS,
    Bullet,
    Player,
    BotPlayer,
    Pistol,
    Rifle,
    Shotgun,
    Sniper,
    SMG,
    RocketLauncher,
    STATE_ALIVE,
    STATE_DEAD,
    STATE_SPECTATING,
)

# EN: TICK_RATE is configurable via env (TICK_RATE_HZ). Default 20 Hz to keep
#     bandwidth low on Railway's Hobby tier — frontend Canvas interpolation
#     covers smoothness between snapshots.
# zh-TW: 透過環境變數 TICK_RATE_HZ 調整 tick 頻率，預設 20 Hz 以節省頻寬。
#     前端 Canvas 內插平滑可彌補較低的 tick 頻率。
def _read_tick_rate() -> int:
    try:
        v = int(os.environ.get("TICK_RATE_HZ", "20"))
        return max(5, min(60, v))
    except (TypeError, ValueError):
        return 20


TICK_RATE = _read_tick_rate()
TICK_DT = 1.0 / TICK_RATE
WORLD_W = 2560
WORLD_H = 1440

# EN: Phase 15 — match-state machine for the new "Post-Game Sandbox Brawl".
#     PLAYING       — normal authoritative match.
#     POST_GAME     — timer expired or admin ended the game; leaderboard is
#                     FROZEN at the snapshot taken at transition. Players
#                     may continue to fight & respawn (sandbox), but the
#                     frozen leaderboard never changes again.
#     Admin "Reset Match" snaps back to PLAYING and wipes all stats.
# zh-TW: Phase 15 — 「賽後沙盒對戰」的對戰狀態機。
#     PLAYING       — 一般正規比賽。
#     POST_GAME     — 時間到或管理員結束遊戲；排行榜會在切換瞬間「凍結」。
#                     玩家仍可繼續廝殺與重生（沙盒模式），但凍結後的排行榜
#                     永遠不再變動。
#     管理員按下「重置對戰」會切回 PLAYING 並清空所有統計。
MATCH_PLAYING = "PLAYING"
MATCH_POST_GAME = "POST_GAME"

# EN: Registry mapping the canonical wire ID → Weapon subclass. Six entries
#     (Phase 10) — used by lobby selectors, allowed_weapons gating, and
#     mid-game reassign.
# zh-TW: 把線上 ID 對應到 Weapon 子類的 registry，Phase 10 共六種。
#     大廳選單、allowed_weapons 過濾與 mid-game 重新指派都會用到。
WEAPON_REGISTRY = {
    "pistol": Pistol,
    "rifle": Rifle,
    "shotgun": Shotgun,
    "sniper": Sniper,
    "smg": SMG,
    "rocket": RocketLauncher,
}

# EN: Default allowed-weapons CSV — every weapon enabled out of the box.
# zh-TW: allowed_weapons 預設 CSV — 開箱即用、全部開放。
DEFAULT_ALLOWED_WEAPONS = ",".join(ALL_WEAPON_IDS)


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
    bot_max_attack_limit: int = 2
    allowed_weapons: str = DEFAULT_ALLOWED_WEAPONS
    # EN: Phase 18 — admin-selectable leaderboard category. The frontend
    #     renders ONLY this category in the FullLeaderboard overlay.
    #     Allowed values: "kills", "deaths", "damage_dealt", "damage_taken".
    # zh-TW: Phase 18 — 管理員可選的排行榜類別。前端在 FullLeaderboard
    #     覆蓋層中僅顯示該類別。允許值：kills / deaths / damage_dealt / damage_taken。
    active_leaderboard_type: str = "kills"
    # EN: Phase 18 — sandbox toggle. When False, the "Close" button on the
    #     POST_GAME leaderboard is disabled, preventing players from entering
    #     the sandbox brawl. Default True = sandbox allowed.
    # zh-TW: Phase 18 — 沙盒開關。為 False 時，POST_GAME 排行榜上的「關閉」
    #     按鈕會被停用，玩家無法進入沙盒對戰。預設 True = 允許沙盒。
    sandbox_enabled: bool = True
    # EN: Phase 17 — admin-controlled global pause. When True the entire match
    #     freezes; the frontend renders an unclosable overlay and blocks input.
    # zh-TW: Phase 17 — 管理員控制的全域暫停。為 True 時整場比賽凍結；
    #     前端渲染不可關閉的覆蓋畫面並阻擋所有輸入。
    match_paused: bool = False
    pause_message: str = ""


# EN: Phase 15 — admin-only device fingerprint captured at WS handshake.
#     Stored separately from Player so it never leaks into the broadcast
#     snapshot (which goes to every player). The AdminPanel renders these
#     fields in its own table column.
# zh-TW: Phase 15 — 管理員專用的設備指紋，在 WS 握手時擷取。
#     刻意與 Player 分開存放，避免被廣播快照（會送給每位玩家）洩漏出去。
#     僅 AdminPanel 在自己的欄位中顯示。
@dataclass
class DeviceInfo:
    ip: str = ""
    user_agent: str = ""


class GameEngine:
    """EN: Authoritative server-side simulation. Phase 15 adds:
       1. Continuous (swept-line) bullet collision so very fast projectiles
          (sniper, 1500 px/s) cannot tunnel past a 28 px player at 20 Hz.
       2. PLAYING / POST_GAME match-state machine + leaderboard freeze.
       3. Admin-only IP / User-Agent capture (NEVER broadcast to players).
       zh-TW: 伺服器端權威模擬。Phase 15 新增：
       1. 子彈連續碰撞（掃掠線）— 解決狙擊槍 1500 px/s 在 20 Hz 下
          穿透 28 px 玩家 AABB 的「狙擊 0 傷害」bug。
       2. PLAYING / POST_GAME 對戰狀態機 + 排行榜凍結。
       3. 管理員專屬 IP / User-Agent 擷取（絕不會廣播給一般玩家）。"""

    def __init__(self, world_w: int = WORLD_W, world_h: int = WORLD_H) -> None:
        self.world_w = world_w
        self.world_h = world_h
        self.players: Dict[str, Player] = {}
        self.bullets: List[Bullet] = []
        self.connections: Dict[str, "WebSocketLike"] = {}
        self.directors: List["WebSocketLike"] = []

        self.admin_ws: Dict[str, "WebSocketLike"] = {}
        self.admin_conns: Set[str] = set()

        self.settings = GameSettings()
        self._running = False
        self._tick = 0
        self.game_end_time: float = 0.0
        self.game_over: bool = False
        self.reset_seq: int = 0
        self._standalone_bot_ids: Set[str] = set()

        # EN: Phase 15 — match state and frozen leaderboard payload.
        #     `match_state` swaps between PLAYING and POST_GAME; the
        #     `frozen_leaderboard` is a shallow copy of relevant per-player
        #     stats taken at the exact moment of transition. Bots that
        #     existed when the freeze fired are kept; players that joined
        #     during POST_GAME are NOT added (the leaderboard is frozen).
        # zh-TW: Phase 15 — 對戰狀態 + 凍結排行榜資料。
        #     `match_state` 在 PLAYING / POST_GAME 之間切換；
        #     `frozen_leaderboard` 是切換瞬間的玩家統計淺複本。凍結後
        #     新加入的玩家「不會」被補進去（排行榜已凍結）。
        self.match_state: str = MATCH_PLAYING
        self.frozen_leaderboard: List[dict] = []

        # EN: Phase 15 — admin device fingerprints, keyed by player_id (NOT
        #     by admin_id — admins are observers and do not have devices we
        #     care about for moderation). Capture happens in main.py at
        #     WebSocket accept time.
        # zh-TW: Phase 15 — 玩家設備指紋，以 player_id 為 key。
        #     管理員是觀察者本身不在追蹤範圍。實際擷取於 main.py 的 WS
        #     accept 時點完成。
        self.devices: Dict[str, DeviceInfo] = {}

        self._wake: asyncio.Event | None = None

    # ──────────── Spawning / 生成 ────────────
    def _spawn_position(self) -> tuple[float, float]:
        return (
            random.uniform(60, self.world_w - 60),
            random.uniform(60, self.world_h - 60),
        )

    def _wake_loop(self) -> None:
        if self._wake is not None and not self._wake.is_set():
            self._wake.set()

    def add_player(
        self,
        name: str,
        ws,
        ip: str = "",
        user_agent: str = "",
    ) -> Player:
        # EN: Phase 15 — admin device fingerprint is captured here too.
        #     `ip` / `user_agent` come from the FastAPI WebSocket scope
        #     (see main.py). Stored on a side-table (`self.devices`) — they
        #     are NEVER added to the broadcast snapshot.
        # zh-TW: Phase 15 — 同步擷取管理員可見的設備指紋。
        #     `ip` / `user_agent` 由 FastAPI WebSocket scope 傳入
        #     （詳見 main.py）。儲存於獨立的 side-table（self.devices），
        #     絕不放進廣播快照中。
        x, y = self._spawn_position()
        p = Player(name=name or "anon", x=x, y=y)
        p.max_hp = self.settings.default_player_hp
        p.hp = p.max_hp
        allowed = self._allowed_weapons_set()
        if p.weapon.name not in allowed:
            cls = WEAPON_REGISTRY.get(self._pick_random_allowed_weapon())
            if cls:
                p.weapon = cls()
        if self.settings.team_mode:
            p.team = self._next_team_assignment()
        self.players[p.id] = p
        self.connections[p.id] = ws
        self.devices[p.id] = DeviceInfo(ip=ip or "", user_agent=user_agent or "")
        self._wake_loop()
        if self.settings.team_mode:
            self._balance_with_bots()
        return p

    def add_bot(self, team: str = "") -> BotPlayer:
        x, y = self._spawn_position()
        bot = BotPlayer(name="", x=x, y=y, team=team)
        bot.max_hp = self.settings.default_bot_hp
        bot.hp = bot.max_hp
        self.players[bot.id] = bot
        self._wake_loop()
        return bot

    def remove_player(self, pid: str) -> None:
        self.players.pop(pid, None)
        self.connections.pop(pid, None)
        self.admin_conns.discard(pid)
        self._standalone_bot_ids.discard(pid)
        self.devices.pop(pid, None)
        if self.bullets:
            self.bullets = [b for b in self.bullets if b.owner_id != pid]
        if self.settings.team_mode:
            self._balance_with_bots()

    def remove_admin(self, admin_id: str) -> None:
        self.admin_ws.pop(admin_id, None)
        self.admin_conns.discard(admin_id)

    def _allowed_weapons_set(self) -> set[str]:
        raw = self.settings.allowed_weapons or ""
        ids = {s.strip() for s in raw.split(",") if s.strip() in WEAPON_REGISTRY}
        return ids if ids else set(WEAPON_REGISTRY.keys())

    def _pick_random_allowed_weapon(self) -> str:
        return random.choice(sorted(self._allowed_weapons_set()))

    def set_weapon(self, pid: str, weapon_name: str) -> None:
        p = self.players.get(pid)
        if not p:
            return
        allowed = self._allowed_weapons_set()
        chosen = weapon_name if weapon_name in allowed else self._pick_random_allowed_weapon()
        cls = WEAPON_REGISTRY.get(chosen)
        if cls:
            p.weapon = cls()

    def _sync_allowed_weapons(self) -> None:
        allowed = self._allowed_weapons_set()
        for p in self.players.values():
            if p.state != STATE_ALIVE:
                continue
            if p.weapon.name not in allowed:
                cls = WEAPON_REGISTRY.get(self._pick_random_allowed_weapon())
                if cls:
                    p.weapon = cls()

    def apply_input(self, pid: str, msg: dict) -> None:
        # EN: Phase 17 — drop ALL player input while the match is paused.
        # zh-TW: Phase 17 — 比賽暫停時丟棄所有玩家輸入。
        if self.settings.match_paused:
            return
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
        # EN: Phase 15 — respawn ALWAYS allowed in both PLAYING and POST_GAME
        #     (POST_GAME is the sandbox brawl — players keep fighting after
        #     the leaderboard freezes).
        # zh-TW: Phase 15 — 重生在 PLAYING 與 POST_GAME 兩種狀態都允許
        #     （POST_GAME 即為沙盒對戰，凍結排行榜後玩家仍可重生繼續廝殺）。
        p = self.players.get(pid)
        if not p or p.state == STATE_ALIVE:
            return
        if time.perf_counter() < p.respawn_at:
            return
        x, y = self._spawn_position()
        p.max_hp = self.settings.default_bot_hp if p.is_bot else self.settings.default_player_hp
        allowed = self._allowed_weapons_set()
        if p.weapon.name not in allowed:
            cls = WEAPON_REGISTRY.get(self._pick_random_allowed_weapon())
            if cls:
                p.weapon = cls()
        p.respawn(x, y)

    def request_spectate(self, pid: str) -> None:
        p = self.players.get(pid)
        if not p:
            return
        if p.state == STATE_DEAD:
            p.state = STATE_SPECTATING

    # ──────────── Admin controls / 管理員控制 ────────────
    def admin_force_respawn(self, target_pid: str) -> None:
        p = self.players.get(target_pid)
        if not p:
            return
        x, y = self._spawn_position()
        p.max_hp = self.settings.default_bot_hp if p.is_bot else self.settings.default_player_hp
        p.respawn(x, y)

    def admin_force_respawn_all(self) -> None:
        for p in self.players.values():
            if p.state in (STATE_DEAD, STATE_SPECTATING):
                x, y = self._spawn_position()
                p.max_hp = self.settings.default_bot_hp if p.is_bot else self.settings.default_player_hp
                p.respawn(x, y)

    def admin_batch_reduce_respawn(self, seconds: float) -> None:
        now = time.perf_counter()
        for p in self.players.values():
            if p.state in (STATE_DEAD, STATE_SPECTATING) and p.respawn_at > now:
                p.respawn_at = max(now, p.respawn_at - seconds)

    def admin_batch_reset_respawn(self) -> None:
        now = time.perf_counter()
        for p in self.players.values():
            if p.state in (STATE_DEAD, STATE_SPECTATING):
                p.respawn_at = now

    def admin_force_kill(self, target_pid: str) -> None:
        p = self.players.get(target_pid)
        if not p or p.state != STATE_ALIVE:
            return
        now = time.perf_counter()
        self._kill(p, None, now)

    def admin_reset_match(self) -> None:
        # EN: Phase 15 — Reset Match returns the world to a fully fresh
        #     PLAYING state. Wipes EVERY per-player counter (kills/deaths/
        #     damage), clears the frozen leaderboard, restores HP, and
        #     respawns every player. Equivalent to "new lobby" without the
        #     reconnect overhead.
        # zh-TW: Phase 15 — 重置對戰 = 把世界完全重置為新鮮的 PLAYING 狀態。
        #     清空每位玩家的計數（擊殺/死亡/傷害）、清掉凍結排行榜、回滿血、
        #     強制全員重生。等同「全新大廳」但不需要重連。
        self.reset_seq += 1
        self.game_over = False
        self.match_state = MATCH_PLAYING
        self.frozen_leaderboard = []
        self.bullets = []
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
        bot_ids = [pid for pid, p in list(self.players.items()) if p.is_bot]
        for pid in bot_ids:
            self.players.pop(pid, None)
            self.connections.pop(pid, None)
            self._standalone_bot_ids.discard(pid)

    def admin_set_game_timer(self, seconds: float) -> None:
        now = time.perf_counter()
        if seconds <= 0:
            self.settings.game_duration = 0.0
            self.game_end_time = 0.0
            self.game_over = False
            self.match_state = MATCH_PLAYING
            self.frozen_leaderboard = []
        else:
            self.settings.game_duration = seconds
            self.game_end_time = now + seconds
            self.game_over = False
            self.match_state = MATCH_PLAYING
            self.frozen_leaderboard = []

    def admin_adjust_game_timer(self, delta: float) -> None:
        if self.settings.game_duration <= 0 or self.game_end_time <= 0:
            return
        now = time.perf_counter()
        self.game_end_time = max(now + 1, self.game_end_time + delta)

    def admin_end_game_now(self) -> None:
        # EN: Phase 15 — explicit admin "end now" also transitions to POST_GAME
        #     and freezes the leaderboard immediately (mirrors the timer-expiry
        #     code path so admin UX is identical to normal time-out).
        # zh-TW: Phase 15 — 管理員按「立即結束」也會切到 POST_GAME 並立刻凍結
        #     排行榜（與時間到的流程相同，UX 一致）。
        self.game_over = True
        self.game_end_time = 0.0
        self._enter_post_game()

    def admin_set_all_hp(self, hp: float, target: str = "all") -> None:
        for p in self.players.values():
            if target == "players" and p.is_bot:
                continue
            if target == "bots" and not p.is_bot:
                continue
            p.max_hp = hp
            p.hp = hp

    def admin_set_player_hp(self, pid: str, hp: float) -> None:
        p = self.players.get(pid)
        if not p:
            return
        p.max_hp = hp
        p.hp = hp

    def _sync_standalone_bots(self) -> None:
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
        except (TypeError, ValueError):
            return
        setattr(self.settings, key, value)
        if key == "team_mode":
            self._sync_team_mode()
        elif key in ("bots_enabled", "bot_count"):
            self._sync_standalone_bots()
        elif key == "allowed_weapons":
            self._sync_allowed_weapons()

    def _sync_team_mode(self) -> None:
        if self.settings.team_mode:
            for p in list(self.players.values()):
                if not p.is_bot and not p.team:
                    p.team = self._next_team_assignment()
            self._balance_with_bots()
        else:
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
        red = sum(1 for p in self.players.values() if p.team == "red")
        blue = sum(1 for p in self.players.values() if p.team == "blue")
        while red < blue:
            self.add_bot(team="red"); red += 1
        while blue < red:
            self.add_bot(team="blue"); blue += 1

    # ──────────── Match state transitions / 對戰狀態切換 ────────────
    def _enter_post_game(self) -> None:
        # EN: Phase 15 — freeze the leaderboard with EVERY current player
        #     (alive, dead, or spectating; bots included if they participated).
        #     This snapshot is the source of truth for the FINAL STANDINGS UI;
        #     subsequent kills during the sandbox brawl never alter it.
        # zh-TW: Phase 15 — 凍結排行榜：包含所有目前在場的玩家（不論生死，
        #     參與過比賽的 Bot 也算進去）。此快照即為「最終排行榜」UI 的
        #     資料來源；沙盒對戰期間的擊殺不會更動它。
        if self.match_state == MATCH_POST_GAME:
            return
        self.match_state = MATCH_POST_GAME
        self.frozen_leaderboard = [
            {
                "id": p.id,
                "name": p.name,
                "kills": p.kills,
                "deaths": p.deaths,
                "damage_dealt": round(p.damage_dealt, 1),
                "damage_taken": round(p.damage_taken, 1),
                "is_bot": p.is_bot,
                "team": p.team,
                "weapon": p.weapon.name,
            }
            for p in self.players.values()
        ]

    # ──────────── Simulation / 模擬 ────────────
    def step(self, dt: float, now: float) -> None:
        self._tick += 1

        # EN: Phase 17 — when the admin has paused the match, skip the entire
        #     simulation step. Only the tick counter advances (so the snapshot
        #     keeps broadcasting and clients see the pause overlay).
        # zh-TW: Phase 17 — 管理員暫停時跳過整個模擬步驟。只有 tick 計數器
        #     繼續跑（好讓快照持續廣播、客戶端看到暫停覆蓋層）。
        if self.settings.match_paused:
            return

        # EN: Phase 15 — when the timer expires we set game_over AND enter
        #     POST_GAME. Players keep playing; the leaderboard is frozen.
        # zh-TW: Phase 15 — 時間到時同時設定 game_over 並進入 POST_GAME。
        #     玩家可繼續對戰，但排行榜已凍結。
        if (not self.game_over
                and self.settings.game_duration > 0
                and self.game_end_time > 0
                and now >= self.game_end_time):
            self.game_over = True
            self._enter_post_game()

        all_players = list(self.players.values())
        max_focus = max(0, int(self.settings.bot_max_attack_limit or 0))
        for p in all_players:
            if isinstance(p, BotPlayer):
                if p.state == STATE_DEAD and now >= p.respawn_at:
                    x, y = self._spawn_position()
                    p.max_hp = self.settings.default_bot_hp
                    p.respawn(x, y)
                else:
                    p.ai_step(
                        all_players,
                        self.world_w,
                        self.world_h,
                        now,
                        self.settings.bot_atk_speed_min,
                        self.settings.bot_atk_speed_max,
                        max_focus,
                    )

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
        self.bullets = [b for b in self.bullets if b.alive]

    def _clamp_to_world(self, p: Player) -> None:
        p.x = max(0.0, min(self.world_w - p.w, p.x))
        p.y = max(0.0, min(self.world_h - p.h, p.y))

    @staticmethod
    def _segment_intersects_aabb(
        x0: float, y0: float, x1: float, y1: float,
        bx: float, by: float, bw: float, bh: float,
    ) -> bool:
        # EN: Phase 15 — Liang–Barsky line-clip test for "does the line
        #     segment (x0,y0)→(x1,y1) intersect the AABB at (bx,by,bw,bh)?".
        #     This is the swept-line CCD primitive that fixes the sniper
        #     bug: at 1500 px/s × 50 ms tick the bullet jumps 75 px per
        #     frame; a plain AABB-vs-AABB test only checks the END position
        #     and misses the player entirely. Liang–Barsky is O(1), branch
        #     friendly, and accepts a degenerate (x0==x1 && y0==y1) segment
        #     gracefully (returns True iff the point is inside the bbox).
        # zh-TW: Phase 15 — Liang–Barsky 線段與 AABB 相交測試：
        #     回答「線段 (x0,y0)→(x1,y1) 是否穿過 AABB(bx,by,bw,bh)？」
        #     這是修正狙擊槍 bug 的 CCD 核心：1500 px/s × 50 ms tick
        #     表示子彈每幀位移 75 px，傳統 AABB 對 AABB 只檢查「終點」位置
        #     會漏掉玩家。Liang–Barsky 是 O(1)、分支簡潔，能正確處理退化
        #     線段（x0==x1 且 y0==y1，視為點對 AABB 測試）。
        dx = x1 - x0
        dy = y1 - y0
        # Degenerate segment → point-in-AABB
        if dx == 0.0 and dy == 0.0:
            return bx <= x0 <= bx + bw and by <= y0 <= by + bh
        t_enter, t_exit = 0.0, 1.0
        for p, q in (
            (-dx, x0 - bx),
            ( dx, (bx + bw) - x0),
            (-dy, y0 - by),
            ( dy, (by + bh) - y0),
        ):
            if p == 0.0:
                if q < 0.0:
                    return False
            elif p < 0.0:
                t = q / p
                if t > t_exit:
                    return False
                if t > t_enter:
                    t_enter = t
            else:
                t = q / p
                if t < t_enter:
                    return False
                if t < t_exit:
                    t_exit = t
        return t_enter <= t_exit

    def _resolve_bullet_hits(self, now: float) -> None:
        # EN: Phase 15 — swept-line CCD. For each live bullet we form a line
        #     segment from (prev_cx, prev_cy) → (current center) and test it
        #     against every alive non-owner player AABB. This guarantees a
        #     fast sniper shot cannot tunnel past a player. On hit, damage
        #     is propagated from the bullet (which inherited it from the
        #     weapon at spawn-time) — the Sniper bug fix is end-to-end:
        #     weapon.damage → Bullet.spawn(damage=) → b.damage → take_damage.
        # zh-TW: Phase 15 — 掃掠線 CCD。每顆存活子彈用
        #     (prev_cx, prev_cy) → (現在中心) 組成線段，逐一測試所有「存活、
        #     非射手」玩家的 AABB；保證高速狙擊彈不會穿透玩家。命中時直接
        #     使用子彈內的 damage（spawn 時由 weapon 注入）。狙擊槍 bug
        #     修正是端到端的：weapon.damage → Bullet.spawn(damage=) →
        #     b.damage → take_damage。
        for b in self.bullets:
            if not b.alive:
                continue
            cx_now = b.x + b.w / 2.0
            cy_now = b.y + b.h / 2.0
            owner = self.players.get(b.owner_id)
            for p in self.players.values():
                if p.state != STATE_ALIVE or p.id == b.owner_id:
                    continue
                if (self.settings.team_mode and owner and owner.team
                        and owner.team == p.team):
                    continue
                # Inflate target AABB by the bullet's radius so a bullet
                # that grazes the edge of the player still counts as a hit.
                # This matches the pre-Phase-15 AABB-vs-AABB feel exactly.
                inflated_w = p.w + b.w
                inflated_h = p.h + b.h
                inflated_x = p.x - b.w / 2.0
                inflated_y = p.y - b.h / 2.0
                if self._segment_intersects_aabb(
                    b.prev_cx, b.prev_cy, cx_now, cy_now,
                    inflated_x, inflated_y, inflated_w, inflated_h,
                ):
                    dmg = float(b.damage)
                    killed = p.take_damage(dmg)
                    if owner is not None:
                        owner.damage_dealt += dmg
                    b.alive = False
                    if killed:
                        self._kill(p, owner, now)
                    break

    def _kill(self, victim: Player, killer, now: float) -> None:
        victim.alive = False
        victim.state = STATE_DEAD
        victim.deaths += 1
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

    # ──────────── Networking — minified payload / 網路通訊 — 精簡封包 ────────────
    @staticmethod
    def _player_short(p: Player) -> dict:
        return {
            "i": p.id,
            "nm": p.name,
            "x": round(p.x, 2),
            "y": round(p.y, 2),
            "h": round(p.hp, 1),
            "mh": p.max_hp,
            "a": round(p.angle, 3),
            "k": p.kills,
            "d": p.deaths,
            "dd": round(p.damage_dealt, 1),
            "dt": round(p.damage_taken, 1),
            "wp": p.weapon.name,
            "s": p.state,
            "ra": p.respawn_at,
            "b": 1 if p.is_bot else 0,
            "tm": p.team,
            "kn": p.killed_by_name,
            "kw": p.killed_by_weapon,
            "al": 1 if p.alive else 0,
        }

    @staticmethod
    def _bullet_short(b: Bullet) -> dict:
        d = {
            "i": b.id,
            "x": round(b.x, 2),
            "y": round(b.y, 2),
            "o": b.owner_id,
            "dm": b.damage,
            "al": 1 if b.alive else 0,
        }
        if b.w != 6.0 or b.h != 6.0:
            d["bw"] = b.w
            d["bh"] = b.h
        return d

    def snapshot(self) -> dict:
        # EN: Phase 15 — snapshot now also carries `ms` (match state) and
        #     `fl` (frozen leaderboard, only populated in POST_GAME) so the
        #     client can render the final standings overlay even after
        #     respawning into the sandbox brawl. `dev` (device fingerprints)
        #     is intentionally OMITTED from this method; admin-only payload
        #     is appended by `admin_snapshot()` (see below).
        # zh-TW: Phase 15 — 快照新增 `ms`（match state）與 `fl`（凍結排行榜，
        #     僅 POST_GAME 有值），讓前端在沙盒對戰中仍可呈現最終排行榜。
        #     `dev`（設備指紋）刻意「不」放在這裡；管理員專屬資料由
        #     `admin_snapshot()` 額外附加（見下方）。
        now = time.perf_counter()
        if self.settings.game_duration > 0 and self.game_end_time > 0 and not self.game_over:
            time_remaining = round(max(0.0, self.game_end_time - now), 1)
        else:
            time_remaining = 0.0
        return {
            "type": "state",
            "t": self._tick,
            "n": now,
            "wo": {"w": self.world_w, "h": self.world_h},
            "st": {
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
                "allowed_weapons": self.settings.allowed_weapons,
                "bot_max_attack_limit": self.settings.bot_max_attack_limit,
                "active_leaderboard_type": self.settings.active_leaderboard_type,
                "sandbox_enabled": self.settings.sandbox_enabled,
                "match_paused": self.settings.match_paused,
                "pause_message": self.settings.pause_message,
            },
            "go": self.game_over,
            "tr": time_remaining,
            "rs": self.reset_seq,
            "ms": self.match_state,
            "fl": self.frozen_leaderboard if self.match_state == MATCH_POST_GAME else [],
            "ps": [self._player_short(p) for p in self.players.values()],
            "bs": [self._bullet_short(b) for b in self.bullets],
        }

    def admin_snapshot(self) -> dict:
        # EN: Phase 15 — admin-only super-set. Includes the regular snapshot
        #     plus a `dev` map of player_id → {ip, user_agent}. This payload
        #     is sent ONLY to admin WebSockets; player and director sockets
        #     never see device fingerprints.
        # zh-TW: Phase 15 — 管理員專屬擴充版快照。除了一般快照外，多帶
        #     `dev` 對照表 player_id → {ip, user_agent}。此 payload 僅送往
        #     管理員 WS；一般玩家與導播 WS 看不到設備指紋。
        snap = self.snapshot()
        snap["dev"] = {
            pid: {"ip": d.ip, "ua": d.user_agent}
            for pid, d in self.devices.items()
        }
        return snap

    async def broadcast(self) -> None:
        # EN: Phase 15 — players + directors get the regular snapshot;
        #     admins get the augmented `admin_snapshot()` with device info.
        # zh-TW: Phase 15 — 玩家與導播收到一般快照；管理員收到含設備
        #     資訊的 `admin_snapshot()`。
        public_payload = json.dumps(self.snapshot(), separators=(",", ":"))
        admin_payload = json.dumps(self.admin_snapshot(), separators=(",", ":"))
        dead_pids: List[str] = []
        for pid, ws in self.connections.items():
            try:
                await ws.send_text(public_payload)
            except Exception:
                dead_pids.append(pid)
        dead_admins: List[str] = []
        for aid, ws in self.admin_ws.items():
            try:
                await ws.send_text(admin_payload)
            except Exception:
                dead_admins.append(aid)
        dead_directors: List = []
        for ws in list(self.directors):
            try:
                await asyncio.wait_for(ws.send_text(public_payload), timeout=0.05)
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
        if self._wake is None:
            self._wake = asyncio.Event()
        last = time.perf_counter()
        while self._running:
            if not self.players:
                if self.bullets:
                    self.bullets = []
                self._wake.clear()
                try:
                    await self._wake.wait()
                except asyncio.CancelledError:
                    raise
                last = time.perf_counter()
                continue

            now = time.perf_counter()
            dt = now - last
            last = now
            self.step(dt, now)
            await self.broadcast()
            elapsed = time.perf_counter() - now
            await asyncio.sleep(max(0.0, TICK_DT - elapsed))

    def stop(self) -> None:
        self._running = False
        if self._wake is not None:
            self._wake.set()


class WebSocketLike:
    async def send_text(self, data: str) -> None: ...
    async def receive_text(self) -> str: ...
