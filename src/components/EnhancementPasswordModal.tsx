import { useState, type FormEvent, useEffect, useRef } from 'react';
import { X, Lock, KeyRound, AlertTriangle } from 'lucide-react';
import { EnhancementRequestGroup } from '../types';

interface EnhancementPasswordModalProps {
  isOpen: boolean;
  request: EnhancementRequestGroup | null;
  actionType: 'EDIT' | 'DELETE';
  onClose: () => void;
  onSuccess: (request: EnhancementRequestGroup) => void;
}

export function EnhancementPasswordModal({
  isOpen,
  request,
  actionType,
  onClose,
  onSuccess,
}: EnhancementPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen || !request) return null;

  const isSample = request?.id === 'req-sample-1' || request?.id === 'req-sample-2';

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('비밀번호를 입력해주세요.');
      return;
    }

    const isMatch = password.trim() === request.password.trim() || (isSample && password.trim() === '0000');

    if (!isMatch) {
      setError('비밀번호가 일치하지 않습니다. 등록한 본인만 수정/삭제할 수 있습니다.');
      return;
    }

    // Ensure the password passed on edit is '0000' for sample requests
    const resolvedRequest = isSample ? { ...request, password: '0000' } : request;
    onSuccess(resolvedRequest);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl p-5 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">
                {actionType === 'EDIT' ? '수정 비밀번호 확인' : '삭제 비밀번호 확인'}
              </h3>
              <p className="text-[11px] text-slate-400">
                요청자: <span className="text-purple-300 font-bold">{request.userId}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="pt-4 space-y-3.5">
          {error && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-medium flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between flex-wrap gap-1">
              <span>등록 시 설정한 비밀번호를 입력해주세요</span>
              {isSample && (
                <span className="text-amber-400 font-bold font-mono text-[11px] bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30">
                  예시 비밀번호: 0000
                </span>
              )}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <KeyRound className="w-4 h-4 text-slate-400" />
              </div>
              <input
                ref={inputRef}
                id="enhancement-verify-password-input"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="비밀번호 입력"
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              id="cancel-password-verify-button"
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              id="confirm-password-verify-button"
              type="submit"
              className={`px-4 py-1.5 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer ${
                actionType === 'DELETE'
                  ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/50'
                  : 'bg-amber-600 hover:bg-amber-500 shadow-amber-950/50 text-slate-950 font-black'
              }`}
            >
              {actionType === 'DELETE' ? '확인 및 삭제' : '확인 및 수정'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
