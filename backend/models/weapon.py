from __future__ import annotations

import math
import time
from dataclasses import dataclass
from typing import List

from .bullet import Bullet


@dataclass
class Weapon:
    """Polymorphic weapon base. Subclasses override fire()."""

    name: str = "weapon"
    damage: float = 10.0
    fire_rate: float = 4.0          # shots per second
    bullet_speed: float = 600.0
    bullet_ttl: float = 0.7         # reduced from 1.2 → effective range ~420px
    _last_shot: float = 0.0

    def can_fire(self, now: float) -> bool:
        return (now - self._last_shot) >= (1.0 / self.fire_rate)

    def fire(self, owner_id: str, x: float, y: float, angle: float, now: float) -> List[Bullet]:
        if not self.can_fire(now):
            return []
        self._last_shot = now
        return [
            Bullet.spawn(
                owner_id=owner_id,
                x=x,
                y=y,
                angle=angle,
                damage=self.damage,
                speed=self.bullet_speed,
                ttl=self.bullet_ttl,
            )
        ]


@dataclass
class Pistol(Weapon):
    name: str = "pistol"
    damage: float = 12.0
    fire_rate: float = 5.0


@dataclass
class Rifle(Weapon):
    name: str = "rifle"
    damage: float = 8.0
    fire_rate: float = 11.0
    bullet_speed: float = 750.0


@dataclass
class Shotgun(Weapon):
    name: str = "shotgun"
    damage: float = 6.0
    fire_rate: float = 1.6
    pellets: int = 6
    spread: float = math.radians(14)

    def fire(self, owner_id, x, y, angle, now):
        if not self.can_fire(now):
            return []
        self._last_shot = now
        step = self.spread / max(1, self.pellets - 1)
        start = angle - self.spread / 2
        return [
            Bullet.spawn(
                owner_id=owner_id,
                x=x,
                y=y,
                angle=start + step * i,
                damage=self.damage,
                speed=self.bullet_speed,
                ttl=self.bullet_ttl,
            )
            for i in range(self.pellets)
        ]
