from __future__ import annotations

import math
import random
from dataclasses import dataclass

from .player import Player, STATE_ALIVE
from .weapon import Rifle


# EN: Minimal AI bot. Picks the nearest alive non-bot enemy, runs at it,
#     fires when in range. Phase 20 — teams feature removed; bots simply
#     target the nearest human player without any team filtering.
# zh-TW: 簡易 AI Bot：鎖定最近的存活非 Bot 敵人、靠近、射擊。
#     Phase 20 — 已移除隊伍功能；Bot 不再做隊伍過濾，直接追擊最近的人類玩家。
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

    def ai_step(
        self,
        players,
        world_w: float,
        world_h: float,
        now: float,
        atk_min: float = 0.2,
        atk_max: float = 1.0,
        max_focus: int = 2,
    ) -> None:
        # EN: Phase 12 — `max_focus` is the admin-tunable cap on how many
        #     bots may focus-fire the same player at once. The previous
        #     hard-coded value of 2 is now passed in by the engine from
        #     `GameSettings.bot_max_attack_limit`. A value of 0 disables
        #     the cap entirely (bots will swarm whoever is closest).
        # zh-TW: Phase 12 — `max_focus` 是管理員可調的集火上限：
        #     同一名玩家最多可被多少隻 Bot 同時鎖定。原本寫死的 2
        #     已改由 engine 從 `GameSettings.bot_max_attack_limit` 傳入；
        #     傳 0 代表不限制（所有 Bot 都會圍攻最近的玩家）。
        if self.state != STATE_ALIVE:
            return

        # EN: find the closest valid target — alive, not me, not same team,
        #     and not already saturated with bot attention.
        # zh-TW: 尋找最近的有效目標 — 仍存活、非自己、不同隊伍，
        #     且尚未被太多 Bot 集火。
        target = None
        best = float("inf")
        cx = self.x + self.w / 2
        cy = self.y + self.h / 2
        for o in players:
            if o.id == self.id or o.state != STATE_ALIVE:
                continue
            if getattr(o, "is_bot", False):
                continue
            # EN: Phase 20 — team filtering removed alongside the team feature.
            # zh-TW: Phase 20 — 隨著隊伍功能移除，此處不再做隊伍過濾。

            # EN: Honour the global focus-fire cap. `max_focus <= 0` means
            #     unlimited (skip the check entirely).
            # zh-TW: 遵守集火上限；`max_focus <= 0` 代表不設限（直接跳過）。
            if max_focus > 0:
                targeting_count = sum(
                    1 for p in players
                    if getattr(p, "is_bot", False)
                    and p.state == STATE_ALIVE
                    and getattr(p, "target_id", "") == o.id
                    and p.id != self.id
                )
                if targeting_count >= max_focus:
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
