/**
 * EN: expandSnapshot — Phase 9 wire-format adapter.
 *     The backend broadcasts an ultra-short JSON payload at every tick to
 *     save Railway egress bandwidth. Rendering code (GameCanvas, DirectorCanvas,
 *     AdminPanel, DeathScreen) was written against the original descriptive
 *     keys, so this helper rehydrates each snapshot back into that shape
 *     once per tick. That keeps the wire small without touching ~1.6k lines
 *     of UI code.
 *
 *     Wire keys (top-level):
 *       type='state', t=tick, n=now, wo={w,h}, st=settings,
 *       go=game_over, tr=time_remaining, rs=reset_seq,
 *       ps=players[], bs=bullets[].
 *     Player keys:
 *       i, nm, x, y, h(hp), mh(max_hp), a(angle), k, d,
 *       dd(damage_dealt), dt(damage_taken), wp(weapon),
 *       s(state), ra(respawn_at), b(is_bot 1/0), tm(team),
 *       kn(killed_by_name), kw(killed_by_weapon), al(alive 1/0).
 *     Bullet keys:
 *       i, x, y, o(owner_id), dm(damage), al(alive 1/0).
 *     Width / height are constants restored client-side
 *     (player 28×28, bullet 6×6) — they never travel on the wire.
 *
 * zh-TW: expandSnapshot — Phase 9 線上格式轉換器。
 *     後端為了節省 Railway 出站頻寬，每 tick 改送極短鍵 JSON。
 *     渲染端（GameCanvas、DirectorCanvas、AdminPanel、DeathScreen）原本是針對
 *     描述性長鍵撰寫，這個 helper 在每個 tick 把短鍵展開回長鍵格式，
 *     既能瘦線、又不用動到約 1600 行的 UI 程式。
 *
 *     線上鍵對照（最上層）：
 *       type='state'、t=tick、n=now、wo={w,h}、st=settings、
 *       go=game_over、tr=剩餘時間、rs=reset_seq、ps=玩家陣列、bs=子彈陣列。
 *     玩家鍵：
 *       i、nm、x、y、h(hp)、mh(max_hp)、a(angle)、k、d、
 *       dd(damage_dealt)、dt(damage_taken)、wp(weapon)、
 *       s(state)、ra(respawn_at)、b(is_bot 1/0)、tm(team)、
 *       kn(killed_by_name)、kw(killed_by_weapon)、al(alive 1/0)。
 *     子彈鍵：i、x、y、o(owner_id)、dm(damage)、al(alive 1/0)。
 *     寬高為常數（玩家 28×28、子彈 6×6），不在線上傳輸，由前端還原。
 */

// EN: Constants matching the server-side dataclass defaults.
// zh-TW: 與伺服器 dataclass 預設值一致的常數。
const PLAYER_W = 28;
const PLAYER_H = 28;
const BULLET_W = 6;
const BULLET_H = 6;

function expandPlayer(p) {
  // EN: Defensive — if the snapshot is already in long-key form (e.g. legacy
  //     server build), pass it through unchanged.
  // zh-TW: 防禦性檢查 — 如果伺服器仍送舊版長鍵格式，直接原樣回傳。
  if (p && typeof p.id === "string" && typeof p.hp === "number") return p;
  return {
    id: p.i,
    name: p.nm,
    x: p.x,
    y: p.y,
    w: PLAYER_W,
    h: PLAYER_H,
    hp: p.h,
    max_hp: p.mh,
    angle: p.a,
    kills: p.k,
    deaths: p.d,
    damage_dealt: p.dd,
    damage_taken: p.dt,
    weapon: p.wp,
    state: p.s,
    status: p.s,
    respawn_at: p.ra,
    is_bot: p.b === 1,
    team: p.tm,
    killed_by_name: p.kn,
    killed_by_weapon: p.kw,
    alive: p.al === 1,
  };
}

function expandBullet(b) {
  if (b && typeof b.owner_id === "string") return b;
  // EN: Phase 10 — `bw`/`bh` are only on the wire when the bullet hitbox
  //     differs from the 6×6 default (currently rocket = 14×14). When
  //     absent, fall back to the default constants.
  // zh-TW: Phase 10 — bw/bh 只有在子彈 hitbox 不是預設 6×6 時才會送
  //     （目前只有 rocket=14×14）。沒帶就用預設常數。
  return {
    id: b.i,
    x: b.x,
    y: b.y,
    w: typeof b.bw === "number" ? b.bw : BULLET_W,
    h: typeof b.bh === "number" ? b.bh : BULLET_H,
    owner_id: b.o,
    damage: b.dm,
    alive: b.al === 1,
  };
}

export default function expandSnapshot(msg) {
  if (!msg || msg.type !== "state") return msg;
  // EN: Already long-key (older server) — fast path, no work.
  // zh-TW: 已是長鍵格式（舊版 server）— 快路徑，不做任何處理。
  if (Array.isArray(msg.players)) return msg;

  const players = Array.isArray(msg.ps) ? msg.ps.map(expandPlayer) : [];
  const bullets = Array.isArray(msg.bs) ? msg.bs.map(expandBullet) : [];
  return {
    type: "state",
    tick: msg.t,
    now: msg.n,
    world: msg.wo,
    settings: msg.st,
    game_over: msg.go,
    game_time_remaining: msg.tr,
    reset_seq: msg.rs,
    players,
    bullets,
  };
}
