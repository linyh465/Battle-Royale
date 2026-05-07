import { createContext, useContext, useState, useMemo, useCallback } from "react";

const TRANSLATIONS = {
  en: {
    // Lobby
    tagline: "ARENA · DEATHMATCH PROTOCOL",
    joinTerminal: "JOIN TERMINAL",
    scanHint: "Scan to deploy from your phone",
    callsign: "CALLSIGN",
    callsignPh: "enter your handle",
    loadout: "LOADOUT",
    pistol: "Pistol",
    rifle: "Rifle",
    shotgun: "Shotgun",
    enter: "ENTER ARENA",
    detect: "detecting LAN node…",
    desktop: "WASD · Mouse aim · Click to fire",
    mobile: "Left stick · Right trigger",
    admin: "ADMIN",
    adminPwPrompt: "Admin password:",
    adminAuthFail: "Admin auth failed",
    // Death screen
    eliminated: "YOU WERE ELIMINATED",
    kia: "K.I.A.",
    eliminatedBy: "ELIMINATED BY",
    respawn: "RESPAWN",
    cooldown: "COOLDOWN",
    spectate: "SPECTATE",
    spaceRespawn: "SPACE RESPAWN",
    tabSpectate: "TAB SPECTATE",
    // Spectate bar
    spectating: "SPECTATING",
    previous: "‹ PREV",
    next: "NEXT ›",
    rejoin: "REJOIN",
    // Admin
    commandCenter: "COMMAND CENTER",
    adminSubtitle: "ADMIN · NOT IN PLAY",
    gameSettings: "GAME SETTINGS",
    teamMode: "Team Mode",
    sortLeaderboard: "Sort Leaderboard",
    baseRespawn: "Base Respawn (s)",
    botRespawn: "Bot Respawn (s)",
    deathPenalty: "Death Penalty (s)",
    access: "ACCESS",
    changeAdminPw: "Change Admin Password",
    newPwPlaceholder: "new password",
    apply: "APPLY",
    playerRoster: "PLAYER ROSTER",
    noPlayers: "No players match this filter",
    directorView: "DIRECTOR VIEW",
    directorDesc: "Open the read-only god-mode canvas in a new window.",
    spawnDirector: "SPAWN DIRECTOR",
    liveTelemetry: "LIVE TELEMETRY",
    dangerZone: "DANGER ZONE",
    resetMatch: "RESET MATCH",
    kickBots: "KICK ALL BOTS",
    forceKill: "Force Kill",
    // Game timer
    gameTimer: "Game Timer",
    setTimer: "Set Timer (s)",
    noTimer: "No timer active",
    timeRemaining: "TIME LEFT",
    extendTimer: "+30s",
    shortenTimer: "-30s",
    endGameNow: "END GAME NOW",
    // Leaderboard columns
    selectColumns: "Final Leaderboard Columns",
    // Game over
    gameOver: "GAME OVER",
    finalLeaderboard: "FINAL STANDINGS",
    close: "CLOSE",
    // Footer
    nodeOnline: "NODE ONLINE",
    // Stats
    kills: "Kills",
    deaths: "Deaths",
    damageDealt: "Damage Dealt",
    damageTaken: "Damage Taken",
    // Threat
    threatWarning: "ENEMY AIMING AT YOU",
    // Portrait lock
    rotateLandscape: "Please rotate your device to landscape",
    // Bot management
    botManagement: "Bot Management",
    botsEnabled: "Enable Bots",
    botCount: "Bot Count",
    botAtkSpeedMin: "Bot Attack Speed Min (s)",
    botAtkSpeedMax: "Bot Attack Speed Max (s)",
    // HP management
    hpManagement: "HP Settings",
    defaultPlayerHp: "Player Base HP",
    defaultBotHp: "Bot Base HP",
    setHpAll: "Set All",
    setHpPlayers: "Players Only",
    setHpBots: "Bots Only",
    setHpIndividual: "Set HP",
    // Match reset notice
    matchResetNotice: "MATCH RESET",
    // Leaderboard sort
    sortBy: "Sort by",
  },
  zh: {
    // Lobby
    tagline: "競技場 · 餘燼協定",
    joinTerminal: "加入終端",
    scanHint: "掃描以從手機部署",
    callsign: "代號",
    callsignPh: "請輸入暱稱",
    loadout: "武裝",
    pistol: "手槍",
    rifle: "步槍",
    shotgun: "霰彈槍",
    enter: "進入競技場",
    detect: "偵測 LAN 節點中…",
    desktop: "WASD 移動 · 滑鼠瞄準 · 點擊射擊",
    mobile: "左搖桿移動 · 右扳機射擊",
    admin: "管理員",
    adminPwPrompt: "管理員密碼：",
    adminAuthFail: "管理員密碼錯誤",
    // Death screen
    eliminated: "你已被淘汰",
    kia: "陣亡",
    eliminatedBy: "擊殺者",
    respawn: "復活",
    cooldown: "冷卻中",
    spectate: "觀戰",
    spaceRespawn: "SPACE 復活",
    tabSpectate: "TAB 觀戰",
    // Spectate bar
    spectating: "觀戰中",
    previous: "‹ 上一位",
    next: "下一位 ›",
    rejoin: "回歸戰場",
    // Admin
    commandCenter: "指揮中心",
    adminSubtitle: "管理員 · 非遊戲中",
    gameSettings: "遊戲設定",
    teamMode: "隊伍模式",
    sortLeaderboard: "計分板排序",
    baseRespawn: "基礎重生時間 (秒)",
    botRespawn: "機器人復活時間 (秒)",
    deathPenalty: "死亡懲罰時間 (秒)",
    access: "授權",
    changeAdminPw: "變更管理員密碼",
    newPwPlaceholder: "新密碼",
    apply: "套用",
    playerRoster: "玩家名單",
    noPlayers: "沒有符合條件的玩家",
    directorView: "導播視角",
    directorDesc: "於新視窗開啟唯讀的上帝視角，不建立玩家。",
    spawnDirector: "開啟導播",
    liveTelemetry: "即時遙測",
    dangerZone: "危險操作",
    resetMatch: "重置對戰",
    kickBots: "踢出所有 BOT",
    forceKill: "強制擊殺",
    // Game timer
    gameTimer: "遊戲計時器",
    setTimer: "設定倒數 (秒)",
    noTimer: "未設定計時器",
    timeRemaining: "剩餘時間",
    extendTimer: "+30秒",
    shortenTimer: "-30秒",
    endGameNow: "立即結束遊戲",
    // Leaderboard columns
    selectColumns: "最終排行榜欄位",
    // Game over
    gameOver: "遊戲結束",
    finalLeaderboard: "最終排行榜",
    close: "關閉",
    // Footer
    nodeOnline: "節點上線",
    // Stats
    kills: "擊殺數",
    deaths: "死亡數",
    damageDealt: "造成傷害",
    damageTaken: "承受傷害",
    // Threat
    threatWarning: "有人在瞄你",
    // Portrait lock
    rotateLandscape: "請旋轉手機為橫向模式",
    // Bot management
    botManagement: "機器人管理",
    botsEnabled: "啟用機器人",
    botCount: "機器人數量",
    botAtkSpeedMin: "機器人最快攻速 (秒)",
    botAtkSpeedMax: "機器人最慢攻速 (秒)",
    // HP management
    hpManagement: "血量設定",
    defaultPlayerHp: "玩家基礎血量",
    defaultBotHp: "機器人基礎血量",
    setHpAll: "全部套用",
    setHpPlayers: "僅玩家",
    setHpBots: "僅機器人",
    setHpIndividual: "設定血量",
    // Match reset notice
    matchResetNotice: "對戰已重置",
    // Leaderboard sort
    sortBy: "排序依據",
  },
  vi: {
    // Lobby
    tagline: "ĐẤU TRƯỜNG · GIAO THỨC TỬ CHIẾN",
    joinTerminal: "THAM GIA",
    scanHint: "Quét mã để chơi trên điện thoại",
    callsign: "TÊN GỌI",
    callsignPh: "nhập biệt danh",
    loadout: "VŨ KHÍ",
    pistol: "Súng Lục",
    rifle: "Súng Trường",
    shotgun: "Súng Hoa Cải",
    enter: "VÀO ĐẤU TRƯỜNG",
    detect: "đang dò LAN…",
    desktop: "WASD di chuyển · Chuột ngắm · Click bắn",
    mobile: "Joystick trái · Nút phải bắn",
    admin: "ADMIN",
    adminPwPrompt: "Mật khẩu admin:",
    adminAuthFail: "Sai mật khẩu admin",
    // Death screen
    eliminated: "BẠN ĐÃ BỊ LOẠI",
    kia: "TỬ TRẬN",
    eliminatedBy: "BỊ TIÊU DIỆT BỞI",
    respawn: "HỒI SINH",
    cooldown: "CHỜ ĐỢI",
    spectate: "XEM",
    spaceRespawn: "SPACE hồi sinh",
    tabSpectate: "TAB xem trận",
    // Spectate bar
    spectating: "ĐANG XEM",
    previous: "‹ TRƯỚC",
    next: "TIẾP ›",
    rejoin: "QUAY LẠI",
    // Admin
    commandCenter: "TRUNG TÂM CHỈ HUY",
    adminSubtitle: "ADMIN · KHÔNG CHƠI",
    gameSettings: "CÀI ĐẶT GAME",
    teamMode: "Chế độ đội",
    sortLeaderboard: "Sắp xếp BXH",
    baseRespawn: "Thời gian hồi sinh (s)",
    botRespawn: "Thời gian hồi sinh Bot (s)",
    deathPenalty: "Thời gian phạt (s)",
    access: "TRUY CẬP",
    changeAdminPw: "Đổi mật khẩu admin",
    newPwPlaceholder: "mật khẩu mới",
    apply: "ÁP DỤNG",
    playerRoster: "DANH SÁCH NGƯỜI CHƠI",
    noPlayers: "Không có người chơi phù hợp",
    directorView: "CHẾ ĐỘ ĐẠO DIỄN",
    directorDesc: "Mở cửa sổ mới chế độ toàn cảnh, chỉ đọc.",
    spawnDirector: "MỞ ĐẠO DIỄN",
    liveTelemetry: "DỮ LIỆU TRỰC TIẾP",
    dangerZone: "VÙNG NGUY HIỂM",
    resetMatch: "ĐẶT LẠI TRẬN",
    kickBots: "ĐUỔI TẤT CẢ BOT",
    forceKill: "Tiêu diệt cưỡng bức",
    // Game timer
    gameTimer: "Đồng hồ đếm ngược",
    setTimer: "Đặt thời gian (s)",
    noTimer: "Chưa đặt đồng hồ",
    timeRemaining: "THỜI GIAN CÒN",
    extendTimer: "+30s",
    shortenTimer: "-30s",
    endGameNow: "KẾT THÚC NGAY",
    // Leaderboard columns
    selectColumns: "Cột bảng xếp hạng cuối",
    // Game over
    gameOver: "KẾT THÚC GAME",
    finalLeaderboard: "BẢNG XẾP HẠNG CUỐI",
    close: "ĐÓNG",
    // Footer
    nodeOnline: "NODE ONLINE",
    // Stats
    kills: "Tiêu diệt",
    deaths: "Tử vong",
    damageDealt: "Sát thương gây ra",
    damageTaken: "Sát thương nhận",
    // Threat
    threatWarning: "ĐỊCH ĐANG NGẮM BẠN",
    // Portrait lock
    rotateLandscape: "Vui lòng xoay thiết bị ngang",
    // Bot management
    botManagement: "Quản lý Bot",
    botsEnabled: "Bật Bot",
    botCount: "Số lượng Bot",
    botAtkSpeedMin: "Tốc độ bắn Bot tối thiểu (s)",
    botAtkSpeedMax: "Tốc độ bắn Bot tối đa (s)",
    // HP management
    hpManagement: "Cài đặt HP",
    defaultPlayerHp: "HP cơ bản người chơi",
    defaultBotHp: "HP cơ bản Bot",
    setHpAll: "Áp dụng tất cả",
    setHpPlayers: "Chỉ người chơi",
    setHpBots: "Chỉ Bot",
    setHpIndividual: "Đặt HP",
    // Match reset notice
    matchResetNotice: "TRẬN ĐẤU ĐÃ ĐẶT LẠI",
    // Leaderboard sort
    sortBy: "Sắp xếp theo",
  },
};

const I18nContext = createContext(null);

export function I18nProvider({ children, defaultLang = "zh" }) {
  const [lang, setLang] = useState(defaultLang);
  const t = useMemo(() => TRANSLATIONS[lang] || TRANSLATIONS.zh, [lang]);
  const toggleLang = useCallback(() => setLang((l) => (l === "en" ? "zh" : "en")), []);
  const value = useMemo(() => ({ lang, setLang, t, toggleLang }), [lang, t, toggleLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>");
  return ctx;
}

export default TRANSLATIONS;
