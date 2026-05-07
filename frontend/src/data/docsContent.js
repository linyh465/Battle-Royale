/**
 * EN: docsContent.js — Phase 16 bilingual SPA documentation source-of-truth.
 *     Consumed by Docs.jsx (the native React docs SPA mounted at
 *     /docs/en and /docs/zh-TW). Each language tree is fully self-contained
 *     so every route renders strictly mono-lingual HTML.
 *
 *     Top-level shape per language:
 *       {
 *         meta:       { title, subtitle, build },
 *         categories: [
 *           {
 *             id:       stable slug used by sidebar nav (eg. "manual").
 *             label:    short label rendered in the side/tab nav.
 *             icon:     1-glyph cyberpunk marker (▣ ◆ ▲ ⌬ etc).
 *             tagline:  one-liner shown under the category header.
 *             sections: [
 *               { heading, body: string[] }      — bullet list section
 *               { heading, groups: [{ title, body: string[] }] } — grouped (Patch Notes)
 *             ],
 *           },
 *           ...
 *         ],
 *       }
 *
 *     Note: Game Manual / Admin Guide / Tech Architecture currently carry
 *     "solid placeholder" copy — enough to render and look real, but
 *     intended to be expanded by the maintainer. Patch Notes v1.5 is
 *     fully fleshed out per spec (Phase 15 summary translated into a
 *     player-and-dev-facing changelog).
 *
 * zh-TW: docsContent.js — Phase 16 雙語 SPA 文件單一資料來源。
 *     由 Docs.jsx（掛在 /docs/en、/docs/zh-TW 的原生 React 文件 SPA）讀取。
 *     兩種語系彼此完全獨立，確保每條路由的 HTML 嚴格單一語系。
 *
 *     單一語系頂層結構：
 *       {
 *         meta:       { title, subtitle, build },
 *         categories: [
 *           {
 *             id:       側邊導覽用的 slug（例如 "manual"）。
 *             label:    側邊 / 上方 tab 顯示的短標籤。
 *             icon:     一個賽博龐克風的記號字符（▣ ◆ ▲ ⌬ 等）。
 *             tagline:  類別標題下的一句副標。
 *             sections: [
 *               { heading, body: string[] }      — 條列式段落
 *               { heading, groups: [{ title, body: string[] }] } — 分組段落（更新日誌用）
 *             ],
 *           },
 *           ...
 *         ],
 *       }
 *
 *     備註：遊戲操作手冊 / 管理員指南 / 技術架構目前是「紮實的占位文案」
 *     — 足以渲染且看來真實，但是預期由維護者後續補完。更新日誌 v1.5 已
 *     依規格完整撰寫（將 Phase 15 摘要翻譯成玩家與開發者皆可閱讀的版本變更）。
 */

