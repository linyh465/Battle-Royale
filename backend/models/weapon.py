from __future__ import annotations

import math
from dataclasses import dataclass
from typing import List

from .bullet import Bullet


# ── Phase 10 — six-weapon arsenal ────────────────────────────────────────────
# EN: Six distinct weapons. Each subclass overrides at minimum (damage,
#     fire_rate, bullet_speed, bullet_ttl) so projectile feel differs.
#     The Shotgun and RocketLauncher additionally override fire() to control
#     pellet pattern / oversized hitbox.
#     Server identifier (`name`) is the canonical wire string used in
#     allowed_weapons CSV, lobby selectors, and player.weapon serialisation.
#     IDs: pistol, rifle, shotgun, sniper, smg, rocket.
# zh-TW: 六種互異武器。每個子類至少覆寫（傷害、射速、彈速、彈道存活時間），
#     讓手感真正有差異。霰彈槍與火箭筒額外覆寫 fire() 以控制彈散形與加大彈體。
#     伺服器識別碼（`name`）是 allowed_weapons CSV、大廳選單與
#     player.weapon 序列化都會用到的標準字串。
#     ID 對照：pistol, rifle, shotgun, sniper, smg, rocket。


@dataclass
class Weapon:
    """EN: Polymorphic weapon base. Subclasses override fire().
       zh-TW: 多型武器基底，子類覆寫 fire()。"""

    name: str = "weapon"
    damage: float = 10.0
    fire_rate: float = 4.0          # EN: shots/sec  zh-TW: 每秒發射數
    bullet_speed: float = 600.0
    bullet_ttl: float = 0.7         # EN: ~range = speed × ttl  zh-TW: 射程 = 速度 × ttl
    bullet_w: float = 6.0
    bullet_h: float = 6.0
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
                x=x, y=y, angle=angle,
                damage=self.damage,
                speed=self.bullet_speed,
                ttl=self.bullet_ttl,
                w=self.bullet_w, h=self.bullet_h,
            )
        ]


# ── 1. Pistol — fast trigger, balanced ───────────────────────────────────────
# EN: Reliable sidearm. Decent damage per shot, snappy fire rate, mid range.
# zh-TW: 可靠的副武器。單發傷害不錯、射速利落、射程中等。
@dataclass
class Pistol(Weapon):
    name: str = "pistol"
    damage: float = 12.0
    fire_rate: float = 5.0
    bullet_speed: float = 600.0
    bullet_ttl: float = 0.7


# ── 2. Assault Rifle — auto-fire workhorse (wire id stays "rifle") ──────────
# EN: Workhorse auto rifle. High RPM, low per-shot damage, fast bullets.
# zh-TW: 全自動主力步槍。高射速、單發低傷、彈速快。
@dataclass
class Rifle(Weapon):
    name: str = "rifle"
    damage: float = 8.0
    fire_rate: float = 11.0
    bullet_speed: float = 750.0
    bullet_ttl: float = 0.7


# ── 3. Shotgun — close-range pellet spread ───────────────────────────────────
# EN: Six-pellet cone. Devastating up close, falls off fast at range.
# zh-TW: 六發彈丸的扇形彈道。近戰毀滅性，遠距離快速衰減。
@dataclass
class Shotgun(Weapon):
    name: str = "shotgun"
    damage: float = 6.0
    fire_rate: float = 1.6
    bullet_speed: float = 600.0
    bullet_ttl: float = 0.5
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
                x=x, y=y,
                angle=start + step * i,
                damage=self.damage,
                speed=self.bullet_speed,
                ttl=self.bullet_ttl,
                w=self.bullet_w, h=self.bullet_h,
            )
            for i in range(self.pellets)
        ]


# ── 4. Sniper — slow charge, lethal one-shot ─────────────────────────────────
# EN: Long ttl + very fast bullet → cross-map lethality. Very low fire rate.
# zh-TW: 長 ttl + 高彈速 = 全圖狙擊。極低射速以平衡殺傷力。
@dataclass
class Sniper(Weapon):
    name: str = "sniper"
    damage: float = 25.0
    fire_rate: float = 0.8
    bullet_speed: float = 1500.0
    bullet_ttl: float = 1.5


# ── 5. SMG — short range bullet hose ─────────────────────────────────────────
# EN: Highest fire rate in the arsenal, lowest per-shot damage, short ttl.
# zh-TW: 武器庫中最高射速、單發傷害最低、ttl 最短。
@dataclass
class SMG(Weapon):
    name: str = "smg"
    damage: float = 5.0
    fire_rate: float = 16.0
    bullet_speed: float = 700.0
    bullet_ttl: float = 0.45


# ── 6. RocketLauncher — heavy slow projectile ────────────────────────────────
# EN: Single oversized projectile, slow speed, very high damage. The 14×14
#     hitbox is tagged on the wire (bw/bh) so clients can render it bigger.
# zh-TW: 單發超大彈體、低速、極高傷害。14×14 hitbox 會在線上以 bw/bh
#     標註，讓前端能畫出更大的彈體。
@dataclass
class RocketLauncher(Weapon):
    name: str = "rocket"
    damage: float = 50.0
    fire_rate: float = 0.6
    bullet_speed: float = 450.0
    bullet_ttl: float = 1.0
    bullet_w: float = 100.0
    bullet_h: float = 100.0


# EN: Public list — used by GameSettings.allowed_weapons default and by the
#     engine to validate user-supplied weapon picks.
# zh-TW: 公開清單 — GameSettings.allowed_weapons 預設值，以及引擎用來驗證
#     玩家送來的武器選擇。
ALL_WEAPON_IDS: tuple[str, ...] = (
    "pistol", "rifle", "shotgun", "sniper", "smg", "rocket",
)
