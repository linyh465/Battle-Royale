from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Tuple


@dataclass
class AABB:
    """Axis-Aligned Bounding Box for collision detection."""
    x: float
    y: float
    w: float
    h: float

    def intersects(self, other: "AABB") -> bool:
        return (
            self.x < other.x + other.w
            and self.x + self.w > other.x
            and self.y < other.y + other.h
            and self.y + self.h > other.y
        )


@dataclass
class GameObject:
    """Base class for every entity that lives in the world."""

    x: float = 0.0
    y: float = 0.0
    w: float = 16.0
    h: float = 16.0
    vx: float = 0.0
    vy: float = 0.0
    alive: bool = True
    id: str = field(default_factory=lambda: uuid.uuid4().hex)

    def update(self, dt: float) -> None:
        if not self.alive:
            return
        self.x += self.vx * dt
        self.y += self.vy * dt

    @property
    def bbox(self) -> AABB:
        return AABB(self.x, self.y, self.w, self.h)

    def collides_with(self, other: "GameObject") -> bool:
        return self.alive and other.alive and self.bbox.intersects(other.bbox)

    def position(self) -> Tuple[float, float]:
        return self.x, self.y

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.__class__.__name__,
            "x": round(self.x, 2),
            "y": round(self.y, 2),
            "w": self.w,
            "h": self.h,
            "alive": self.alive,
        }
