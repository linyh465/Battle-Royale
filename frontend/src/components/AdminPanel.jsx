/**
 * EN: AdminPanel — Phase 10 → Phase 12.
 *     Phase 10 fixed input lag (memoised <NumSetting> / <TextSetting>).
 *     Phase 12 fixes the toggle-flicker bug: previously, after the admin
 *     clicked a toggle (Weapons / Leaderboard columns / booleans), the
 *     local UI snapped briefly back to the old value because the next 250 ms
 *     re-render read the *pre-update* settings from the snapshot before the
 *     server's broadcast caught up. The fix is "optimistic-with-confirmation":
 *     each toggleable field stores a pending value locally; the local value
 *     is rendered until the next server snapshot reports the same value
 *     (i.e. the change has been confirmed), at which point the override
 *     clears. This eliminates the flicker without inventing a custom RTT
 *     timer (the engine commits the new value FIRST in admin_set; see
 *     engine.py for the matching backend guarantee).
 *
 *     Phase 12 also:
 *       - removes the Server Stress Test panel entirely,
 *       - adds the `bot_max_attack_limit` slider (focus-fire cap),
 *       - applies Tailwind responsive prefixes (flex-col / md:flex-row …)
 *         so the dashboard works on mobile-width admin sessions.
 *
 * zh-TW: AdminPanel — Phase 10 → Phase 12。
 *     Phase 10 解決了輸入卡頓（memoised <NumSetting> / <TextSetting>）。
 *     Phase 12 解決切換 toggle 時短暫閃回舊值的 bug：以往管理員按下 toggle
 *     後，下一個 250 ms re-render 會先讀到伺服器尚未更新的 snapshot，UI 會
 *     瞬間閃回舊值。改採「樂觀更新 + 伺服器確認後清除」：每個可切換欄位
 *     都先寫入本地 pending 值並照本地值渲染，直到 snapshot 回報的值與
 *     pending 一致（即伺服器已經確認），才把 override 清掉，等於消除了
 *     閃爍。後端 engine.admin_set 會先 setattr 永久 persist，再執行 side
 *     effects，前後端共同保證了這個流程。
 *
 *     Phase 12 同時：
 *       - 完整移除壓力測試面板，
 *       - 新增 `bot_max_attack_limit`（集火上限）控制項，
 *       - 套用 Tailwind 響應式前綴（flex-col / md:flex-row …），
 *         讓管理員介面在手機寬度也能正常使用。
 */
