import { useState, type FormEvent } from 'react';
import { X, Settings, Volume2, Shield, Bell, Megaphone, Check } from 'lucide-react';
import { GuildConfig, AlarmSettings } from '../types';
import { soundService, requestNotificationPermission } from '../utils/audioAlerts';

interface GuildSettingsModalProps {
  isOpen: boolean;
  guildConfig: GuildConfig;
  alarmSettings: AlarmSettings;
  onClose: () => void;
  onSaveGuildConfig: (config: { guildName?: string; guildPassword?: string; announcement?: string }) => Promise<void>;
  onUpdateAlarmSettings: (settings: Partial<AlarmSettings>) => void;
}

export function GuildSettingsModal({
  isOpen,
  guildConfig,
  alarmSettings,
  onClose,
  onSaveGuildConfig,
  onUpdateAlarmSettings,
}: GuildSettingsModalProps) {
  const [guildName, setGuildName] = useState(guildConfig.guildName);
  const [guildPassword, setGuildPassword] = useState('');
  const [announcement, setAnnouncement] = useState(guildConfig.announcement);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSaveConfig = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMsg(null);
    try {
      await onSaveGuildConfig({
        guildName: guildName.trim() || undefined,
        guildPassword: guildPassword.trim() || undefined,
        announcement: announcement.trim(),
      });
      setSuccessMsg('길드 설정이 성공적으로 저장되었습니다!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestSound = (type: 'ping' | 'warning' | 'horn' | 'tts') => {
    if (type === 'ping') soundService.playPing(alarmSettings.volume);
    if (type === 'warning') soundService.playWarningAlarm(alarmSettings.volume);
    if (type === 'horn') soundService.playSpawnAlarm(alarmSettings.volume);
    if (type === 'tts') soundService.speak('신을 버린자 리젠 1분 전입니다. 태초의 성소로 집결하세요.');
  };

  const handleTogglePush = async () => {
    if (!alarmSettings.browserNotificationEnabled) {
      const granted = await requestNotificationPermission();
      onUpdateAlarmSettings({ browserNotificationEnabled: granted });
    } else {
      onUpdateAlarmSettings({ browserNotificationEnabled: false });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-black text-white">길드 설정 및 알람 환경설정</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {successMsg && (
          <div className="my-3 p-3 bg-emerald-950/60 border border-emerald-700 text-emerald-200 text-xs rounded-xl flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Section 1: Sound and Push Notifications */}
        <div className="py-4 border-b border-slate-800 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <Bell className="w-4 h-4" />
            <span>실시간 알람 및 사운드 설정</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center justify-between p-3 bg-slate-950/70 border border-slate-800 rounded-xl cursor-pointer">
              <span className="text-xs font-semibold text-slate-200">사운드 알람</span>
              <input
                type="checkbox"
                checked={alarmSettings.soundEnabled}
                onChange={(e) => onUpdateAlarmSettings({ soundEnabled: e.target.checked })}
                className="w-4 h-4 accent-cyan-500 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-slate-950/70 border border-slate-800 rounded-xl cursor-pointer">
              <span className="text-xs font-semibold text-slate-200">브라우저 푸시 알림</span>
              <input
                type="checkbox"
                checked={alarmSettings.browserNotificationEnabled}
                onChange={handleTogglePush}
                className="w-4 h-4 accent-cyan-500 rounded"
              />
            </label>
          </div>

          {/* Timing toggles */}
          <div className="space-y-2">
            <span className="text-xs text-slate-400 block font-medium">알람 발생 타이밍:</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <label className="flex items-center gap-1.5 text-xs text-slate-300 p-2 bg-slate-950/40 border border-slate-800/80 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={alarmSettings.alertAt10Min}
                  onChange={(e) => onUpdateAlarmSettings({ alertAt10Min: e.target.checked })}
                  className="accent-cyan-500 rounded"
                />
                <span>10분 전</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-300 p-2 bg-slate-950/40 border border-slate-800/80 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={alarmSettings.alertAt5Min}
                  onChange={(e) => onUpdateAlarmSettings({ alertAt5Min: e.target.checked })}
                  className="accent-cyan-500 rounded"
                />
                <span>5분 전</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-300 p-2 bg-slate-950/40 border border-slate-800/80 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={alarmSettings.alertAt1Min}
                  onChange={(e) => onUpdateAlarmSettings({ alertAt1Min: e.target.checked })}
                  className="accent-cyan-500 rounded"
                />
                <span>1분 전</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-300 p-2 bg-slate-950/40 border border-slate-800/80 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={alarmSettings.alertAtSpawn}
                  onChange={(e) => onUpdateAlarmSettings({ alertAtSpawn: e.target.checked })}
                  className="accent-cyan-500 rounded"
                />
                <span>리젠 완료 즉시</span>
              </label>
            </div>
          </div>

          {/* Sound Testing Buttons */}
          <div>
            <span className="text-xs text-slate-400 block mb-2 font-medium">효과음 사전 테스트:</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleTestSound('ping')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
              >
                🔔 기록 알림음
              </button>
              <button
                type="button"
                onClick={() => handleTestSound('warning')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-amber-300 cursor-pointer"
              >
                ⚠️ 임박 사이렌
              </button>
              <button
                type="button"
                onClick={() => handleTestSound('horn')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-rose-300 cursor-pointer"
              >
                🎺 리젠 뿔나팔
              </button>
              <button
                type="button"
                onClick={() => handleTestSound('tts')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-cyan-300 cursor-pointer"
              >
                🗣️ 한국어 음성
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: Guild Information & Security */}
        <form onSubmit={handleSaveConfig} className="py-4 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <Shield className="w-4 h-4" />
            <span>길드 정보 및 비밀번호 관리</span>
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              길드 명칭
            </label>
            <input
              type="text"
              value={guildName}
              onChange={(e) => setGuildName(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              새 길드 비밀번호 (변경 시에만 입력)
            </label>
            <input
              type="password"
              value={guildPassword}
              onChange={(e) => setGuildPassword(e.target.value)}
              placeholder="변경하지 않으려면 공란으로 두세요"
              className="w-full px-3.5 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              상단 길드 공지 문구
            </label>
            <div className="relative">
              <Megaphone className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
              <textarea
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                rows={2}
                className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              닫기
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white text-xs font-bold shadow-md shadow-cyan-950/50 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? '저장중...' : '설정 저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
