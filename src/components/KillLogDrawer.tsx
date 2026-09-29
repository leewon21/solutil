import { useState } from 'react';
import { X, Radio, Clock, User, MapPin, Swords, Filter } from 'lucide-react';
import { KillLogItem } from '../types';

interface KillLogDrawerProps {
  isOpen: boolean;
  logs: KillLogItem[];
  onClose: () => void;
  title?: string;
  description?: string;
}

export function KillLogDrawer({
  isOpen,
  logs,
  onClose,
  title = '길드 실시간 처치 기록 피드',
  description = '길드원들이 등록한 보스 처치 히스토리',
}: KillLogDrawerProps) {
  const [selectedBoss, setSelectedBoss] = useState<string>('ALL');

  if (!isOpen) return null;

  const bossNames = Array.from(new Set(logs.map((l) => l.bossName)));
  const filteredLogs = selectedBoss === 'ALL' ? logs : logs.filter((l) => l.bossName === selectedBoss);

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })} ${d.toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-md h-full bg-slate-900 border-l border-slate-800 shadow-2xl p-5 flex flex-col text-slate-100 animate-in slide-in-from-right">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
            <div>
              <h2 className="text-base font-black text-white">{title}</h2>
              <p className="text-xs text-slate-400">
                {description}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter by Boss */}
        {bossNames.length > 0 && (
          <div className="py-3 flex items-center gap-1.5 overflow-x-auto border-b border-slate-800/80 scrollbar-none">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <button
              onClick={() => setSelectedBoss('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                selectedBoss === 'ALL'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              전체 보기 ({logs.length})
            </button>
            {bossNames.map((name) => (
              <button
                key={name}
                onClick={() => setSelectedBoss(name)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                  selectedBoss === name
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {/* Logs List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3">
          {filteredLogs.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center text-slate-500 text-xs">
              <Swords className="w-8 h-8 mb-2 stroke-1 text-slate-600" />
              <span>기록된 보스 처치 내역이 없습니다.</span>
              <span className="text-[11px] text-slate-600 mt-1">
                대시보드에서 [처치 기록]을 누르면 실시간으로 누적됩니다.
              </span>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sm text-white">{log.bossName}</span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {formatDateTime(log.killTime)}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                  <span className="flex items-center gap-1 text-slate-300">
                    <User className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="font-medium">{log.killerId}</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span>{log.region}</span>
                  </span>
                </div>

                <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 text-xs flex items-center justify-between font-mono">
                  <span className="text-slate-400">리젠 예정:</span>
                  <span className="text-cyan-300 font-bold">
                    {formatDateTime(log.nextSpawnTime)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
