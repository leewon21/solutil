import { useState, useEffect } from 'react';
import { 
  MapPin, 
  Settings, 
  Trash2, 
  Sparkles,
  RotateCw,
  Swords,
  CheckCircle2,
  Radio,
  User,
  Compass,
  Eye,
  Clock
} from 'lucide-react';
import { BossItem, ServerBossState } from '../types';

interface ServerBossListItemProps {
  boss: BossItem;
  currentUserId: string;
  onSetStatus: (bossId: string, newStatus: ServerBossState) => Promise<void> | void;
  onOpenEditBoss: (boss: BossItem) => void;
  onDeleteBoss: (bossId: string) => Promise<void> | void;
  onUpdateScouts?: (bossId: string, teljiScout: string, bossRoomScout: string) => Promise<void> | void;
  onResetBoss?: (bossId: string) => Promise<void> | void;
  onOpenHistory?: (boss: BossItem) => void;
}

export function ServerBossListItem({
  boss,
  currentUserId: _currentUserId,
  onSetStatus,
  onOpenEditBoss,
  onDeleteBoss,
  onUpdateScouts,
}: ServerBossListItemProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  // Local state for 텔지띵 & 보스방띵
  const [telji, setTelji] = useState(boss.teljiScout || '');
  const [bossRoom, setBossRoom] = useState(boss.bossRoomScout || '');

  useEffect(() => {
    setTelji(boss.teljiScout || '');
  }, [boss.teljiScout]);

  useEffect(() => {
    setBossRoom(boss.bossRoomScout || '');
  }, [boss.bossRoomScout]);

  const handleSaveScouts = () => {
    if (telji !== (boss.teljiScout || '') || bossRoom !== (boss.bossRoomScout || '')) {
      onUpdateScouts?.(boss.id, telji, bossRoom);
    }
  };

  // Derive current status: defaults to '출현 중' if past spawn, else '처치완료'
  const currentStatus: ServerBossState = boss.serverStatus || (
    boss.nextSpawnTime && new Date(boss.nextSpawnTime).getTime() <= Date.now()
      ? '출현 중'
      : '처치완료'
  );

  const recorderId = boss.statusRecorderId || (boss.lastKillerId ? boss.lastKillerId.replace(/\s*\(멍\)/, '') : '');

  const formatRespawnCycle = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs === 0) return `${mins}분`;
    if (mins === 0) return `${hrs}시간`;
    return `${hrs}시간 ${mins}분`;
  };

  const formatTimeOnly = (iso: string | null | undefined) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    } catch {
      return '';
    }
  };

  const handleStatusChange = async (newStatus: ServerBossState) => {
    if (isUpdating) return;
    try {
      setIsUpdating(true);
      await onSetStatus(boss.id, newStatus);
    } finally {
      setIsUpdating(false);
    }
  };

  const getRowHighlight = () => {
    if (currentStatus === '출현 중') {
      return 'border-rose-500/60 bg-rose-950/20 hover:bg-rose-950/30 shadow-sm shadow-rose-950/30';
    }
    if (currentStatus === '멍') {
      return 'border-amber-500/60 bg-amber-950/20 hover:bg-amber-950/30';
    }
    return 'border-slate-800/80 bg-slate-900/70 hover:bg-slate-800/60';
  };

  return (
    <div
      id={`server-boss-item-${boss.id}`}
      className={`relative rounded-xl border p-3 sm:p-3.5 transition-all backdrop-blur-md flex flex-col xl:flex-row xl:items-center justify-between gap-3 ${getRowHighlight()}`}
    >
      {/* Left section: Boss info, location, difficulty, tags */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          {boss.difficulty && (
            <span className="px-1.5 py-0.5 rounded text-[11px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
              {boss.difficulty}급
            </span>
          )}
          <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2 truncate">
            <span>{boss.name}</span>
          </h3>

          {/* Mobile status display badge */}
          <div className="xl:hidden ml-auto flex flex-col items-end gap-1">
            {currentStatus === '출현 중' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/25 border border-rose-500 text-rose-300 text-xs font-black animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>출현 중</span>
              </span>
            )}
            {currentStatus === '멍' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/25 border border-amber-500 text-amber-300 text-xs font-black">
                <RotateCw className="w-3 h-3 text-amber-400" />
                <span>멍</span>
              </span>
            )}
            {currentStatus === '처치완료' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-xs font-black">
                <CheckCircle2 className="w-3 h-3 text-slate-400" />
                <span>처치완료</span>
              </span>
            )}
            {recorderId && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-cyan-300 font-semibold max-w-[110px] truncate" title={`기록자: ${recorderId}`}>
                <User className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                <span className="truncate">{recorderId}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className="flex items-center gap-1.5 text-sm sm:text-base font-bold text-slate-200">
            <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="truncate max-w-[260px] sm:max-w-none tracking-tight">{boss.region}</span>
          </span>
          {boss.channel && (
            <>
              <span className="text-slate-600 hidden sm:inline">|</span>
              <span className="text-xs text-slate-300 font-medium">
                {boss.channel}
              </span>
            </>
          )}
          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="text-xs text-cyan-300 font-medium whitespace-nowrap">
            주기 {formatRespawnCycle(boss.respawnMinutes)}
          </span>
          {boss.spawnTimes && boss.spawnTimes.length > 0 && (
            <>
              <span className="text-slate-600 hidden sm:inline">|</span>
              <span className="inline-flex items-center gap-1 text-xs text-amber-300 font-semibold bg-amber-950/40 border border-amber-800/60 px-2 py-0.5 rounded-md whitespace-nowrap">
                <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                <span>젠: {boss.spawnTimes.join(', ')}</span>
              </span>
            </>
          )}
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

      {/* Scout section: 텔지띵 & 보스방띵 아이디 입력 텍스트박스 (보스정보 오른쪽) */}
      <div className="flex items-center gap-2 shrink-0 bg-slate-950/70 p-1.5 sm:p-2 rounded-xl border border-slate-800/90">
        {/* 텔지띵 */}
        <div className="flex items-center gap-1.5">
          <span 
            className="text-[11px] font-bold text-amber-300 bg-amber-950/60 border border-amber-800/70 px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1 cursor-default" 
            title="텔지띵: 텔레포트 지점 브리핑 담당자"
          >
            <Compass className="w-3 h-3 text-amber-400 shrink-0" />
            <span>텔지띵</span>
          </span>
          <input
            id={`server-boss-telji-${boss.id}`}
            type="text"
            value={telji}
            onChange={(e) => setTelji(e.target.value)}
            onBlur={handleSaveScouts}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            placeholder="아이디 입력"
            className="w-20 sm:w-24 bg-slate-900 border border-slate-700/80 focus:border-amber-400 rounded-lg px-2 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
          />
        </div>

        <div className="w-[1px] h-5 bg-slate-800 shrink-0" />

        {/* 보스방띵 */}
        <div className="flex items-center gap-1.5">
          <span 
            className="text-[11px] font-bold text-rose-300 bg-rose-950/60 border border-rose-800/70 px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1 cursor-default" 
            title="보스방띵: 보스방 브리핑 담당자"
          >
            <Eye className="w-3 h-3 text-rose-400 shrink-0" />
            <span>보스방띵</span>
          </span>
          <input
            id={`server-boss-bossroom-${boss.id}`}
            type="text"
            value={bossRoom}
            onChange={(e) => setBossRoom(e.target.value)}
            onBlur={handleSaveScouts}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            placeholder="아이디 입력"
            className="w-20 sm:w-24 bg-slate-900 border border-slate-700/80 focus:border-rose-400 rounded-lg px-2 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Center section: Current Boss Status (보스정보 옆에 남은시간 기록 대신 표시) */}
      <div className="hidden xl:flex items-center justify-center gap-3 w-52 shrink-0 bg-slate-950/70 px-3.5 py-2 rounded-xl border border-slate-800">
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-slate-400 font-semibold mb-1 flex items-center gap-1">
            <Radio className="w-3 h-3 text-cyan-400" />
            <span>현재 보스상태</span>
          </span>

          {/* 3 Statuses: "출현 중", "멍", "처치완료" */}
          {currentStatus === '출현 중' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500/20 border-2 border-rose-500 text-rose-300 font-black text-xs shadow-sm shadow-rose-950/50 animate-pulse">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-80"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              <span>출현 중</span>
            </span>
          )}

          {currentStatus === '멍' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/20 border-2 border-amber-500/90 text-amber-300 font-black text-xs shadow-sm shadow-amber-950/50">
              <RotateCw className="w-3 h-3 text-amber-400" />
              <span>멍</span>
            </span>
          )}

          {currentStatus === '처치완료' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800/90 border-2 border-slate-700 text-slate-300 font-black text-xs shadow-sm">
              <CheckCircle2 className="w-3 h-3 text-cyan-400" />
              <span>처치완료</span>
            </span>
          )}

          {/* Recorder ID & Time */}
          <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-400 font-medium">
            {recorderId && (
              <span className="inline-flex items-center gap-1 text-slate-200 font-semibold bg-slate-900/90 px-1.5 py-0.2 rounded border border-slate-800" title={`기록자: ${recorderId}`}>
                <User className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                <span className="text-cyan-300 truncate max-w-[80px]">{recorderId}</span>
              </span>
            )}
            {boss.statusUpdatedAt && (
              <span className="text-[10px] text-slate-500 font-mono">
                {formatTimeOnly(boss.statusUpdatedAt)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right action buttons: [리젠!], [멍], [처치], and compact icon buttons [수정], [삭제] */}
      <div className="flex items-center gap-1.5 sm:gap-2 justify-end shrink-0 pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-800/80 flex-wrap sm:flex-nowrap">
        {/* "리젠!" 버튼: 누르면 상태를 [출현 중]으로 변경 */}
        <button
          id={`server-boss-btn-regen-${boss.id}`}
          type="button"
          disabled={isUpdating}
          onClick={() => handleStatusChange('출현 중')}
          title="보스 상태를 [출현 중]으로 변경"
          className={`py-2 sm:py-2.5 px-3 sm:px-3.5 rounded-xl font-black text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 group ${
            currentStatus === '출현 중'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 ring-2 ring-emerald-400 shadow-emerald-950/40 shadow-md font-black'
              : 'bg-emerald-950/60 hover:bg-emerald-700/90 text-emerald-300 hover:text-white border border-emerald-500/50 hover:border-emerald-400'
          }`}
        >
          <Sparkles className={`w-3.5 h-3.5 ${currentStatus === '출현 중' ? 'text-slate-950' : 'text-emerald-400'} group-hover:scale-110 transition-transform`} />
          <span>리젠!</span>
        </button>

        {/* "멍" 버튼: 누르면 상태를 [멍]으로 변경 */}
        <button
          id={`server-boss-btn-missed-${boss.id}`}
          type="button"
          disabled={isUpdating}
          onClick={() => handleStatusChange('멍')}
          title="보스 상태를 [멍]으로 변경"
          className={`py-2 sm:py-2.5 px-3 sm:px-3.5 rounded-xl font-black text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 group ${
            currentStatus === '멍'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 ring-2 ring-amber-400 shadow-amber-950/40 shadow-md font-black'
              : 'bg-amber-950/60 hover:bg-amber-700/90 text-amber-300 hover:text-white border border-amber-500/50 hover:border-amber-400'
          }`}
        >
          <RotateCw className={`w-3.5 h-3.5 ${currentStatus === '멍' ? 'text-slate-950' : 'text-amber-400'} group-hover:rotate-180 transition-transform`} />
          <span>멍</span>
        </button>

        {/* "처치" 버튼: 누르면 상태를 [처치완료]로 변경 */}
        <button
          id={`server-boss-btn-kill-${boss.id}`}
          type="button"
          disabled={isUpdating}
          onClick={() => handleStatusChange('처치완료')}
          title="보스 상태를 [처치완료]로 변경"
          className={`py-2 sm:py-2.5 px-3 sm:px-4 rounded-xl font-black text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 group ${
            currentStatus === '처치완료'
              ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white ring-2 ring-rose-400 shadow-rose-950/40 shadow-md font-black'
              : 'bg-rose-950/60 hover:bg-rose-700/90 text-rose-300 hover:text-white border border-rose-500/50 hover:border-rose-400'
          }`}
        >
          <Swords className={`w-3.5 h-3.5 ${currentStatus === '처치완료' ? 'text-white' : 'text-rose-400'} group-hover:scale-110 transition-transform`} />
          <span>처치</span>
        </button>

        {/* "수정" 아이콘 버튼 (공간 절약) */}
        <button
          id={`server-boss-btn-edit-${boss.id}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenEditBoss(boss);
          }}
          title="서버 보스 정보 수정"
          aria-label="서버 보스 정보 수정"
          className="p-2 sm:p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/60 text-slate-400 hover:text-cyan-300 shadow-sm transition-all flex items-center justify-center cursor-pointer active:scale-95 group shrink-0"
        >
          <Settings className="w-3.5 h-3.5 group-hover:rotate-45 transition-transform" />
        </button>

        {/* "삭제" 아이콘 버튼 (공간 절약) */}
        <button
          id={`server-boss-btn-delete-${boss.id}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteBoss(boss.id);
          }}
          title="서버 보스 삭제"
          aria-label="서버 보스 삭제"
          className="p-2 sm:p-2.5 rounded-xl bg-rose-950/30 hover:bg-rose-900/60 active:bg-rose-950 border border-rose-900/50 hover:border-rose-700 text-rose-400 hover:text-rose-200 shadow-sm transition-all flex items-center justify-center cursor-pointer active:scale-95 group shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
        </button>
      </div>
    </div>
  );
}
