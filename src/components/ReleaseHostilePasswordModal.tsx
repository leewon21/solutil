import { useState, useEffect, useRef } from 'react';
import { X, Lock, ShieldAlert, KeyRound, AlertTriangle } from 'lucide-react';
import { HostileTarget } from '../types';

interface ReleaseHostilePasswordModalProps {
  isOpen: boolean;
  target: HostileTarget | null;
  onClose: () => void;
  onConfirm: (targetId: string) => Promise<void> | void;
  adminPassword?: string;
}

export function ReleaseHostilePasswordModal({
  isOpen,
  target,
  onClose,
  onConfirm,
  adminPassword = '0606',
}: ReleaseHostilePasswordModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError('');
      setIsSubmitting(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen || !target) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('운영자 비밀번호를 입력해주세요.');
      inputRef.current?.focus();
      return;
    }

    // Verify password against adminPassword (defaults to '0606')
    const entered = password.trim();
    const expected = (adminPassword || '0606').trim();
    if (entered !== expected && password !== (adminPassword || '0606')) {
      setError('운영자 비밀번호가 일치하지 않습니다.');
      setPassword('');
      inputRef.current?.focus();
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      await onConfirm(target.id);
      onClose();
    } catch (err: any) {
      setError(err?.message || '경계 해제 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="release-hostile-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-rose-950/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 id="release-hostile-title" className="text-base sm:text-lg font-black text-white">
                경계해제 - 운영자 인증
              </h2>
              <p className="text-xs text-slate-400">
                삭제 권한 확인을 위해 운영자 비밀번호를 입력해주세요.
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

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {/* Target Info Summary */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">경계대상 아이디</span>
              <span className="text-sm font-extrabold text-rose-400 tracking-wide">
                {target.targetId}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-800/80">
              <span className="text-slate-400">등록일자</span>
              <span className="text-slate-300 font-mono">{target.createdAt}</span>
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
              <span className="text-slate-400">등록자</span>
              <span className="text-slate-300 font-medium">{target.createdBy}</span>
            </div>
            {target.memo && (
              <div className="text-xs pt-1 border-t border-slate-800/60 text-slate-400">
                <span className="text-slate-500">사유:</span> {target.memo}
              </div>
            )}
          </div>

          {/* Warning Note */}
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>경계해제 시 해당 대상은 목록에서 즉시 영구 삭제됩니다.</span>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/60 text-rose-200 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Password Input */}
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1.5">
              운영자 비밀번호
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="운영자 비밀번호 입력"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors"
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
              disabled={isSubmitting || !password}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 active:scale-95 text-white font-black text-xs shadow-md shadow-rose-950/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '처리 중...' : '경계해제 확인'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
