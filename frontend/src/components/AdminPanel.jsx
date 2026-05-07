/**
 * EN: AdminPanel — Phase 10 refactor.
 *     Production users hit hard input lag because the panel was driven by a
 *     250 ms tick that re-read state from a high-frequency (20 Hz) WebSocket.
 *     Every keystroke fought a re-render that snapped the input back to the
 *     server's last-broadcast value.
 *
 *     Fix:
 *       1. All numeric / text inputs are wrapped in memoised
 *          `<NumSetting>` / `<TextSetting>` components that hold their own
 *          local state and only sync from the server when the user is *not*
 *          currently focused.
 *       2. Server commits happen on blur or Enter, never on every keystroke.
 *       3. The roster (which legitimately needs the high-frequency tick) is
 *          isolated; the settings column re-renders with the same parent tick
 *          but its inputs no longer re-bind their DOM `value`.
 *
 *     Phase 10 also adds a six-entry Weapon Checklist that toggles
 *     `allowed_weapons` on the server. The backend reassigns any alive
 *     player whose current weapon was just disabled.
 *
 * zh-TW: AdminPanel — Phase 10 改寫。
 *     生產環境的輸入卡頓來自於：250 ms tick 會把 20 Hz WebSocket 廣播的
 *     state 重新讀進來。每打一個字，就會被 re-render 拉回去伺服器最後一次
 *     廣播的值，導致打字嚴重 lag。
 *
 *     修法：
 *       1. 所有數字 / 文字輸入都包進 memoised 的 `<NumSetting>` /
 *          `<TextSetting>` 內，元件自己維護 local state，
 *          使用者沒 focus 時才從伺服器同步。
 *       2. 失焦或按 Enter 時才 commit 到伺服器，不會每打一個字就送一次。
 *       3. 玩家名單需要高頻 tick 才正確，故獨立處理；設定欄即便仍隨父層
 *          re-render，輸入框的 DOM `value` 也不會被重新 bind。
 *
 *     Phase 10 還新增了「武器啟用清單」，切換時即時送 admin_set
 *     `allowed_weapons` 到伺服器，後端會強制重派所有持已禁武器的存活玩家。
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

  useEffect(() => {
    // EN: Roster + telemetry refresh. Inputs are insulated from this tick.
    // zh-TW: 玩家名單與遙測刷新；輸入框已與此 tick 解耦。
    const id = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);

  const snap = stateRef.current;
  const settings = snap?.settings ?? {};
  const players = snap?.players ?? [];
  const sortKey = settings.leaderboard_sort_by || "kills";
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

  const setKey = (key, value) => send({ type: "admin_set", key, value });

  // ── Leaderboard column toggles ─────────────────────────────────────────
  const allCols = ["kills", "deaths", "damage_dealt", "damage_taken"];
  const colLabels = { kills: t.kills, deaths: t.deaths, damage_dealt: t.damageDealt, damage_taken: t.damageTaken };
  const activeCols = (settings.leaderboard_columns || "kills,deaths,damage_dealt,damage_taken")
    .split(",").map(s => s.trim()).filter(Boolean);
  const toggleCol = (col) => {
    let next;
    if (activeCols.includes(col)) {
      next = activeCols.filter(c => c !== col);
      if (next.length === 0) return;
    } else {
      next = [...activeCols, col];
    }
    setKey("leaderboard_columns", next.join(","));
  };

  // ── Weapon allow-list toggles (Phase 10) ───────────────────────────────
  const activeWeapons = (settings.allowed_weapons || ALL_WEAPONS.join(","))
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
    setKey("allowed_weapons", [...set].join(","));
  };

  return (
    <div className="br-admin">
      <div className="br-bg-grid" aria-hidden />
      <div className="br-bg-glow br-bg-glow--crimson" aria-hidden />
      <div className="br-scanlines" aria-hidden />

      <header className="br-admin-topbar">
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

      <div className="br-admin-body">
        {/* LEFT — Game Settings */}
        <section className="br-glass br-admin-col">
          <PanelHead title={t.gameSettings} />

          <div className="br-field">
            <label className="br-field-label">{t.teamMode}</label>
            <Toggle checked={!!settings.team_mode} onChange={(v) => setKey("team_mode", v)} />
          </div>

          <div className="br-field">
            <label className="br-field-label">{t.sortLeaderboard}</label>
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
            <Toggle checked={!!settings.bots_enabled} onChange={(v) => setKey("bots_enabled", v)} />
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
        <section className="br-glass br-admin-col br-admin-col--wide">
          <div className="br-roster-head">
            <PanelHead title={t.playerRoster} inline />
            <div className="br-filter-tabs">
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

          <div className="br-table">
            <div className="br-table-head">
              <span className="br-th br-th--idx">#</span>
              <span className="br-th br-th--name">CALLSIGN</span>
              <span className="br-th br-th--team">TEAM</span>
              <span className="br-th br-th--num">K</span>
              <span className="br-th br-th--num">D</span>
              <span className="br-th br-th--num">DMG</span>
              <span className="br-th br-th--state">STATE</span>
              <span className="br-th br-th--act" style={{ minWidth: 140 }}>ACTION</span>
            </div>

            <div className="br-table-body">
              {filtered.map((p, i) => (
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
                  <span className="br-td br-td--act" style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
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
              ))}
              {filtered.length === 0 && (
                <div className="br-empty">{t.noPlayers}</div>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT — Director / Telemetry / Danger */}
        <section className="br-admin-col br-admin-col--right">
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
