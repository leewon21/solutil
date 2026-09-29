import { useState, useEffect, type FormEvent } from 'react';
import { X, Shield, Save, Clock, MapPin } from 'lucide-react';
import { BossItem } from '../types';

interface BossFormModalProps {
  isOpen: boolean;
  bossToEdit: BossItem | null;
  isServerBoss?: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    region: string;
    channel: string;
    respawnMinutes: number;
    notes: string;
    difficulty: 'SS' | 'S' | 'A' | 'B';
    spawnTimes?: string[];
  }) => Promise<void>;
}

const SPAWN_TIME_OPTIONS = ['09:00', '12:00', '21:00', '24:00'];

export function BossFormModal({ isOpen, bossToEdit, isServerBoss = false, onClose, onSave }: BossFormModalProps) {
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [respawnHours, setRespawnHours] = useState(1);
  const [respawnMins, setRespawnMins] = useState(0);
  const [spawnTimes, setSpawnTimes] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (bossToEdit) {
      setName(bossToEdit.name);
      setRegion(bossToEdit.region);
      setRespawnHours(Math.floor(bossToEdit.respawnMinutes / 60));
      setRespawnMins(bossToEdit.respawnMinutes % 60);
      setSpawnTimes(bossToEdit.spawnTimes || []);
    } else {
      setName('');
      setRegion('');
      setRespawnHours(1);
      setRespawnMins(0);
      setSpawnTimes([]);
    }
    setError(null);
  }, [bossToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('명칭을 입력해주세요.');
      return;
    }
    if (!region.trim()) {
      setError('출현 지역을 입력해주세요.');
      return;
    }
    const totalMinutes = isServerBoss 
      ? (bossToEdit?.respawnMinutes || 60) 
      : (respawnHours * 60 + respawnMins);

    if (!isServerBoss && totalMinutes <= 0) {
      setError('리젠 시간은 최소 1분 이상이어야 합니다.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        region: region.trim(),
        channel: bossToEdit?.channel || '1채널',
        respawnMinutes: totalMinutes,
        notes: bossToEdit?.notes || '',
        difficulty: bossToEdit?.difficulty || 'S',
        spawnTimes: isServerBoss ? spawnTimes : undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyPreset = (presetName: string, presetRegion: string = '', h: number = 1, m: number = 0) => {
    setName(presetName);
    setRegion(presetRegion);
    setRespawnHours(h);
    setRespawnMins(m);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-black text-white">
              {bossToEdit 
                ? (isServerBoss ? '서버 보스 정보 수정' : '지역 정보 및 리젠 주기 수정') 
                : (isServerBoss ? '신규 서버 보스 등록' : '신규 지역 등록')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets (서버 보스 등록 시 비활성화/숨김) */}
        {!isServerBoss && !bossToEdit && (
          <div className="my-4 p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-semibold">
                신규 지역 등록 유형 프리셋:
              </span>
              <span className="text-[11px] text-cyan-400/80">
                선택 시 명칭 &amp; 리젠 주기 자동 세팅 (출현 지역 직접 입력)
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyPreset('신을 버린자', '', 1, 0)}
                className="px-3 py-1.5 rounded-lg bg-cyan-950 border border-cyan-500/40 text-cyan-300 text-xs font-semibold hover:bg-cyan-900 transition-colors cursor-pointer"
              >
                신을 버린자 (1시간)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('창조의 핵', '', 1, 0)}
                className="px-3 py-1.5 rounded-lg bg-indigo-950 border border-indigo-500/40 text-indigo-300 text-xs font-semibold hover:bg-indigo-900 transition-colors cursor-pointer"
              >
                창조의 핵 (1시간)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('신의탑 상자', '', 6, 0)}
                className="px-3 py-1.5 rounded-lg bg-amber-950 border border-amber-500/40 text-amber-300 text-xs font-semibold hover:bg-amber-900 transition-colors cursor-pointer"
              >
                신의탑 상자 (6시간)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('생명의 트리', '', 8, 0)}
                className="px-3 py-1.5 rounded-lg bg-emerald-950 border border-emerald-500/40 text-emerald-300 text-xs font-semibold hover:bg-emerald-900 transition-colors cursor-pointer"
              >
                생명의 트리 (8시간)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('리퍼', '', 1, 0)}
                className="px-3 py-1.5 rounded-lg bg-rose-950 border border-rose-500/40 text-rose-300 text-xs font-semibold hover:bg-rose-900 transition-colors cursor-pointer"
              >
                리퍼 (1시간)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('드레이크', '', 1, 0)}
                className="px-3 py-1.5 rounded-lg bg-emerald-950 border border-emerald-500/40 text-emerald-300 text-xs font-semibold hover:bg-emerald-900 transition-colors cursor-pointer"
              >
                드레이크 (1시간)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('라자엘', '', 1, 0)}
                className="px-3 py-1.5 rounded-lg bg-indigo-950 border border-indigo-500/40 text-indigo-300 text-xs font-semibold hover:bg-indigo-900 transition-colors cursor-pointer"
              >
                라자엘 (1시간)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('아리엘', '', 1, 0)}
                className="px-3 py-1.5 rounded-lg bg-violet-950 border border-violet-500/40 text-violet-300 text-xs font-semibold hover:bg-violet-900 transition-colors cursor-pointer"
              >
                아리엘 (1시간)
              </button>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              명칭 *
            </label>
            <input
              id="boss-form-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 신을 버린자, 창조의 핵, 신의탑 상자, 리퍼, 드레이크, 라자엘, 아리엘"
              className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              출현 지역 *
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                id="boss-form-region"
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="출현 지역 입력"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                required
              />
            </div>
          </div>

          {/* Server Boss: 젠시간 Checkboxes (09:00, 12:00, 21:00, 24:00) */}
          {isServerBoss && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-amber-300">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>젠시간 (출현 타임 선택)</span>
                </span>
                <span className="text-[11px] text-slate-400 font-normal">
                  (09:00 / 12:00 / 21:00 / 24:00)
                </span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {SPAWN_TIME_OPTIONS.map((time) => {
                  const isChecked = spawnTimes.includes(time);
                  return (
                    <label
                      key={time}
                      id={`boss-form-spawn-time-${time.replace(':', '')}`}
                      className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-all select-none ${
                        isChecked
                          ? 'bg-amber-950/60 border-amber-500/80 text-amber-200 font-bold shadow-sm shadow-amber-950/40 ring-1 ring-amber-500/40'
                          : 'bg-slate-950/80 border-slate-700/80 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSpawnTimes([...spawnTimes, time].sort());
                          } else {
                            setSpawnTimes(spawnTimes.filter((t) => t !== time));
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-400/40 bg-slate-900 cursor-pointer accent-amber-500"
                      />
                      <span className="text-xs sm:text-sm font-mono tracking-wider">{time}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Respawn Cycle Time Inputs (서버 보스에서는 숨김) */}
          {!isServerBoss && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                리젠 주기 (처치 후 부활까지 걸리는 시간) *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2">
                  <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                  <input
                    id="boss-form-hours"
                    type="number"
                    min="0"
                    max="168"
                    value={respawnHours}
                    onChange={(e) => setRespawnHours(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-transparent text-sm text-white font-mono focus:outline-none"
                  />
                  <span className="text-xs text-slate-400 shrink-0">시간</span>
                </div>

                <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2">
                  <input
                    id="boss-form-minutes"
                    type="number"
                    min="0"
                    max="59"
                    value={respawnMins}
                    onChange={(e) => setRespawnMins(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-transparent text-sm text-white font-mono focus:outline-none"
                  />
                  <span className="text-xs text-slate-400 shrink-0">분</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                총 {respawnHours * 60 + respawnMins}분 후 자동 리젠 시간 계산
              </p>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              취소
            </button>
            <button
              id="boss-form-submit-button"
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white text-xs font-bold shadow-md shadow-cyan-950/50 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{bossToEdit ? '수정 내용 저장' : '추가하기'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
