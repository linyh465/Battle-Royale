from __future__ import annotations

from dataclasses import dataclass, field
from typing import List

from .bullet import Bullet
from .game_object import GameObject
from .weapon import Pistol, Weapon


# EN: Player lifecycle states. The engine drives transitions; clients only render.
#     Valid states: ALIVE → DEAD → SPECTATING (optional) → ALIVE (respawn).
# zh-TW: 玩家生命週期狀態，由引擎控制狀態切換，前端只負責渲染。
#     有效狀態：ALIVE → DEAD → SPECTATING（可選）→ ALIVE（重生）。
STATE_ALIVE = "alive"
STATE_DEAD = "dead"
STATE_SPECTATING = "spectating"


@dataclass
class Player(GameObject):
    name: str = "player"
    # EN: Phase 23 — dataclass default lowered from 200 → 50 to stay in sync
    #     with `GameSettings.default_player_hp`. Engine.add_player still
    #     overrides both fields from settings before broadcast, so this is a
    #     belt-and-braces default for any path that constructs a Player
    #     without going through the engine.
    # zh-TW: Phase 23 — dataclass 預設由 200 降為 50，與
    #     `GameSettings.default_player_hp` 同步。引擎在 add_player 時仍會
    #     依設定覆寫這兩個欄位再廣播，這裡只是雙保險預設，給任何不經
    #     引擎建立 Player 的路徑使用。
    hp: float = 50.0
    max_hp: float = 50.0
    speed: float = 220.0
    angle: float = 0.0

    # EN: Stats tracked across the match for the leaderboard / admin sort.
    #     kills        — total confirmed kills
    #     deaths       — total deaths (feeds respawn penalty formula)
    #     damage_dealt — outgoing damage total
    #     damage_taken — incoming damage total
    # zh-TW: 比賽期間累積，用於計分板與管理員排序。
    #     kills        — 累計確認擊殺數
    #     deaths       — 累計死亡數（決定重生懲罰公式）
    #     damage_dealt — 累計輸出傷害
    #     damage_taken — 累計承受傷害
    kills: int = 0
    deaths: int = 0
    damage_dealt: float = 0.0
    damage_taken: float = 0.0

    weapon: Weapon = field(default_factory=Pistol)
    w: float = 28.0
    h: float = 28.0

    # EN: state-machine + respawn deadline (perf_counter timebase).
    #     state values: 'alive' | 'dead' | 'spectating'
    # zh-TW: 狀態機 + 重生倒數時間（perf_counter 時基）。
    #     state 值：'alive' | 'dead' | 'spectating'
    state: str = STATE_ALIVE
    respawn_at: float = 0.0
    is_bot: bool = False
    # EN: Phase 20 — Teams feature fully removed. The `team` attribute was
    #     scrubbed from the model, broadcast payload, engine logic, and
    #     frontend rendering. Free-for-all is now the only supported mode.
    # zh-TW: Phase 20 — 完全移除「隊伍」功能。team 屬性已從模型、廣播封包、
    #     引擎邏輯與前端渲染中清除，現在僅支援自由混戰模式。

    killed_by_name: str = ""
    killed_by_weapon: str = ""

    input_dx: float = 0.0
    input_dy: float = 0.0
    input_fire: bool = False

    # EN: Convenience alias so callers can access p.status in addition to p.state.
    # zh-TW: 方便的別名，呼叫端可用 p.status 存取（等同 p.state）。
    @property
    def status(self) -> str:
        return self.state

    def apply_input(self, dx: float, dy: float, angle: float, fire: bool) -> None:
        # EN: clamp input to a unit vector — no diagonal speed boost.
        # zh-TW: 將輸入規範化成單位向量，避免斜向加速。
        mag = (dx * dx + dy * dy) ** 0.5
        if mag > 1e-6:
            dx, dy = dx / mag, dy / mag
        else:
            dx, dy = 0.0, 0.0
        self.input_dx, self.input_dy = dx, dy
        self.angle = angle
        self.input_fire = fire

    def update(self, dt: float) -> None:
        if self.state != STATE_ALIVE:
            return
        self.vx = self.input_dx * self.speed
        self.vy = self.input_dy * self.speed
        super().update(dt)

    def shoot(self, now: float) -> List[Bullet]:
        if self.state != STATE_ALIVE or not self.input_fire:
            return []
        cx = self.x + self.w / 2
        cy = self.y + self.h / 2
        return self.weapon.fire(self.id, cx, cy, self.angle, now)

    def take_damage(self, dmg: float) -> bool:
        # EN: returns True if this hit was the killing blow.
        # zh-TW: 若這發為致命一擊則回傳 True。
        if self.state != STATE_ALIVE:
            return False
        self.hp = max(0.0, self.hp - dmg)
        self.damage_taken += dmg
        if self.hp <= 0:
            self.alive = False
            return True
        return False

    def respawn(self, x: float, y: float) -> None:
        # EN: Reset the player to alive at the given coordinates.
        # zh-TW: 將玩家重設為存活狀態，置於指定座標。
        self.x = x
        self.y = y
        self.hp = self.max_hp
        self.alive = True
        self.state = STATE_ALIVE
        self.respawn_at = 0.0
        self.killed_by_name = ""
        self.killed_by_weapon = ""
        self.input_dx = self.input_dy = 0.0
        self.input_fire = False

    def to_dict(self) -> dict:
        # EN: Serialise player state for network broadcast.
        # zh-TW: 將玩家狀態序列化供網路廣播使用。
        d = super().to_dict()
        d.update({
            "name": self.name,
            "hp": round(self.hp, 1),
            "max_hp": self.max_hp,
            "angle": round(self.angle, 3),
            "kills": self.kills,
            "deaths": self.deaths,
            "damage_dealt": round(self.damage_dealt, 1),
            "damage_taken": round(self.damage_taken, 1),
            "weapon": self.weapon.name,
            # EN: 'state' and 'status' carry the same value for convenience.
            # zh-TW: 'state' 與 'status' 相同值，方便前端使用。
            "state": self.state,
            "status": self.state,
            "respawn_at": self.respawn_at,
            "is_bot": self.is_bot,
            # EN: Phase 20 — `team` removed from broadcast payload.
            # zh-TW: Phase 20 — 廣播封包中已移除 team。
            "killed_by_name": self.killed_by_name,
            "killed_by_weapon": self.killed_by_weapon,
        })
        return d
