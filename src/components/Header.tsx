import { useState, useEffect } from 'react';
import { 
  Shield, 
  Volume2, 
  VolumeX, 
  Bell, 
  BellOff, 
  Plus, 
  Settings, 
  LogOut, 
  Radio, 
  Clock, 
  Megaphone,
  Sparkles,
  Users,
  Globe,
  Swords
} from 'lucide-react';
import { GuildConfig, AlarmSettings } from '../types';

interface HeaderProps {
  userId: string;
  guildConfig: GuildConfig;
  alarmSettings: AlarmSettings;
  isLiveConnected: boolean;
  activeUsersCount?: number;
  activeUsers?: { userId: string }[];
  currentPage?: 'MAIN' | 'SERVER_BOSS' | 'ENHANCEMENT_REQUESTS' | 'SSULJA_EVENT';
  onNavigatePage?: (page: 'MAIN' | 'SERVER_BOSS' | 'ENHANCEMENT_REQUESTS' | 'SSULJA_EVENT') => void;
  onUpdateAlarmSettings: (settings: Partial<AlarmSettings>) => void;
  onRequestPushPermission: () => void;
  onOpenAddBoss: () => void;
  onOpenGuildSettings: () => void;
  onLogout: () => void;
  onOpenLogs: () => void;
  unreadLogsCount?: number;
}

