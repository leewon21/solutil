import { useMemo } from 'react';
import { 
  X, 
  History, 
  Clock, 
  User, 
  MapPin, 
  Swords, 
  Calendar, 
  RotateCw,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { BossItem, KillLogItem } from '../types';

interface BossHistoryModalProps {
  isOpen: boolean;
  boss: BossItem | null;
  logs: KillLogItem[];
  onClose: () => void;
}

export function BossHistoryModal({
  isOpen,
  boss,
  logs,
  onClose,
}: BossHistoryModalProps) {
  if (!isOpen || !boss) return null;

  // Filter logs for this specific boss, sort descending by killTime / loggedAt, and slice top 10
  const recentLogs = useMemo(() => {
    return logs
      .filter((l) => l.bossId === boss.id || l.bossName.trim().toLowerCase() === boss.name.trim().toLowerCase())
      .sort((a, b) => {
        const timeA = new Date(a.killTime || a.loggedAt).getTime();
        const timeB = new Date(b.killTime || b.loggedAt).getTime();
        return timeB - timeA;
      })
      .slice(0, 10);
  }, [logs, boss]);

  const formatDateTime = (iso: string | null | undefined) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  const formatTimeOnly = (iso: string | null | undefined) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  const getRelativeTime = (iso: string) => {
    const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diffSec < 60) return '방금 전';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`;
    return `${Math.floor(diffSec / 86400)}일 전`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
      <div 
        className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                {boss.difficulty && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    {boss.difficulty}급
                  </span>
                )}
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  {boss.name}
                </h3>
                <span className="text-xs text-slate-400">
                  이전 처치 기록
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-cyan-400" />
                  <span>{boss.region}</span>
                </span>
                {boss.channel && (
                  <>
                    <span>·</span>
                    <span className="text-slate-300">{boss.channel}</span>
                  </>
                )}
                <span>·</span>
                <span className="text-cyan-300 font-medium">
                  리젠 주기 {boss.respawnMinutes}분
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-banner: Notification & limit description */}
        <div className="bg-slate-950/40 px-5 py-2.5 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5 text-cyan-300 font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>최근 처치 기록 (최대 10개)</span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            {recentLogs.length > 0 ? `기록 ${recentLogs.length}건 표시 중` : '기록 없음'}
          </span>
        </div>

        {/* Logs List Container */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5 flex-1 scrollbar-thin">
          {recentLogs.length === 0 ? (
            <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-500 mb-3">
                <Swords className="w-6 h-6 stroke-1" />
              </div>
              <p className="text-sm font-bold text-slate-300 mb-1">
                기록된 이전 처치 내역이 없습니다.
              </p>
              <p className="text-xs text-slate-500 max-w-sm">
                메인 목록에서 <span className="text-rose-400 font-bold">[처치 기록]</span>이나 <span className="text-amber-400 font-bold">[멍]</span> 버튼을 누르면 처치 시간이 자동으로 누적 저장됩니다.
              </p>
            </div>
          ) : (
            recentLogs.map((log, index) => {
              const isLatest = index === 0;
              const isMissed = (log.notes || '').includes('멍') || (log.killerId || '').includes('멍');

              return (
                <div
                  key={log.id || `${log.bossId}-${index}`}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isLatest
                      ? 'bg-slate-950/80 border-cyan-500/40 shadow-sm shadow-cyan-950/30 ring-1 ring-cyan-500/20'
                      : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-black font-mono flex items-center gap-1 ${
                          isLatest
                            ? 'bg-cyan-500 text-slate-950'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        <span>#{index + 1}</span>
                        {isLatest && <span className="text-[10px] font-extrabold ml-0.5">최신</span>}
                      </span>

                      {isMissed ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                          <RotateCw className="w-2.5 h-2.5" />
                          <span>멍 처리</span>
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                          <Swords className="w-2.5 h-2.5" />
                          <span>처치</span>
                        </span>
                      )}

                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <User className="w-3 h-3 text-cyan-400" />
                        <span className="text-slate-200 font-medium">{log.killerId}</span>
                      </span>
                    </div>

                    {/* Relative Time Badge */}
                    <span className="text-[11px] font-mono text-slate-400">
                      {getRelativeTime(log.killTime || log.loggedAt)}
                    </span>
                  </div>

                  {/* Time Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 font-mono">
                    <div>
                      <span className="text-slate-500 text-[10px] block font-sans">처치 일시</span>
                      <span className="text-slate-200 font-bold flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {formatDateTime(log.killTime || log.loggedAt)}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] block font-sans">계산된 다음 젠</span>
                      <span className="text-cyan-300 font-bold flex items-center gap-1 mt-0.5">
                        <ChevronRight className="w-3 h-3 text-cyan-400" />
                        {log.nextSpawnTime ? formatDateTime(log.nextSpawnTime) : '-'}
                      </span>
                    </div>
                  </div>

                  {/* Notes / Reason */}
                  {log.notes && (
                    <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900/50 border border-slate-800/60">
                      <span className="text-slate-500">메모:</span>
                      <span className="text-slate-300">{log.notes}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            총 {recentLogs.length}개의 기록 (최대 10개 보관)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 hover:text-white font-bold text-xs transition-colors cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