const docsContent = {
  en: {
    meta: {
      title: "BATTLE ROYALE · OPERATIONS MANUAL",
      subtitle: "Build 1.5 · Twin-stick combat · Sandbox brawl",
      build: "v1.5",
    },
    categories: [
      // ---------------------------------------------------------------
      // 1. Game Manual
      // ---------------------------------------------------------------
      {
        id: "manual",
        label: "Game Manual",
        icon: "▣",
        tagline: "Rules, controls, and HUD overview.",
        sections: [
          {
            heading: "01 / OVERVIEW",
            body: [
              "Battle Royale is a continuous deathmatch arena: a single 2560x1440 grid with no shrinking safe-zone. Match length is configured by the admin (default: untimed).",
              "When the timer expires the match transitions to POST-GAME · SANDBOX BRAWL — the leaderboard freezes, but combat continues so players can keep practising without affecting standings.",
            ],
          },
          {
            heading: "02 / TWIN-STICK CONTROLS — MOBILE",
            body: [
              "LEFT joystick — movement only. The barrel is NEVER auto-aimed by movement direction.",
              "RIGHT joystick (AIM) — drag to aim, tap to fire one round, hold-and-drag for continuous fire (server enforces each weapon's fire-rate cap).",
              "The right stick fully replaces the legacy red FIRE button from earlier builds.",
            ],
          },
          {
            heading: "03 / DESKTOP CONTROLS",
            body: [
              "Movement — W A S D",
              "Aim     — mouse cursor (the barrel tracks the cursor)",
              "Fire    — left mouse button (hold for continuous fire)",
              "Respawn — Space (when the cooldown reaches 0)",
              "Spectate — Tab",
            ],
          },
          {
            heading: "04 / HUD READOUT",
            body: [
              "Five always-on telemetry tiles: HP · Weapon · Kills · Match Timer · Players Alive.",
              "The full leaderboard panel is scrollable; the local player's row is highlighted.",
              "The post-game banner appears once the round ends, with a sandbox close button on the right.",
            ],
          },
          {
            heading: "05 / WEAPON ARSENAL",
            body: [
              "Pistol           — balanced sidearm.",
              "Assault Rifle    — auto-fire workhorse.",
              "Shotgun          — six-pellet cone, devastating up close.",
              "Sniper           — slow trigger, lethal one-shot (CCD-corrected in v1.5).",
              "SMG              — highest fire-rate, lowest per-shot damage.",
              "Rocket Launcher  — heavy slow projectile, 14x14 hitbox.",
            ],
          },
        ],
      },

      // ---------------------------------------------------------------
      // 2. Admin Guide
      // ---------------------------------------------------------------
      {
        id: "admin",
        label: "Admin Guide",
        icon: "◆",
        tagline: "Device tracking, match settings, sandbox controls.",
        sections: [
          {
            heading: "01 / ENTERING THE COMMAND CENTER",
            body: [
              "Tap the lobby logo five times within 1.5 seconds, then enter the admin password (default: "Secret").",
              "The admin connection is a non-combatant WebSocket — opening the panel never spawns a player into the world.",
            ],
          },
          {
            heading: "02 / DEVICE TRACKING (NEW)",
            body: [
              "The admin roster now exposes each connected player's IP and User-Agent for moderation purposes.",
              "Source IP is parsed from X-Forwarded-For when the server is behind a proxy, falling back to the socket peer address when not.",
              "Device data is delivered via the dedicated admin_snapshot frame — it is NEVER broadcast to other players.",
            ],
          },
          {
            heading: "03 / MATCH SETTINGS",
            body: [
              "HP cap, weapon allow-list, bot count, focus-fire cap, match timer.",
              "Allow-list changes propagate to lobby clients via /api/settings polling — no reconnect required.",
              "End Game Now triggers the POST_GAME state immediately, freezing the leaderboard.",
              "Reset Match wipes the world back to PLAYING and clears every kill / HP / penalty.",
            ],
          },
          {
            heading: "04 / POST-GAME SANDBOX",
            body: [
              "After the timer expires the world enters POST_GAME. Players can keep killing and respawning, but those kills no longer change the final standings.",
              "Admins can leave the sandbox running indefinitely or call Reset Match to start a fresh round.",
            ],
          },
        ],
      },

      // ---------------------------------------------------------------
      // 3. Tech Architecture
      // ---------------------------------------------------------------
      {
        id: "tech",
        label: "Tech Architecture",
        icon: "▲",
        tagline: "WebSocket protocol, SPA routing, state machine.",
        sections: [
          {
            heading: "01 / SERVER-AUTHORITATIVE LOOP",
            body: [
              "The Python engine ticks at a fixed step and broadcasts a compact state snapshot over a single /ws WebSocket.",
              "Clients are pure renderers: they ship intent (move vector, aim vector, fire flag) and trust the server's authoritative collision / damage results.",
            ],
          },
          {
            heading: "02 / SPA ROUTING",
            body: [
              "React Router owns the full URL space: / (lobby), /docs/:lang (this manual), and a catch-all 404.",
              "The backend's SPA fallback returns index.html for any unknown path so deep links survive cold loads.",
              "/docs is split into two strictly mono-lingual routes (/docs/en, /docs/zh-TW) — there is no client-side translation switcher mid-render.",
            ],
          },
          {
            heading: "03 / MATCH STATE MACHINE",
            body: [
              "PLAYING   — normal authoritative match, kills count, leaderboard live.",
              "POST_GAME — timer hit zero (or admin ended early). Leaderboard frozen, sandbox combat allowed.",
              "Reset Match transitions POST_GAME (or PLAYING) back to a fresh PLAYING state.",
            ],
          },
        ],
      },

      // ---------------------------------------------------------------
      // 4. Patch Notes — fully fleshed out from the Phase 15 summary
      // ---------------------------------------------------------------
      {
        id: "patch",
        label: "Patch Notes",
        icon: "⌬",
        tagline: "What's new in v1.5 — the twin-stick & sandbox update.",
        sections: [
          {
            heading: "v1.5 — TWIN-STICK & SANDBOX",
            groups: [
              {
                title: "Gameplay & Controls",
                body: [
                  "True twin-stick on mobile — the LEFT joystick now controls movement only. Movement direction never auto-aims your weapon. Players who liked the old auto-aim feel can simply mirror the right stick to the left stick's heading.",
                  "The RIGHT joystick replaces the legacy red FIRE button: drag to aim, tap to fire one round, hold-and-drag for continuous fire. Each weapon's fire-rate cap is still enforced server-side.",
                  "Post-game seamlessly transitions into a SANDBOX BRAWL: the leaderboard is frozen at the moment the timer hits zero, but you can keep killing and respawning to practise. Sandbox kills do not change the final standings — close the sandbox panel any time to return to the lobby.",
                  "The HUD now surfaces five fully-translated telemetry items at all times (HP, weapon, kills, match timer, players alive). The full leaderboard is scrollable and highlights your own row in cyan.",
                ],
              },
              {
                title: "Backend & Physics",
                body: [
                  "Sniper Fix — bullets now use Continuous Collision Detection (Liang–Barsky segment-vs-AABB intersection) so 1500 px/s rounds can no longer tunnel past 28 px players between ticks. Symptom in earlier builds was \"sniper hits register 0 damage\"; resolved.",
                  "Bullet model rewrite — each bullet now stores prev_cx / prev_cy and treats (x, y) as the AABB top-left, giving the CCD pass a clean swept segment to test. Damage values are floats (no more silent int truncation when balance numbers go below 1).",
                  "Match state machine extended — POST_GAME now freezes the leaderboard server-side, while admin_reset_match wipes the world back to PLAYING with all stats / HP / penalties cleared.",
                  "Documentation hosting changed — the in-process MkDocs StaticFiles mount has been removed. Docs are now served by the React SPA itself (this page) so we no longer ship a duplicated docs build through the API server.",
                ],
              },
              {
                title: "Admin & Tracking",
                body: [
                  "Admin device tracking — the engine now keeps a per-connection map of IP and User-Agent in engine.devices. The public state snapshot deliberately hides this data; only the dedicated admin_snapshot frame carries it through.",
                  "Source IP is now parsed from X-Forwarded-For when the server runs behind a proxy, falling back to the socket peer address otherwise. The User-Agent comes from the WebSocket handshake headers.",
                  "AdminPanel adds a new \"Device\" column that surfaces IP + UA next to each connected player, giving moderators immediate context when triaging suspicious behaviour.",
                  "/api/settings polling on the lobby keeps the weapon picker in sync with admin allow-list changes within ~3 s — no reconnect required.",
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  // ===================================================================
  // 繁體中文
  // ===================================================================
  "zh-TW": {
    meta: {
      title: "競技場 · 餘燼協定 操作手冊",
      subtitle: "v1.5 版本 · 雙搖桿戰鬥 · 賽後沙盒",
      build: "v1.5",
    },
    categories: [
      // ---------------------------------------------------------------
      // 1. 遊戲操作手冊
      // ---------------------------------------------------------------
      {
        id: "manual",
        label: "遊戲操作手冊",
        icon: "▣",
        tagline: "規則、操作方式與 HUD 介面說明。",
        sections: [
          {
            heading: "01 / 遊戲概述",
            body: [
              "本作是一款持續對戰的競技場遊戲：世界為單一 2560×1440 網格，沒有縮圈機制。比賽時長由管理員設定（預設無限時）。",
              "當倒數歸零，遊戲會切換為「賽後 · 沙盒對戰」狀態 — 排行榜立即凍結，但戰鬥仍持續，玩家可繼續練習而不會影響最終排名。",
            ],
          },
          {
            heading: "02 / 雙搖桿操作（手機）",
            body: [
              "左搖桿 — 「僅控制移動」。槍口不會再自動跟隨移動方向。",
              "右搖桿（AIM）— 拖曳即瞄準，短點為單發射擊，按住並拖曳為連續射擊（射速冷卻仍由伺服器依各武器 fire_rate 強制）。",
              "右搖桿已完全取代舊版紅色 FIRE 按鈕。",
            ],
          },
          {
            heading: "03 / 桌面操作",
            body: [
              "移動    — W A S D",
              "瞄準    — 滑鼠游標（槍口跟隨游標方向）",
              "射擊    — 滑鼠左鍵（按住 = 連射）",
              "復活    — 空白鍵（冷卻為 0 時可用）",
              "觀戰    — Tab",
            ],
          },
          {
            heading: "04 / HUD 介面說明",
            body: [
              "五項常駐遙測：HP、武器、擊殺數、對戰倒數、存活玩家數。",
              "完整排行榜面板可上下捲動；本機玩家所在的列會以青色高亮。",
              "回合結束後出現賽後橫幅，右側附沙盒對戰關閉鍵。",
            ],
          },
          {
            heading: "05 / 武器庫",
            body: [
              "手槍       — 平衡型副武器。",
              "突擊步槍   — 全自動主力武器。",
              "霰彈槍     — 六發扇形彈道，近戰毀滅性。",
              "狙擊槍     — 低射速、單發致命（v1.5 已套用 CCD 修正）。",
              "衝鋒槍     — 武器庫中最高射速、單發傷害最低。",
              "火箭筒     — 重型慢速彈，14×14 hitbox。",
            ],
          },
        ],
      },

      // ---------------------------------------------------------------
      // 2. 管理員指南
      // ---------------------------------------------------------------
      {
        id: "admin",
        label: "管理員指南",
        icon: "◆",
        tagline: "裝置追蹤、對戰參數、沙盒控制。",
        sections: [
          {
            heading: "01 / 進入管理員指揮中心",
            body: [
              "於 1.5 秒內連點大廳 LOGO 五下，輸入管理員密碼（預設：祕密不能告訴你TT）即可進入。",
              "管理員連線為非戰鬥員 WebSocket — 開啟管理員面板「不會」於戰場生成玩家。",
            ],
          },
          {
            heading: "02 / 裝置追蹤（新）",
            body: [
              "管理員專屬玩家列表新增「IP 與 User-Agent」欄位，方便巡守。",
              "伺服器在反向代理之後時，IP 由 X-Forwarded-For 解析；無代理時退回 socket peer address。",
              "裝置資料僅由獨立的 admin_snapshot 訊框傳送 — 「絕不會」廣播給其他玩家。",
            ],
          },
          {
            heading: "03 / 對戰參數",
            body: [
              "可調整：HP 上限、武器允許清單、Bot 數量、集火上限、對戰倒數。",
              "允許清單變更會透過 /api/settings 輪詢同步至大廳玩家，無需重新連線。",
              "「立即結束」會立刻把世界切到 POST_GAME 並凍結排行榜。",
              "「重置對戰」會把世界切回 PLAYING，並清空所有計數 / 血量 / 懲罰。",
            ],
          },
          {
            heading: "04 / 賽後沙盒",
            body: [
              "倒數歸零後世界進入 POST_GAME 狀態：玩家可繼續擊殺與重生，但這些擊殺「不會」再影響最終排行榜。",
              "管理員可讓沙盒持續運作，或按下「重置對戰」開啟新一輪。",
            ],
          },
        ],
      },

      // ---------------------------------------------------------------
      // 3. 技術架構
      // ---------------------------------------------------------------
      {
        id: "tech",
        label: "技術架構",
        icon: "▲",
        tagline: "WebSocket 協定、SPA 路由、狀態機。",
        sections: [
          {
            heading: "01 / 伺服器權威迴圈",
            body: [
              "Python 引擎以固定 tick 推進，並透過單一 /ws WebSocket 廣播緊湊的狀態快照。",
              "前端純粹是渲染端：上傳意圖（移動向量、瞄準向量、射擊旗標），完全信任伺服器的權威碰撞 / 傷害結算。",
            ],
          },
          {
            heading: "02 / SPA 路由",
            body: [
              "React Router 統一掌管整個 URL 空間：/（大廳）、/docs/:lang（本手冊），以及 catch-all 404。",
              "後端的 SPA fallback 會把任何未知路徑回傳 index.html，讓 deep link 在冷啟動後仍能正確命中對應路由。",
              "/docs 拆成兩條嚴格單一語系路由（/docs/en、/docs/zh-TW）— 渲染期間沒有任何前端 i18n key 切換。",
            ],
          },
          {
            heading: "03 / 對戰狀態機",
            body: [
              "PLAYING   — 一般權威對戰，擊殺計分、排行榜即時更新。",
              "POST_GAME — 時間到（或管理員提前結束）：排行榜凍結，沙盒戰鬥持續進行。",
              "「重置對戰」會把 POST_GAME（或 PLAYING）切回全新的 PLAYING 狀態。",
            ],
          },
        ],
      },

      // ---------------------------------------------------------------
      // 4. 更新日誌（依 Phase 15 摘要完整改寫）
      // ---------------------------------------------------------------
      {
        id: "patch",
        label: "更新日誌",
        icon: "⌬",
        tagline: "v1.5 雙搖桿與沙盒更新。",
        sections: [
          {
            heading: "v1.5 — 雙搖桿與沙盒",
            groups: [
              {
                title: "玩法與操作",
                body: [
                  "手機端真正的雙搖桿 — 左搖桿改為「僅控制移動」，移動方向不會再自動帶動瞄準。喜歡舊版「移動即瞄準」手感的玩家，只要用右搖桿同步左搖桿方向即可。",
                  "右搖桿正式取代舊版紅色 FIRE 按鈕：拖曳即瞄準、短點為單發、按住並拖曳為連續射擊。各武器射速冷卻仍由伺服器強制。",
                  "賽後無縫進入「沙盒對戰」：倒數歸零的當下排行榜立刻凍結，但你仍可繼續擊殺與重生練習。沙盒擊殺「不會」改變最終排行榜 — 隨時可關閉沙盒回到大廳。",
                  "HUD 改為常駐顯示五項已完整翻譯的遙測（HP、武器、擊殺數、對戰倒數、存活玩家數）。完整排行榜可捲動，且本機玩家所在列會以青色高亮。",
                ],
              },
              {
                title: "後端與物理",
                body: [
                  "狙擊修正 — 子彈改用「連續碰撞偵測（CCD，Liang–Barsky 線段 vs AABB 求交）」，1500 px/s 的高速彈不會再於兩個 tick 之間穿透 28 px 寬的玩家。先前版本「狙擊命中卻 0 傷害」的症狀已解決。",
                  "子彈模型重寫 — 每顆子彈會記錄 prev_cx / prev_cy，並把 (x, y) 視為 AABB 左上角，讓 CCD 有乾淨的掃掠線段可測試。傷害值改為浮點數（避免平衡數值低於 1 時被 int 靜默截斷為 0）。",
                  "對戰狀態機擴充 — POST_GAME 會在伺服器端凍結排行榜；admin_reset_match 則會把世界切回 PLAYING 並清空所有計數 / 血量 / 懲罰。",
                  "文件託管方式變更 — 移除 in-process MkDocs StaticFiles 掛載，文件改由 React SPA 本身（也就是這個頁面）提供，API 伺服器不再夾帶一份重複的 docs build。",
                ],
              },
              {
                title: "管理員與追蹤",
                body: [
                  "管理員裝置追蹤 — 引擎會在 engine.devices 為每條連線維護一份 IP 與 User-Agent。公開狀態快照刻意隱藏此資訊；只有獨立的 admin_snapshot 訊框會帶出。",
                  "伺服器位於反向代理之後時，IP 改由 X-Forwarded-For 解析；無代理時退回 socket peer address。User-Agent 取自 WebSocket handshake header。",
                  "AdminPanel 新增「Device」欄位，於每位連線玩家旁直接顯示 IP + UA，讓管理員處理可疑行為時能立即取得脈絡。",
                  "大廳的 /api/settings 輪詢可在 ~3 秒內把武器允許清單變更同步到玩家端，無需重新連線。",
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

export default docsContent;