export function Header({
  userId,
  guildConfig,
  alarmSettings,
  isLiveConnected,
  activeUsersCount,
  activeUsers = [],
  currentPage = 'MAIN',
  onNavigatePage,
  onUpdateAlarmSettings,
  onRequestPushPermission,
  onOpenAddBoss,
  onOpenGuildSettings,
  onLogout,
  onOpenLogs,
  unreadLogsCount = 0,
}: HeaderProps) {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  const currentActiveCount = activeUsersCount ?? (guildConfig.activeMembers || 1);
  const activeUserNames = activeUsers.length > 0 
    ? Array.from(new Set(activeUsers.map(u => u.userId))).join(', ')
    : userId;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatServerTime = (d: Date) => {
    return d.toLocaleTimeString('ko-KR', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDate = (d: Date) => {
    return d.toLocaleDateString('ko-KR', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  };

  return (
    <header className="sticky top-0 z-30 bg-[#0c121e]/95 border-b border-slate-800/90 backdrop-blur-md">
      {/* Top Guild Announcement Bar */}
      {guildConfig.announcement && (
        <div className="bg-gradient-to-r from-cyan-950/80 via-slate-900 to-indigo-950/80 border-b border-cyan-900/40 text-xs text-cyan-200">
          <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden truncate">
              <Megaphone className="w-3.5 h-3.5 text-cyan-400 shrink-0 animate-pulse" />
              <span className="font-semibold text-cyan-400 shrink-0">길드 공지:</span>
              <span className="truncate text-slate-300">{guildConfig.announcement}</span>
            </div>
            <button
              onClick={onOpenGuildSettings}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 underline shrink-0 ml-3 cursor-pointer"
            >
              공지 수정
            </button>
          </div>
        </div>
      )}

      {/* Main Navigation Bar */}
      <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-6 lg:px-8 py-2.5">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-2.5 shrink-0 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-md shadow-cyan-950/50 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap min-w-0">
              <span className="font-black text-sm sm:text-base text-white tracking-tight">
                솔 인챈트 <span className="text-cyan-400 hidden sm:inline">신을 버린자 · 창조의 핵 실시간 리젠</span>
              </span>
              <span className="hidden 2xl:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-[11px] font-medium text-cyan-300 shrink-0">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                {guildConfig.guildName || '솔 인챈트 길드'}
              </span>
            </div>
          </div>

          {/* Page Navigation Tabs (길드 보스타임 / 서버 보스타임 진행) */}
          {onNavigatePage && (
            <div className="hidden md:flex items-center bg-slate-900/90 border border-slate-700/80 rounded-xl p-0.5 shrink-0">
              <button
                id="header-nav-main-tab"
                type="button"
                onClick={() => onNavigatePage('MAIN')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currentPage === 'MAIN'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>리젠 타이머</span>
              </button>
              <button
                id="header-nav-server-tab"
                type="button"
                onClick={() => onNavigatePage('SERVER_BOSS')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currentPage === 'SERVER_BOSS'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-extrabold shadow-sm'
                    : 'text-amber-400 hover:text-amber-300'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>개인 적대 목록</span>
              </button>
              <button
                id="header-nav-enhancement-tab"
                type="button"
                onClick={() => onNavigatePage('ENHANCEMENT_REQUESTS')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currentPage === 'ENHANCEMENT_REQUESTS'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-extrabold shadow-sm'
                    : 'text-purple-400 hover:text-purple-300'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>수집템 강화 요청소</span>
              </button>
              <button
                id="header-nav-ssulja-tab"
                type="button"
                onClick={() => onNavigatePage('SSULJA_EVENT')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currentPage === 'SSULJA_EVENT'
                    ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white font-extrabold shadow-sm'
                    : 'text-rose-400 hover:text-rose-300'
                }`}
              >
                <Swords className="w-3.5 h-3.5" />
                <span>썰자 이벤트 참여</span>
              </button>
            </div>
          )}

          {/* Center Clock & Connection Status */}
          <div className="hidden 2xl:flex items-center gap-3 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-xl text-xs shrink-0 whitespace-nowrap">
            <div className="flex items-center gap-1.5 text-slate-300 font-mono">
              <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="hidden 2xl:inline">{formatDate(currentTime)}</span>
              <span className="font-bold text-white text-xs ml-0.5">{formatServerTime(currentTime)}</span>
            </div>

            <div className="w-px h-3.5 bg-slate-700/60" />

            <div className="flex items-center gap-1.5">
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isLiveConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="text-[11px] text-slate-400">
                {isLiveConnected ? 'Firebase 실시간' : '로컬 동기화'}
              </span>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 whitespace-nowrap">
            {/* Dedicated Real-time Active Users Badge (Always visible on all screen sizes) */}
            <div
              className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold shadow-sm shadow-emerald-950/50 shrink-0 transition-colors cursor-default"
              title={`실시간 접속 길드원 (${currentActiveCount}명): ${activeUserNames}`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-mono">
                접속 <span className="text-emerald-100 font-extrabold">{currentActiveCount}</span>명
              </span>
            </div>
            {/* Audio Alarm Toggle */}
            <button
              id="header-sound-toggle-button"
              onClick={() => onUpdateAlarmSettings({ soundEnabled: !alarmSettings.soundEnabled })}
              title={alarmSettings.soundEnabled ? '사운드 알람 켜짐' : '사운드 알람 꺼짐'}
              className={`p-2 rounded-xl border transition-colors cursor-pointer shrink-0 ${
                alarmSettings.soundEnabled
                  ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/70'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {alarmSettings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Push Notification Permission Button */}
            <button
              id="header-push-permission-button"
              onClick={onRequestPushPermission}
              title={alarmSettings.browserNotificationEnabled ? '푸시 알림 활성화됨' : '푸시 알림 켜기'}
              className={`p-2 rounded-xl border transition-colors cursor-pointer shrink-0 ${
                alarmSettings.browserNotificationEnabled
                  ? 'bg-amber-950/60 border-amber-500/40 text-amber-300 hover:bg-amber-900/70'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {alarmSettings.browserNotificationEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>

            {/* Kill Log History Drawer Button */}
            <button
              id="header-logs-button"
              onClick={onOpenLogs}
              className="relative p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              title="실시간 처치 기록 내역"
            >
              <Radio className="w-4 h-4" />
              {unreadLogsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-bounce">
                  {unreadLogsCount > 9 ? '9+' : unreadLogsCount}
                </span>
              )}
            </button>

            {/* Add Region Button */}
            <button
              id="header-add-boss-button"
              onClick={onOpenAddBoss}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white text-xs font-bold shadow-md shadow-cyan-950/40 transition-colors cursor-pointer shrink-0"
              title="신규 지역 및 보스 등록"
            >
              <Plus className="w-4 h-4" />
              <span>지역 추가</span>
            </button>

            {/* Guild Settings */}
            <button
              id="header-guild-settings-button"
              onClick={onOpenGuildSettings}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              title="길드 설정 & 알람 테스트"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* User Profile & Logout */}
            <div className="flex items-center pl-1.5 sm:pl-2 border-l border-slate-800 gap-1.5 sm:gap-2 shrink-0">
              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs font-bold text-slate-200 leading-tight">{userId}</span>
                <span className="text-[10px] text-cyan-400">길드원</span>
              </div>
              <button
                id="header-logout-button"
                onClick={onLogout}
                className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-700 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer shrink-0"
                title="로그아웃"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
