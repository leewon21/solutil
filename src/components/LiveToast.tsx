import { useEffect } from 'react';
import { Swords, X, Bell, Info } from 'lucide-react';

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type?: 'kill' | 'spawn' | 'info';
}

interface LiveToastProps {
  toasts: ToastMessage[];
  onRemoveToast: (id: string) => void;
}

export function LiveToast({ toasts, onRemoveToast }: LiveToastProps) {
  useEffect(() => {
    if (toasts.length > 0) {
      const timer = setTimeout(() => {
        onRemoveToast(toasts[0].id);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toasts, onRemoveToast]);

  if (toasts.length === 0) return null;

  // Show at most 2 recent toasts to avoid covering list controls
  const visibleToasts = toasts.slice(-2);

  return (
    <div className="fixed bottom-3 right-3 z-50 flex flex-col gap-1.5 max-w-[280px] sm:max-w-[310px] w-auto pointer-events-none">
      {visibleToasts.map((toast) => {
        const isKill = toast.type === 'kill';
        const isSpawn = toast.type === 'spawn';

        const borderColor = isKill
          ? 'border-rose-500/70 shadow-rose-950/40'
          : isSpawn
          ? 'border-amber-500/70 shadow-amber-950/40'
          : 'border-slate-700/80 shadow-slate-950/40';

        const iconBg = isKill
          ? 'bg-rose-950/80 border-rose-700/60 text-rose-400'
          : isSpawn
          ? 'bg-amber-950/80 border-amber-700/60 text-amber-400'
          : 'bg-slate-800/80 border-slate-700/60 text-cyan-400';

        const titleColor = isKill
          ? 'text-rose-300'
          : isSpawn
          ? 'text-amber-300'
          : 'text-cyan-300';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-2.5 rounded-xl bg-slate-900/95 border ${borderColor} shadow-lg backdrop-blur-md flex items-start gap-2.5 text-slate-100 transition-all duration-200 animate-in slide-in-from-bottom-3 fade-in`}
          >
            <div className={`p-1.5 rounded-lg border ${iconBg} shrink-0 mt-0.5`}>
              {isKill ? (
                <Swords className="w-3.5 h-3.5" />
              ) : isSpawn ? (
                <Bell className="w-3.5 h-3.5 animate-pulse" />
              ) : (
                <Info className="w-3.5 h-3.5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <h4 className={`text-[11px] font-black ${titleColor} tracking-tight truncate`}>
                  {toast.title}
                </h4>
                <span className="text-[9px] text-slate-500 font-mono shrink-0">
                  {new Date(toast.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium leading-tight mt-0.5 break-words line-clamp-2">
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => onRemoveToast(toast.id)}
              className="p-1 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0 -mr-1 -mt-0.5"
              aria-label="알림 닫기"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
