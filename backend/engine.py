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
    # EN: Phase 10 — comma-separated whitelist of weapon IDs the lobby + engine
    #     are allowed to hand out. Disabling an entry mid-match triggers a
    #     forced random reassign for all alive players holding it.
    # zh-TW: Phase 10 — 以逗號分隔的武器白名單，大廳選單與引擎都受其約束。
    #     比賽中關閉某把武器時，引擎會強制把所有持該武器的存活玩家
    #     隨機改派到目前還允許的武器之一。
    allowed_weapons: str = DEFAULT_ALLOWED_WEAPONS


# ── NOTE: SafeZone / Poison Zone has been REMOVED in Phase 2. ──
# ── 備註：SafeZone / 毒圈已在 Phase 2 中完全移除。           ──


class GameEngine:
    """EN: Authoritative server-side simulation. Tick rate configurable via
       TICK_RATE_HZ (default 20). Continuous Deathmatch — no shrinking zone.
       When no players are connected the loop sleeps on an asyncio.Event,
       consuming zero CPU until someone joins (Phase 9 idle-pause).
       zh-TW: 伺服器端權威模擬，tick 頻率可由 TICK_RATE_HZ 環境變數設定（預設 20）。
       持續餘燼模式 — 無縮圈。當沒有玩家連線時，loop 會 await 一個 asyncio.Event，
       在 CPU 上完全閒置，直到有人加入才喚醒（Phase 9 閒置暫停）。"""

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
        # zh-TW: 非戰鬥管理員 WebSocket 連線。
        self.admin_ws: Dict[str, "WebSocketLike"] = {}
        # EN: Legacy set kept for backward-compat checks elsewhere.
        # zh-TW: 舊版集合，保留供其他模組向後相容使用。
        self.admin_conns: Set[str] = set()

        self.settings = GameSettings()
        self._running = False
        self._tick = 0
        self.game_end_time: float = 0.0
        self.game_over: bool = False
        self.reset_seq: int = 0
        self._standalone_bot_ids: Set[str] = set()

        # EN: Wake-up event used by run() to sleep the simulation loop while
        #     idle (no players). Created lazily inside run() to bind to the
        #     correct asyncio loop.
        # zh-TW: run() 使用的喚醒事件 — 沒有玩家時讓模擬 loop 休眠。
        #     在 run() 內延遲建立以綁定正確的 asyncio loop。
        self._wake: asyncio.Event | None = None

    # ──────────── Spawning / 生成 ────────────
    def _spawn_position(self) -> tuple[float, float]:
        # EN: Random position within world bounds (60 px margin).
        # zh-TW: 在世界邊界內隨機位置（留 60 px 邊距）。
        return (
            random.uniform(60, self.world_w - 60),
            random.uniform(60, self.world_h - 60),
        )

    def _wake_loop(self) -> None:
        # EN: Signal the run() loop to resume from idle sleep.
        # zh-TW: 通知 run() loop 從閒置睡眠中恢復。
        if self._wake is not None and not self._wake.is_set():
            self._wake.set()

    def add_player(self, name: str, ws) -> Player:
        # EN: Creates a new combatant Player and registers the WS connection.
        #     Phase 10 — if the default Pistol is currently disabled by the
        #     allowed_weapons whitelist, swap to a random allowed weapon so
        #     joiners never spawn holding a banned gun.
        #     Wakes the simulation loop if it was idle.
        # zh-TW: 建立新的戰鬥玩家並註冊其 WebSocket 連線。
        #     Phase 10 — 若預設手槍已被 allowed_weapons 白名單禁用，
        #     直接改成隨機允許的武器，避免玩家一加入就拿到被禁的武器。
        #     若 loop 處於閒置睡眠，則同時喚醒它。
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
        # EN: Remove a combatant player and their connection. Eagerly drop
        #     bullets owned by this player so RAM is freed immediately
        #     (Phase 9 GC tightening).
        # zh-TW: 移除戰鬥玩家及其連線。同時立即清除其名下子彈，
        #     讓 RAM 即時釋放（Phase 9 GC 強化）。
        self.players.pop(pid, None)
        self.connections.pop(pid, None)
        self.admin_conns.discard(pid)
        self._standalone_bot_ids.discard(pid)
        if self.bullets:
            self.bullets = [b for b in self.bullets if b.owner_id != pid]
        if self.settings.team_mode:
            self._balance_with_bots()

    def remove_admin(self, admin_id: str) -> None:
        # EN: Remove a non-combatant admin connection (no Player to clean up).
        # zh-TW: 移除非戰鬥管理員連線（無需清除 Player 物件）。
        self.admin_ws.pop(admin_id, None)
        self.admin_conns.discard(admin_id)

    def _allowed_weapons_set(self) -> set[str]:
        # EN: Parse the CSV whitelist into a set of valid weapon IDs that
        #     also exist in the registry. Falls back to every weapon if the
        #     parsed set is empty (admin must always have *something* to
        #     hand out — empty whitelist would brick the lobby).
        # zh-TW: 把 CSV 白名單解析成存在於 registry 中的武器 ID 集合。
        #     若解析結果為空（管理員不能讓武器庫變成完全空），自動回退為全部
        #     武器，避免大廳卡住。
        raw = self.settings.allowed_weapons or ""
        ids = {s.strip() for s in raw.split(",") if s.strip() in WEAPON_REGISTRY}
        return ids if ids else set(WEAPON_REGISTRY.keys())

    def _pick_random_allowed_weapon(self) -> str:
        return random.choice(sorted(self._allowed_weapons_set()))

    def set_weapon(self, pid: str, weapon_name: str) -> None:
        # EN: Honour the allowed_weapons whitelist. Requesting a banned weapon
        #     silently snaps to a random allowed one so the player always
        #     leaves the call holding *something* legal.
        # zh-TW: 遵守 allowed_weapons 白名單。請求被禁的武器時自動改派到隨機
        #     允許的武器，確保玩家最後一定持有合法武器。
        p = self.players.get(pid)
        if not p:
            return
        allowed = self._allowed_weapons_set()
        chosen = weapon_name if weapon_name in allowed else self._pick_random_allowed_weapon()
        cls = WEAPON_REGISTRY.get(chosen)
        if cls:
            p.weapon = cls()

    def _sync_allowed_weapons(self) -> None:
        # EN: Mid-game override. Whenever the admin updates allowed_weapons,
        #     iterate every alive player; if their weapon was just removed
        #     from the whitelist, immediately reassign them to a random
        #     currently-allowed weapon. Dead/spectating players are left
        #     alone — they'll be reassigned on respawn via set_weapon.
        # zh-TW: 比賽中即時覆寫。管理員更新 allowed_weapons 後，遍歷所有
        #     存活玩家，若其武器剛被移出白名單，立即隨機改派為目前還允許的
        #     其中一把。死亡 / 觀戰中的玩家先不動，會在重生時透過 set_weapon
        #     自動修正。
        allowed = self._allowed_weapons_set()
        for p in self.players.values():
            if p.state != STATE_ALIVE:
                continue
            if p.weapon.name not in allowed:
                cls = WEAPON_REGISTRY.get(self._pick_random_allowed_weapon())
                if cls:
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
        p = self.players.get(pid)
        if not p or p.state == STATE_ALIVE:
            return
        if time.perf_counter() < p.respawn_at:
            return
        x, y = self._spawn_position()
        p.max_hp = self.settings.default_bot_hp if p.is_bot else self.settings.default_player_hp
        # EN: Phase 10 — if the player's stored weapon was banned while they
        #     were dead, swap to a legal one before they re-enter the arena.
        # zh-TW: Phase 10 — 玩家死亡期間若武器被禁，重生前先替換為合法武器。
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
        else:
            self.settings.game_duration = seconds
            self.game_end_time = now + seconds
            self.game_over = False

    def admin_adjust_game_timer(self, delta: float) -> None:
        if self.settings.game_duration <= 0 or self.game_end_time <= 0:
            return
        now = time.perf_counter()
        self.game_end_time = max(now + 1, self.game_end_time + delta)

    def admin_end_game_now(self) -> None:
        self.game_over = True
        self.game_end_time = 0.0

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
            setattr(self.settings, key, value)
        except (TypeError, ValueError):
            return
        if key == "team_mode":
            self._sync_team_mode()
        elif key in ("bots_enabled", "bot_count"):
            self._sync_standalone_bots()
        elif key == "allowed_weapons":
            # EN: Phase 10 mid-game override — reassign alive players whose
            #     current weapon was just disabled.
            # zh-TW: Phase 10 比賽中即時覆寫 — 把武器剛被禁掉的存活玩家改派。
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

    # ──────────── Simulation / 模擬 ────────────
    def step(self, dt: float, now: float) -> None:
        self._tick += 1

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
    # EN: Phase 9 wire format. We emit ultra-short keys to slash JSON size on
    #     the broadcast hot-path (20 Hz × N players × N viewers). The frontend
    #     `expandSnapshot()` helper reverses this mapping back into the
    #     descriptive shape used by rendering code.
    #     Per-player keys:
    #       i = id, nm = name, x/y = pos, h = hp, mh = max_hp,
    #       a = angle, k = kills, d = deaths,
    #       dd = damage_dealt, dt = damage_taken, wp = weapon name,
    #       s = state ('alive'|'dead'|'spectating'),
    #       ra = respawn_at, b = is_bot (1/0), tm = team,
    #       kn = killed_by_name, kw = killed_by_weapon, al = alive (1/0).
    #     Per-bullet keys:
    #       i = id, x/y = pos, o = owner_id, dm = damage, al = alive (1/0).
    #     Top-level keys:
    #       type='state', t = tick, n = now, wo = world{w,h}, st = settings,
    #       go = game_over, tr = time_remaining, rs = reset_seq,
    #       ps = players, bs = bullets.
    #     Width/height are constant (player 28×28, bullet 6×6) and restored
    #     client-side from `wo` / hard-coded constants — they never travel.
    # zh-TW: Phase 9 廣播格式。改用極短鍵名以削減 JSON 大小（20 Hz × N 玩家 × N 觀眾）。
    #     前端 `expandSnapshot()` 會把短鍵重新展開為渲染程式使用的長鍵格式。
    #     玩家鍵對照：
    #       i = id, nm = 名稱, x/y = 座標, h = hp, mh = 最大 hp,
    #       a = 角度, k = 擊殺, d = 死亡,
    #       dd = 輸出傷害, dt = 承受傷害, wp = 武器名稱,
    #       s = 狀態（alive/dead/spectating）,
    #       ra = 重生時間, b = 是否為 Bot（1/0）, tm = 隊伍,
    #       kn = 擊殺者名稱, kw = 擊殺武器, al = 是否存活（1/0）。
    #     子彈鍵對照：i, x, y, o = 擁有者 id, dm = 傷害, al = 存活旗標。
    #     寬高為常數（玩家 28×28、子彈 6×6），不在線上傳輸，由前端還原。

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
        # EN: Phase 10 — only emit bw/bh on the wire when the bullet hitbox
        #     differs from the 6×6 default (rocket = 14×14). Keeps standard
        #     bullets at the smallest payload while still letting clients
        #     render heavy projectiles at the correct size.
        # zh-TW: Phase 10 — 子彈的 bw/bh 只有在 hitbox 不是預設 6×6 時才送
        #     （目前只有 rocket=14×14）。一般子彈仍維持最小封包，重型彈頭
        #     也能在前端正確放大繪製。
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
        # EN: Build the authoritative state snapshot broadcast each tick.
        #     Uses the Phase 9 minified key schema documented above.
        # zh-TW: 建構每 tick 廣播的權威狀態快照，採用 Phase 9 短鍵格式（如上說明）。
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
            },
            "go": self.game_over,
            "tr": time_remaining,
            "rs": self.reset_seq,
            "ps": [self._player_short(p) for p in self.players.values()],
            "bs": [self._bullet_short(b) for b in self.bullets],
        }

    async def broadcast(self) -> None:
        # EN: Send the snapshot to all player, admin, and director connections.
        # zh-TW: 將快照廣播給所有玩家、管理員與導播連線。
        payload = json.dumps(self.snapshot(), separators=(",", ":"))
        dead_pids: List[str] = []
        for pid, ws in self.connections.items():
            try:
                await ws.send_text(payload)
            except Exception:
                dead_pids.append(pid)
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
        # EN: Main simulation loop. When `self.players` is empty we await the
        #     wake event and consume zero CPU until a player joins
        #     (Phase 9 idle-pause). Bullets are also flushed during idle so
        #     no stale projectiles linger when a new match begins.
        # zh-TW: 主模擬 loop。當沒有玩家時，await 喚醒事件，CPU 完全閒置，
        #     直到有人加入才繼續（Phase 9 閒置暫停）。閒置時順手清空殘留子彈，
        #     避免新局開始時還有舊子彈。
        self._running = True
        if self._wake is None:
            self._wake = asyncio.Event()
        last = time.perf_counter()
        while self._running:
            if not self.players:
                # EN: Idle — drop bullets and sleep until a player joins.
                # zh-TW: 閒置 — 清空子彈並等待玩家加入。
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
        # EN: Wake any pending await on the idle event so run() can exit cleanly.
        # zh-TW: 喚醒任何 await 中的閒置事件，讓 run() 能順利結束。
        if self._wake is not None:
            self._wake.set()


class WebSocketLike:
    async def send_text(self, data: str) -> None: ...
    async def receive_text(self) -> str: ...
