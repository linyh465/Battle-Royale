from __future__ import annotations

import math
from dataclasses import dataclass

from .game_object import GameObject


@dataclass
class Bullet(GameObject):
    # EN: Phase 15 — `damage` is the AUTHORITATIVE per-bullet damage value.
    #     It MUST be supplied by the firing weapon at spawn-time (never left
    #     at 0 or the legacy 10.0 default). The collision resolver in
    #     engine.py reads it directly to deduct HP from the victim, so an
    #     incorrect value here would silently zero-out hits. Sniper bug fix:
    #     guarantee the value flows from `Weapon.damage` → `Bullet.spawn` →
    #     `Bullet.damage` without truncation.
    # zh-TW: Phase 15 — `damage` 是子彈權威傷害值。
    #     必須由發射武器在 spawn 時給定（不能保留為 0 或舊版 10.0 預設值）。
    #     engine.py 的碰撞解算會直接讀取此欄位扣血；錯誤值會讓命中變成
    #     靜默零傷害。狙擊槍 bug 修正：確保數值能完整從 `Weapon.damage`
    #     流到 `Bullet.spawn` 再到 `Bullet.damage`，全程不被截斷。
    owner_id: str = ""
    damage: float = 10.0
    speed: float = 600.0
    ttl: float = 1.5
    w: float = 6.0
    h: float = 6.0
    # EN: Phase 15 — previous-frame center coordinates for swept-line
    #     continuous collision detection (CCD). Without this, a 1500 px/s
    #     sniper bullet at 20 Hz moves 75 px per tick — easily tunneling
    #     past a 28×28 player AABB. Engine uses (prev_cx, prev_cy) → (cx, cy)
    #     as a line segment and tests it against each player bbox.
    # zh-TW: Phase 15 — 上一幀的中心座標，供「掃掠線」連續碰撞偵測（CCD）使用。
    #     沒有這欄位時，1500 px/s 的狙擊彈在 20 Hz 下每 tick 位移 75 px，
    #     很容易直接「穿過」28×28 的玩家 AABB。引擎會用
    #     (prev_cx, prev_cy) → (cx, cy) 作為線段，逐一測試每位玩家的 bbox。
    prev_cx: float = 0.0
    prev_cy: float = 0.0

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
        # EN: Phase 15 — spawn x/y is the bullet CENTER (passed by Player.shoot
        #     as muzzle position). We translate to the top-left for the AABB
        #     and seed prev_cx / prev_cy with the same center so the very
        #     first CCD segment has zero length (no false positives at spawn).
        #     `damage` is forced to float so an int weapon-config never gets
        #     truncated to 0 by accident.
        # zh-TW: Phase 15 — spawn 傳入的 x/y 是子彈「中心」（由 Player.shoot
        #     傳入槍口位置）。內部換算為 AABB 的左上角；prev_cx/prev_cy
        #     初始化為同一個中心點，讓第一個 tick 的 CCD 線段長度為 0，
        #     避免在出膛瞬間誤判命中。`damage` 強制轉為 float，避免設定
        #     誤填整數時被截斷成 0。
        cx, cy = float(x), float(y)
        return cls(
            x=cx - w / 2.0,
            y=cy - h / 2.0,
            vx=math.cos(angle) * speed,
            vy=math.sin(angle) * speed,
            owner_id=owner_id,
            damage=float(damage),
            speed=speed,
            ttl=ttl,
            w=w,
            h=h,
            prev_cx=cx,
            prev_cy=cy,
        )

    def update(self, dt: float) -> None:
        # EN: Phase 15 — record the previous CENTER before the position step
        #     so engine CCD has a valid line segment after `update()`.
        # zh-TW: Phase 15 — 在位移之前先記錄當前中心，更新後即可用
        #     (prev_cx, prev_cy) → (現在中心) 作為 CCD 線段。
        self.prev_cx = self.x + self.w / 2.0
        self.prev_cy = self.y + self.h / 2.0
        super().update(dt)
        self.ttl -= dt
        if self.ttl <= 0:
            self.alive = False

    def to_dict(self) -> dict:
        d = super().to_dict()
        d.update({"owner_id": self.owner_id, "damage": self.damage})
        return d
