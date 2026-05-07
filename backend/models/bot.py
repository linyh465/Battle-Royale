from __future__ import annotations

import math
import random
from dataclasses import dataclass

from .player import Player, STATE_ALIVE
from .weapon import Rifle


# EN: Minimal AI bot. Picks the nearest non-team enemy, runs at it, fires when in range.
#     Used by the engine when team_mode is on, to balance Red vs Blue head-counts.
# zh-TW: 簡易 AI Bot：鎖定最近的非同隊敵人、靠近、射擊；
#         在 team_mode 開啟時由引擎自動補位以平衡紅藍隊人數。
@dataclass
class BotPlayer(Player):
    is_bot: bool = True
    aggro_range: float = 600.0
    target_id: str = ""
    next_shot_time: float = 0.0

    def __post_init__(self) -> None:
        self.weapon = Rifle()
        self.hp = 50.0
        self.max_hp = 50.0
        if not self.name or self.name == "player":
            self.name = f"BOT-{random.randint(100, 999)}"

    def ai_step(self, players, world_w: float, world_h: float, now: float, atk_min: float = 0.2, atk_max: float = 1.0) -> None:
        if self.state != STATE_ALIVE:
            return

        # EN: find the closest valid target — alive, not me, not same team.
        # zh-TW: 尋找最近的有效目標 — 仍存活、非自己、不同隊伍。
        target = None
        best = float("inf")
        cx = self.x + self.w / 2
        cy = self.y + self.h / 2
        for o in players:
            if o.id == self.id or o.state != STATE_ALIVE:
                continue
            if getattr(o, "is_bot", False):
                continue
            if self.team and o.team and o.team == self.team:
                continue
            
            # Limit max 2 bots per player
            targeting_count = sum(
                1 for p in players 
                if getattr(p, "is_bot", False) and p.state == STATE_ALIVE and getattr(p, "target_id", "") == o.id and p.id != self.id
            )
            if targeting_count >= 2:
                continue

            ox = o.x + o.w / 2
            oy = o.y + o.h / 2
            d2 = (ox - cx) ** 2 + (oy - cy) ** 2
            if d2 < best:
                best = d2
                target = o

        if target is None:
            self.target_id = ""
            self.input_dx = self.input_dy = 0.0
            self.input_fire = False
            return

        self.target_id = target.id

        tx = target.x + target.w / 2
        ty = target.y + target.h / 2
        dx = tx - cx
        dy = ty - cy
        dist = math.hypot(dx, dy) or 1.0

        if dist < 200.0:
            self.input_dx = -dx / dist
            self.input_dy = -dy / dist
        elif dist > 300.0:
            self.input_dx = dx / dist
            self.input_dy = dy / dist
        else:
            self.input_dx = 0.0
            self.input_dy = 0.0

        self.angle = math.atan2(dy, dx)
        if dist < self.aggro_range:
            if now >= self.next_shot_time:
                self.input_fire = True
                self.next_shot_time = now + random.uniform(atk_min, atk_max)
            else:
                self.input_fire = False
        else:
            self.input_fire = False
