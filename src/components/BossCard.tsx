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
  Check, 
  Sparkles,
  Calendar,
  AlertCircle,
  History
} from 'lucide-react';
import { BossItem, BossStatus } from '../types';

interface BossCardProps {
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

export function BossCard({
  boss,
  currentUserId,
  onInstantKill,
  onMissedSpawn,
  onOpenCustomKill,
  onOpenEditBoss,
  onResetBoss,
  onDeleteBoss,
  onOpenHistory,
}: BossCardProps) {
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

  // Format millisecond duration into HH:MM:SS
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

  // Status Styling Badges
  const getStatusBadge = () => {
    switch (status) {
      case 'SPAWNED':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/80 border border-rose-500/80 text-rose-300 text-xs font-bold animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>리젠 완료! (처치 대기)</span>
          </div>
        );
      case 'IMMINENT':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-500/80 text-amber-300 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>리젠 임박</span>
          </div>
        );
      case 'WAITING':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/60 text-cyan-300 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>쿨타임 진행중</span>
          </div>
        );
      case 'NO_RECORD':
      default:
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            <span>처치 기록 없음 (리젠 대기)</span>
          </div>
        );
    }
  };

  // Card Border and Glow based on status
  const getCardBorder = () => {
    if (status === 'SPAWNED') {
      return 'border-rose-500/70 shadow-lg shadow-rose-950/40 bg-slate-900/90';
    }
    if (status === 'IMMINENT') {
      return 'border-amber-500/70 shadow-lg shadow-amber-950/40 bg-slate-900/90';
    }
    return 'border-slate-800/90 bg-slate-900/80 hover:border-slate-700';
  };

  return (
    <div
      id={`boss-card-${boss.id}`}
      className={`relative rounded-2xl border p-5 transition-all backdrop-blur-md flex flex-col justify-between ${getCardBorder()}`}
    >
      <div>
        {/* Card Header: Boss Name, Status Badge & Actions */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <h3 className="text-xl font-black text-white tracking-tight">
                {boss.name}
              </h3>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-sm sm:text-base font-bold text-slate-200">
                <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="tracking-tight">{boss.region}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="text-cyan-300 font-medium">
                  주기: {formatRespawnCycle(boss.respawnMinutes)}
                </span>
                {boss.notes && (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-400 truncate max-w-[180px]">{boss.notes}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Config Actions */}
          <div className="flex items-center gap-1">
            {onOpenHistory && (
              <button
                id={`boss-card-quick-history-button-${boss.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenHistory(boss);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors cursor-pointer"
                title="이전 기록보기"
              >
                <History className="w-4 h-4" />
              </button>
            )}
            <button
              id={`boss-edit-button-${boss.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onOpenEditBoss(boss);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors cursor-pointer"
              title="지역 정보 수정"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              id={`boss-reset-button-${boss.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onResetBoss(boss.id);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors cursor-pointer"
              title="타이머 초기화"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              id={`boss-delete-button-${boss.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteBoss(boss.id);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
              title="삭제"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status Badge */}
        <div className="mb-4">
          {getStatusBadge()}
        </div>

        {/* Big Live Digital Timer Display */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 text-center my-3 shadow-inner">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-center gap-1">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {status === 'SPAWNED' ? '리젠 경과 시간' : '리젠까지 남은 시간'}
            </span>
          </div>

          <div
            className={`font-mono text-3xl sm:text-4xl font-black tracking-tight ${
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

          {/* Progress Bar */}
          <div className="w-full bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
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

        {/* Time Info: Last Defeat & Next Respawn */}
        <div className="grid grid-cols-2 gap-2 text-xs my-3 bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
          <div>
            <span className="text-slate-400 block mb-0.5">최근 처치 시간</span>
            <span className="font-mono text-slate-200 font-semibold block">
              {formatDateTime(boss.lastKillTime)}
            </span>
            {boss.lastKillerId && (
              <span className="text-[11px] text-cyan-400 truncate block mt-0.5">
                처치: {boss.lastKillerId}
              </span>
            )}
          </div>
          <div className="text-right">
            <span className="text-slate-400 block mb-0.5">리젠 예정 시간</span>
            <span className="font-mono text-cyan-300 font-bold block">
              {formatDateTime(boss.nextSpawnTime)}
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              {boss.nextSpawnTime ? '자동 계산 완료' : '처치 시 계산'}
            </span>
          </div>
        </div>

        {/* Drop Items or Notes */}
        {boss.notes && (
          <div className="text-xs text-slate-400 bg-slate-950/30 p-2.5 rounded-lg border border-slate-800/40 mb-3 flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{boss.notes}</span>
          </div>
        )}

        {/* 이전 기록보기 버튼 */}
        {onOpenHistory && (
          <div className="mb-2">
            <button
              id={`boss-card-history-button-${boss.id}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenHistory(boss);
              }}
              className="w-full py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer group"
            >
              <History className="w-3.5 h-3.5 text-cyan-400 group-hover:rotate-[-20deg] transition-transform" />
              <span>이전 기록보기 (최근 10건)</span>
            </button>
          </div>
        )}
      </div>

      {/* Primary Action Button: "멍" and "처치 기록" (Record Kill) */}
      <div className="pt-2 flex items-center gap-2">
        {/* "멍" (미출현/스킵) Button */}
        <button
          id={`boss-card-missed-button-${boss.id}`}
          type="button"
          onClick={handleMissedSpawn}
          disabled={isMissedRecording || isRecording}
          title="멍: 직전 리젠 시간에 리젠 주기를 더해 다음 리젠시간으로 갱신"
          className="py-3 px-3.5 rounded-xl bg-slate-800/90 hover:bg-amber-950/70 active:bg-amber-900 border border-slate-700/90 hover:border-amber-500/70 text-amber-300 hover:text-amber-200 font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 whitespace-nowrap"
        >
          {isMissedRecording ? (
            <div className="w-4 h-4 border-2 border-amber-300/30 border-t-amber-300 rounded-full animate-spin" />
          ) : (
            <>
              <RotateCw className="w-4 h-4 text-amber-400" />
              <span>멍</span>
            </>
          )}
        </button>

        {/* Record Kill Button */}
        <div className="relative flex-1 flex items-center">
          <button
            id={`boss-record-kill-button-${boss.id}`}
            onClick={handleQuickKill}
            disabled={isRecording}
            className="flex-1 py-3 px-4 rounded-l-xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-500 hover:to-amber-500 active:from-rose-700 active:to-amber-700 text-white font-black text-sm shadow-md shadow-rose-950/40 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
          >
            {isRecording ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Swords className="w-4 h-4" />
                <span>처치 기록 (지금 즉시)</span>
              </>
            )}
          </button>

          {/* Dropdown for custom time */}
          <button
            id={`boss-custom-kill-dropdown-${boss.id}`}
            onClick={() => setShowDropdown(!showDropdown)}
            className="py-3 px-3 rounded-r-xl bg-rose-700 hover:bg-rose-600 text-white border-l border-rose-800 flex items-center justify-center cursor-pointer"
            title="처치 시간 직접 입력"
          >
            <ChevronDown className="w-4 h-4" />
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div className="absolute bottom-full right-0 mb-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-20 animate-in fade-in zoom-in-95">
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
      </div>
    </div>
  );
}
