import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Swords,
  Upload,
  FileSpreadsheet,
  Trash2,
  Edit3,
  Search,
  Filter,
  Calendar,
  User,
  Shield,
  Clock,
  Sparkles,
  ArrowLeft,
  Globe,
  AlertTriangle,
  CheckCircle2,
  Download,
  Image as ImageIcon,
  RotateCcw,
  Plus,
  X,
  FileText,
  ChevronDown,
  Layers,
  Flame,
  Check,
  Trophy
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SsuljaEventRecord, SsuljaContributionType, UserSession } from '../types';
import { SsuljaRecordModal } from './SsuljaRecordModal';
import { SsuljaRankingSection } from './SsuljaRankingSection';

interface SsuljaEventViewProps {
  records: SsuljaEventRecord[];
  session: UserSession;
  onNavigateToMain: () => void;
  onNavigateToServerBoss: () => void;
  onNavigateToEnhancement: () => void;
  onSaveRecord: (record: SsuljaEventRecord) => Promise<void>;
  onSaveMultipleRecords: (records: SsuljaEventRecord[]) => Promise<void>;
  onDeleteRecord: (recordId: string) => Promise<void>;
  onDeleteMultipleRecords: (recordIds: string[]) => Promise<void>;
  onAddToast?: (title: string, message: string, type?: 'kill' | 'spawn' | 'info') => void;
}

interface ParsedCandidateRow {
  tempId: string;
  occurredAt: string;
  contributionType: SsuljaContributionType;
  targetId: string;
  targetGuild: string;
}

// Boss Time Exclusion Detector
// Excluded Windows: 08:55 ~ 09:05, 11:55 ~ 12:05, 20:55 ~ 21:05, 23:55 ~ 00:05
export function isBossTimeExcluded(occurredAt: string): { isExcluded: boolean; reason?: string } {
  if (!occurredAt) return { isExcluded: false };

  const timeMatch = occurredAt.match(/(\d{1,2}):(\d{2})/);
  if (!timeMatch) return { isExcluded: false };

  const hours = parseInt(timeMatch[1], 10);
  const minutes = parseInt(timeMatch[2], 10);

  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return { isExcluded: false };
  }

  const totalMinutes = hours * 60 + minutes;

  // 1) 08:55 ~ 09:05 (535 ~ 545 min)
  if (totalMinutes >= 535 && totalMinutes <= 545) {
    return { isExcluded: true, reason: '08:55~09:05' };
  }

  // 2) 11:55 ~ 12:05 (715 ~ 725 min)
  if (totalMinutes >= 715 && totalMinutes <= 725) {
    return { isExcluded: true, reason: '11:55~12:05' };
  }

  // 3) 20:55 ~ 21:05 (1255 ~ 1265 min)
  if (totalMinutes >= 1255 && totalMinutes <= 1265) {
    return { isExcluded: true, reason: '20:55~21:05' };
  }

  // 4) 23:55 ~ 00:05 (1435 ~ 1439 min or 0 ~ 5 min)
  if (totalMinutes >= 1435 || totalMinutes <= 5) {
    return { isExcluded: true, reason: '23:55~00:05' };
  }

  return { isExcluded: false };
}

