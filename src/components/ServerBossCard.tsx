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

interface ServerBossCardProps {
  boss: BossItem;
  currentUserId: string;
  onSetStatus: (bossId: string, newStatus: ServerBossState) => Promise<void> | void;
  onOpenEditBoss: (boss: BossItem) => void;
  onResetBoss: (bossId: string) => Promise<void> | void;
  onDeleteBoss: (bossId: string) => Promise<void> | void;
  onUpdateScouts?: (bossId: string, teljiScout: string, bossRoomScout: string) => Promise<void> | void;
  onOpenHistory?: (boss: BossItem) => void;
}

export function ServerBossCard({
  boss,
  currentUserId: _currentUserId,
  onSetStatus,
  onOpenEditBoss,
  onResetBoss: _onResetBoss,
  onDeleteBoss,
  onUpdateScouts,
}: ServerBossCardProps) {
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

  const getCardBorder = () => {
    if (currentStatus === '출현 중') {
      return 'border-rose-500/80 shadow-rose-950/40 bg-gradient-to-b from-slate-900 via-slate-900 to-rose-950/20';
    }
    if (currentStatus === '멍') {
      return 'border-amber-500/70 shadow-amber-950/30 bg-gradient-to-b from-slate-900 via-slate-900 to-amber-950/20';
    }
    return 'border-slate-800 bg-slate-900/90';
  };

  return (
    <div
      id={`server-boss-card-${boss.id}`}
      className={`rounded-2xl border p-4.5 transition-all shadow-lg flex flex-col justify-between relative overflow-hidden backdrop-blur-md ${getCardBorder()}`}
    >
      {/* Top Section: Header, Difficulty, Boss Info */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              {boss.difficulty && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {boss.difficulty}급
                </span>
              )}
              <span className="text-xs text-cyan-300 font-semibold">
                주기 {formatRespawnCycle(boss.respawnMinutes)}
              </span>
            </div>
            <h3 className="text-lg font-black text-white tracking-tight truncate">
              {boss.name}
            </h3>
          </div>

          {/* Quick Config Actions */}
          <div className="flex items-center gap-1">
            <button
              id={`server-boss-card-edit-button-${boss.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onOpenEditBoss(boss);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="보스 수정"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              id={`server-boss-card-delete-button-${boss.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteBoss(boss.id);
              }}
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
              title="보스 삭제"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Location & Channel */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-2 bg-slate-950/40 px-2.5 py-1.5 rounded-lg border border-slate-800/60">
          <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="truncate">{boss.region}</span>
          {boss.channel && (
            <>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">{boss.channel}</span>
            </>
          )}
        </div>

        {/* Server Boss: Spawn Times (젠시간) */}
        {boss.spawnTimes && boss.spawnTimes.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 mb-3 bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-800/60">
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-slate-400 text-[11px]">젠시간:</span>
            <span className="font-mono tracking-wide">{boss.spawnTimes.join(', ')}</span>
          </div>
        )}

        {/* Center section: Current Boss Status (남은시간 대신 현재 보스상태 표기) */}
        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/90 mb-3 text-center">
          <div className="text-[10px] text-slate-400 font-semibold mb-1.5 flex items-center justify-center gap-1">
            <Radio className="w-3 h-3 text-cyan-400" />
            <span>현재 보스상태</span>
          </div>

          {currentStatus === '출현 중' && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/20 border-2 border-rose-500 text-rose-300 font-black text-base shadow-sm shadow-rose-950/50 animate-pulse">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-80"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
              <span>출현 중</span>
            </div>
          )}

          {currentStatus === '멍' && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border-2 border-amber-500/90 text-amber-300 font-black text-base shadow-sm shadow-amber-950/50">
              <RotateCw className="w-4 h-4 text-amber-400" />
              <span>멍</span>
            </div>
          )}

          {currentStatus === '처치완료' && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/90 border-2 border-slate-700 text-slate-300 font-black text-base shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              <span>처치완료</span>
            </div>
          )}

          {/* Recorder ID & Time */}
          <div className="flex items-center justify-center gap-1.5 mt-2 flex-wrap">
            {recorderId && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300 bg-slate-900/90 px-2 py-0.5 rounded-md border border-slate-800" title={`기록자: ${recorderId}`}>
                <User className="w-3 h-3 text-cyan-400 shrink-0" />
                <span className="truncate max-w-[120px]">{recorderId}</span>
              </span>
            )}
            {boss.statusUpdatedAt && (
              <span className="text-[10px] text-slate-500 font-mono">
                {formatTimeOnly(boss.statusUpdatedAt)} 변경
              </span>
            )}
          </div>
        </div>

        {/* Notes */}
        {boss.notes && (
          <div className="text-xs text-slate-400 bg-slate-950/30 p-2.5 rounded-lg border border-slate-800/40 mb-3 flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{boss.notes}</span>
          </div>
        )}

        {/* Scouts: 텔지띵 & 보스방띵 */}
        <div className="grid grid-cols-2 gap-2 mb-3 bg-slate-950/60 p-2 rounded-xl border border-slate-800/80">
          <div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-300 mb-1">
              <Compass className="w-3 h-3 text-amber-400" />
              <span>텔지띵</span>
            </div>
            <input
              id={`server-boss-card-telji-${boss.id}`}
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
              className="w-full bg-slate-900 border border-slate-700/80 focus:border-amber-400 rounded-lg px-2 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-rose-300 mb-1">
              <Eye className="w-3 h-3 text-rose-400" />
              <span>보스방띵</span>
            </div>
            <input
              id={`server-boss-card-bossroom-${boss.id}`}
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
              className="w-full bg-slate-900 border border-slate-700/80 focus:border-rose-400 rounded-lg px-2 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      {/* 3 Buttons: [리젠!], [멍], [처치] */}
      <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-800/80">
        {/* 리젠! */}
        <button
          id={`server-boss-card-regen-${boss.id}`}
          type="button"
          disabled={isUpdating}
          onClick={() => handleStatusChange('출현 중')}
          title="보스 상태를 [출현 중]으로 변경"
          className={`py-2 px-2 rounded-xl font-black text-xs shadow-sm transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap active:scale-95 group ${
            currentStatus === '출현 중'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 ring-2 ring-emerald-400 shadow-emerald-950/40 font-black'
              : 'bg-emerald-950/60 hover:bg-emerald-700/90 text-emerald-300 hover:text-white border border-emerald-500/50 hover:border-emerald-400'
          }`}
        >
          <Sparkles className={`w-3.5 h-3.5 ${currentStatus === '출현 중' ? 'text-slate-950' : 'text-emerald-400'} group-hover:scale-110 transition-transform`} />
          <span>리젠!</span>
        </button>

        {/* 멍 */}
        <button
          id={`server-boss-card-missed-${boss.id}`}
          type="button"
          disabled={isUpdating}
          onClick={() => handleStatusChange('멍')}
          title="보스 상태를 [멍]으로 변경"
          className={`py-2 px-2 rounded-xl font-black text-xs shadow-sm transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap active:scale-95 group ${
            currentStatus === '멍'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 ring-2 ring-amber-400 shadow-amber-950/40 font-black'
              : 'bg-amber-950/60 hover:bg-amber-700/90 text-amber-300 hover:text-white border border-amber-500/50 hover:border-amber-400'
          }`}
        >
          <RotateCw className={`w-3.5 h-3.5 ${currentStatus === '멍' ? 'text-slate-950' : 'text-amber-400'} group-hover:rotate-180 transition-transform`} />
          <span>멍</span>
        </button>

        {/* 처치 */}
        <button
          id={`server-boss-card-kill-${boss.id}`}
          type="button"
          disabled={isUpdating}
          onClick={() => handleStatusChange('처치완료')}
          title="보스 상태를 [처치완료]로 변경"
          className={`py-2 px-2 rounded-xl font-black text-xs shadow-sm transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap active:scale-95 group ${
            currentStatus === '처치완료'
              ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white ring-2 ring-rose-400 shadow-rose-950/40 font-black'
              : 'bg-rose-950/60 hover:bg-rose-700/90 text-rose-300 hover:text-white border border-rose-500/50 hover:border-rose-400'
          }`}
        >
          <Swords className={`w-3.5 h-3.5 ${currentStatus === '처치완료' ? 'text-white' : 'text-rose-400'} group-hover:scale-110 transition-transform`} />
          <span>처치</span>
        </button>
      </div>
    </div>
  );
}
