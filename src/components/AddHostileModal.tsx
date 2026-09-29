import { useState, useEffect, useRef } from 'react';
import { X, UserPlus, ShieldAlert, FileText, User, AlertTriangle } from 'lucide-react';
import { HostileTarget } from '../types';

interface AddHostileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (target: Omit<HostileTarget, 'id'>) => Promise<void> | void;
  currentUserId: string;
  existingTargets?: HostileTarget[];
}

export function AddHostileModal({
  isOpen,
  onClose,
  onSave,
  currentUserId,
  existingTargets = [],
}: AddHostileModalProps) {
  const [targetId, setTargetId] = useState('');
  const [memo, setMemo] = useState('');
  const [error, setError] = useState('');
  const [duplicateTarget, setDuplicateTarget] = useState<HostileTarget | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTargetId('');
      setMemo('');
      setError('');
      setDuplicateTarget(null);
      setIsSubmitting(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isCurrentIdDuplicate = Boolean(
    targetId.trim() &&
      existingTargets.some(
        (t) => t.targetId.trim().toLowerCase() === targetId.trim().toLowerCase()
      )
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedId = targetId.trim();
    if (!trimmedId) {
      setError('경계 대상 아이디(캐릭터명)를 입력해주세요.');
      inputRef.current?.focus();
      return;
    }

    // Check for duplicate ID
    const duplicate = existingTargets.find(
      (t) => t.targetId.trim().toLowerCase() === trimmedId.toLowerCase()
    );
    if (duplicate) {
      setDuplicateTarget(duplicate);
      setError(`'${trimmedId}'(은)는 이미 등록되어 있는 중복 아이디입니다.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const formattedDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
        now.getHours()
      )}:${pad(now.getMinutes())}`;

      await onSave({
        targetId: trimmedId,
        createdAt: formattedDate,
        createdBy: currentUserId || '익명 길드원',
        memo: memo.trim() || undefined,
      });

      onClose();
    } catch (err: any) {
      setError(err?.message || '경계 대상 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismissDuplicate = () => {
    setDuplicateTarget(null);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-hostile-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-slate-900 border border-rose-500/40 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl shadow-rose-950/50 relative">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-rose-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 id="add-hostile-title" className="text-base sm:text-lg font-black text-white">
                경계대상 추가
              </h2>
              <p className="text-xs text-slate-400">
                적대 및 경계 플레이어 아이디를 등록합니다.
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
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs font-semibold flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* 경계대상 아이디 Input */}
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1.5">
              경계대상 아이디 <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <UserPlus className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                type="text"
                value={targetId}
                onChange={(e) => {
                  setTargetId(e.target.value);
                  if (error) setError('');
                  if (duplicateTarget) setDuplicateTarget(null);
                }}
                placeholder="적대 캐릭터명 또는 유저 아이디 입력"
                className={`w-full bg-slate-950 border rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${
                  isCurrentIdDuplicate
                    ? 'border-amber-500/80 focus:border-amber-400 focus:ring-1 focus:ring-amber-400'
                    : 'border-slate-700 focus:border-rose-400 focus:ring-1 focus:ring-rose-400'
                }`}
                maxLength={40}
              />
            </div>
            {isCurrentIdDuplicate && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-400 font-semibold animate-fade-in">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>이미 등록되어 있는 아이디입니다. 등록 시 중복 팝업이 표시됩니다.</span>
              </div>
            )}
          </div>

          {/* 등록 사유 / 메모 Input */}
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center justify-between">
              <span>사유 및 메모 (선택)</span>
              <span className="text-[11px] text-slate-400 font-normal">최대 100자</span>
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="경계 사유 또는 특이사항 (예: 사냥터 PK, 분쟁 유발 등)"
                rows={2}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 transition-colors resize-none"
                maxLength={100}
              />
            </div>
          </div>

          {/* Meta Info Preview */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-400 space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-400">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                <span>등록자</span>
              </span>
              <span className="font-bold text-slate-200">{currentUserId}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
              <span>등록 일자</span>
              <span className="text-slate-300 font-mono text-[11px]">등록 시각 자동 기록</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !targetId.trim()}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 active:scale-95 text-white font-black text-xs shadow-md shadow-rose-950/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '등록 중...' : '경계대상 등록'}
            </button>
          </div>
        </form>

        {/* 중복된 아이디 알림 팝업 Modal */}
        {duplicateTarget && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="duplicate-dialog-title"
            className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in"
          >
            <div className="bg-slate-900 border border-amber-500/70 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl shadow-amber-950/60 p-5 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>

              <h3 id="duplicate-dialog-title" className="text-base font-black text-white mb-1">
                중복된 아이디 안내
              </h3>
              <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                입력하신 <span className="font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-500/40">'{duplicateTarget.targetId}'</span>(은)는<br />
                이미 경계 대상 목록에 등록되어 있습니다.
              </p>

              {/* 기존 등록 정보 요약 */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 text-left text-xs space-y-1.5 mb-4 shadow-inner">
                <div className="flex justify-between items-center text-slate-400">
                  <span>등록 일자</span>
                  <span className="font-mono text-slate-200">{duplicateTarget.createdAt}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>등록자</span>
                  <span className="font-semibold text-slate-200">{duplicateTarget.createdBy}</span>
                </div>
                {duplicateTarget.memo && (
                  <div className="pt-1.5 border-t border-slate-800/80 text-slate-400">
                    <span className="block text-[11px] text-slate-500 mb-0.5">기존 등록 사유:</span>
                    <p className="text-slate-300 break-words line-clamp-2">{duplicateTarget.memo}</p>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-400 mb-4">
                동일한 아이디는 중복 등록할 수 없습니다.<br />
                아래 버튼을 눌러 아이디를 확인 후 수정해주세요.
              </p>

              <button
                type="button"
                onClick={handleDismissDuplicate}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:scale-95 text-slate-950 font-black text-xs shadow-md shadow-amber-950/40 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>아이디 수정하기</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
