import { useEffect, useState } from "react";
import { useI18n } from "../i18n.jsx";

export default function AdminPanel({ stateRef, send, onClose }) {
  const { t, lang, setLang } = useI18n();
  const [, setTick] = useState(0);
  const [newPassword, setNewPassword] = useState("");
  const [filter, setFilter] = useState("all");
  const [timerInput, setTimerInput] = useState("");
  const [hpInput, setHpInput] = useState({ all: "", players: "", bots: "" });

  useEffect(() => {
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

  // Leaderboard columns toggle
  const allCols = ["kills", "deaths", "damage_dealt", "damage_taken"];
  const colLabels = { kills: t.kills, deaths: t.deaths, damage_dealt: t.damageDealt, damage_taken: t.damageTaken };
  const activeCols = (settings.leaderboard_columns || "kills,deaths,damage_dealt,damage_taken")
    .split(",").map(s => s.trim()).filter(Boolean);
  const toggleCol = (col) => {
    let next;
    if (activeCols.includes(col)) {
      next = activeCols.filter(c => c !== col);
      if (next.length === 0) return; // keep at least one
    } else {
      next = [...activeCols, col];
    }
    setKey("leaderboard_columns", next.join(","));
  };

  const handleSetTimer = () => {
    const s = parseFloat(timerInput);
    if (!isNaN(s)) send({ type: "admin_set_game_timer", seconds: s });
  };

  return (
    <div className="br-admin">
      <div className="br-bg-grid" aria-hidden />
      <div className="br-bg-glow br-bg-glow--crimson" aria-hidden />
      <div className="br-scanlines" aria-hidden />

      {/* Top bar */}
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
          {/* Language toggle */}
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

      {/* 3-column body */}
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

          <div className="br-field">
            <label className="br-field-label">{t.baseRespawn}</label>
            <input className="br-input br-input--num" type="number" min={0} step={0.5}
              value={settings.base_respawn_time ?? 5}
              onChange={(e) => setKey("base_respawn_time", parseFloat(e.target.value))} />
          </div>

          <div className="br-field">
            <label className="br-field-label">{t.botRespawn}</label>
            <input className="br-input br-input--num" type="number" min={0} step={0.5}
              value={settings.bot_respawn_time ?? 15}
              onChange={(e) => setKey("bot_respawn_time", parseFloat(e.target.value))} />
          </div>

          <div className="br-field">
            <label className="br-field-label">{t.deathPenalty}</label>
            <input className="br-input br-input--num" type="number" min={0} step={0.5}
              value={settings.respawn_penalty ?? 3}
              onChange={(e) => setKey("respawn_penalty", parseFloat(e.target.value))} />
          </div>

          <div className="br-divider" />

          {/* Bot Management */}
          <PanelHead title={t.botManagement} small />
          <div className="br-field">
            <label className="br-field-label">{t.botsEnabled}</label>
            <Toggle
              checked={!!settings.bots_enabled}
              onChange={(v) => setKey("bots_enabled", v)}
            />
          </div>
          <div className="br-field">
            <label className="br-field-label">{t.botCount}</label>
            <input className="br-input br-input--num" type="number" min={0} max={20} step={1}
              value={settings.bot_count ?? 0}
              onChange={(e) => setKey("bot_count", parseInt(e.target.value) || 0)} />
          </div>
          <div className="br-field">
            <label className="br-field-label">{t.botAtkSpeedMin}</label>
            <input className="br-input br-input--num" type="number" min={0.1} step={0.1}
              value={settings.bot_atk_speed_min ?? 0.2}
              onChange={(e) => setKey("bot_atk_speed_min", parseFloat(e.target.value))} />
          </div>
          <div className="br-field">
            <label className="br-field-label">{t.botAtkSpeedMax}</label>
            <input className="br-input br-input--num" type="number" min={0.1} step={0.1}
              value={settings.bot_atk_speed_max ?? 1.0}
              onChange={(e) => setKey("bot_atk_speed_max", parseFloat(e.target.value))} />
          </div>

          <div className="br-divider" />

          {/* HP Settings */}
          <PanelHead title={t.hpManagement} small />
          <div className="br-field">
            <label className="br-field-label">{t.defaultPlayerHp}</label>
            <input className="br-input br-input--num" type="number" min={1} step={10}
              value={settings.default_player_hp ?? 200}
              onChange={(e) => setKey("default_player_hp", parseFloat(e.target.value))} />
          </div>
          <div className="br-field">
            <label className="br-field-label">{t.defaultBotHp}</label>
            <input className="br-input br-input--num" type="number" min={1} step={10}
              value={settings.default_bot_hp ?? 50}
              onChange={(e) => setKey("default_bot_hp", parseFloat(e.target.value))} />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            <div className="br-input-row" style={{ gap: 4 }}>
              <input className="br-input br-input--num" type="number" min={1} step={10}
                placeholder="HP"
                value={hpInput.all}
                onChange={e => setHpInput(p => ({ ...p, all: e.target.value }))} />
              <button className="br-btn br-btn--ghost br-btn--xs"
                onClick={() => {
                  const hp = parseFloat(hpInput.all);
                  if (!isNaN(hp)) send({ type: "admin_set_all_hp", hp, target: "all" });
                }}>
                {t.setHpAll}
              </button>
              <button className="br-btn br-btn--ghost br-btn--xs"
                onClick={() => {
                  const hp = parseFloat(hpInput.all);
                  if (!isNaN(hp)) send({ type: "admin_set_all_hp", hp, target: "players" });
                }}>
                {t.setHpPlayers}
              </button>
              <button className="br-btn br-btn--ghost br-btn--xs"
                onClick={() => {
                  const hp = parseFloat(hpInput.all);
                  if (!isNaN(hp)) send({ type: "admin_set_all_hp", hp, target: "bots" });
                }}>
                {t.setHpBots}
              </button>
            </div>
          </div>

          <div className="br-divider" />

          {/* Game Timer */}
          <PanelHead title={t.gameTimer} small />
          <div style={{ fontSize: 13, color: "#91a3c4", marginBottom: 8, fontFamily: "var(--br-mono)" }}>
            {timeRemaining > 0
              ? `${t.timeRemaining}: ${Math.floor(timeRemaining / 60)}:${String(Math.floor(timeRemaining % 60)).padStart(2, "0")}`
              : t.noTimer}
          </div>
          <div className="br-field br-field--stack">
            <label className="br-field-label">{t.setTimer}</label>
            <div className="br-input-row">
              <input className="br-input br-input--num" type="number" min={0} step={30}
                value={timerInput} placeholder="s"
                onChange={(e) => setTimerInput(e.target.value)} />
              <button className="br-btn br-btn--ghost" onClick={handleSetTimer}>{t.apply}</button>
            </div>
          </div>
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

          {/* Leaderboard columns */}
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
          <div className="br-field br-field--stack">
            <label className="br-field-label">{t.changeAdminPw}</label>
            <div className="br-input-row">
              <input className="br-input" type="password" value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t.newPwPlaceholder} />
              <button className="br-btn br-btn--ghost" onClick={() => {
                if (!newPassword.trim()) return;
                send({ type: "admin_password", value: newPassword.trim() });
                setNewPassword("");
              }}>{t.apply}</button>
            </div>
          </div>
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
                      pid={p.id}
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
              <Telem big label="TICK/S" value="30" accent="cyan" />
              <Telem big label="UPLINK" value="OK" accent="cyan" />
            </div>
            <div className="br-spark"><Sparkline /></div>
          </div>

          <div className="br-glass br-glass--danger br-danger-card">
            <PanelHead title={t.dangerZone} small danger />
            <button className="br-btn br-btn--danger"
              onClick={() => {
                if (window.confirm(`${t.resetMatch}?`)) send({ type: "admin_reset_match" });
              }}>
              {t.resetMatch}
            </button>
            <button className="br-btn br-btn--ghost"
              onClick={() => send({ type: "admin_kick_bots" })}>
              {t.kickBots}
            </button>
            <button className="br-btn br-btn--danger"
              style={{ marginTop: 4, borderColor: "rgba(255,59,92,0.6)" }}
              onClick={() => {
                if (window.confirm(`${t.endGameNow}?`)) send({ type: "admin_end_game_now" });
              }}>
              {t.endGameNow}
            </button>
          </div>
        </section>
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
