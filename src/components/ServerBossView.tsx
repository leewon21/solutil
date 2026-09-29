import { useState, useMemo } from 'react';
import {
  ShieldAlert,
  UserPlus,
  Search,
  ArrowUpDown,
  Calendar,
  FileSpreadsheet,
  FileText,
  Trash2,
  Edit3,
  X,
  Shield,
  Sparkles,
  User,
  Clock,
  Download,
  AlertOctagon,
} from 'lucide-react';
import { HostileTarget, UserSession } from '../types';
import { AddHostileModal } from './AddHostileModal';
import { ReleaseHostilePasswordModal } from './ReleaseHostilePasswordModal';
import { EditHostileModal } from './EditHostileModal';

interface ServerBossViewProps {
  hostileTargets?: HostileTarget[];
  session: UserSession;
  adminPassword?: string;
  onSaveHostileTarget?: (target: Omit<HostileTarget, 'id'>) => Promise<void> | void;
  onUpdateHostileTarget?: (target: HostileTarget) => Promise<void> | void;
  onDeleteHostileTarget?: (id: string) => Promise<void> | void;
  onNavigateToMain: () => void;
  onNavigateToEnhancement?: () => void;
  onAddToast?: (title: string, message: string, type?: 'kill' | 'spawn' | 'info') => void;
  // Optional legacy props for backwards-compatibility
  serverBosses?: any[];
  serverLogs?: any[];
  onInstantKill?: any;
  onMissedSpawn?: any;
  onCustomKill?: any;
  onSaveBoss?: any;
  onDeleteBoss?: any;
  onResetBoss?: any;
  onSetStatus?: any;
}

type SortMode = 'NAME_ASC' | 'NAME_DESC' | 'DATE_DESC' | 'DATE_ASC';