import { memo, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n.jsx";

// EN: Server-side weapon IDs. Must match models/weapon.py ALL_WEAPON_IDS.
// zh-TW: 伺服器端武器 ID，必須與 models/weapon.py 中的 ALL_WEAPON_IDS 一致。
const ALL_WEAPONS = ["pistol", "rifle", "shotgun", "sniper", "smg", "rocket"];

export default function AdminPanel({ stateRef, send, onClose }) {
  const { t, lang, setLang } = useI18n();
  const [, setTick] = useState(0);
  const [filter, setFilter] = useState("all");
  const [hpAllInput, setHpAllInput] = useState("");

  // EN: Phase 12 — pending overrides for any toggleable setting. Keyed by
  //     setting name; the value is what we just sent to the server. The
  //     override is cleared as soon as the server's snapshot reports the
  //     same value (= the change has been confirmed end-to-end). This is
  //     why the toggle no longer flickers: we never read a stale snapshot
  //     between click and server-confirmation.
  // zh-TW: Phase 12 — 各 toggle 欄位的 pending overrides。以欄位名為 key，
  //     值是剛送給伺服器的內容；一旦下個 snapshot 回報相同值（end-to-end
  //     確認），override 立刻清除。這就是 toggle 不再閃爍的關鍵：點擊到
  //     伺服器確認之間，UI 都不會去讀仍未更新的 snapshot。
  const [pending, setPending] = useState({});

  useEffect(() => {
    // EN: Roster + telemetry refresh. Inputs are insulated from this tick.
    // zh-TW: 玩家名單與遙測刷新；輸入框已與此 tick 解耦。
    const id = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);

  const snap = stateRef.current;
  const settings = snap?.settings ?? {};
  const players = snap?.players ?? [];

  // EN: Reconcile pending → server. Any pending key whose server value
  //     already matches the local override is dropped from `pending` so
  //     subsequent renders just use `settings`. Doing it inside an effect
  //     keeps render pure — we never mutate state during render itself.
  // zh-TW: 把 pending 與 server 對帳。若伺服器回報的值已等於本地 pending
  //     值，立刻把該 key 從 pending 清掉，後續 render 直接讀 `settings`。
  //     在 effect 裡做這件事可保持 render 純函式，不會在 render 中改 state。
  useEffect(() => {
    setPending((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const key of Object.keys(prev)) {
        const serverVal = settings?.[key];
        if (serverVal !== undefined && String(serverVal) === String(prev[key])) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [settings]);

  // EN: Helper — read the live value of a toggleable setting, preferring
  //     the local pending override (if any) over the snapshot.
  // zh-TW: helper — 讀取 toggle 欄位的當前值，pending override 優先於 snapshot。
  const liveSetting = (key, fallback) =>
    pending[key] !== undefined ? pending[key] : settings[key] ?? fallback;

  // EN: Helper — commit a setting both optimistically (local pending) and
  //     to the server (admin_set). Used for every toggle in this panel.
  // zh-TW: helper — 同時做樂觀本地更新與伺服器 commit（admin_set），
  //     所有 toggle 都使用這個函式。
  const commitSetting = (key, value) => {
    setPending((prev) => ({ ...prev, [key]: value }));
    send({ type: "admin_set", key, value });
  };

  const sortKey = liveSetting("leaderboard_sort_by", "kills");
  const sorted = [...players].sort((a, b) => (b[sortKey] ?? 0) - (a[sortKey] ?? 0));
  const timeRemaining = snap?.game_time_remaining ?? 0;
  const gameOver = snap?.game_over ?? false;

  const filtered = sorted.filter((p) => {
    if (filter === "alive") return p.state === "alive";
    if (filter === "dead") return p.state === "dead";
    if (filter === "bots") return p.is_bot;
    return true;
  });

  const counts = {
    total: players.length,
    alive: players.filter((p) => p.state === "alive").length,
    dead: players.filter((p) => p.state === "dead").length,
    bots: players.filter((p) => p.is_bot).length,
  };

  // EN: Phase 12 — every toggle/select/checkbox routes through commitSetting
  //     so the optimistic-with-confirmation pipeline applies uniformly.
  // zh-TW: Phase 12 — 所有 toggle / select / checkbox 都改走 commitSetting，
  //     一致地套用「樂觀更新 + 伺服器確認後清除」流程。
  const setKey = (key, value) => commitSetting(key, value);

  // ── Leaderboard column toggles ─────────────────────────────────────────
  const allCols = ["kills", "deaths", "damage_dealt", "damage_taken"];
  const colLabels = { kills: t.kills, deaths: t.deaths, damage_dealt: t.damageDealt, damage_taken: t.damageTaken };
  const activeCols = liveSetting("leaderboard_columns", "kills,deaths,damage_dealt,damage_taken")
    .split(",").map(s => s.trim()).filter(Boolean);
  const toggleCol = (col) => {
    let next;
    if (activeCols.includes(col)) {
      next = activeCols.filter(c => c !== col);
      if (next.length === 0) return;
    } else {
      next = [...activeCols, col];
    }
    commitSetting("leaderboard_columns", next.join(","));
  };

  // ── Weapon allow-list toggles ─────────────────────────────────────────
  // EN: Phase 12 — uses the same `pending` pipeline as all other toggles.
  //     The override clears the moment the server's snapshot echoes our
  //     CSV back, so the UI never flickers between click and confirm.
  // zh-TW: Phase 12 — 改用與其他 toggle 一致的 `pending` 流程；
  //     伺服器 snapshot 回報相同 CSV 後 override 立即清除，
  //     UI 在點擊到伺服器確認之間不會閃爍。
  const activeWeapons = liveSetting("allowed_weapons", ALL_WEAPONS.join(","))
    .split(",").map(s => s.trim()).filter(Boolean);
  const toggleWeapon = (w) => {
    const set = new Set(activeWeapons);
    if (set.has(w)) {
      // EN: Never allow the list to drop to zero — engine would force-reset.
      // zh-TW: 不允許清單變成空，否則引擎會被迫保底全開。
      if (set.size <= 1) return;
      set.delete(w);
    } else {
      set.add(w);
    }
    commitSetting("allowed_weapons", [...set].join(","));
  };

  return (
    <div className="br-admin">
      <div className="br-bg-grid" aria-hidden />
      <div className="br-bg-glow br-bg-glow--crimson" aria-hidden />
      <div className="br-scanlines" aria-hidden />

      {/* EN: Phase 12 — `flex-wrap` lets telemetry chips spill onto a new
              row instead of overflowing on phones; `gap-2` keeps spacing.
          zh-TW: Phase 12 — `flex-wrap` 讓遙測 chip 在手機寬度自動換行，
              避免溢出；`gap-2` 維持基本間距。 */}
      <header className="br-admin-topbar flex-wrap gap-2">
        <div className="br-admin-brand">
          <span className="br-status-led br-status-led--red" />
          <div className="br-admin-brand-text">
            <span className="br-admin-title">{t.commandCenter}</span>
            <span className="br-admin-sub">{t.adminSubtitle}</span>
          </div>
        </div>
        <div className="br-admin-meta">
          <Telem label="TICK" value={snap?.tick ?? 0} />
          <Telem label="PLAYERS" value={counts.total} />
          <Telem label="ALIVE" value={counts.alive} accent="cyan" />
          <Telem label="DOWN" value={counts.dead} accent="crimson" />
          {gameOver && (
            <span style={{
              fontFamily: "var(--br-mono)", fontSize: 12, color: "#ff3b5c",
              background: "rgba(255,59,92,0.15)", border: "1px solid rgba(255,59,92,0.4)",
              padding: "3px 10px", borderRadius: 6, letterSpacing: "0.12em",
            }}>
              {t.gameOver}
            </span>
          )}
          <div className="br-lang-toggle" role="tablist" aria-label="Language">
            {["en", "zh", "vi"].map(l => (
              <button key={l} role="tab" aria-selected={lang === l}
                className={`br-lang-pill ${lang === l ? "is-active" : ""}`}
                onClick={() => setLang(l)}
              >{l === "en" ? "EN" : l === "zh" ? "中" : "VN"}</button>
            ))}
          </div>
          <button className="br-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
      </header>

      {/* EN: Phase 12 RWD — `flex-col md:grid` flips the dashboard to a
              vertical stack on phones and back to the 3-column grid on ≥768 px.
              `gap-3 md:gap-4` keeps spacing comfortable on both ends.
          zh-TW: Phase 12 RWD — `flex-col md:grid` 在手機寬度以垂直堆疊
              呈現，≥768px 時才回到三欄 grid；spacing 在手機與桌面都舒適。 */}
      <div className="br-admin-body flex flex-col md:grid gap-3 md:gap-4">
        {/* LEFT — Game Settings */}
        <section className="br-glass br-admin-col w-full md:w-auto">
          <PanelHead title={t.gameSettings} />

          <div className="br-field">
            <label className="br-field-label">{t.teamMode}</label>
            <Toggle checked={!!liveSetting("team_mode", false)} onChange={(v) => setKey("team_mode", v)} />
          </div>

          <div className="br-field">
            <label className="br-field-label">{t.sortLeaderboard}</label>
            {/* EN: `value` reads through liveSetting so the dropdown does
                    not flicker between click and server-confirmation.
                zh-TW: `value` 透過 liveSetting 取值，避免點擊到伺服器確認
                    之間下拉選單閃回舊值。 */}
            <select className="br-select" value={sortKey}
              onChange={(e) => setKey("leaderboard_sort_by", e.target.value)}>
              <option value="kills">{t.kills}</option>
              <option value="deaths">{t.deaths}</option>
              <option value="damage_dealt">{t.damageDealt}</option>
              <option value="damage_taken">{t.damageTaken}</option>
            </select>
          </div>

          <NumSetting
            label={t.baseRespawn}
            serverValue={settings.base_respawn_time}
            fallback={5}
            min={0} step={0.5}
            onCommit={(v) => setKey("base_respawn_time", v)}
          />
          <NumSetting
            label={t.botRespawn}
            serverValue={settings.bot_respawn_time}
            fallback={15}
            min={0} step={0.5}
            onCommit={(v) => setKey("bot_respawn_time", v)}
          />
          <NumSetting
            label={t.deathPenalty}
            serverValue={settings.respawn_penalty}
            fallback={3}
            min={0} step={0.5}
            onCommit={(v) => setKey("respawn_penalty", v)}
          />

          <div className="br-divider" />

          <PanelHead title={t.weaponArsenal} small />
          <p className="br-mute" style={{ fontSize: 11, margin: "4px 0 8px", lineHeight: 1.5 }}>
            {t.weaponArsenalHint}
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            {ALL_WEAPONS.map((w) => (
              <button key={w}
                className={`br-filter-tab ${activeWeapons.includes(w) ? "is-active" : ""}`}
                onClick={() => toggleWeapon(w)}
                style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}
              >
                {t[`weapon_${w}`] ?? w}
              </button>
            ))}
          </div>

          <div className="br-divider" />

          <PanelHead title={t.botManagement} small />
          <div className="br-field">
            <label className="br-field-label">{t.botsEnabled}</label>
            <Toggle checked={!!liveSetting("bots_enabled", false)} onChange={(v) => setKey("bots_enabled", v)} />
          </div>
          <NumSetting
            label={t.botCount}
            serverValue={settings.bot_count}
            fallback={0}
            min={0} max={20} step={1}
            integer
            onCommit={(v) => setKey("bot_count", v)}
          />
          <NumSetting
            label={t.botAtkSpeedMin}
            serverValue={settings.bot_atk_speed_min}
            fallback={0.2}
            min={0.1} step={0.1}
            onCommit={(v) => setKey("bot_atk_speed_min", v)}
          />
          <NumSetting
            label={t.botAtkSpeedMax}
            serverValue={settings.bot_atk_speed_max}
            fallback={1.0}
            min={0.1} step={0.1}
            onCommit={(v) => setKey("bot_atk_speed_max", v)}
          />
          {/* EN: Phase 12 — admin-tunable focus-fire cap. 0 = unlimited.
              zh-TW: Phase 12 — 集火上限（管理員可調），0 代表不限制。 */}
          <NumSetting
            label={t.botMaxAttackLimit}
            serverValue={settings.bot_max_attack_limit}
            fallback={2}
            min={0} max={20} step={1}
            integer
            onCommit={(v) => setKey("bot_max_attack_limit", v)}
          />
          <p className="br-mute" style={{ fontSize: 11, margin: "-2px 0 8px", lineHeight: 1.5 }}>
            {t.botMaxAttackLimitHint}
          </p>

          <div className="br-divider" />

          <PanelHead title={t.hpManagement} small />
          <NumSetting
            label={t.defaultPlayerHp}
            serverValue={settings.default_player_hp}
            fallback={200}
            min={1} step={10}
            onCommit={(v) => setKey("default_player_hp", v)}
          />
          <NumSetting
            label={t.defaultBotHp}
            serverValue={settings.default_bot_hp}
            fallback={50}
            min={1} step={10}
            onCommit={(v) => setKey("default_bot_hp", v)}
          />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            <div className="br-input-row" style={{ gap: 4 }}>
              <input className="br-input br-input--num" type="number" min={1} step={10}
                placeholder="HP"
                value={hpAllInput}
                onChange={e => setHpAllInput(e.target.value)} />
              <button className="br-btn br-btn--ghost br-btn--xs"
                onClick={() => {
                  const hp = parseFloat(hpAllInput);
                  if (!isNaN(hp)) send({ type: "admin_set_all_hp", hp, target: "all" });
                }}>{t.setHpAll}</button>
              <button className="br-btn br-btn--ghost br-btn--xs"
                onClick={() => {
                  const hp = parseFloat(hpAllInput);
                  if (!isNaN(hp)) send({ type: "admin_set_all_hp", hp, target: "players" });
                }}>{t.setHpPlayers}</button>
              <button className="br-btn br-btn--ghost br-btn--xs"
                onClick={() => {
                  const hp = parseFloat(hpAllInput);
                  if (!isNaN(hp)) send({ type: "admin_set_all_hp", hp, target: "bots" });
                }}>{t.setHpBots}</button>
            </div>
          </div>

          <div className="br-divider" />

          <PanelHead title={t.gameTimer} small />
          <div style={{ fontSize: 13, color: "#91a3c4", marginBottom: 8, fontFamily: "var(--br-mono)" }}>
            {timeRemaining > 0
              ? `${t.timeRemaining}: ${Math.floor(timeRemaining / 60)}:${String(Math.floor(timeRemaining % 60)).padStart(2, "0")}`
              : t.noTimer}
          </div>
          <TimerSetTextRow
            label={t.setTimer}
            applyLabel={t.apply}
            onApply={(s) => send({ type: "admin_set_game_timer", seconds: s })}
          />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            <button className="br-btn br-btn--ghost br-btn--xs"
              onClick={() => send({ type: "admin_adjust_game_timer", delta: 30 })}>
              {t.extendTimer}
            </button>
            <button className="br-btn br-btn--ghost br-btn--xs"
              onClick={() => send({ type: "admin_adjust_game_timer", delta: -30 })}>
              {t.shortenTimer}
            </button>
          </div>

          <div className="br-divider" />

          <PanelHead title={t.selectColumns} small />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {allCols.map(col => (
              <button key={col}
                className={`br-filter-tab ${activeCols.includes(col) ? "is-active" : ""}`}
                onClick={() => toggleCol(col)}
                style={{ fontSize: 11 }}>
                {colLabels[col]}
              </button>
            ))}
          </div>

          <div className="br-divider" />

          <PanelHead title={t.access} small />
          <PasswordChangeRow
            label={t.changeAdminPw}
            placeholder={t.newPwPlaceholder}
            applyLabel={t.apply}
            onApply={(pw) => send({ type: "admin_password", value: pw })}
          />
        </section>

        {/* CENTER — Player Roster */}
        <section className="br-glass br-admin-col br-admin-col--wide w-full md:w-auto">
          {/* EN: Phase 12 RWD — stack the roster header on phones so filter
                  tabs do not crowd the title.
              zh-TW: Phase 12 RWD — 手機寬度下標題與篩選 tab 改成上下排列。 */}
          <div className="br-roster-head flex flex-col md:flex-row gap-2 md:gap-4">
            <PanelHead title={t.playerRoster} inline />
            <div className="br-filter-tabs flex-wrap">
              {[
                { id: "all",   label: `ALL ${counts.total}` },
                { id: "alive", label: `ALIVE ${counts.alive}` },
                { id: "dead",  label: `DOWN ${counts.dead}` },
                { id: "bots",  label: `BOTS ${counts.bots}` },
              ].map((f) => (
                <button key={f.id}
                  className={`br-filter-tab ${filter === f.id ? "is-active" : ""}`}
                  onClick={() => setFilter(f.id)}>{f.label}</button>
              ))}
            </div>
          </div>

          {/* EN: Phase 15 — admin-only `Device` column.
                  The `devices` map comes from the AUGMENTED admin snapshot
                  (`admin_snapshot()` in engine.py) and is keyed by player_id.
                  We surface IP and a truncated User-Agent (full UA on hover
                  via title=). This column is added INSIDE AdminPanel only;
                  the regular player snapshot never carries this data, so
                  ordinary players cannot see other players' device info.
              zh-TW: Phase 15 — 管理員專屬「設備」欄位。
                  `devices` 對照表來自管理員擴充版快照
                  （engine.py 的 `admin_snapshot()`），以 player_id 為 key。
                  欄位顯示 IP 與截短的 User-Agent（hover 顯示完整 UA）。
                  此欄僅出現在 AdminPanel；一般玩家快照不帶這份資料，
                  普通玩家絕對看不到其他玩家的設備資訊。 */}
          <div className="br-table">
            <div className="br-table-head">
              <span className="br-th br-th--idx">#</span>
              <span className="br-th br-th--name">CALLSIGN</span>
              <span className="br-th br-th--team">TEAM</span>
              <span className="br-th br-th--num">K</span>
              <span className="br-th br-th--num">D</span>
              <span className="br-th br-th--num">DMG</span>
              <span className="br-th br-th--state">STATE</span>
              <span className="br-th" style={{ minWidth: 180, flex: "1 1 180px" }}>
                {t.adminDevice}
              </span>
              <span className="br-th br-th--act" style={{ minWidth: 140 }}>ACTION</span>
            </div>

            <div className="br-table-body">
              {filtered.map((p, i) => {
                const dev = (snap?.devices && snap.devices[p.id]) || null;
                const ip = dev?.ip || "";
                const ua = dev?.ua || "";
                const uaShort = ua.length > 38 ? ua.slice(0, 36) + "…" : ua;
                return (
                  <div className={`br-tr ${p.is_bot ? "is-bot" : ""}`} key={p.id}>
                    <span className="br-td br-td--idx">{String(i + 1).padStart(2, "0")}</span>
                    <span className="br-td br-td--name">
                      <span className="br-name">{p.name}</span>
                      {p.is_bot && <span className="br-tag br-tag--bot">BOT</span>}
                      {p.state === "dead" && p.respawn_at > 0 && (
                        <span style={{ fontSize: 11, color: "#ff7a8e", marginLeft: 6, fontFamily: "var(--br-mono)" }}>
                          ({Math.max(0, p.respawn_at - (snap?.now || 0)).toFixed(1)}s)
                        </span>
                      )}
                    </span>
                    <span className="br-td br-td--team">
                      {p.team
                        ? <span className={`br-team-pill br-team-pill--${p.team}`}>{p.team.toUpperCase()}</span>
                        : <span className="br-mute">—</span>}
                    </span>
                    <span className="br-td br-td--num br-mono">{p.kills ?? 0}</span>
                    <span className="br-td br-td--num br-mono br-mute">{p.deaths ?? 0}</span>
                    <span className="br-td br-td--num br-mono br-cyan">{Math.round(p.damage_dealt ?? 0)}</span>
                    <span className="br-td br-td--state"><StateBadge state={p.state} /></span>
                    <span
                      className="br-td"
                      style={{
                        minWidth: 180, flex: "1 1 180px",
                        fontFamily: "var(--br-mono)", fontSize: 11,
                        color: "#91a3c4", lineHeight: 1.35,
                        overflow: "hidden",
                      }}
                      title={ua ? `${t.adminIp}: ${ip}\n${t.adminUserAgent}: ${ua}` : t.adminDevice}
                    >
                      {p.is_bot ? (
                        <span className="br-mute">—</span>
                      ) : (
                        <span style={{ display: "inline-flex", flexDirection: "column" }}>
                          <span style={{ color: "#22d3ee" }}>{ip || "—"}</span>
                          <span style={{
                            color: "#5a6b8a",
                            overflow: "hidden", textOverflow: "ellipsis",
                            whiteSpace: "nowrap", maxWidth: 220,
                          }}>
                            {uaShort || "—"}
                          </span>
                        </span>
                      )}
                    </span>
                    <span className="br-td br-td--act flex flex-wrap items-center gap-1 md:gap-2">
                      <button className="br-btn br-btn--xs"
                        onClick={() => send({ type: "admin_force_respawn", player_id: p.id })}
                        disabled={p.state === "alive"}
                        title={t.respawn}>
                        <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden>
                          <path d="M8 3 V1 L4 4 L8 7 V5 A3 3 0 1 1 5 8" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                      </button>
                      <button className="br-btn br-btn--xs br-btn--danger"
                        onClick={() => send({ type: "admin_force_kill", player_id: p.id })}
                        disabled={p.state !== "alive"}
                        title={t.forceKill}
                        style={{ borderColor: "rgba(255,59,92,0.5)", color: "#ff7a8e" }}>
                        ✕
                      </button>
                      <PlayerHpInput
                        label={t.setHpIndividual}
                        onSet={(hp) => send({ type: "admin_set_player_hp", player_id: p.id, hp })}
                      />
                    </span>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="br-empty">{t.noPlayers}</div>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT — Director / Telemetry / Danger */}
        <section className="br-admin-col br-admin-col--right w-full md:w-auto">
          <div className="br-glass br-director-cta">
            <div className="br-director-art" aria-hidden>
              <svg viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
                <circle cx="40" cy="40" r="24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.6" />
                <circle cx="40" cy="40" r="6" fill="currentColor" />
                <path d="M40 4 V14 M40 66 V76 M4 40 H14 M66 40 H76" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <PanelHead title={t.directorView} small />
            <p className="br-director-desc">{t.directorDesc}</p>
            <button className="br-cta br-cta--violet"
              onClick={() => window.open("/?role=director", "_blank")}>
              <span className="br-cta-arrow">▸</span>
              <span>{t.spawnDirector}</span>
              <span className="br-cta-glint" aria-hidden />
            </button>
          </div>

          <div className="br-glass br-telem-card">
            <PanelHead title={t.liveTelemetry} small />
            <div className="br-telem-grid">
              <Telem big label="BULLETS" value={snap?.bullets?.length ?? 0} />
              <Telem big label="WORLD" value={`${snap?.world?.w ?? 2560}×${snap?.world?.h ?? 1440}`} />
              <Telem big label="TICK/S" value="20" accent="cyan" />
              <Telem big label="UPLINK" value="OK" accent="cyan" />
            </div>
            <div className="br-spark"><Sparkline /></div>
          </div>

          <div className="br-glass br-glass--danger br-danger-card">
            <PanelHead title={t.dangerZone} small danger />
            <button className="br-btn br-btn--danger"
              onClick={() => {
                if (window.confirm(`${t.resetMatch}?`)) send({ type: "admin_reset_match" });
              }}>{t.resetMatch}</button>
            <button className="br-btn br-btn--ghost"
              onClick={() => send({ type: "admin_kick_bots" })}>{t.kickBots}</button>
            <button className="br-btn br-btn--danger"
              style={{ marginTop: 4, borderColor: "rgba(255,59,92,0.6)" }}
              onClick={() => {
                if (window.confirm(`${t.endGameNow}?`)) send({ type: "admin_end_game_now" });
              }}>{t.endGameNow}</button>
          </div>

          {/* EN: Phase 12 — Stress Test panel removed. The "Server Stress
              Testing System" was deprecated alongside the backend code in
              engine.py / main.py.
              zh-TW: Phase 12 — 已完全移除壓力測試面板，後端 engine.py /
              main.py 中對應的程式碼也一併刪除。 */}
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Decoupled input components — Phase 10 lag fix
// ---------------------------------------------------------------------------
//
// EN: Each input owns its own `value` state. A serverValue prop pushes new
//     values in only when the user hasn't focused the input — so the 250 ms
//     parent tick never overwrites what the user is typing. Commits go to
//     the server on blur or Enter, never on keystroke.
// zh-TW: 每個輸入框都自管 value state。serverValue 只有在使用者沒 focus
//     時才會同步進來，避免父層 250 ms tick 把使用者打字的內容蓋掉。
//     失焦或按 Enter 時才送伺服器，不會每打一個字就送一次。

const NumSetting = memo(function NumSetting({
  label, serverValue, fallback = 0, min, max, step, integer = false, onCommit,
}) {
  const [val, setVal] = useState(() => String(serverValue ?? fallback));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) {
      setVal(String(serverValue ?? fallback));
    }
  }, [serverValue, fallback]);

  const commit = () => {
    const n = integer ? parseInt(val, 10) : parseFloat(val);
    if (!Number.isNaN(n)) onCommit?.(n);
  };

  return (
    <div className="br-field">
      <label className="br-field-label">{label}</label>
      <input
        className="br-input br-input--num"
        type="number"
        min={min}
        max={max}
        step={step}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onFocus={() => { focusedRef.current = true; }}
        onBlur={() => { focusedRef.current = false; commit(); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            e.currentTarget.blur();
          }
        }}
      />
    </div>
  );
});

function PasswordChangeRow({ label, placeholder, applyLabel, onApply }) {
  const [pw, setPw] = useState("");
  return (
    <div className="br-field br-field--stack">
      <label className="br-field-label">{label}</label>
      <div className="br-input-row">
        <input
          className="br-input"
          type="password"
          value={pw}
          placeholder={placeholder}
          onChange={(e) => setPw(e.target.value)}
        />
        <button className="br-btn br-btn--ghost"
          onClick={() => {
            const trimmed = pw.trim();
            if (!trimmed) return;
            onApply?.(trimmed);
            setPw("");
          }}>{applyLabel}</button>
      </div>
    </div>
  );
}

function TimerSetTextRow({ label, applyLabel, onApply }) {
  const [val, setVal] = useState("");
  return (
    <div className="br-field br-field--stack">
      <label className="br-field-label">{label}</label>
      <div className="br-input-row">
        <input
          className="br-input br-input--num"
          type="number" min={0} step={30}
          value={val} placeholder="s"
          onChange={(e) => setVal(e.target.value)}
        />
        <button className="br-btn br-btn--ghost"
          onClick={() => {
            const n = parseFloat(val);
            if (!Number.isNaN(n)) onApply?.(n);
          }}>{applyLabel}</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PanelHead({ title, small, inline, danger }) {
  return (
    <div className={`br-panel-head ${small ? "is-small" : ""} ${inline ? "is-inline" : ""} ${danger ? "is-danger" : ""}`}>
      <span className="br-panel-tick" />
      <span className="br-panel-title">{title}</span>
    </div>
  );
}

function Telem({ label, value, accent, big }) {
  return (
    <div className={`br-telem ${big ? "is-big" : ""} ${accent ? `is-${accent}` : ""}`}>
      <span className="br-telem-label">{label}</span>
      <span className="br-telem-value">{value}</span>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button type="button"
      className={`br-toggle ${checked ? "is-on" : ""}`}
      onClick={() => onChange?.(!checked)}
      role="switch" aria-checked={!!checked}>
      <span className="br-toggle-knob" />
      <span className="br-toggle-label br-toggle-label--off">OFF</span>
      <span className="br-toggle-label br-toggle-label--on">ON</span>
    </button>
  );
}

function StateBadge({ state }) {
  if (state === "alive") return <span className="br-state br-state--alive">● ALIVE</span>;
  if (state === "dead") return <span className="br-state br-state--dead">✗ DOWN</span>;
  return <span className="br-state br-state--spec">👁 SPEC</span>;
}

function PlayerHpInput({ label, onSet }) {
  const [val, setVal] = useState("");
  return (
    <span style={{ display: "inline-flex", gap: 3 }}>
      <input
        style={{
          width: 46, background: "rgba(3,7,13,0.7)", border: "1px solid rgba(110,145,200,0.2)",
          borderRadius: 4, color: "#d8e6ff", fontFamily: "var(--br-mono)", fontSize: 11,
          padding: "2px 4px",
        }}
        type="number" min={1} step={10} placeholder="HP"
        value={val}
        onChange={e => setVal(e.target.value)}
      />
      <button
        className="br-btn br-btn--xs"
        style={{ fontSize: 10, padding: "2px 6px" }}
        onClick={() => { const hp = parseFloat(val); if (!isNaN(hp) && hp > 0) { onSet(hp); setVal(""); } }}
      >
        {label}
      </button>
    </span>
  );
}

function Sparkline() {
  const pts = Array.from({ length: 32 }, (_, i) =>
    `${i * 8},${20 - Math.round(8 + 7 * Math.sin(i * 0.6) + 3 * Math.cos(i * 0.4))}`
  ).join(" ");
  return (
    <svg viewBox="0 0 256 24" className="br-spark-svg" aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
