from __future__ import annotations

import math
from dataclasses import dataclass, field

from .game_object import GameObject


@dataclass
class Bullet(GameObject):
    owner_id: str = ""
    damage: float = 10.0
    speed: float = 600.0
    ttl: float = 1.5
    w: float = 6.0
    h: float = 6.0

    @classmethod
    def spawn(
        cls,
        owner_id: str,
        x: float,
        y: float,
        angle: float,
        damage: float,
        speed: float = 600.0,
        ttl: float = 1.5,
        w: float = 6.0,
        h: float = 6.0,
    ) -> "Bullet":
        # EN: Phase 10 — accept optional w/h so heavy projectiles (rocket) can
        #     declare a larger collision/visual hitbox. Defaults stay at 6×6
        #     so existing weapons emit the same wire bytes (zero churn).
        # zh-TW: Phase 10 — 接受可選的 w/h，讓重型彈頭（火箭）能宣告較大的
        #     碰撞 / 視覺 hitbox。預設仍為 6×6，既有武器的線上格式不會變動。
        return cls(
            x=x,
            y=y,
            vx=math.cos(angle) * speed,
            vy=math.sin(angle) * speed,
            owner_id=owner_id,
            damage=damage,
            speed=speed,
            ttl=ttl,
            w=w,
            h=h,
        )

    def update(self, dt: float) -> None:
        super().update(dt)
        self.ttl -= dt
        if self.ttl <= 0:
            self.alive = False

    def to_dict(self) -> dict:
        d = super().to_dict()
        d.update({"owner_id": self.owner_id, "damage": self.damage})
        return d