export function ServerBossView({
  hostileTargets = [],
  session,
  adminPassword = '0606',
  onSaveHostileTarget,
  onUpdateHostileTarget,
  onDeleteHostileTarget,
  onNavigateToMain,
  onNavigateToEnhancement,
  onAddToast,
}: ServerBossViewProps) {
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('DATE_DESC');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [targetToRelease, setTargetToRelease] = useState<HostileTarget | null>(null);
  const [targetToEdit, setTargetToEdit] = useState<HostileTarget | null>(null);

  // Filtered & Sorted Hostile Target List
  const filteredAndSortedList = useMemo(() => {
    let result = [...hostileTargets];

    // 1. Filter by Search Query (Target ID, Memo, CreatedBy)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.targetId.toLowerCase().includes(q) ||
          (item.memo && item.memo.toLowerCase().includes(q)) ||
          item.createdBy.toLowerCase().includes(q)
      );
    }

    // 2. Sort by Selected Mode
    result.sort((a, b) => {
      if (sortMode === 'NAME_ASC') {
        return a.targetId.localeCompare(b.targetId, 'ko-KR');
      }
      if (sortMode === 'NAME_DESC') {
        return b.targetId.localeCompare(a.targetId, 'ko-KR');
      }
      if (sortMode === 'DATE_ASC') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      // Default: DATE_DESC (Newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return result;
  }, [hostileTargets, searchQuery, sortMode]);

  // Handle Sort Toggle Shortcuts
  const toggleNameSort = () => {
    if (sortMode === 'NAME_ASC') {
      setSortMode('NAME_DESC');
    } else {
      setSortMode('NAME_ASC');
    }
  };

  const toggleDateSort = () => {
    if (sortMode === 'DATE_DESC') {
      setSortMode('DATE_ASC');
    } else {
      setSortMode('DATE_DESC');
    }
  };

  // Export to TXT File
  // Requirement: 추출내용은 경계대상 아이디, 등록일자, 등록자아이디 세가지 데이터만 각 줄에 표시
  const handleExportTxt = () => {
    if (hostileTargets.length === 0) {
      onAddToast?.('추출 실패', '추출할 경계 대상 데이터가 없습니다.', 'info');
      return;
    }

    const lines = hostileTargets.map(
      (item) => `${item.targetId}\t${item.createdAt}\t${item.createdBy}`
    );
    const content = '\uFEFF' + lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `개인_적대_목록_${today}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onAddToast?.(
      '📄 TXT 파일 추출 완료',
      `총 ${hostileTargets.length}건의 경계 대상 데이터가 다운로드되었습니다.`,
      'info'
    );
  };

  // Export to Excel (CSV) File
  // Requirement: 추출내용은 경계대상 아이디, 등록일자, 등록자아이디 세가지 데이터만 각 줄에 표시
  const handleExportExcel = () => {
    if (hostileTargets.length === 0) {
      onAddToast?.('추출 실패', '추출할 경계 대상 데이터가 없습니다.', 'info');
      return;
    }

    const header = '경계대상 아이디,등록일자,등록자아이디';
    const rows = hostileTargets.map((item) => {
      const cleanTargetId = `"${item.targetId.replace(/"/g, '""')}"`;
      const cleanDate = `"${item.createdAt.replace(/"/g, '""')}"`;
      const cleanUser = `"${item.createdBy.replace(/"/g, '""')}"`;
      return `${cleanTargetId},${cleanDate},${cleanUser}`;
    });
    const csvContent = '\uFEFF' + [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `개인_적대_목록_${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onAddToast?.(
      '📊 엑셀(CSV) 추출 완료',
      `총 ${hostileTargets.length}건의 경계 대상 데이터가 다운로드되었습니다.`,
      'info'
    );
  };

  // Add Hostile Target Handler
  const handleSave = async (targetData: Omit<HostileTarget, 'id'>) => {
    if (onSaveHostileTarget) {
      await onSaveHostileTarget(targetData);
      onAddToast?.(
        '⚔️ 경계대상 등록 완료',
        `'${targetData.targetId}'님이 경계 목록에 등록되었습니다.`,
        'kill'
      );
    }
  };

  // Delete / Release Hostile Target Handler
  const handleConfirmRelease = async (targetId: string) => {
    if (onDeleteHostileTarget) {
      const targetObj = hostileTargets.find((t) => t.id === targetId);
      const name = targetObj?.targetId || '대상';
      await onDeleteHostileTarget(targetId);
      onAddToast?.(
        '🛡️ 경계해제 완료',
        `'${name}'님이 경계 목록에서 삭제되었습니다.`,
        'info'
      );
    }
  };

  // Update Hostile Target Handler
  const handleUpdate = async (updatedTarget: HostileTarget) => {
    if (onUpdateHostileTarget) {
      await onUpdateHostileTarget(updatedTarget);
      onAddToast?.(
        '✏️ 경계대상 수정 완료',
        `'${updatedTarget.targetId}' 정보가 성공적으로 수정되었습니다.`,
        'info'
      );
    }
  };

  return (
    <div id="hostile-list-view" className="flex-1 w-full max-w-[1920px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-5">
      {/* Top Banner: Title & Primary Actions */}
      <div className="bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-rose-950/40 border border-rose-500/30 rounded-2xl p-4 sm:p-5 mb-5 shadow-lg backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl text-rose-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  개인 적대 목록
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                  실시간 공유
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  총 <span className="text-rose-400 font-extrabold">{hostileTargets.length}</span>명
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                길드 공유 적대 및 경계 플레이어 목록 (운영자 암호 보안 관리)
              </p>
            </div>
          </div>

          {/* Action Buttons: Add Target & File Export */}
          <div className="flex items-center gap-2 flex-wrap self-start lg:self-center">
            {/* Export TXT Button */}
            <button
              id="export-hostile-txt-button"
              type="button"
              onClick={handleExportTxt}
              className="px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="경계 목록을 TXT 파일로 추출"
            >
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span>TXT 추출</span>
            </button>

            {/* Export Excel Button */}
            <button
              id="export-hostile-excel-button"
              type="button"
              onClick={handleExportExcel}
              className="px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="경계 목록을 엑셀(CSV) 파일로 추출"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>엑셀 추출</span>
            </button>

            {/* Add Hostile Target Button (Prominent) */}
            <button
              id="open-add-hostile-modal-button"
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 hover:from-rose-500 hover:via-red-500 hover:to-amber-500 active:scale-95 text-white font-black text-xs sm:text-sm shadow-md shadow-rose-950/60 flex items-center gap-2 transition-all cursor-pointer ring-2 ring-rose-400/40"
            >
              <UserPlus className="w-4 h-4 stroke-[2.5]" />
              <span>경계대상 추가</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Quick Links to other pages */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            id="hostile-to-regen-timer-button"
            type="button"
            onClick={onNavigateToMain}
            className="relative inline-flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:via-sky-400 hover:to-blue-500 active:scale-95 text-slate-950 font-black text-xs sm:text-sm shadow-md shadow-cyan-500/30 border border-cyan-300/60 ring-2 ring-cyan-400/50 hover:ring-cyan-300 transition-all cursor-pointer group"
            title="리젠 타이머 페이지로 이동"
          >
            <Shield className="w-4 h-4 text-slate-950 group-hover:scale-110 transition-transform" />
            <span className="tracking-tight text-slate-950 font-black">리젠 타이머로 이동</span>
            <span className="bg-black/25 text-slate-950 px-1.5 py-0.2 rounded text-[10px] font-bold">
              이동 ➔
            </span>
          </button>

          {onNavigateToEnhancement && (
            <button
              id="hostile-to-enhancement-button"
              type="button"
              onClick={onNavigateToEnhancement}
              className="relative inline-flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 hover:from-purple-500 hover:via-fuchsia-500 hover:to-indigo-500 active:scale-95 text-white font-black text-xs sm:text-sm shadow-md shadow-purple-900/50 border border-purple-300/70 ring-2 ring-purple-400/60 hover:ring-purple-300 transition-all cursor-pointer group"
              title="수집템 강화 요청소 페이지로 이동"
            >
              <Sparkles className="w-4 h-4 text-white group-hover:rotate-12 transition-transform" />
              <span className="tracking-tight text-white font-black">수집템 강화 요청소</span>
              <span className="bg-black/30 text-purple-200 px-1.5 py-0.2 rounded text-[10px] font-bold">
                이동 ➔
              </span>
            </button>
          )}
        </div>

        <div className="text-xs text-slate-400">
          표시 중: <span className="text-white font-bold">{filteredAndSortedList.length}</span>명
          {searchQuery && ` (검색어: "${searchQuery}")`}
        </div>
      </div>

      {/* Filter & Search Bar with Sort Shortcuts */}
      <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-2.5 sm:p-3 mb-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 backdrop-blur-sm shadow-sm">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="hostile-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="경계대상 아이디 검색..."
            className="w-full bg-slate-950 border border-slate-700/90 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
              title="검색어 지우기"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Short-cut Sort Buttons: 가나다순 정렬 & 등록일자순 정렬 */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-slate-400 hidden sm:inline">정렬:</span>

          {/* 가나다순 정렬 단축 버튼 */}
          <button
            id="sort-by-name-button"
            type="button"
            onClick={toggleNameSort}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              sortMode === 'NAME_ASC' || sortMode === 'NAME_DESC'
                ? 'bg-rose-950/80 text-rose-300 border border-rose-500/70 shadow-sm shadow-rose-950/40 ring-1 ring-rose-500/50'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 border border-slate-700'
            }`}
            title="경계대상 아이디 가나다순 정렬"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>가나다순 정렬</span>
            {sortMode === 'NAME_ASC' && <span className="text-[10px] text-rose-400 font-mono">(오름차순)</span>}
            {sortMode === 'NAME_DESC' && <span className="text-[10px] text-rose-400 font-mono">(내림차순)</span>}
          </button>

          {/* 등록일자순 정렬 단축 버튼 */}
          <button
            id="sort-by-date-button"
            type="button"
            onClick={toggleDateSort}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              sortMode === 'DATE_DESC' || sortMode === 'DATE_ASC'
                ? 'bg-amber-950/80 text-amber-300 border border-amber-500/70 shadow-sm shadow-amber-950/40 ring-1 ring-amber-500/50'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 border border-slate-700'
            }`}
            title="등록일자순 정렬"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>등록일자순 정렬</span>
            {sortMode === 'DATE_DESC' && <span className="text-[10px] text-amber-400 font-mono">(최신순)</span>}
            {sortMode === 'DATE_ASC' && <span className="text-[10px] text-amber-400 font-mono">(과거순)</span>}
          </button>
        </div>
      </div>

      {/* Hostile List Table / Items */}
      {filteredAndSortedList.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center">
          <AlertOctagon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base sm:text-lg font-bold text-white mb-1">
            {searchQuery
              ? '검색 조건에 맞는 경계 대상이 없습니다.'
              : '현재 등록된 경계 대상이 없습니다.'}
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            {searchQuery
              ? '검색어를 변경하거나 초기화해 보세요.'
              : '적대 및 경계 플레이어가 발견되면 [경계대상 추가] 버튼을 눌러 등록하세요.'}
          </p>
          {!searchQuery && (
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>경계대상 추가하기</span>
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {/* Header Row for large screens */}
          <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-900/40 rounded-xl border border-slate-800/40">
            <div className="col-span-4">경계대상 아이디</div>
            <div className="col-span-3">추가된 일자</div>
            <div className="col-span-2">추가한 사람 (등록자)</div>
            <div className="col-span-3 text-right">관리 (수정 · 경계해제)</div>
          </div>

          {/* List Items */}
          {filteredAndSortedList.map((item, index) => (
            <div
              key={item.id}
              className="bg-slate-900/90 hover:bg-slate-850 border border-slate-800/90 hover:border-rose-500/40 rounded-2xl p-3.5 sm:p-4 transition-all shadow-sm flex flex-col md:grid md:grid-cols-12 gap-3 items-start md:items-center justify-between"
            >
              {/* 1. 경계대상 아이디 & 메모 */}
              <div className="md:col-span-4 flex items-center gap-3 w-full">
                <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center text-rose-400 font-mono text-xs font-black shrink-0">
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm sm:text-base font-black text-white tracking-wide truncate">
                      {item.targetId}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-rose-950/80 text-rose-300 border border-rose-700/60 shrink-0">
                      경계
                    </span>
                  </div>
                  {item.memo && (
                    <p className="text-xs text-slate-400 mt-0.5 truncate" title={item.memo}>
                      사유: {item.memo}
                    </p>
                  )}
                </div>
              </div>

              {/* 2. 추가된 일자 */}
              <div className="md:col-span-3 flex items-center gap-2 text-xs text-slate-300 font-mono">
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="md:hidden text-slate-500">등록일자:</span>
                <span>{item.createdAt}</span>
              </div>

              {/* 3. 추가한 사람의 아이디 */}
              <div className="md:col-span-2 flex items-center gap-2 text-xs text-slate-300">
                <User className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="md:hidden text-slate-500">등록자:</span>
                <span className="font-semibold px-2 py-0.5 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-200">
                  {item.createdBy}
                </span>
              </div>

              {/* 4. 수정 및 경계해제 버튼 (운영자 암호 확인 팝업) */}
              <div className="md:col-span-3 flex items-center justify-end gap-1.5 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setTargetToEdit(item)}
                  className="flex-1 md:flex-initial px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 active:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 hover:border-amber-500/60 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  title="운영자 비밀번호 확인 후 내용 수정"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                  <span>수정</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTargetToRelease(item)}
                  className="flex-1 md:flex-initial px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 active:bg-rose-900 text-rose-300 hover:text-white border border-rose-800/60 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-rose-950/30"
                  title="운영자 비밀번호 확인 후 경계 목록에서 삭제"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>경계해제</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Hostile Modal */}
      <AddHostileModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSave}
        currentUserId={session.userId}
        existingTargets={hostileTargets}
      />

      {/* Edit Hostile Modal */}
      <EditHostileModal
        isOpen={!!targetToEdit}
        target={targetToEdit}
        onClose={() => setTargetToEdit(null)}
        onSave={handleUpdate}
        adminPassword={adminPassword}
        existingTargets={hostileTargets}
      />

      {/* Release Hostile Password Modal */}
      <ReleaseHostilePasswordModal
        isOpen={!!targetToRelease}
        target={targetToRelease}
        onClose={() => setTargetToRelease(null)}
        onConfirm={handleConfirmRelease}
        adminPassword={adminPassword}
      />
    </div>
  );
}
