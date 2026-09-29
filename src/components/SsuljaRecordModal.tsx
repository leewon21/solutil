import { useState, useEffect } from 'react';
import { X, Swords, Calendar, User, Shield, FileText, Check } from 'lucide-react';
import { SsuljaEventRecord, SsuljaContributionType } from '../types';

interface SsuljaRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: SsuljaEventRecord) => Promise<void> | void;
  recordToEdit?: SsuljaEventRecord | null;
  currentUserId: string;
}

export function SsuljaRecordModal({
  isOpen,
  onClose,
  onSave,
  recordToEdit,
  currentUserId,
}: SsuljaRecordModalProps) {
  const [occurredAt, setOccurredAt] = useState('');
  const [contributionType, setContributionType] = useState<SsuljaContributionType>('처치');
  const [targetId, setTargetId] = useState('');
  const [targetGuild, setTargetGuild] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (recordToEdit) {
        setOccurredAt(recordToEdit.occurredAt);
        setContributionType(recordToEdit.contributionType);
        setTargetId(recordToEdit.targetId);
        setTargetGuild(recordToEdit.targetGuild || '');
        setNotes(recordToEdit.notes || '');
      } else {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const formattedNow = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
        setOccurredAt(formattedNow);
        setContributionType('처치');
        setTargetId('');
        setTargetGuild('');
        setNotes('');
      }
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen, recordToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!occurredAt.trim()) {
      setError('발생시간을 입력해주세요 (예: 2026/09/28 00:10).');
      return;
    }
    if (!targetId.trim()) {
      setError('대상자 아이디를 입력해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const record: SsuljaEventRecord = {
        id: recordToEdit?.id || `ssulja-rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        occurredAt: occurredAt.trim(),
        contributionType,
        targetId: targetId.trim(),
        targetGuild: targetGuild.trim() || '-',
        uploaderId: recordToEdit?.uploaderId || currentUserId || '익명 길드원',
        uploadedAt: recordToEdit?.uploadedAt || new Date().toISOString().replace('T', ' ').substring(0, 16),
        notes: notes.trim() || undefined,
      };

      await onSave(record);
      onClose();
    } catch (err: any) {
      setError(err?.message || '기록 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-slate-900 border border-rose-500/40 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl shadow-rose-950/50">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-rose-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-400">
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                {recordToEdit ? '썰자 기록 수정' : '썰자 기록 직접 추가'}
              </h2>
              <p className="text-xs text-slate-400">
                {recordToEdit ? '전투 기록의 세부 내용을 수정합니다.' : '전투 기록을 수동으로 입력하여 통계에 누적합니다.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* 발생시간 */}
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center justify-between">
              <span>발생시간 <span className="text-rose-400">*</span></span>
              <span className="text-[11px] text-slate-400">예: 2026/09/28 00:10</span>
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                placeholder="2026/09/28 00:10"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 transition-colors font-mono"
              />
            </div>
          </div>

          {/* 기여내역 (처치 / 도움) */}
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1.5">
              기여내역 <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setContributionType('처치')}
                className={`py-2 px-3 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  contributionType === '처치'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 ring-2 ring-cyan-500/40 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Swords className="w-3.5 h-3.5 text-cyan-400" />
                <span>처치 (Kill)</span>
              </button>
              <button
                type="button"
                onClick={() => setContributionType('도움')}
                className={`py-2 px-3 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  contributionType === '도움'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-2 ring-amber-500/40 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span>도움 (Assist)</span>
              </button>
            </div>
          </div>

          {/* 대상자 아이디 */}
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1.5">
              대상자 아이디(캐릭터명) <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder="대상 캐릭터명 입력"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 transition-colors"
              />
            </div>
          </div>

          {/* 대상자 길드 */}
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center justify-between">
              <span>대상자 길드명 (선택)</span>
              <span className="text-[11px] text-slate-400">없으면 '-' 입력</span>
            </label>
            <div className="relative">
              <Shield className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={targetGuild}
                onChange={(e) => setTargetGuild(e.target.value)}
                placeholder="길드명 입력 (예: 스파르타A)"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 transition-colors"
              />
            </div>
          </div>

          {/* 비고 / 메모 */}
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1.5">
              메모 및 비고 (선택)
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="전투 장소, 특이사항 등 자유 메모"
                rows={2}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 transition-colors resize-none"
              />
            </div>
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !targetId.trim() || !occurredAt.trim()}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 active:scale-95 text-white font-black text-xs shadow-md shadow-rose-950/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSubmitting ? '저장 중...' : '저장 완료'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
