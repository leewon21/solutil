import { useState, useEffect, type FormEvent } from 'react';
import { X, Clock, Swords, Check, Calendar, ArrowRight } from 'lucide-react';
import { BossItem } from '../types';

interface CustomKillModalProps {
  isOpen: boolean;
  boss: BossItem | null;
  currentUserId: string;
  onClose: () => void;
  onConfirmKill: (bossId: string, killTimeIso: string, killerId: string, notes?: string) => Promise<void>;
}

export function CustomKillModal({
  isOpen,
  boss,
  currentUserId,
  onClose,
  onConfirmKill,
}: CustomKillModalProps) {
  const [killerId, setKillerId] = useState(currentUserId);
  const [dateTimeString, setDateTimeString] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewSpawn, setPreviewSpawn] = useState<string>('');

  useEffect(() => {
    if (boss && isOpen) {
      setKillerId(currentUserId);
      setNotes('');
      // Set to local ISO string YYYY-MM-DDTHH:mm
      const now = new Date();
      const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setDateTimeString(localIso);
      updatePreview(localIso);
    }
  }, [boss, isOpen, currentUserId]);

  const updatePreview = (inputDateStr: string) => {
    if (!boss || !inputDateStr) return;
    const d = new Date(inputDateStr);
    if (!isNaN(d.getTime())) {
      const spawnDate = new Date(d.getTime() + boss.respawnMinutes * 60 * 1000);
      setPreviewSpawn(
        `${spawnDate.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })} ${spawnDate.toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit' })}`
      );
    }
  };

  const handleTimeChange = (newVal: string) => {
    setDateTimeString(newVal);
    updatePreview(newVal);
  };

  const handleQuickOffset = (minutesAgo: number) => {
    const target = new Date(Date.now() - minutesAgo * 60 * 1000);
    const localIso = new Date(target.getTime() - target.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setDateTimeString(localIso);
    updatePreview(localIso);
  };

  if (!isOpen || !boss) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!dateTimeString) return;

    const killDate = new Date(dateTimeString);
    if (isNaN(killDate.getTime())) return;

    setIsSubmitting(true);
    try {
      await onConfirmKill(boss.id, killDate.toISOString(), killerId.trim() || currentUserId, notes);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl p-6 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-rose-500" />
            <div>
              <h2 className="text-base font-black text-white">처치 시간 직접 기록</h2>
              <p className="text-xs text-slate-400">
                {boss.name} · {boss.region}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 my-4">
          {/* Quick Offset Presets */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              빠른 시간 지정
            </label>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleQuickOffset(0)}
                className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg cursor-pointer text-center"
              >
                방금 전
              </button>
              <button
                type="button"
                onClick={() => handleQuickOffset(5)}
                className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg cursor-pointer text-center"
              >
                5분 전
              </button>
              <button
                type="button"
                onClick={() => handleQuickOffset(10)}
                className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg cursor-pointer text-center"
              >
                10분 전
              </button>
              <button
                type="button"
                onClick={() => handleQuickOffset(30)}
                className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg cursor-pointer text-center"
              >
                30분 전
              </button>
            </div>
          </div>

          {/* Exact Datetime Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              정확한 처치 일시 *
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                id="custom-kill-datetime"
                type="datetime-local"
                value={dateTimeString}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950/90 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                required
              />
            </div>
          </div>

          {/* Killer Guild Member ID */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              처치 길드원 (기록자)
            </label>
            <input
              id="custom-kill-user-id"
              type="text"
              value={killerId}
              onChange={(e) => setKillerId(e.target.value)}
              placeholder="길드원 아이디 입력"
              className="w-full px-3.5 py-2 bg-slate-950/90 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Calculated Spawn Preview Box */}
          <div className="bg-cyan-950/40 border border-cyan-500/40 p-3.5 rounded-xl text-xs space-y-1">
            <div className="flex items-center justify-between text-cyan-300 font-semibold">
              <span>보스 리젠 주기:</span>
              <span>{Math.floor(boss.respawnMinutes / 60)}시간 {boss.respawnMinutes % 60}분</span>
            </div>
            <div className="flex items-center justify-between text-white font-bold pt-1 border-t border-cyan-900/40">
              <span>계산된 리젠 시각:</span>
              <span className="font-mono text-cyan-300 text-sm">{previewSpawn || '-'}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              취소
            </button>
            <button
              id="custom-kill-submit-button"
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-950/50 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>처치 기록 저장</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
