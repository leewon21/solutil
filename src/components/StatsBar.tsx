import { AlertTriangle, CheckCircle2, Clock, Layers } from 'lucide-react';
import { BossItem } from '../types';

interface StatsBarProps {
  bosses: BossItem[];
}

export function StatsBar({ bosses }: StatsBarProps) {
  const now = Date.now();

  let spawnedCount = 0;
  let imminentCount = 0;
  let waitingCount = 0;

  bosses.forEach((boss) => {
    if (!boss.nextSpawnTime) {
      spawnedCount++; // If never recorded or reset, treat as ready to hunt
      return;
    }
    const spawnTime = new Date(boss.nextSpawnTime).getTime();
    const diff = spawnTime - now;
    if (diff <= 0) {
      spawnedCount++;
    } else if (diff <= 15 * 60 * 1000) {
      imminentCount++;
    } else {
      waitingCount++;
    }
  });

  return (
    <div className="mb-6">
      {/* 4 Overview Metric Cards (현황 요약) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Spawned / Ready */}
        <div className="p-3.5 rounded-2xl border border-slate-800 bg-slate-900/80 text-left">
          <div className="flex items-center justify-between text-xs font-semibold text-rose-400 mb-1">
            <span>리젠 완료 (처치 대기)</span>
            <CheckCircle2 className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-white">{spawnedCount}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">즉시 토벌 가능한 상태</p>
        </div>

        {/* Imminent */}
        <div className="p-3.5 rounded-2xl border border-slate-800 bg-slate-900/80 text-left">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-400 mb-1">
            <span>리젠 임박 (15분내)</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white">{imminentCount}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">집결 준비 권장</p>
        </div>

        {/* Cooldown */}
        <div className="p-3.5 rounded-2xl border border-slate-800 bg-slate-900/80 text-left">
          <div className="flex items-center justify-between text-xs font-semibold text-cyan-400 mb-1">
            <span>쿨타임 진행중</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white">{waitingCount}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">리젠 대기중인 보스</p>
        </div>

        {/* Total Tracked */}
        <div className="p-3.5 rounded-2xl border border-slate-800 bg-slate-900/80 text-left">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-1">
            <span>전체 등록 보스</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-white">{bosses.length}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">추적 관리 대상</p>
        </div>
      </div>
    </div>
  );
}