export function SsuljaEventView({
  records,
  session,
  onNavigateToMain,
  onNavigateToServerBoss,
  onNavigateToEnhancement,
  onSaveRecord,
  onSaveMultipleRecords,
  onDeleteRecord,
  onDeleteMultipleRecords,
  onAddToast,
}: SsuljaEventViewProps) {
  // Active Tab: 진입 시 첫화면을 'UPLOAD' (스크린샷 업로드)로 기본 설정
  const [activeTab, setActiveTab] = useState<'UPLOAD' | 'STATS' | 'RANKING'>('UPLOAD');

  // Filter States
  const [searchTargetId, setSearchTargetId] = useState('');
  const [searchUploaderId, setSearchUploaderId] = useState('');
  const [filterContribution, setFilterContribution] = useState<'ALL' | '처치' | '도움'>('ALL');
  const [dateFilterPreset, setDateFilterPreset] = useState<'ALL' | 'TODAY' | '3DAYS' | '7DAYS' | 'MONTH' | 'CUSTOM'>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals state
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<SsuljaEventRecord | null>(null);

  // Selected records for batch deletion
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());

  // Delete Confirm Modal
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: async () => {},
  });

  // --- Image Upload & Analysis State ---
  const [isDragging, setIsDragging] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [lastUploadedMimeType, setLastUploadedMimeType] = useState<string>('image/png');
  const [customUploaderId, setCustomUploaderId] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedCandidateRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Global Clipboard paste event listener (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            handleProcessFile(file);
            setActiveTab('UPLOAD');
            onAddToast?.('클립보드 스크린샷 감지', '붙여넣은 스크린샷 이미지 분석을 시작합니다.', 'info');
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // Process File (from input, drag & drop, or paste)
  const handleProcessFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setAnalysisError('이미지 파일(PNG, JPG, WEBP 등)만 업로드할 수 있습니다.');
      return;
    }

    setAnalysisError(null);
    setParsedRows([]);
    setLastUploadedMimeType(file.type || 'image/png');

    const reader = new FileReader();
    reader.onload = (e) => {
      const rawBase64 = e.target?.result as string;

      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 2400;
        let { width, height } = img;

        // If image is already within max dimensions and under 4MB, send original directly for 100% crisp OCR text
        if (width <= MAX_DIM && height <= MAX_DIM && file.size < 4 * 1024 * 1024) {
          setImagePreview(rawBase64);
          triggerImageAnalysis(rawBase64, file.type || 'image/png');
          return;
        }

        // Scale down while maintaining high quality text
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.94);
          setImagePreview(optimizedBase64);
          setLastUploadedMimeType('image/jpeg');
          triggerImageAnalysis(optimizedBase64, 'image/jpeg');
          return;
        }

        setImagePreview(rawBase64);
        triggerImageAnalysis(rawBase64, file.type || 'image/png');
      };
      img.onerror = () => {
        setImagePreview(rawBase64);
        triggerImageAnalysis(rawBase64, file.type || 'image/png');
      };
      img.src = rawBase64;
    };
    reader.readAsDataURL(file);
  };

  // Call Server-side Gemini OCR analysis endpoint
  const triggerImageAnalysis = async (base64Image: string, mimeType: string) => {
    try {
      setIsAnalyzing(true);
      setAnalysisError(null);

      const targetUploader = customUploaderId.trim() || session.userId || '익명 길드원';
      const payload = JSON.stringify({
        imageBase64: base64Image,
        mimeType: mimeType || 'image/jpeg',
        uploaderId: targetUploader,
      });

      let res: Response;
      try {
        res = await fetch('/api/ssulja/parse-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        });

        // Fallback to trailing slash endpoint if 404
        if (res.status === 404) {
          res = await fetch('/api/ssulja/parse-image/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
          });
        }
      } catch (netErr: any) {
        throw new Error('서버 네트워크 통신에 실패했습니다. 잠시 후 [다시 분석 시도하기]를 눌러주세요.');
      }

      const contentType = res.headers.get('content-type') || '';
      let data: any;

      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        if (res.status === 413) {
          throw new Error('이미지 전송 용량이 너무 큽니다. 다른 스크린샷으로 다시 시도해주세요.');
        } else if (res.status === 504 || res.status === 502) {
          throw new Error('서버 응답 시간이 초과되었습니다. 잠시 후 [다시 분석 시도하기]를 눌러주세요.');
        } else if (res.status === 404) {
          throw new Error('분석 서버 엔드포인트 연결을 재설정하는 중입니다. [다시 분석 시도하기]를 눌러주세요.');
        } else {
          throw new Error(`서버 응답 오류 (HTTP ${res.status}): 분석 서버가 일시적으로 원활하지 않습니다. [다시 분석 시도하기]를 눌러주세요.`);
        }
      }

      if (!res.ok) {
        let errStr = data?.error || '스크린샷 분석에 실패했습니다.';
        if (errStr.includes('high demand') || errStr.includes('503') || errStr.includes('UNAVAILABLE')) {
          errStr = 'AI 분석 서버의 일시적인 사용량 증가로 지연되었습니다. [다시 분석 시도하기] 버튼을 누르면 정상 처리됩니다.';
        } else if (errStr.includes('quota') || errStr.includes('429') || errStr.includes('exhausted')) {
          errStr = 'AI 처리 요청 한도에 도달했습니다. 잠시(약 3초) 후 [다시 분석 시도하기]를 눌러주세요.';
        }
        throw new Error(errStr);
      }

      if (Array.isArray(data.records) && data.records.length > 0) {
        const rows: ParsedCandidateRow[] = data.records.map((r: any, idx: number) => ({
          tempId: `candidate-${Date.now()}-${idx}`,
          occurredAt: r.occurredAt || '',
          contributionType: (r.contributionType === '도움' ? '도움' : '처치') as SsuljaContributionType,
          targetId: r.targetId || '',
          targetGuild: r.targetGuild || '-',
        }));
        setParsedRows(rows);
        onAddToast?.('스크린샷 분석 완료', `전투 로그 ${rows.length}건이 성공적으로 추출되었습니다. (참여자: ${targetUploader})`, 'kill');
      } else {
        setAnalysisError('스크린샷에서 유효한 처치/도움 전투 기록 행을 감지하지 못했습니다. 전투 로그 화면이 선명하게 보이도록 스크린샷을 확인해주세요.');
      }
    } catch (err: any) {
      console.error('Image analysis error:', err);
      let message = err?.message || '스크린샷 분석 중 오류가 발생했습니다.';
      if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
        message = '서버 연결이 불안정합니다. 인터넷 연결을 확인하고 [다시 분석 시도하기]를 눌러주세요.';
      }
      setAnalysisError(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Commit Analyzed Rows to Firestore & Local DB (Excluding boss time records)
  const handleCommitParsedRows = async () => {
    if (parsedRows.length === 0) return;

    try {
      const effectiveUploader = customUploaderId.trim() || session.userId || '익명 길드원';
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);

      // Filter out boss time rows (08:55~09:05, 11:55~12:05, 20:55~21:05, 23:55~00:05)
      const validRows = parsedRows.filter((row) => !isBossTimeExcluded(row.occurredAt).isExcluded);
      const excludedCount = parsedRows.length - validRows.length;

      if (validRows.length === 0) {
        onAddToast?.(
          '누적 전송 불가',
          `추출된 ${parsedRows.length}건이 모두 보스타임(08:55~09:05, 11:55~12:05, 20:55~21:05, 23:55~00:05) 제외 대상입니다.`,
          'info'
        );
        return;
      }

      const newRecords: SsuljaEventRecord[] = validRows.map((row) => ({
        id: `ssulja-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        occurredAt: row.occurredAt.trim(),
        contributionType: row.contributionType,
        targetId: row.targetId.trim(),
        targetGuild: row.targetGuild.trim() || '-',
        uploaderId: effectiveUploader,
        uploadedAt: nowStr,
      }));

      await onSaveMultipleRecords(newRecords);

      const msg = excludedCount > 0
        ? `[${effectiveUploader}] 님의 기록 중 보스타임 제외 ${excludedCount}건을 삭제하고 유효 ${validRows.length}건만 통계에 누적되었습니다!`
        : `[${effectiveUploader}] 님의 썰자 기록 ${newRecords.length}건이 통계 내역에 누적되었습니다!`;

      onAddToast?.('통계 누적 완료', msg, 'kill');
      setParsedRows([]);
      setImagePreview(null);
      setActiveTab('STATS');
    } catch (err: any) {
      onAddToast?.('저장 실패', err?.message || '통계 누적 저장 중 오류가 발생했습니다.', 'info');
    }
  };

  // Candidate rows statistics (valid vs boss-time excluded)
  const candidateStats = useMemo(() => {
    let validCount = 0;
    let excludedCount = 0;
    parsedRows.forEach((r) => {
      if (isBossTimeExcluded(r.occurredAt).isExcluded) {
        excludedCount++;
      } else {
        validCount++;
      }
    });
    return { validCount, excludedCount, total: parsedRows.length };
  }, [parsedRows]);

  // Filtered Records based on user criteria
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // 1) Target ID Filter
      if (searchTargetId.trim()) {
        const query = searchTargetId.trim().toLowerCase();
        if (!r.targetId.toLowerCase().includes(query)) return false;
      }

      // 2) Uploader ID Filter
      if (searchUploaderId.trim()) {
        const query = searchUploaderId.trim().toLowerCase();
        if (!r.uploaderId.toLowerCase().includes(query)) return false;
      }

      // 3) Contribution Type Filter
      if (filterContribution !== 'ALL' && r.contributionType !== filterContribution) {
        return false;
      }

      // 4) Date Filter
      if (dateFilterPreset !== 'ALL') {
        const cleanOccurred = r.occurredAt.replace(/\//g, '-').trim();
        const recDate = new Date(cleanOccurred);

        if (!isNaN(recDate.getTime())) {
          const now = new Date();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

          if (dateFilterPreset === 'TODAY') {
            if (recDate.getTime() < todayStart) return false;
          } else if (dateFilterPreset === '3DAYS') {
            const threeDaysAgo = todayStart - 3 * 24 * 60 * 60 * 1000;
            if (recDate.getTime() < threeDaysAgo) return false;
          } else if (dateFilterPreset === '7DAYS') {
            const sevenDaysAgo = todayStart - 7 * 24 * 60 * 60 * 1000;
            if (recDate.getTime() < sevenDaysAgo) return false;
          } else if (dateFilterPreset === 'MONTH') {
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
            if (recDate.getTime() < monthStart) return false;
          } else if (dateFilterPreset === 'CUSTOM') {
            if (startDate) {
              const start = new Date(startDate).getTime();
              if (recDate.getTime() < start) return false;
            }
            if (endDate) {
              const end = new Date(endDate + ' 23:59:59').getTime();
              if (recDate.getTime() > end) return false;
            }
          }
        }
      }

      return true;
    });
  }, [records, searchTargetId, searchUploaderId, filterContribution, dateFilterPreset, startDate, endDate]);

  // Statistics Metrics
  const stats = useMemo(() => {
    const totalCount = records.length;
    const killCount = records.filter((r) => r.contributionType === '처치').length;
    const assistCount = records.filter((r) => r.contributionType === '도움').length;

    // Top participants (uploaders)
    const uploaderCounts: Record<string, number> = {};
    const targetGuildCounts: Record<string, number> = {};
    const targetIdCounts: Record<string, number> = {};

    records.forEach((r) => {
      uploaderCounts[r.uploaderId] = (uploaderCounts[r.uploaderId] || 0) + 1;
      if (r.targetGuild && r.targetGuild !== '-') {
        targetGuildCounts[r.targetGuild] = (targetGuildCounts[r.targetGuild] || 0) + 1;
      }
      targetIdCounts[r.targetId] = (targetIdCounts[r.targetId] || 0) + 1;
    });

    const topUploader = Object.entries(uploaderCounts).sort((a, b) => b[1] - a[1])[0] || ['-', 0];
    const topGuild = Object.entries(targetGuildCounts).sort((a, b) => b[1] - a[1])[0] || ['-', 0];
    const topTarget = Object.entries(targetIdCounts).sort((a, b) => b[1] - a[1])[0] || ['-', 0];

    return {
      totalCount,
      killCount,
      assistCount,
      topUploader: { name: topUploader[0], count: topUploader[1] },
      topGuild: { name: topGuild[0], count: topGuild[1] },
      topTarget: { name: topTarget[0], count: topTarget[1] },
    };
  }, [records]);

  // Excel Export Handler (.xlsx)
  const handleExportExcel = () => {
    if (filteredRecords.length === 0) {
      onAddToast?.('다운로드 불가', '내보낼 통계 데이터가 없습니다.', 'info');
      return;
    }

    const exportRows = filteredRecords.map((r, index) => ({
      No: index + 1,
      발생시간: r.occurredAt,
      기여내역: r.contributionType,
      '대상자 아이디': r.targetId,
      '대상자 길드': r.targetGuild || '-',
      '참여자 (업로더)': r.uploaderId,
      '등록 일시': r.uploadedAt,
      비고: r.notes || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 10 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 24 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '썰자이벤트_통계내역');

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `썰자이벤트_참여통계_${dateStr}.xlsx`);
    onAddToast?.('엑셀 파일 저장 완료', `총 ${filteredRecords.length}건의 통계 내역이 엑셀(.xlsx)로 저장되었습니다.`, 'kill');
  };

  // CSV Export Handler (UTF-8 BOM)
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      onAddToast?.('다운로드 불가', '내보낼 통계 데이터가 없습니다.', 'info');
      return;
    }

    const headers = ['No', '발생시간', '기여내역', '대상자 아이디', '대상자 길드', '참여자(업로더)', '등록 일시', '비고'];
    const rows = filteredRecords.map((r, index) => [
      index + 1,
      `"${r.occurredAt.replace(/"/g, '""')}"`,
      `"${r.contributionType}"`,
      `"${r.targetId.replace(/"/g, '""')}"`,
      `"${(r.targetGuild || '-').replace(/"/g, '""')}"`,
      `"${r.uploaderId.replace(/"/g, '""')}"`,
      `"${r.uploadedAt.replace(/"/g, '""')}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `썰자이벤트_참여통계_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onAddToast?.('CSV 파일 저장 완료', `총 ${filteredRecords.length}건의 통계 내역이 CSV로 저장되었습니다.`, 'kill');
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchTargetId('');
    setSearchUploaderId('');
    setFilterContribution('ALL');
    setDateFilterPreset('ALL');
    setStartDate('');
    setEndDate('');
  };

  // Toggle selection for batch actions
  const handleToggleSelectAll = () => {
    if (selectedRecordIds.size === filteredRecords.length) {
      setSelectedRecordIds(new Set());
    } else {
      setSelectedRecordIds(new Set(filteredRecords.map((r) => r.id)));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Batch Delete
  const handleBatchDelete = () => {
    if (selectedRecordIds.size === 0) return;
    const count = selectedRecordIds.size;
    setConfirmDeleteModal({
      isOpen: true,
      title: '선택한 전투 기록 일괄 삭제',
      message: `선택하신 ${count}건의 썰자 이벤트 참여 기록을 정말 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.`,
      onConfirm: async () => {
        await onDeleteMultipleRecords(Array.from(selectedRecordIds));
        setSelectedRecordIds(new Set());
        setConfirmDeleteModal((prev) => ({ ...prev, isOpen: false }));
        onAddToast?.('삭제 완료', `${count}건의 기록이 삭제되었습니다.`, 'info');
      },
    });
  };

  // Single Delete
  const handleSingleDelete = (record: SsuljaEventRecord) => {
    setConfirmDeleteModal({
      isOpen: true,
      title: '전투 기록 삭제',
      message: `'${record.targetId}' 대상자 전투 기록(${record.occurredAt})을 삭제하시겠습니까?`,
      onConfirm: async () => {
        await onDeleteRecord(record.id);
        setConfirmDeleteModal((prev) => ({ ...prev, isOpen: false }));
        onAddToast?.('삭제 완료', '기록이 삭제되었습니다.', 'info');
      },
    });
  };

  return (
    <div className="flex-1 w-full max-w-[1920px] mx-auto px-3 sm:px-6 lg:px-8 py-5 animate-fade-in">
      {/* Top Breadcrumb & Page Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onNavigateToMain}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-xs transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>리젠 타이머로 돌아가기</span>
          </button>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onNavigateToServerBoss}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 font-semibold text-xs transition-colors cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>개인 적대 목록</span>
            </button>
            <button
              type="button"
              onClick={onNavigateToEnhancement}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 text-purple-300 font-semibold text-xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>수집템 강화 요청소</span>
            </button>
          </div>
        </div>

        {/* Current Active Mode Badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">현재 모드:</span>
          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
            activeTab === 'UPLOAD'
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
          }`}>
            {activeTab === 'UPLOAD' ? '📸 스크린샷 업로드 & AI 분석' : '📊 썰자 통계내역 대시보드'}
          </span>
        </div>
      </div>

      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-950/70 via-slate-900/90 to-amber-950/50 border border-rose-500/30 p-4 sm:p-6 mb-6 shadow-xl shadow-rose-950/20">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold">
              <Flame className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
              <span>전장 PvP 처치 & 도움 전투 기록 실시간 누적 시스템</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <span>썰자 이벤트 참여 및 통계 대시보드</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
              게임 내 PvP 전투 기록 스크린샷을 드래그 또는 <span className="text-amber-300 font-bold">Ctrl + V</span>로 붙여넣으면
              발생시간, 처치/도움, 대상자 아이디, 길드 데이터를 AI가 자동 추출하여 엑셀 리스트로 누적합니다.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setRecordToEdit(null);
                setIsRecordModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs transition-colors cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4 text-cyan-400" />
              <span>수기 직접 추가</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-md shadow-emerald-950/40"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>엑셀 다운로드 (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>CSV 내보내기</span>
            </button>
          </div>
        </div>
      </div>

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">총 누적 기록</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl sm:text-2xl font-black text-white font-mono">{stats.totalCount}</span>
            <span className="text-xs text-slate-400">건</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-cyan-500/30 rounded-xl p-3.5 flex flex-col justify-between bg-gradient-to-b from-cyan-950/20 to-transparent">
          <span className="text-xs text-cyan-400 font-bold flex items-center gap-1">
            <Swords className="w-3.5 h-3.5" />
            <span>총 처치 (Kill)</span>
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl sm:text-2xl font-black text-cyan-300 font-mono">{stats.killCount}</span>
            <span className="text-xs text-cyan-400">회</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-3.5 flex flex-col justify-between bg-gradient-to-b from-amber-950/20 to-transparent">
          <span className="text-xs text-amber-400 font-bold flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" />
            <span>총 도움 (Assist)</span>
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl sm:text-2xl font-black text-amber-300 font-mono">{stats.assistCount}</span>
            <span className="text-xs text-amber-400">회</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium truncate">최다 참여자 (업로더)</span>
          <div className="mt-1">
            <div className="text-sm sm:text-base font-bold text-purple-300 truncate">
              {stats.topUploader.name}
            </div>
            <div className="text-[11px] text-slate-400 font-mono">{stats.topUploader.count}건 기여</div>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium truncate">최다 피격 길드</span>
          <div className="mt-1">
            <div className="text-sm sm:text-base font-bold text-rose-300 truncate">
              {stats.topGuild.name}
            </div>
            <div className="text-[11px] text-slate-400 font-mono">{stats.topGuild.count}회 타격</div>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium truncate">최다 타겟 아이디</span>
          <div className="mt-1">
            <div className="text-sm sm:text-base font-bold text-orange-300 truncate">
              {stats.topTarget.name}
            </div>
            <div className="text-[11px] text-slate-400 font-mono">{stats.topTarget.count}회 처치/도움</div>
          </div>
        </div>
      </div>

      {/* --- 통계 대시보드 하단: 눈에 잘 띄는 대형 탭 전환 컨트롤 --- */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-900 border-2 border-slate-700/80 rounded-2xl p-2 sm:p-2.5 mb-6 shadow-2xl shadow-black/40">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {/* 1. 스크린샷 업로드 버튼 (기본 첫 화면) */}
          <button
            type="button"
            onClick={() => setActiveTab('UPLOAD')}
            className={`relative flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl font-black text-sm sm:text-base transition-all duration-200 cursor-pointer ${
              activeTab === 'UPLOAD'
                ? 'bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 text-white shadow-xl shadow-rose-950/60 ring-2 ring-rose-400 scale-[1.01]'
                : 'bg-slate-950/70 text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-800'
            }`}
          >
            <div className={`p-2 rounded-lg ${activeTab === 'UPLOAD' ? 'bg-black/30' : 'bg-rose-500/10 text-rose-400'}`}>
              <Upload className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span>📸 스크린샷 업로드</span>
                {parsedRows.length > 0 && (
                  <span className="bg-amber-300 text-slate-950 text-xs px-2 py-0.5 rounded-full font-black animate-bounce">
                    {parsedRows.length}건 분석됨
                  </span>
                )}
                {activeTab === 'UPLOAD' && (
                  <span className="text-[10px] uppercase font-bold bg-white/20 px-2 py-0.5 rounded-full">
                    선택됨
                  </span>
                )}
              </div>
              <p className={`text-xs font-normal ${activeTab === 'UPLOAD' ? 'text-rose-100' : 'text-slate-400'}`}>
                드래그 & 드롭 / 파일 선택 / Ctrl+V 붙여넣기 AI 분석
              </p>
            </div>
          </button>

          {/* 2. 통계내역 보기 버튼 */}
          <button
            type="button"
            onClick={() => setActiveTab('STATS')}
            className={`relative flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl font-black text-sm sm:text-base transition-all duration-200 cursor-pointer ${
              activeTab === 'STATS'
                ? 'bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 text-white shadow-xl shadow-cyan-950/60 ring-2 ring-cyan-400 scale-[1.01]'
                : 'bg-slate-950/70 text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-800'
            }`}
          >
            <div className={`p-2 rounded-lg ${activeTab === 'STATS' ? 'bg-black/30' : 'bg-cyan-500/10 text-cyan-400'}`}>
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span>📊 통계내역 보기</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-black ${
                  activeTab === 'STATS' ? 'bg-black/30 text-white' : 'bg-slate-800 text-cyan-400'
                }`}>
                  {records.length}건
                </span>
                {activeTab === 'STATS' && (
                  <span className="text-[10px] uppercase font-bold bg-white/20 px-2 py-0.5 rounded-full">
                    선택됨
                  </span>
                )}
              </div>
              <p className={`text-xs font-normal ${activeTab === 'STATS' ? 'text-cyan-100' : 'text-slate-400'}`}>
                기간·아이디·참여자 필터, 엑셀/CSV 다운로드, 수정·삭제
              </p>
            </div>
          </button>

          {/* 3. 기간별 순위 보기 버튼 (추가됨) */}
          <button
            type="button"
            onClick={() => setActiveTab('RANKING')}
            className={`relative flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl font-black text-sm sm:text-base transition-all duration-200 cursor-pointer ${
              activeTab === 'RANKING'
                ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600 text-white shadow-xl shadow-amber-950/60 ring-2 ring-amber-400 scale-[1.01]'
                : 'bg-slate-950/70 text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-800'
            }`}
          >
            <div className={`p-2 rounded-lg ${activeTab === 'RANKING' ? 'bg-black/30' : 'bg-amber-500/10 text-amber-400'}`}>
              <Trophy className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span>🏆 기간별 순위 보기</span>
                {activeTab === 'RANKING' && (
                  <span className="text-[10px] uppercase font-bold bg-white/20 px-2 py-0.5 rounded-full">
                    선택됨
                  </span>
                )}
              </div>
              <p className={`text-xs font-normal ${activeTab === 'RANKING' ? 'text-amber-100' : 'text-slate-400'}`}>
                특정 기간 입력, 건수별 순위 집계 & 엑셀 다운로드
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* --- TAB CONTENT 1: 스크린샷 업로드 & 분석 --- */}
      {activeTab === 'UPLOAD' && (
        <div className="space-y-6 animate-fade-in">
          {/* Upload Drop Zone Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-white">전투 기록 스크린샷 업로드 & AI 분석</h2>
                  <p className="text-xs text-slate-400">
                    게임 내 처치/도움 기록 스크린샷을 드래그하거나 클립보드 붙여넣기(Ctrl+V)하세요.
                  </p>
                </div>
              </div>

              {imagePreview && (
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview(null);
                    setParsedRows([]);
                    setAnalysisError(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>새로 올리기</span>
                </button>
              )}
            </div>

            {/* 참여자 (업로더) 아이디 직접 입력 영역 */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <User className="w-4 h-4 text-purple-400" />
                    <span>참여자(업로더) 아이디 직접 입력</span>
                    <span className="text-[10px] text-amber-300 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                      선택 사항
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-400">
                    스크린샷 업로드 전에 아이디를 입력하면 해당 아이디로 누적 통계에 전송됩니다. 미입력 시 로그인된 아이디가 자동 적용됩니다.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customUploaderId}
                    onChange={(e) => setCustomUploaderId(e.target.value)}
                    placeholder={`미입력 시: ${session.userId || '로그인 계정'}`}
                    className="bg-slate-900 border border-slate-700 focus:border-purple-400 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none w-56 font-bold"
                  />
                  {customUploaderId && (
                    <button
                      type="button"
                      onClick={() => setCustomUploaderId('')}
                      className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs transition-colors cursor-pointer"
                      title="로그인 아이디로 재설정"
                    >
                      초기화
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-400 border-t border-slate-800/80 pt-2">
                <span>적용될 참여자:</span>
                <span className="font-bold text-purple-300 px-2 py-0.5 rounded bg-purple-950/60 border border-purple-500/40">
                  {customUploaderId.trim() || session.userId || '익명 길드원'}
                </span>
                {!customUploaderId.trim() ? (
                  <span className="text-[11px] text-slate-500">(현재 로그인된 계정 적용 중)</span>
                ) : (
                  <span className="text-[11px] text-amber-300 font-semibold">(직접 지정한 아이디로 통계 누적 전송됨)</span>
                )}
              </div>
            </div>

            {/* Drag & Drop Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleProcessFile(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-rose-400 bg-rose-950/20 scale-[0.99]'
                  : 'border-slate-700 hover:border-rose-500/60 bg-slate-950/60 hover:bg-slate-950/80'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleProcessFile(file);
                }}
              />

              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <ImageIcon className="w-7 h-7" />
              </div>

              <h3 className="text-sm sm:text-base font-bold text-white mb-1">
                스크린샷 이미지 파일을 클릭하여 선택하거나 여기로 드래그하세요
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mb-3">
                Windows/Mac 화면 캡처 도구로 캡처한 뒤 이 화면에서 바로 <span className="text-amber-400 font-bold bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">Ctrl + V</span> 를 누르면 즉시 분석됩니다.
              </p>

              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 text-[11px] text-slate-300 border border-slate-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>지원 형식: PNG, JPG, JPEG, WEBP | 해상도 자동 최적화 & 다중 AI 모델 인식 적용</span>
              </div>
            </div>

            {/* Error Message with Retry and Manual Add Options */}
            {analysisError && (
              <div className="mt-4 p-4 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-200 text-xs font-semibold animate-fade-in space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{analysisError}</span>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-rose-500/30 flex-wrap">
                  {imagePreview && (
                    <button
                      type="button"
                      onClick={() => triggerImageAnalysis(imagePreview, lastUploadedMimeType)}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>다시 분석 시도하기</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const newRow: ParsedCandidateRow = {
                        tempId: `candidate-${Date.now()}`,
                        occurredAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
                        contributionType: '처치',
                        targetId: '',
                        targetGuild: '-',
                      };
                      setParsedRows([newRow]);
                      setAnalysisError(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-cyan-400" />
                    <span>수기로 직접 행 추가하기</span>
                  </button>
                </div>
              </div>
            )}

            {/* Loading Indicator */}
            {isAnalyzing && (
              <div className="mt-6 p-6 rounded-2xl bg-slate-950/80 border border-cyan-500/40 text-center animate-fade-in">
                <div className="w-10 h-10 mx-auto mb-3 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
                <h4 className="text-sm font-bold text-white">스크린샷 전투 로그 AI 분석 중...</h4>
                <p className="text-xs text-slate-400 mt-1">
                  발생시간, 처치/도움 기여도, 대상자 아이디 및 길드를 정밀하게 판독하고 있습니다.
                </p>
              </div>
            )}

            {/* Preview of Analyzed Rows before Commit */}
            {parsedRows.length > 0 && !isAnalyzing && (
              <div className="mt-6 space-y-4 animate-fade-in border-t border-slate-800 pt-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-white flex items-center gap-2 flex-wrap">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>추출 완료 ({parsedRows.length}건)</span>
                      <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs px-2.5 py-0.5 rounded-full font-bold">
                        전송 대상 {candidateStats.validCount}건
                      </span>
                      {candidateStats.excludedCount > 0 && (
                        <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs px-2.5 py-0.5 rounded-full font-black animate-pulse flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          <span>보스타임 제외 {candidateStats.excludedCount}건</span>
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-slate-400">
                      보스타임(<span className="text-rose-400 font-bold">08:55~09:05</span>, <span className="text-rose-400 font-bold">11:55~12:05</span>, <span className="text-rose-400 font-bold">20:55~21:05</span>, <span className="text-rose-400 font-bold">23:55~00:05</span>) 발생 내역은 <strong className="text-rose-300">[보스타임 제외]</strong>로 자동 표기되며, 통계 누적 시 자동 삭제 처리됩니다.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const newRow: ParsedCandidateRow = {
                          tempId: `candidate-${Date.now()}`,
                          occurredAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
                          contributionType: '처치',
                          targetId: '',
                          targetGuild: '-',
                        };
                        setParsedRows((prev) => [...prev, newRow]);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                    >
                      + 행 추가
                    </button>
                    <button
                      type="button"
                      onClick={handleCommitParsedRows}
                      disabled={candidateStats.validCount === 0}
                      className={`px-4 py-2 rounded-xl text-white font-black text-xs shadow-lg transition-all flex items-center gap-1.5 ${
                        candidateStats.validCount > 0
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 shadow-emerald-950/50 cursor-pointer'
                          : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                      }`}
                      title={
                        candidateStats.validCount === 0
                          ? '전송 가능한 정상 데이터가 없습니다 (모두 보스타임 제외).'
                          : undefined
                      }
                    >
                      <Check className="w-4 h-4" />
                      <span>
                        {candidateStats.excludedCount > 0
                          ? `보스타임 제외 ${candidateStats.excludedCount}건 삭제 후 ${candidateStats.validCount}건 누적 저장`
                          : `${candidateStats.validCount}건 통계에 누적 저장`}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Candidate Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/90 shadow-inner">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">No</th>
                        <th className="py-2.5 px-3">발생시간</th>
                        <th className="py-2.5 px-3 text-center">보스타임 구분</th>
                        <th className="py-2.5 px-3">기여내역</th>
                        <th className="py-2.5 px-3">대상자 아이디</th>
                        <th className="py-2.5 px-3">대상자 길드</th>
                        <th className="py-2.5 px-3">참여자 (업로더)</th>
                        <th className="py-2.5 px-3 text-right">삭제</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 font-mono">
                      {parsedRows.map((row, idx) => {
                        const bossCheck = isBossTimeExcluded(row.occurredAt);
                        return (
                          <tr
                            key={row.tempId}
                            className={`transition-colors ${
                              bossCheck.isExcluded
                                ? 'bg-rose-950/25 border-l-4 border-l-rose-500'
                                : 'hover:bg-slate-900/50'
                            }`}
                          >
                            <td className="py-2 px-3 text-slate-500">{idx + 1}</td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={row.occurredAt}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setParsedRows((prev) =>
                                    prev.map((r) => (r.tempId === row.tempId ? { ...r, occurredAt: val } : r))
                                  );
                                }}
                                className={`bg-slate-900 border rounded px-2 py-1 text-xs w-36 focus:outline-none ${
                                  bossCheck.isExcluded
                                    ? 'border-rose-500/70 text-rose-200 focus:border-rose-400'
                                    : 'border-slate-800 text-slate-200 focus:border-cyan-400'
                                }`}
                              />
                              {bossCheck.isExcluded && (
                                <span className="block text-[10px] text-rose-400 font-sans mt-0.5 font-semibold">
                                  누적 저장 시 자동 삭제
                                </span>
                              )}
                            </td>
                            {/* 보스타임 구분 상태 */}
                            <td className="py-2 px-3 text-center whitespace-nowrap">
                              {bossCheck.isExcluded ? (
                                <div
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-300 text-[10px] font-black shadow-sm"
                                  title={`보스타임 시간대(${bossCheck.reason})에 해당되어 누적 저장 시 자동 제외(삭제)됩니다`}
                                >
                                  <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                                  <span>보스타임 제외</span>
                                  <span className="text-[10px] text-rose-400 font-mono">({bossCheck.reason})</span>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold shadow-sm">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                  <span>정상 전송</span>
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <select
                                value={row.contributionType}
                                onChange={(e) => {
                                  const val = e.target.value as SsuljaContributionType;
                                  setParsedRows((prev) =>
                                    prev.map((r) => (r.tempId === row.tempId ? { ...r, contributionType: val } : r))
                                  );
                                }}
                                className={`rounded px-2 py-1 text-xs font-bold font-sans border cursor-pointer ${
                                  row.contributionType === '처치'
                                    ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                                    : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                                }`}
                              >
                                <option value="처치">처치 (Kill)</option>
                                <option value="도움">도움 (Assist)</option>
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={row.targetId}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setParsedRows((prev) =>
                                    prev.map((r) => (r.tempId === row.tempId ? { ...r, targetId: val } : r))
                                  );
                                }}
                                placeholder="대상자 아이디"
                                className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white font-bold font-sans text-xs w-32 focus:border-rose-400 focus:outline-none"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={row.targetGuild}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setParsedRows((prev) =>
                                    prev.map((r) => (r.tempId === row.tempId ? { ...r, targetGuild: val } : r))
                                  );
                                }}
                                placeholder="길드명"
                                className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-300 font-sans text-xs w-28 focus:border-rose-400 focus:outline-none"
                              />
                            </td>
                            <td className="py-2 px-3 font-sans">
                              <span className="font-bold text-purple-300">
                                {customUploaderId.trim() || session.userId || '익명 길드원'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setParsedRows((prev) => prev.filter((r) => r.tempId !== row.tempId));
                                }}
                                className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                                title="이 행 삭제"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Candidate Table Footer Information */}
                {candidateStats.excludedCount > 0 && (
                  <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-rose-300">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>
                        보스타임 제외 안내: 총 {candidateStats.total}건 중 <strong>{candidateStats.excludedCount}건</strong>이 보스타임(08:55~09:05, 11:55~12:05, 20:55~21:05, 23:55~00:05)에 해당합니다.
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      * 상단 [누적 저장] 버튼 클릭 시 보스타임 제외 데이터는 자동으로 삭제되고 유효 데이터({candidateStats.validCount}건)만 통계에 전송됩니다.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB CONTENT 2: 통계 내역 & 엑셀 리스트 관리 --- */}
      {activeTab === 'STATS' && (
        <div className="space-y-4 animate-fade-in">
          {/* Multi-Criteria Filter Bar */}
          <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs sm:text-sm font-black text-white">필터 및 상세 검색</h3>
                <span className="text-[11px] text-slate-400">
                  (조회 결과: <span className="text-cyan-300 font-bold">{filteredRecords.length}</span> / {records.length}건)
                </span>
              </div>

              {(searchTargetId || searchUploaderId || filterContribution !== 'ALL' || dateFilterPreset !== 'ALL' || startDate || endDate) && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>필터 초기화</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 1) 대상자 아이디 검색 */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  대상자 아이디 검색
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTargetId}
                    onChange={(e) => setSearchTargetId(e.target.value)}
                    placeholder="피격/제압 대상 아이디"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-400"
                  />
                  {searchTargetId && (
                    <button
                      type="button"
                      onClick={() => setSearchTargetId('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* 2) 참여자 (업로더) 검색 */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  참여자(업로더) 아이디 검색
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchUploaderId}
                    onChange={(e) => setSearchUploaderId(e.target.value)}
                    placeholder="기록 등록 길드원"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-400"
                  />
                  {searchUploaderId && (
                    <button
                      type="button"
                      onClick={() => setSearchUploaderId('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* 3) 기여내역 (처치 / 도움) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  기여내역 구분
                </label>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => setFilterContribution('ALL')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      filterContribution === 'ALL'
                        ? 'bg-cyan-600 border-cyan-400 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    전체
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterContribution('처치')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      filterContribution === '처치'
                        ? 'bg-cyan-950 border-cyan-400 text-cyan-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    처치
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterContribution('도움')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      filterContribution === '도움'
                        ? 'bg-amber-950 border-amber-400 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    도움
                  </button>
                </div>
              </div>

              {/* 4) 기간별 프리셋 */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  발생시간 기간별 필터
                </label>
                <div className="flex items-center gap-1 overflow-x-auto">
                  {(
                    [
                      { id: 'ALL', label: '전체' },
                      { id: 'TODAY', label: '오늘' },
                      { id: '3DAYS', label: '3일' },
                      { id: '7DAYS', label: '7일' },
                      { id: 'MONTH', label: '이번달' },
                      { id: 'CUSTOM', label: '직접' },
                    ] as const
                  ).map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setDateFilterPreset(preset.id)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors cursor-pointer border ${
                        dateFilterPreset === preset.id
                          ? 'bg-rose-600 border-rose-400 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom Date Range Picker (shown when 'CUSTOM' is selected) */}
            {dateFilterPreset === 'CUSTOM' && (
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60 animate-fade-in flex-wrap">
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-rose-400" />
                  <span>직접 기간 설정:</span>
                </span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-rose-400 [color-scheme:dark] cursor-pointer"
                />
                <span className="text-slate-500">~</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-rose-400 [color-scheme:dark] cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Table Toolbar (Batch Delete & Export Buttons) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/80 px-4 py-2.5 rounded-xl">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 font-bold">
                <input
                  type="checkbox"
                  checked={filteredRecords.length > 0 && selectedRecordIds.size === filteredRecords.length}
                  onChange={handleToggleSelectAll}
                  className="rounded border-slate-700 text-rose-600 focus:ring-rose-500 bg-slate-950 cursor-pointer"
                />
                <span>전체 선택</span>
              </label>

              {selectedRecordIds.size > 0 && (
                <div className="flex items-center gap-2 animate-fade-in">
                  <span className="text-xs text-rose-400 font-bold font-mono">
                    {selectedRecordIds.size}건 선택됨
                  </span>
                  <button
                    type="button"
                    onClick={handleBatchDelete}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>선택 삭제</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-sm"
                title="필터링된 현재 목록을 엑셀 파일로 다운로드"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>엑셀 추출 (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRecordToEdit(null);
                  setIsRecordModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-cyan-400" />
                <span>기록 추가</span>
              </button>
            </div>
          </div>

          {/* Main Excel-like Data Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/90 border-b border-slate-800 text-slate-400 font-bold uppercase text-[11px]">
                    <th className="py-3 px-4 w-10 text-center">
                      <span className="sr-only">선택</span>
                    </th>
                    <th className="py-3 px-3 w-14 text-center">No</th>
                    <th className="py-3 px-4">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-cyan-400" />
                        <span>발생시간</span>
                      </span>
                    </th>
                    <th className="py-3 px-3 w-28 text-center">
                      <span className="flex items-center justify-center gap-1">
                        <Swords className="w-3.5 h-3.5 text-rose-400" />
                        <span>기여내역</span>
                      </span>
                    </th>
                    <th className="py-3 px-4">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-amber-400" />
                        <span>대상자 아이디</span>
                      </span>
                    </th>
                    <th className="py-3 px-4">
                      <span className="flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-indigo-400" />
                        <span>대상자 길드</span>
                      </span>
                    </th>
                    <th className="py-3 px-4">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-purple-400" />
                        <span>참여자(업로더)</span>
                      </span>
                    </th>
                    <th className="py-3 px-4 text-slate-500">등록일시</th>
                    <th className="py-3 px-4 text-center w-24">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500 font-sans">
                        <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 text-slate-600 opacity-60" />
                        <p className="text-sm font-semibold text-slate-400">등록된 썰자 이벤트 전투 기록이 없습니다.</p>
                        <p className="text-xs text-slate-500 mt-1">
                          [스크린샷 업로드] 탭에서 이미지를 올리거나 [기록 추가] 버튼을 눌러보세요.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((record, index) => {
                      const isSelected = selectedRecordIds.has(record.id);
                      return (
                        <tr
                          key={record.id}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            isSelected ? 'bg-rose-950/20' : ''
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectRow(record.id)}
                              className="rounded border-slate-700 text-rose-600 focus:ring-rose-500 bg-slate-950 cursor-pointer"
                            />
                          </td>

                          {/* Index */}
                          <td className="py-3 px-3 text-center text-slate-500 text-xs">
                            {index + 1}
                          </td>

                          {/* 발생시간 */}
                          <td className="py-3 px-4 text-slate-200 font-bold whitespace-nowrap">
                            <span className="bg-slate-950 px-2 py-1 rounded border border-slate-800/80">
                              {record.occurredAt}
                            </span>
                          </td>

                          {/* 기여내역 */}
                          <td className="py-3 px-3 text-center">
                            {record.contributionType === '처치' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-950/50 font-sans">
                                <Swords className="w-3 h-3 text-cyan-400" />
                                <span>처치</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-950/80 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-950/50 font-sans">
                                <Shield className="w-3 h-3 text-amber-400" />
                                <span>도움</span>
                              </span>
                            )}
                          </td>

                          {/* 대상자 아이디 */}
                          <td className="py-3 px-4 font-sans font-bold text-slate-100">
                            <span className="hover:text-rose-400 transition-colors">{record.targetId}</span>
                          </td>

                          {/* 대상자 길드 */}
                          <td className="py-3 px-4 font-sans">
                            {record.targetGuild && record.targetGuild !== '-' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 text-xs font-semibold">
                                <Shield className="w-3 h-3 text-indigo-400" />
                                <span>{record.targetGuild}</span>
                              </span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>

                          {/* 참여자 (업로더) */}
                          <td className="py-3 px-4 font-sans text-slate-300">
                            <span className="font-semibold text-purple-300">{record.uploaderId}</span>
                          </td>

                          {/* 등록일시 */}
                          <td className="py-3 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                            {record.uploadedAt}
                          </td>

                          {/* 관리 (수정, 삭제) */}
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5 font-sans">
                              <button
                                type="button"
                                onClick={() => {
                                  setRecordToEdit(record);
                                  setIsRecordModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                title="수정"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSingleDelete(record)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-400 transition-colors cursor-pointer"
                                title="삭제"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer Summary */}
            {filteredRecords.length > 0 && (
              <div className="bg-slate-950/80 border-t border-slate-800 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
                <div className="flex items-center gap-4">
                  <span>
                    총 <span className="font-bold text-white">{filteredRecords.length}</span>건 표시 중
                  </span>
                  <span>
                    처치: <span className="font-bold text-cyan-400">{filteredRecords.filter((r) => r.contributionType === '처치').length}</span>건
                  </span>
                  <span>
                    도움: <span className="font-bold text-amber-400">{filteredRecords.filter((r) => r.contributionType === '도움').length}</span>건
                  </span>
                </div>

                <div className="text-[11px] text-slate-500">
                  데이터는 Firestore 클라우드 및 브라우저에 안전하게 실시간 보관됩니다.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB CONTENT 3: 기간별 순위 보기 --- */}
      {activeTab === 'RANKING' && (
        <SsuljaRankingSection
          records={records}
          currentUserId={session.userId}
          onAddToast={onAddToast}
        />
      )}

      {/* Manual / Edit Record Modal */}
      <SsuljaRecordModal
        isOpen={isRecordModalOpen}
        onClose={() => {
          setIsRecordModalOpen(false);
          setRecordToEdit(null);
        }}
        onSave={async (record) => {
          await onSaveRecord(record);
          onAddToast?.('저장 완료', `'${record.targetId}' 전투 기록이 저장되었습니다.`, 'kill');
        }}
        recordToEdit={recordToEdit}
        currentUserId={session.userId}
      />

      {/* Delete Confirmation Modal */}
      {confirmDeleteModal.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
        >
          <div className="bg-slate-900 border border-rose-500/50 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-5 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <Trash2 className="w-6 h-6 animate-pulse" />
            </div>

            <h3 className="text-base font-black text-white mb-1.5">
              {confirmDeleteModal.title}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-5">
              {confirmDeleteModal.message}
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteModal((prev) => ({ ...prev, isOpen: false }))}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmDeleteModal.onConfirm}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-black text-xs shadow-md shadow-rose-950/50 transition-all cursor-pointer"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
