import { useState, useEffect } from 'react';
import { 
  Clock, 
  MapPin, 
  Swords, 
  RotateCcw, 
  RotateCw,
  Edit3, 
  Trash2, 
  ChevronDown, 
  Calendar,
  Sparkles,
  History
} from 'lucide-react';
import { BossItem, BossStatus } from '../types';

interface BossListItemProps {
  boss: BossItem;
  currentUserId: string;
  onInstantKill: (bossId: string) => Promise<void>;
  onMissedSpawn: (bossId: string) => Promise<void>;
  onOpenCustomKill: (boss: BossItem) => void;
  onOpenEditBoss: (boss: BossItem) => void;
  onResetBoss: (bossId: string) => Promise<void> | void;
  onDeleteBoss: (bossId: string) => Promise<void> | void;
  onOpenHistory?: (boss: BossItem) => void;
}

export function BossListItem({
  boss,
  currentUserId,
  onInstantKill,
  onMissedSpawn,
  onOpenCustomKill,
  onOpenEditBoss,
  onResetBoss,
  onDeleteBoss,
  onOpenHistory,
}: BossListItemProps) {
  const [now, setNow] = useState(Date.now());
  const [isRecording, setIsRecording] = useState(false);
  const [isMissedRecording, setIsMissedRecording] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute status and timers
  let status: BossStatus = 'NO_RECORD';
  let diffMs = 0;
  let elapsedSinceSpawnMs = 0;
  let progressPercent = 100;

  if (boss.lastKillTime && boss.nextSpawnTime) {
    const killTime = new Date(boss.lastKillTime).getTime();
    const spawnTime = new Date(boss.nextSpawnTime).getTime();
    diffMs = spawnTime - now;

    const totalDuration = spawnTime - killTime;
    const elapsedSinceKill = now - killTime;

    if (diffMs <= 0) {
      status = 'SPAWNED';
      elapsedSinceSpawnMs = Math.abs(diffMs);
      progressPercent = 100;
    } else if (diffMs <= 15 * 60 * 1000) {
      status = 'IMMINENT';
      progressPercent = Math.min(100, Math.max(0, (elapsedSinceKill / totalDuration) * 100));
    } else {
      status = 'WAITING';
      progressPercent = Math.min(100, Math.max(0, (elapsedSinceKill / totalDuration) * 100));
    }
  }

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const formatDateTime = (iso: string | null) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })} ${d.toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  };

  const formatRespawnCycle = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}시간 ${m}분`;
    if (h > 0) return `${h}시간`;
    return `${m}분`;
  };

  const handleQuickKill = async () => {
    setIsRecording(true);
    try {
      await onInstantKill(boss.id);
    } finally {
      setIsRecording(false);
    }
  };

  const handleMissedSpawn = async () => {
    setIsMissedRecording(true);
    try {
      await onMissedSpawn(boss.id);
    } finally {
      setIsMissedRecording(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'SPAWNED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-950/80 border border-rose-500/80 text-rose-300 text-xs font-bold animate-pulse whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>리젠 완료!</span>
          </span>
        );
      case 'IMMINENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-950/80 border border-amber-500/80 text-amber-300 text-xs font-bold whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>리젠 임박</span>
          </span>
        );
      case 'WAITING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-950/80 border border-cyan-500/60 text-cyan-300 text-xs font-bold whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>쿨타임 중</span>
          </span>
        );
      case 'NO_RECORD':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            <span>기록 없음</span>
          </span>
        );
    }
  };

  const getRowHighlight = () => {
    if (status === 'SPAWNED') {
      return 'border-rose-500/60 bg-rose-950/20 hover:bg-rose-950/30';
    }
    if (status === 'IMMINENT') {
      return 'border-amber-500/60 bg-amber-950/20 hover:bg-amber-950/30';
    }
    return 'border-slate-800/80 bg-slate-900/70 hover:bg-slate-800/60';
  };

  return (
    <div
      id={`boss-list-item-${boss.id}`}
      className={`relative rounded-xl border p-3.5 sm:p-4 transition-all backdrop-blur-md flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${getRowHighlight()}`}
    >
      {/* Left section: Boss info, location, tags */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2 truncate">
            <span>{boss.name}</span>
          </h3>
          <div className="lg:hidden ml-auto">
            {getStatusBadge()}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className="flex items-center gap-1.5 text-sm sm:text-base font-bold text-slate-200">
            <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="truncate max-w-[260px] sm:max-w-none tracking-tight">{boss.region}</span>
          </span>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="text-xs text-cyan-300 font-medium whitespace-nowrap">
            주기 {formatRespawnCycle(boss.respawnMinutes)}
          </span>
          {boss.notes && (
            <>
              <span className="text-slate-600 hidden md:inline">|</span>
              <span className="text-slate-400 hidden md:flex items-center gap-1 truncate max-w-xs text-xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">{boss.notes}</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Center section: Status Badge + Live Timer Countdown + Progress Bar */}
      <div className="flex items-center justify-between lg:justify-center gap-4 lg:w-72 shrink-0 bg-slate-950/60 p-2.5 sm:px-4 sm:py-2.5 rounded-xl border border-slate-800/80">
        <div className="hidden lg:block">
          {getStatusBadge()}
        </div>

        <div className="flex-1 text-right lg:text-center min-w-[130px]">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5 flex items-center justify-end lg:justify-center gap-1">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span>{status === 'SPAWNED' ? '경과' : '남은시간'}</span>
          </div>
          <div
            className={`font-mono text-xl sm:text-2xl font-black tracking-tight ${
              status === 'SPAWNED'
                ? 'text-rose-400 animate-pulse'
                : status === 'IMMINENT'
                ? 'text-amber-300'
                : status === 'WAITING'
                ? 'text-cyan-300'
                : 'text-slate-400'
            }`}
          >
            {status === 'SPAWNED' && `+${formatDuration(elapsedSinceSpawnMs)}`}
            {status === 'IMMINENT' && formatDuration(diffMs)}
            {status === 'WAITING' && formatDuration(diffMs)}
            {status === 'NO_RECORD' && '00:00:00'}
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${
                status === 'SPAWNED'
                  ? 'bg-rose-500'
                  : status === 'IMMINENT'
                  ? 'bg-amber-400'
                  : 'bg-cyan-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Right-center section: Times (Last Defeat / Next Respawn) */}
      <div className="grid grid-cols-2 lg:flex lg:flex-col justify-center gap-1 text-xs lg:w-44 shrink-0 bg-slate-950/40 p-2 rounded-lg border border-slate-800/60">
        <div className="leading-tight">
          <span className="text-slate-500 text-[10px] block">최근 처치</span>
          <span className="font-mono text-slate-300 text-xs font-medium">
            {formatDateTime(boss.lastKillTime)}
          </span>
          {boss.lastKillerId && (
            <span className="text-[10px] text-cyan-400 truncate block">
              by {boss.lastKillerId}
            </span>
          )}
        </div>
        <div className="leading-tight text-right lg:text-left">
          <span className="text-slate-500 text-[10px] block">리젠 예정</span>
          <span className="font-mono text-cyan-300 text-xs font-bold">
            {formatDateTime(boss.nextSpawnTime)}
          </span>
        </div>
      </div>

      {/* Right action buttons: [이전 기록보기], [멍], [처치 기록] and submenu + config */}
      <div className="flex items-center gap-1.5 sm:gap-2 justify-end shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800/80 flex-wrap sm:flex-nowrap">
        {/* 이전 기록보기 버튼 */}
        {onOpenHistory && (
          <button
            id={`boss-list-history-button-${boss.id}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenHistory(boss);
            }}
            title="최근 처치 기록 10개 팝업 보기"
            className="py-2 sm:py-2.5 px-2.5 sm:px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700 active:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/60 text-slate-300 hover:text-cyan-300 font-bold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap group"
          >
            <History className="w-3.5 h-3.5 text-cyan-400 group-hover:rotate-[-20deg] transition-transform" />
            <span className="hidden sm:inline">이전 기록보기</span>
            <span className="sm:hidden">기록</span>
          </button>
        )}

        {/* "멍" (미출현/스킵) 버튼 - 처치 기록 앞쪽 */}
        <button
          id={`boss-list-missed-button-${boss.id}`}
          type="button"
          onClick={handleMissedSpawn}
          disabled={isMissedRecording || isRecording}
          title="멍: 직전 리젠 시간에 리젠 주기를 더해 다음 리젠시간으로 갱신"
          className="py-2 sm:py-2.5 px-3 sm:px-3.5 rounded-xl bg-slate-800/90 hover:bg-amber-950/70 active:bg-amber-900 border border-slate-700/90 hover:border-amber-500/70 text-amber-300 hover:text-amber-200 font-bold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
        >
          {isMissedRecording ? (
            <div className="w-3.5 h-3.5 border-2 border-amber-300/30 border-t-amber-300 rounded-full animate-spin" />
          ) : (
            <>
              <RotateCw className="w-3.5 h-3.5 text-amber-400" />
              <span>멍</span>
            </>
          )}
        </button>

        {/* Record Kill Button */}
        <div className="relative flex items-center">
          <button
            id={`boss-list-record-kill-button-${boss.id}`}
            onClick={handleQuickKill}
            disabled={isRecording}
            className="py-2 sm:py-2.5 px-3.5 sm:px-4 rounded-l-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 active:from-rose-700 active:to-amber-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-950/40 flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-50 whitespace-nowrap"
          >
            {isRecording ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Swords className="w-3.5 h-3.5" />
                <span>처치 기록</span>
              </>
            )}
          </button>

          <button
            id={`boss-list-custom-kill-dropdown-${boss.id}`}
            onClick={() => setShowDropdown(!showDropdown)}
            className="py-2 sm:py-2.5 px-2 rounded-r-xl bg-rose-700 hover:bg-rose-600 text-white border-l border-rose-800 flex items-center justify-center cursor-pointer"
            title="처치 시간 직접 입력"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div className="absolute top-full right-0 mt-1.5 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-30 animate-in fade-in zoom-in-95">
              <button
                onClick={() => {
                  setShowDropdown(false);
                  onOpenCustomKill(boss);
                }}
                className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 rounded-lg flex items-center gap-2 cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>처치 시간 직접 입력</span>
              </button>
              <button
                onClick={() => {
                  setShowDropdown(false);
                  onResetBoss(boss.id);
                }}
                className="w-full text-left px-3 py-2 text-xs text-amber-300 hover:bg-slate-800 rounded-lg flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>타이머 리셋</span>
              </button>
            </div>
          )}
        </div>

        {/* Quick Config Actions */}
        <div className="flex items-center gap-1">
          <button
            id={`boss-list-edit-button-${boss.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenEditBoss(boss);
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors cursor-pointer"
            title="지역 정보 수정"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            id={`boss-list-reset-button-${boss.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onResetBoss(boss.id);
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors cursor-pointer"
            title="타이머 초기화"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            id={`boss-list-delete-button-${boss.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onDeleteBoss(boss.id);
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
            title="삭제"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
