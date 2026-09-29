import { useState, useMemo } from 'react';
import { 
  Sparkles, 
  Plus, 
  Search, 
  Shield, 
  Clock, 
  User, 
  Edit3, 
  Trash2, 
  ArrowLeft, 
  Globe, 
  CheckCircle2, 
  Flame,
  Layers,
  Filter,
  MessageSquare,
  ArrowDownUp,
  LayoutGrid,
  ListOrdered
} from 'lucide-react';
import { EnhancementRequestGroup, UserSession } from '../types';
import { EnhancementRequestModal } from './EnhancementRequestModal';
import { EnhancementPasswordModal } from './EnhancementPasswordModal';
import { sortEnhancementGroups, aggregateByItemName, groupCardEnhancementItems } from '../utils/enhancementUtils';

interface EnhancementRequestsViewProps {
  requests: EnhancementRequestGroup[];
  session: UserSession;
  onNavigateToMain: () => void;
  onNavigateToServerBoss: () => void;
  onSaveRequest: (request: EnhancementRequestGroup) => Promise<void>;
  onDeleteRequest: (requestId: string) => Promise<void>;
  onAddToast?: (title: string, message: string, type?: 'kill' | 'spawn' | 'info') => void;
}

export function EnhancementRequestsView({
  requests,
  session,
  onNavigateToMain,
  onNavigateToServerBoss,
  onSaveRequest,
  onDeleteRequest,
  onAddToast,
}: EnhancementRequestsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'MINE'>('ALL');
  // 정렬 기준: 'ITEM_NAME' (동일 아이템 모아보기 - 기본값), 'LATEST' (최신순), 'TARGET_LEVEL' (목표강화순), 'USER' (요청자순)
  const [sortMode, setSortMode] = useState<'ITEM_NAME' | 'LATEST' | 'TARGET_LEVEL' | 'USER'>('ITEM_NAME');
  // 보기 모드: 'CARD' (카드별 보기), 'ITEM' (동일 아이템별 묶음 보기)
  const [viewMode, setViewMode] = useState<'CARD' | 'ITEM'>('CARD');
  
  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [requestToEdit, setRequestToEdit] = useState<EnhancementRequestGroup | null>(null);
  
  // Password verify modal state
  const [passwordTarget, setPasswordTarget] = useState<EnhancementRequestGroup | null>(null);
  const [passwordAction, setPasswordAction] = useState<'EDIT' | 'DELETE'>('EDIT');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Filtered and sorted requests (동일 아이템이 비슷한 위치에 오도록 자동 정렬)
  const filteredRequests = useMemo(() => {
    const filtered = requests.filter((req) => {
      // 1) Filter tab
      if (filterType === 'MINE' && req.userId !== session.userId) {
        return false;
      }

      // 2) Search query (Item name, user id, or memo)
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesUser = req.userId.toLowerCase().includes(query);
        const matchesMemo = req.memo?.toLowerCase().includes(query);
        const matchesItems = req.items.some((it) => it.itemName.toLowerCase().includes(query));
        if (!matchesUser && !matchesMemo && !matchesItems) {
          return false;
        }
      }

      return true;
    });

    // 수정될 때마다 체크하여 동일한 아이템이 비슷한 위치에 오도록 자동 정렬
    return sortEnhancementGroups(filtered, sortMode);
  }, [requests, filterType, searchQuery, session.userId, sortMode]);

  // 동일 아이템 이름별 집계 목록 (아이템별 묶음 보기용)
  const aggregatedItems = useMemo(() => {
    return aggregateByItemName(filteredRequests);
  }, [filteredRequests]);

  // Summary counts (총 요청 아이템 수량 합산)
  const totalItemsCount = useMemo(() => {
    return requests.reduce((acc, r) => {
      return acc + (r.items?.reduce((sum, it) => sum + (it.count || 1), 0) || 0);
    }, 0);
  }, [requests]);

  const highTierItemsCount = useMemo(() => {
    return requests.reduce((acc, r) => {
      return (
        acc +
        (r.items?.filter((it) => it.targetLevel >= 7).reduce((sum, it) => sum + (it.count || 1), 0) || 0)
      );
    }, 0);
  }, [requests]);

  // Prompt password for edit
  const handlePromptEdit = (req: EnhancementRequestGroup) => {
    setPasswordTarget(req);
    setPasswordAction('EDIT');
    setIsPasswordModalOpen(true);
  };

  // Prompt password for delete
  const handlePromptDelete = (req: EnhancementRequestGroup) => {
    setPasswordTarget(req);
    setPasswordAction('DELETE');
    setIsPasswordModalOpen(true);
  };

  // On password verified successfully
  const handlePasswordVerified = async (target: EnhancementRequestGroup) => {
    if (passwordAction === 'EDIT') {
      setRequestToEdit(target);
      setIsCreateModalOpen(true);
    } else if (passwordAction === 'DELETE') {
      try {
        await onDeleteRequest(target.id);
        onAddToast?.(
          '강화 요청 삭제 완료',
          `'${target.userId}'님의 강화 요청 리스트가 성공적으로 삭제되었습니다.`,
          'info'
        );
      } catch (e: any) {
        console.error('Delete request error:', e);
      }
    }
  };

  // Handle save from modal
  const handleSaveModal = async (saved: EnhancementRequestGroup) => {
    await onSaveRequest(saved);
    onAddToast?.(
      requestToEdit ? '강화 요청 수정 완료' : '신규 강화 요청 등록 완료',
      `${saved.items.length}개의 수집템 강화 요청이 등록되었습니다.`,
      'info'
    );
  };

  // Format date helper
  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('ko-KR', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch {
      return isoStr;
    }
  };

  // Target level color styling
  const getLevelStyle = (level: number) => {
    if (level >= 9) {
      return 'bg-gradient-to-r from-amber-500 to-yellow-300 text-slate-950 font-black shadow-sm shadow-amber-500/50 border border-amber-300 ring-1 ring-amber-400';
    }
    if (level >= 7) {
      return 'bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white font-black shadow-sm shadow-purple-900/50 border border-purple-400/50';
    }
    if (level >= 4) {
      return 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold border border-cyan-400/40';
    }
    return 'bg-slate-800 text-slate-200 border border-slate-700 font-bold';
  };

  return (
    <div className="flex-1 w-full max-w-[1920px] mx-auto px-3 sm:px-6 lg:px-8 py-5 animate-in fade-in">
      {/* Top Banner & Quick Navigation */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-950/60 via-slate-900/90 to-indigo-950/60 border border-purple-500/30 p-4 sm:p-6 mb-6 shadow-xl shadow-purple-950/20">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-900/50 shrink-0">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  수집템 강화 요청소
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-900/70 border border-purple-400/40 text-[11px] font-bold text-purple-200">
                  비밀번호 보안 등록
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                길드원 간 수집 도감 등록 아이템의 목표 강화단계와 귀속 여부를 등록하고 공유하는 게시판입니다.
              </p>
            </div>
          </div>

          {/* Action Buttons & Nav Links */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="nav-back-to-main-button"
              type="button"
              onClick={onNavigateToMain}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>리젠 타이머</span>
            </button>

            <button
              id="nav-to-server-boss-from-enhancement"
              type="button"
              onClick={onNavigateToServerBoss}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 border border-amber-500/40 text-xs font-semibold transition-all cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>개인 적대 목록</span>
            </button>

            {/* Eye-catching Register Request Button */}
            <button
              id="open-register-enhancement-modal-button"
              type="button"
              onClick={() => {
                setRequestToEdit(null);
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 hover:from-purple-500 hover:via-fuchsia-500 hover:to-indigo-500 active:scale-95 text-white font-black text-xs sm:text-sm shadow-lg shadow-purple-900/50 border border-purple-300/60 ring-2 ring-purple-400/40 transition-all cursor-pointer group"
            >
              <Plus className="w-4 h-4 text-white group-hover:rotate-90 transition-transform" />
              <span>강화요청 등록</span>
            </button>
          </div>
        </div>

        {/* Stats strip inside banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-slate-800/80">
          <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800 flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-purple-400 shrink-0" />
            <div>
              <div className="text-[11px] text-slate-400">등록된 의뢰</div>
              <div className="text-sm sm:text-base font-black text-white">{requests.length}건</div>
            </div>
          </div>

          <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800 flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-cyan-400 shrink-0" />
            <div>
              <div className="text-[11px] text-slate-400">총 요청 아이템</div>
              <div className="text-sm sm:text-base font-black text-cyan-300">{totalItemsCount}개</div>
            </div>
          </div>

          <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800 flex items-center gap-2.5">
            <Flame className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <div className="text-[11px] text-slate-400">고강화 목표 (+7~)</div>
              <div className="text-sm sm:text-base font-black text-amber-300">{highTierItemsCount}개</div>
            </div>
          </div>

          <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800 flex items-center gap-2.5">
            <User className="w-4 h-4 text-purple-400 shrink-0" />
            <div>
              <div className="text-[11px] text-slate-400">내 등록 의뢰</div>
              <div className="text-sm sm:text-base font-black text-purple-300">
                {requests.filter((r) => r.userId === session.userId).length}건
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-5">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            id="enhancement-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="아이템 이름, 요청자 ID, 메모 검색..."
            className="w-full pl-9 pr-3 py-2 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            id="filter-enhancement-all"
            type="button"
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterType === 'ALL'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            전체 ({requests.length})
          </button>

          <button
            id="filter-enhancement-mine"
            type="button"
            onClick={() => setFilterType('MINE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterType === 'MINE'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            내 요청만 ({requests.filter((r) => r.userId === session.userId).length})
          </button>
        </div>
      </div>

      {/* Sort & View Mode Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 text-xs">
        {/* Sort Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 text-slate-400 font-bold mr-1 shrink-0">
            <ArrowDownUp className="w-3.5 h-3.5 text-purple-400" />
            <span>정렬:</span>
          </div>
          <button
            id="sort-enhancement-item-name"
            type="button"
            onClick={() => setSortMode('ITEM_NAME')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
              sortMode === 'ITEM_NAME'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-950/80 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
            title="동일한 아이템을 요청한 목록끼리 서로 인접하게 모아서 정렬합니다"
          >
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>동일 아이템 모아보기 (기본)</span>
          </button>
          <button
            id="sort-enhancement-latest"
            type="button"
            onClick={() => setSortMode('LATEST')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              sortMode === 'LATEST'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-950/80 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            최신 등록/수정순
          </button>
          <button
            id="sort-enhancement-target-level"
            type="button"
            onClick={() => setSortMode('TARGET_LEVEL')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              sortMode === 'TARGET_LEVEL'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-950/80 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            목표강화 높은순
          </button>
          <button
            id="sort-enhancement-user"
            type="button"
            onClick={() => setSortMode('USER')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              sortMode === 'USER'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-950/80 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            요청자순
          </button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto bg-slate-950/80 p-0.5 rounded-lg border border-slate-800">
          <button
            id="view-mode-card"
            type="button"
            onClick={() => setViewMode('CARD')}
            className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1 ${
              viewMode === 'CARD'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="요청자별 카드 형태로 표시 (동일 아이템 인접 정렬)"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>카드별 보기</span>
          </button>
          <button
            id="view-mode-item"
            type="button"
            onClick={() => setViewMode('ITEM')}
            className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'ITEM'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="동일 아이템별로 완벽하게 묶어서 한눈에 표시"
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>아이템별 묶음</span>
            <span className="px-1 py-0.2 rounded bg-purple-950 text-[10px] text-purple-300 border border-purple-500/40">
              {aggregatedItems.length}종
            </span>
          </button>
        </div>
      </div>

      {/* Request Cards Grid */}
      {filteredRequests.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-10 text-center text-slate-400">
          <Sparkles className="w-10 h-10 text-purple-400/60 mx-auto mb-3 animate-pulse" />
          <h3 className="text-base font-bold text-white mb-1">등록된 강화 요청이 없습니다</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
            {searchQuery
              ? '검색 조건과 일치하는 강화 요청이 없습니다. 검색어를 변경해보세요.'
              : '수집 도감에 필요한 아이템의 강화 요청을 직접 등록해보세요.'}
          </p>
          <button
            id="empty-state-register-enhancement-button"
            type="button"
            onClick={() => {
              setRequestToEdit(null);
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>신규 강화요청 등록하기</span>
          </button>
        </div>
      ) : viewMode === 'ITEM' ? (
        /* 동일 아이템별 묶음 보기 */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {aggregatedItems.map((agg) => (
            <div
              key={agg.itemName}
              id={`item-group-${agg.itemName}`}
              className="bg-slate-900/90 border border-slate-800 hover:border-purple-500/40 rounded-2xl p-4 shadow-lg transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Aggregated Item Header */}
                <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-800">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-white truncate">{agg.itemName}</h4>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                        <span className="text-purple-400 font-bold">총 {agg.totalCount}개 요청</span>
                        <span className="text-slate-600">·</span>
                        <span className="text-slate-300">{agg.entries.length}명 참여</span>
                        <span className="text-slate-600">·</span>
                        <span className="text-amber-300 font-bold">최고 +{agg.maxTargetLevel}강</span>
                      </div>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-500/40 text-[11px] font-black text-purple-300 shrink-0">
                    {agg.totalCount}개 모음
                  </span>
                </div>

                {/* Requesters list for this identical item */}
                <div className="space-y-2">
                  {agg.entries.map((entry, idx) => {
                    const isMyReq = entry.userId === session.userId;
                    return (
                      <div
                        key={`${entry.groupId}-${idx}`}
                        className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80 flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          {/* Requester & Level & Count */}
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span
                              className={`w-8 h-6 rounded-md flex items-center justify-center text-xs font-mono shrink-0 ${getLevelStyle(
                                entry.item.targetLevel
                              )}`}
                              title={`목표 강화: +${entry.item.targetLevel}강`}
                            >
                              +{entry.item.targetLevel}
                            </span>

                            <div className="flex items-center gap-1.5 truncate">
                              <span className="text-xs font-bold text-slate-200 truncate">
                                {entry.userId}
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                                  entry.count > 1
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                                }`}
                                title={`요청 수량: ${entry.count}개`}
                              >
                                {entry.count}개
                              </span>
                              {isMyReq && (
                                <span className="px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-500/40 text-[9px] font-semibold shrink-0">
                                  내 요청
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handlePromptEdit(entry.group)}
                              className="p-1 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                              title="비밀번호 입력 후 수정"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePromptDelete(entry.group)}
                              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                              title="비밀번호 입력 후 삭제"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Memo if any */}
                        {entry.memo && (
                          <div className="text-[11px] text-purple-300/90 bg-purple-950/30 px-2 py-1 rounded-md border border-purple-900/30 truncate">
                            <span className="font-semibold text-purple-400 mr-1">메모:</span>
                            <span>{entry.memo}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* 카드별 보기 (동일 아이템이 비슷한 위치에 오도록 자동 정렬됨) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRequests.map((req) => {
            const isMyRequest = req.userId === session.userId;
            return (
              <div
                key={req.id}
                id={`enhancement-request-card-${req.id}`}
                className="bg-slate-900/90 border border-slate-800 hover:border-purple-500/40 rounded-2xl p-4 shadow-lg transition-all flex flex-col justify-between group"
              >
                {/* Card Header */}
                <div>
                  <div className="mb-3 pb-2.5 border-b border-slate-800">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300 font-black text-xs shrink-0 mt-0.5">
                          {req.userId.substring(0, 1)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-black text-white truncate">{req.userId}</span>
                            {isMyRequest && (
                              <span className="px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-500/40 text-[10px] font-semibold shrink-0">
                                내 요청
                              </span>
                            )}
                            <div className="flex items-center gap-1 text-[11px] text-slate-400">
                              <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                              <span>{formatDate(req.createdAt)}</span>
                            </div>
                          </div>

                          {/* 강화요청 등록 메모 내용 (등록카드 아이디 바로 밑에 표기) */}
                          {req.memo && (
                            <div className="mt-2 bg-purple-950/40 border border-purple-800/50 rounded-xl px-2.5 py-1.5 text-xs text-purple-200 flex items-start gap-1.5">
                              <MessageSquare className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                              <div className="break-words leading-relaxed min-w-0">
                                <span className="font-bold text-purple-300 mr-1.5">메모:</span>
                                <span>{req.memo}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Small action icon buttons for Edit & Delete (Both require password) */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          id={`edit-request-${req.id}`}
                          type="button"
                          onClick={() => handlePromptEdit(req)}
                          className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          title="비밀번호 입력 후 수정"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          id={`delete-request-${req.id}`}
                          type="button"
                          onClick={() => handlePromptDelete(req)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          title="비밀번호 입력 후 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Items List (동일 아이템은 하나로 표기하고 옆에 갯수를 표기) */}
                  <div className="space-y-2">
                    {groupCardEnhancementItems(req.items).map((item) => (
                      <div
                        key={item.id}
                        id={`enhancement-item-${req.id}-${item.itemName}-${item.targetLevel}`}
                        className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 flex items-center justify-between gap-2"
                      >
                        {/* Target Level Badge */}
                        <span
                          className={`w-10 h-7 rounded-lg flex items-center justify-center text-xs font-mono shrink-0 ${getLevelStyle(
                            item.targetLevel
                          )}`}
                          title={`목표 강화: +${item.targetLevel}강`}
                        >
                          +{item.targetLevel}
                        </span>

                        {/* Item Name & Count (갯수) & Duplicate Count Badge across users */}
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <span className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                            {item.itemName}
                          </span>

                          {/* 갯수 표기 (동일 아이템 여러 개일 경우 강조) */}
                          <span
                            id={`item-count-badge-${req.id}-${item.itemName}`}
                            className={`px-2 py-0.5 rounded-md text-xs font-extrabold shrink-0 flex items-center gap-1 ${
                              item.count > 1
                                ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300 shadow-sm ring-1 ring-amber-500/30'
                                : 'bg-slate-800/80 border border-slate-700/80 text-slate-300 text-[11px]'
                            }`}
                            title={`요청 수량: ${item.count}개`}
                          >
                            <span>{item.count}개</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <EnhancementRequestModal
        isOpen={isCreateModalOpen}
        requestToEdit={requestToEdit}
        currentUserId={session.userId}
        onClose={() => {
          setIsCreateModalOpen(false);
          setRequestToEdit(null);
        }}
        onSave={handleSaveModal}
      />

      {/* Password verification prompt modal */}
      <EnhancementPasswordModal
        isOpen={isPasswordModalOpen}
        request={passwordTarget}
        actionType={passwordAction}
        onClose={() => {
          setIsPasswordModalOpen(false);
          setPasswordTarget(null);
        }}
        onSuccess={handlePasswordVerified}
      />
    </div>
  );
}
