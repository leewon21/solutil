import { useState, useEffect, useRef } from 'react';
import { X, Edit3, Lock, ShieldAlert, FileText, UserPlus, AlertTriangle } from 'lucide-react';
import { HostileTarget } from '../types';

interface EditHostileModalProps {
  isOpen: boolean;
  target: HostileTarget | null;
  onClose: () => void;
  onSave: (target: HostileTarget) => Promise<void> | void;
  adminPassword?: string;
  existingTargets?: HostileTarget[];
}

export function EditHostileModal({
  isOpen,
  target,
  onClose,
  onSave,
  adminPassword = '0606',
  existingTargets = [],
}: EditHostileModalProps) {
  const [targetId, setTargetId] = useState('');
  const [memo, setMemo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && target) {
      setTargetId(target.targetId);
      setMemo(target.memo || '');
      setPassword('');
      setError('');
      setIsSubmitting(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, target]);

  if (!isOpen || !target) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedId = targetId.trim();

    if (!trimmedId) {
      setError('경계 대상 아이디를 입력해주세요.');
      inputRef.current?.focus();
      return;
    }

    // Check if new targetId is already used by another target
    const isDuplicate = existingTargets.some(
      (t) => t.id !== target.id && t.targetId.trim().toLowerCase() === trimmedId.toLowerCase()
    );
    if (isDuplicate) {
      setError(`'${trimmedId}'(은)는 이미 등록되어 있는 다른 경계 대상의 아이디입니다.`);
      inputRef.current?.focus();
      return;
    }

    if (!password) {
      setError('운영자 비밀번호를 입력해주세요.');
      return;
    }

    // Verify admin password
    const entered = password.trim();
    const expected = (adminPassword || '0606').trim();
    if (entered !== expected && password !== (adminPassword || '0606')) {
      setError('운영자 비밀번호가 일치하지 않습니다.');
      setPassword('');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      await onSave({
        ...target,
        targetId: trimmedId,
        memo: memo.trim() || undefined,
      });

      onClose();
    } catch (err: any) {
      setError(err?.message || '경계 대상 수정 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-hostile-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl shadow-amber-950/40">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-400">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="edit-hostile-title" className="text-base sm:text-lg font-black text-white">
                경계대상 정보 수정
              </h2>
              <p className="text-xs text-slate-400">
                수정 권한 확인을 위해 운영자 비밀번호를 입력해주세요.
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
                }}
                placeholder="적대 캐릭터명 또는 유저 아이디 입력"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors"
                maxLength={40}
              />
            </div>
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
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors resize-none"
                maxLength={100}
              />
            </div>
          </div>

          {/* Meta Info (등록일자 / 등록자) */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-xs text-slate-400 space-y-1.5">
            <div className="flex items-center justify-between">
              <span>최초 등록일자</span>
              <span className="font-mono text-slate-300">{target.createdAt}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
              <span>최초 등록자</span>
              <span className="font-semibold text-slate-200">{target.createdBy}</span>
            </div>
          </div>

          {/* 운영자 비밀번호 Input */}
          <div className="pt-1">
            <label className="block text-xs font-bold text-amber-300 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>운영자 비밀번호 인증</span> <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="운영자 비밀번호 입력"
                className="w-full bg-slate-950 border border-amber-500/40 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors"
                autoComplete="off"
              />
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
              disabled={isSubmitting || !targetId.trim() || !password}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:scale-95 text-slate-950 font-black text-xs shadow-md shadow-amber-950/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '수정 중...' : '수정 완료'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
