import React, { useState, useMemo, useRef } from 'react';
import {
  Trophy,
  Medal,
  Crown,
  Swords,
  Shield,
  FileSpreadsheet,
  Calendar,
  RotateCcw,
  User,
  Flame,
  Search,
  Award,
  ChevronRight,
  Sparkles,
  Info,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SsuljaEventRecord } from '../types';

interface SsuljaRankingSectionProps {
  records: SsuljaEventRecord[];
  currentUserId?: string;
  onAddToast?: (title: string, message: string, type?: 'kill' | 'spawn' | 'info') => void;
}

export interface ParticipantRanking {
  rank: number;
  uploaderId: string;
  killCount: number;
  assistCount: number;
  totalCount: number;
  lastActiveTime: string;
  killRatio: number; // percentage
  assistRatio: number; // percentage
}

type PeriodPreset = 'ALL' | 'TODAY' | 'YESTERDAY' | '3DAYS' | '7DAYS' | 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM';

// Helper to format Date to YYYY-MM-DD
function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Robust record date extractor
function parseRecordDate(record: SsuljaEventRecord): Date | null {
  const dateStr = record.occurredAt?.trim() || record.uploadedAt?.trim() || '';
  if (!dateStr) return null;

  // Replace slashes or dots: e.g. "2026/09/28 14:20" -> "2026-09-28 14:20"
  const normalized = dateStr.replace(/\./g, '-').replace(/\//g, '-').trim();
  const d = new Date(normalized);
  if (!isNaN(d.getTime())) return d;

  const match = normalized.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    const parsed = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    );
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

export function SsuljaRankingSection({
  records,
  currentUserId,
  onAddToast,
}: SsuljaRankingSectionProps) {
  // Preset and custom date filters
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchUploader, setSearchUploader] = useState<string>('');

  const startDateInputRef = useRef<HTMLInputElement>(null);
  const endDateInputRef = useRef<HTMLInputElement>(null);

  // Handle Preset changes
  const handleSelectPreset = (preset: PeriodPreset) => {
    setPeriodPreset(preset);
    const now = new Date();
    const todayStr = formatDate(now);

    switch (preset) {
      case 'ALL':
        setStartDate('');
        setEndDate('');
        break;
      case 'TODAY':
        setStartDate(todayStr);
        setEndDate(todayStr);
        break;
      case 'YESTERDAY': {
        const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const yStr = formatDate(y);
        setStartDate(yStr);
        setEndDate(yStr);
        break;
      }
      case '3DAYS': {
        const d3 = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
        setStartDate(formatDate(d3));
        setEndDate(todayStr);
        break;
      }
      case '7DAYS': {
        const d7 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        setStartDate(formatDate(d7));
        setEndDate(todayStr);
        break;
      }
      case 'THIS_WEEK': {
        // Monday as start of week
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(now.setDate(diff));
        setStartDate(formatDate(monday));
        setEndDate(todayStr);
        break;
      }
      case 'THIS_MONTH': {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        setStartDate(formatDate(firstDay));
        setEndDate(todayStr);
        break;
      }
      case 'LAST_MONTH': {
        const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        setStartDate(formatDate(firstDayLastMonth));
        setEndDate(formatDate(lastDayLastMonth));
        break;
      }
      case 'CUSTOM':
        // Keep whatever start/end date user has or current month
        if (!startDate) {
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
          setStartDate(formatDate(firstDay));
        }
        if (!endDate) {
          setEndDate(todayStr);
        }
        break;
    }
  };

  // Filter records by period
  const periodFilteredRecords = useMemo(() => {
    return records.filter((rec) => {
      // If no start and end date specified, return all
      if (!startDate && !endDate) return true;

      const recDate = parseRecordDate(rec);
      if (!recDate) return true; // If date cannot be parsed, include by default

      const recTimestamp = recDate.getTime();

      if (startDate) {
        const start = new Date(`${startDate}T00:00:00`).getTime();
        if (recTimestamp < start) return false;
      }

      if (endDate) {
        const end = new Date(`${endDate}T23:59:59.999`).getTime();
        if (recTimestamp > end) return false;
      }

      return true;
    });
  }, [records, startDate, endDate]);

  // Compute rankings aggregated by "uploaderId"
  const rankings: ParticipantRanking[] = useMemo(() => {
    const aggMap: Record<
      string,
      {
        uploaderId: string;
        killCount: number;
        assistCount: number;
        totalCount: number;
        lastActiveTime: string;
      }
    > = {};

    periodFilteredRecords.forEach((r) => {
      const uploader = r.uploaderId?.trim() || '익명 참여자';
      if (!aggMap[uploader]) {
        aggMap[uploader] = {
          uploaderId: uploader,
          killCount: 0,
          assistCount: 0,
          totalCount: 0,
          lastActiveTime: r.occurredAt || r.uploadedAt || '',
        };
      }

      if (r.contributionType === '처치') {
        aggMap[uploader].killCount += 1;
      } else if (r.contributionType === '도움') {
        aggMap[uploader].assistCount += 1;
      }
      aggMap[uploader].totalCount += 1;

      // Track most recent active time
      if (r.occurredAt && r.occurredAt > aggMap[uploader].lastActiveTime) {
        aggMap[uploader].lastActiveTime = r.occurredAt;
      }
    });

    // Sort by totalCount descending, secondary by killCount descending
    const sortedList = Object.values(aggMap).sort((a, b) => {
      if (b.totalCount !== a.totalCount) {
        return b.totalCount - a.totalCount;
      }
      if (b.killCount !== a.killCount) {
        return b.killCount - a.killCount;
      }
      return a.uploaderId.localeCompare(b.uploaderId);
    });

    // Assign rank (handling ties if desired or sequential rank)
    let currentRank = 1;
    return sortedList.map((item, index) => {
      if (index > 0) {
        const prev = sortedList[index - 1];
        if (item.totalCount === prev.totalCount && item.killCount === prev.killCount) {
          // tie rank: same as prev
          // or sequential rank. Sequential with medal grouping is clean and standard
        }
      }
      currentRank = index + 1;

      const killRatio = item.totalCount > 0 ? Math.round((item.killCount / item.totalCount) * 100) : 0;
      const assistRatio = item.totalCount > 0 ? Math.round((item.assistCount / item.totalCount) * 100) : 0;

      return {
        ...item,
        rank: currentRank,
        killRatio,
        assistRatio,
      };
    });
  }, [periodFilteredRecords]);

  // Filter rankings by search keyword
  const displayedRankings = useMemo(() => {
    if (!searchUploader.trim()) return rankings;
    const query = searchUploader.trim().toLowerCase();
    return rankings.filter((r) => r.uploaderId.toLowerCase().includes(query));
  }, [rankings, searchUploader]);

  // Overall statistics for the selected period
  const periodStats = useMemo(() => {
    const totalRecords = periodFilteredRecords.length;
    const totalKills = periodFilteredRecords.filter((r) => r.contributionType === '처치').length;
    const totalAssists = periodFilteredRecords.filter((r) => r.contributionType === '도움').length;
    const participantCount = rankings.length;
    const topParticipant = rankings[0] || null;

    return {
      totalRecords,
      totalKills,
      totalAssists,
      participantCount,
      topParticipant,
    };
  }, [periodFilteredRecords, rankings]);

  // Excel Export Handler (.xlsx)
  const handleExportExcel = () => {
    if (rankings.length === 0) {
      onAddToast?.('다운로드 불가', '내보낼 순위 데이터가 없습니다.', 'info');
      return;
    }

    const periodLabel = startDate || endDate
      ? `${startDate || '처음'} ~ ${endDate || '현재'}`
      : '전체 누적 기간';

    // Format Excel Data
    const exportRows = rankings.map((item) => ({
      순위: `${item.rank}위`,
      '업로더(참여자) 아이디': item.uploaderId,
      '처치 건수': item.killCount,
      '도움 건수': item.assistCount,
      '합계 건수': item.totalCount,
      '처치 비율': `${item.killRatio}%`,
      '도움 비율': `${item.assistRatio}%`,
      '최근 활동 일시': item.lastActiveTime || '-',
      집계기간: periodLabel,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 8 },  // 순위
      { wch: 22 }, // 업로더(참여자) 아이디
      { wch: 12 }, // 처치 건수
      { wch: 12 }, // 도움 건수
      { wch: 14 }, // 합계 건수
      { wch: 12 }, // 처치 비율
      { wch: 12 }, // 도움 비율
      { wch: 20 }, // 최근 활동 일시
      { wch: 26 }, // 집계기간
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '기간별_순위');

    const fileDateStr = startDate && endDate
      ? `${startDate}_${endDate}`
      : new Date().toISOString().split('T')[0];

    XLSX.writeFile(workbook, `썰자이벤트_기간별순위_${fileDateStr}.xlsx`);

    onAddToast?.(
      '엑셀 다운로드 완료',
      `총 ${rankings.length}명의 참여자 순위 데이터가 엑셀 파일로 저장되었습니다.`,
      'kill'
    );
  };

  // Find current user's rank
  const myRanking = useMemo(() => {
    if (!currentUserId) return null;
    return rankings.find((r) => r.uploaderId.toLowerCase() === currentUserId.toLowerCase()) || null;
  }, [rankings, currentUserId]);

  const periodDisplayString = useMemo(() => {
    if (!startDate && !endDate) return '전체 누적 기간';
    if (startDate && !endDate) return `${startDate} ~ 현재`;
    if (!startDate && endDate) return `처음 ~ ${endDate}`;
    if (startDate === endDate) return `${startDate} (당일)`;
    return `${startDate} ~ ${endDate}`;
  }, [startDate, endDate]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner / Card */}
      <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>기간별 썰자 기여도 순위 집계 대시보드</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <span>기간별 순위 보기</span>
              <span className="text-sm font-normal text-amber-300/80">
                ({periodDisplayString})
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              특정 기간을 설정하면 해당 기간 동안 발생한 썰자 내역을 자동 집계하여
              <strong className="text-white"> 업로더(참여자) 아이디, 처치 건수, 도움 건수, 합계 건수</strong> 순으로 자동 정렬하여 표시합니다.
            </p>
          </div>

          {/* Excel Export Button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={rankings.length === 0}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all shadow-lg ${
                rankings.length > 0
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white cursor-pointer shadow-emerald-950/50 hover:scale-105 active:scale-95'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              }`}
              title="현재 순위 표를 엑셀 파일로 다운로드합니다"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span>순위 엑셀 다운로드 (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Selected Period Stats Mini Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-purple-400" />
              <span>총 참여 인원</span>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl sm:text-2xl font-black text-purple-300 font-mono">
                {periodStats.participantCount}
              </span>
              <span className="text-xs text-slate-400">명</span>
            </div>
          </div>

          <div className="bg-slate-950/70 border border-cyan-500/30 rounded-xl p-3">
            <div className="text-[11px] text-cyan-400 font-bold flex items-center gap-1.5">
              <Swords className="w-3.5 h-3.5" />
              <span>기간 내 처치 (Kill)</span>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl sm:text-2xl font-black text-cyan-300 font-mono">
                {periodStats.totalKills}
              </span>
              <span className="text-xs text-cyan-400">건</span>
            </div>
          </div>

          <div className="bg-slate-950/70 border border-amber-500/30 rounded-xl p-3">
            <div className="text-[11px] text-amber-400 font-bold flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>기간 내 도움 (Assist)</span>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl sm:text-2xl font-black text-amber-300 font-mono">
                {periodStats.totalAssists}
              </span>
              <span className="text-xs text-amber-400">건</span>
            </div>
          </div>

          <div className="bg-slate-950/70 border border-rose-500/30 rounded-xl p-3">
            <div className="text-[11px] text-rose-400 font-bold flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5" />
              <span>기간 총 합계 건수</span>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl sm:text-2xl font-black text-rose-300 font-mono">
                {periodStats.totalRecords}
              </span>
              <span className="text-xs text-rose-400">건</span>
            </div>
          </div>
        </div>

        {/* Current user ranking highlight if found */}
        {myRanking && (
          <div className="mt-4 p-3 rounded-xl bg-purple-950/40 border border-purple-500/40 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-purple-500/30 text-purple-200 font-bold font-mono">
                내 순위
              </span>
              <span className="text-slate-200">
                <strong className="text-purple-300">{currentUserId}</strong> 님의 현재 순위는{' '}
                <strong className="text-amber-300 text-sm font-black">{myRanking.rank}위</strong> 입니다.
              </span>
            </div>
            <div className="flex items-center gap-3 text-slate-300 font-mono">
              <span>처치: <b className="text-cyan-400">{myRanking.killCount}</b>건</span>
              <span>도움: <b className="text-amber-400">{myRanking.assistCount}</b>건</span>
              <span>합계: <b className="text-rose-400 font-bold">{myRanking.totalCount}</b>건</span>
            </div>
          </div>
        )}
      </div>

      {/* Period Filter Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">집계 기간 설정</h3>
              <p className="text-xs text-slate-400">
                원하는 기간을 프리셋으로 빠르게 선택하거나 시작일과 종료일을 직접 입력하세요.
              </p>
            </div>
          </div>

          {/* Reset button */}
          {(startDate || endDate || periodPreset !== 'ALL') && (
            <button
              type="button"
              onClick={() => handleSelectPreset('ALL')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>전체 기간으로 초기화</span>
            </button>
          )}
        </div>

        {/* Preset Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
            빠른 기간:
          </span>
          {[
            { id: 'ALL', label: '전체 누적' },
            { id: 'TODAY', label: '오늘' },
            { id: 'YESTERDAY', label: '어제' },
            { id: '3DAYS', label: '최근 3일' },
            { id: '7DAYS', label: '최근 7일' },
            { id: 'THIS_WEEK', label: '이번 주' },
            { id: 'THIS_MONTH', label: '이번 달' },
            { id: 'LAST_MONTH', label: '지난 달' },
            { id: 'CUSTOM', label: '직접 지정' },
          ].map((preset) => {
            const isSelected = periodPreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset.id as PeriodPreset)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-950/40 ring-1 ring-amber-300 scale-105'
                    : 'bg-slate-950/70 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Date Inputs & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
          {/* Start Date */}
          <div className="sm:col-span-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>시작일</span>
              </label>
              {startDate && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setPeriodPreset('CUSTOM');
                  }}
                  className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-0.5"
                >
                  <X className="w-3 h-3" />
                  <span>초기화</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700/80 hover:border-amber-500/70 rounded-xl p-1.5 transition-all focus-within:border-amber-400 focus-within:ring-1 focus-within:ring-amber-400/40">
              <input
                ref={startDateInputRef}
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPeriodPreset('CUSTOM');
                }}
                className="w-full bg-transparent px-2.5 py-1 text-xs text-white font-mono focus:outline-none cursor-pointer [color-scheme:dark]"
              />
              <button
                type="button"
                onClick={() => {
                  try {
                    startDateInputRef.current?.showPicker?.();
                  } catch (e) {
                    startDateInputRef.current?.focus();
                  }
                }}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 hover:text-amber-200 text-[11px] font-bold transition-colors cursor-pointer shadow-sm"
                title="달력 열기"
              >
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>달력</span>
              </button>
            </div>
          </div>

          {/* End Date */}
          <div className="sm:col-span-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>종료일</span>
              </label>
              {endDate && (
                <button
                  type="button"
                  onClick={() => {
                    setEndDate('');
                    setPeriodPreset('CUSTOM');
                  }}
                  className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-0.5"
                >
                  <X className="w-3 h-3" />
                  <span>초기화</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700/80 hover:border-amber-500/70 rounded-xl p-1.5 transition-all focus-within:border-amber-400 focus-within:ring-1 focus-within:ring-amber-400/40">
              <input
                ref={endDateInputRef}
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPeriodPreset('CUSTOM');
                }}
                className="w-full bg-transparent px-2.5 py-1 text-xs text-white font-mono focus:outline-none cursor-pointer [color-scheme:dark]"
              />
              <button
                type="button"
                onClick={() => {
                  try {
                    endDateInputRef.current?.showPicker?.();
                  } catch (e) {
                    endDateInputRef.current?.focus();
                  }
                }}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 hover:text-amber-200 text-[11px] font-bold transition-colors cursor-pointer shadow-sm"
                title="달력 열기"
              >
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>달력</span>
              </button>
            </div>
          </div>

          {/* Search participant */}
          <div className="sm:col-span-4">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              참여자 아이디 검색
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchUploader}
                onChange={(e) => setSearchUploader(e.target.value)}
                placeholder="아이디 검색..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 placeholder-slate-500 transition-colors"
              />
              {searchUploader && (
                <button
                  type="button"
                  onClick={() => setSearchUploader('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Top 3 Podium Cards (If rankings exist) */}
      {rankings.length > 0 && !searchUploader && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 1st Place */}
          {rankings[0] && (
            <div className="bg-gradient-to-b from-amber-500/20 via-slate-900 to-slate-900 border-2 border-amber-500/50 rounded-2xl p-4 relative overflow-hidden shadow-xl shadow-amber-950/20">
              <div className="absolute top-2 right-2 text-amber-500/20">
                <Crown className="w-16 h-16" />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-amber-400 text-slate-950 font-black flex items-center justify-center text-sm shadow-md">
                  🥇
                </div>
                <div>
                  <span className="text-[10px] uppercase font-black text-amber-400 tracking-wider">
                    1위 썰자 챔피언
                  </span>
                  <div className="text-base font-black text-white truncate max-w-[180px]">
                    {rankings[0].uploaderId}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-amber-500/20 text-center font-mono">
                <div className="bg-slate-950/60 rounded-lg p-1.5">
                  <div className="text-[10px] text-cyan-400">처치</div>
                  <div className="text-sm font-bold text-white">{rankings[0].killCount}</div>
                </div>
                <div className="bg-slate-950/60 rounded-lg p-1.5">
                  <div className="text-[10px] text-amber-400">도움</div>
                  <div className="text-sm font-bold text-white">{rankings[0].assistCount}</div>
                </div>
                <div className="bg-amber-500/20 border border-amber-500/40 rounded-lg p-1.5">
                  <div className="text-[10px] text-amber-300 font-bold">합계</div>
                  <div className="text-sm font-black text-amber-300">{rankings[0].totalCount}</div>
                </div>
              </div>
            </div>
          )}

          {/* 2nd Place */}
          {rankings[1] && (
            <div className="bg-gradient-to-b from-slate-400/20 via-slate-900 to-slate-900 border border-slate-600 rounded-2xl p-4 relative overflow-hidden shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-slate-300 text-slate-950 font-black flex items-center justify-center text-sm shadow-md">
                  🥈
                </div>
                <div>
                  <span className="text-[10px] uppercase font-black text-slate-300 tracking-wider">
                    2위 썰자 정예
                  </span>
                  <div className="text-base font-black text-white truncate max-w-[180px]">
                    {rankings[1].uploaderId}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-700 text-center font-mono">
                <div className="bg-slate-950/60 rounded-lg p-1.5">
                  <div className="text-[10px] text-cyan-400">처치</div>
                  <div className="text-sm font-bold text-white">{rankings[1].killCount}</div>
                </div>
                <div className="bg-slate-950/60 rounded-lg p-1.5">
                  <div className="text-[10px] text-amber-400">도움</div>
                  <div className="text-sm font-bold text-white">{rankings[1].assistCount}</div>
                </div>
                <div className="bg-slate-800/80 border border-slate-600 rounded-lg p-1.5">
                  <div className="text-[10px] text-slate-200 font-bold">합계</div>
                  <div className="text-sm font-black text-slate-100">{rankings[1].totalCount}</div>
                </div>
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {rankings[2] && (
            <div className="bg-gradient-to-b from-amber-800/20 via-slate-900 to-slate-900 border border-amber-800/50 rounded-2xl p-4 relative overflow-hidden shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-amber-700 text-amber-100 font-black flex items-center justify-center text-sm shadow-md">
                  🥉
                </div>
                <div>
                  <span className="text-[10px] uppercase font-black text-amber-400 tracking-wider">
                    3위 썰자 정예
                  </span>
                  <div className="text-base font-black text-white truncate max-w-[180px]">
                    {rankings[2].uploaderId}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-amber-900/40 text-center font-mono">
                <div className="bg-slate-950/60 rounded-lg p-1.5">
                  <div className="text-[10px] text-cyan-400">처치</div>
                  <div className="text-sm font-bold text-white">{rankings[2].killCount}</div>
                </div>
                <div className="bg-slate-950/60 rounded-lg p-1.5">
                  <div className="text-[10px] text-amber-400">도움</div>
                  <div className="text-sm font-bold text-white">{rankings[2].assistCount}</div>
                </div>
                <div className="bg-amber-900/30 border border-amber-800/60 rounded-lg p-1.5">
                  <div className="text-[10px] text-amber-300 font-bold">합계</div>
                  <div className="text-sm font-black text-amber-200">{rankings[2].totalCount}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ranking Table Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">
              참여자 순위 목록
            </h3>
            <span className="text-xs bg-slate-800 text-amber-300 px-2.5 py-0.5 rounded-full font-mono font-bold">
              총 {displayedRankings.length}명
            </span>
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-500" />
            <span>합계 건수 많은 순서로 자동 정렬됩니다.</span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/90 text-slate-400 border-b border-slate-800 uppercase font-black tracking-wider text-[11px]">
                <th className="py-3 px-4 w-16 text-center">순위</th>
                <th className="py-3 px-4">업로더 (참여자) 아이디</th>
                <th className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-1 text-cyan-400">
                    <Swords className="w-3.5 h-3.5" />
                    <span>처치 건수</span>
                  </div>
                </th>
                <th className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-1 text-amber-400">
                    <Shield className="w-3.5 h-3.5" />
                    <span>도움 건수</span>
                  </div>
                </th>
                <th className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-1 text-rose-400 font-black">
                    <Flame className="w-3.5 h-3.5" />
                    <span>합계 건수</span>
                  </div>
                </th>
                <th className="py-3 px-4 text-center w-36">기여 비중 (처치/도움)</th>
                <th className="py-3 px-4 text-right">최근 기록 일시</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {displayedRankings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="max-w-xs mx-auto space-y-2">
                      <div className="w-12 h-12 mx-auto rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500">
                        <Trophy className="w-6 h-6" />
                      </div>
                      <p className="font-bold text-white text-sm">
                        선택된 기간에 해당하는 순위 데이터가 없습니다.
                      </p>
                      <p className="text-xs text-slate-500">
                        기간 필터를 변경하거나 스크린샷을 업로드하여 전투 기록을 누적해 보세요.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedRankings.map((item) => {
                  const isCurrentUser =
                    currentUserId &&
                    item.uploaderId.toLowerCase() === currentUserId.toLowerCase();

                  // Medals / Badges for Top 3
                  let rankBadge = (
                    <span className="font-mono font-bold text-slate-400 text-sm">
                      {item.rank}
                    </span>
                  );
                  let rowBg = 'hover:bg-slate-800/40 transition-colors';

                  if (item.rank === 1) {
                    rankBadge = (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 font-black text-sm shadow-sm">
                        🥇 1
                      </span>
                    );
                    rowBg = 'bg-amber-950/15 hover:bg-amber-950/25 transition-colors';
                  } else if (item.rank === 2) {
                    rankBadge = (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-400/20 text-slate-200 border border-slate-400/40 font-black text-sm shadow-sm">
                        🥈 2
                      </span>
                    );
                    rowBg = 'bg-slate-800/20 hover:bg-slate-800/35 transition-colors';
                  } else if (item.rank === 3) {
                    rankBadge = (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-800/20 text-amber-400 border border-amber-700/40 font-black text-sm shadow-sm">
                        🥉 3
                      </span>
                    );
                    rowBg = 'bg-amber-950/10 hover:bg-amber-950/20 transition-colors';
                  }

                  if (isCurrentUser) {
                    rowBg += ' ring-1 ring-purple-500/60 bg-purple-950/20';
                  }

                  return (
                    <tr key={item.uploaderId} className={rowBg}>
                      {/* 순위 */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {rankBadge}
                      </td>

                      {/* 업로더(참여자) 아이디 */}
                      <td className="py-3 px-4 font-bold text-slate-100">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                            isCurrentUser
                              ? 'bg-purple-600 text-white shadow-sm'
                              : 'bg-slate-800 text-slate-300'
                          }`}>
                            <User className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className={isCurrentUser ? 'text-purple-300 font-black' : 'text-slate-200'}>
                                {item.uploaderId}
                              </span>
                              {isCurrentUser && (
                                <span className="bg-purple-500/30 text-purple-200 text-[10px] px-1.5 py-0.2 rounded font-bold">
                                  나
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 처치 건수 */}
                      <td className="py-3 px-4 text-center font-mono font-bold text-cyan-300 text-sm whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded bg-cyan-950/50 border border-cyan-500/30">
                          {item.killCount}건
                        </span>
                      </td>

                      {/* 도움 건수 */}
                      <td className="py-3 px-4 text-center font-mono font-bold text-amber-300 text-sm whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded bg-amber-950/50 border border-amber-500/30">
                          {item.assistCount}건
                        </span>
                      </td>

                      {/* 합계 건수 */}
                      <td className="py-3 px-4 text-center font-mono font-black text-base whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-gradient-to-r from-rose-950/70 to-red-950/70 border border-rose-500/50 text-rose-300 shadow-sm">
                          <Flame className="w-3.5 h-3.5 text-rose-400" />
                          <span>{item.totalCount}건</span>
                        </span>
                      </td>

                      {/* 기여 비중 프로그레스 바 */}
                      <td className="py-3 px-4">
                        <div className="w-full space-y-1">
                          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                            <span className="text-cyan-400">처치 {item.killRatio}%</span>
                            <span className="text-amber-400">도움 {item.assistRatio}%</span>
                          </div>
                          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
                            <div
                              style={{ width: `${item.killRatio}%` }}
                              className="bg-cyan-500 h-full transition-all"
                              title={`처치 ${item.killCount}건 (${item.killRatio}%)`}
                            />
                            <div
                              style={{ width: `${item.assistRatio}%` }}
                              className="bg-amber-500 h-full transition-all"
                              title={`도움 ${item.assistCount}건 (${item.assistRatio}%)`}
                            />
                          </div>
                        </div>
                      </td>

                      {/* 최근 기록 일시 */}
                      <td className="py-3 px-4 text-right text-slate-400 text-[11px] font-mono whitespace-nowrap">
                        {item.lastActiveTime || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        {displayedRankings.length > 0 && (
          <div className="bg-slate-950/80 border-t border-slate-800 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-3">
              <span>
                기간 내 순위 집계 참여자: <strong className="text-white">{displayedRankings.length}</strong>명
              </span>
              <span>•</span>
              <span>
                총 처치: <strong className="text-cyan-400">{periodStats.totalKills}</strong>건
              </span>
              <span>•</span>
              <span>
                총 도움: <strong className="text-amber-400">{periodStats.totalAssists}</strong>건
              </span>
              <span>•</span>
              <span>
                총 합계: <strong className="text-rose-400">{periodStats.totalRecords}</strong>건
              </span>
            </div>

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-bold transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>순위 엑셀로 저장하기 (.xlsx)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
