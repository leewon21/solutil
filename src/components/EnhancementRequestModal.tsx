import { useState, useEffect, type FormEvent } from 'react';
import { X, Sparkles, Plus, Trash2, Shield, Lock, CheckCircle2 } from 'lucide-react';
import { EnhancementRequestGroup, EnhancementItem } from '../types';
import { sortEnhancementItems, consolidateEnhancementItems } from '../utils/enhancementUtils';

interface EnhancementRequestModalProps {
  isOpen: boolean;
  requestToEdit: EnhancementRequestGroup | null;
  currentUserId: string;
  onClose: () => void;
  onSave: (request: EnhancementRequestGroup) => Promise<void>;
}

export function EnhancementRequestModal({
  isOpen,
  requestToEdit,
  currentUserId,
  onClose,
  onSave,
}: EnhancementRequestModalProps) {
  const [password, setPassword] = useState('');
  const [memo, setMemo] = useState('');
  const [items, setItems] = useState<EnhancementItem[]>([
    {
      id: `item-${Date.now()}-1`,
      itemName: '',
      targetLevel: 5,
      isCompleted: false,
      count: 1,
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (requestToEdit) {
      setPassword(requestToEdit.password);
      setMemo(requestToEdit.memo || '');
      setItems(
        requestToEdit.items && requestToEdit.items.length > 0
          ? requestToEdit.items.map((it) => ({
              ...it,
              count: Math.max(1, Number(it.count) || 1),
            }))
          : [
              {
                id: `item-${Date.now()}-1`,
                itemName: '',
                targetLevel: 5,
                isCompleted: false,
                count: 1,
              },
            ]
      );
    } else {
      setPassword('');
      setMemo('');
      setItems([
        {
          id: `item-${Date.now()}-1`,
          itemName: '',
          targetLevel: 5,
          isCompleted: false,
          count: 1,
        },
      ]);
    }
    setError(null);
  }, [requestToEdit, isOpen]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        itemName: '',
        targetLevel: 5,
        isCompleted: false,
        count: 1,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setError('최소 1개 이상의 요청 아이템이 필요합니다.');
      return;
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: keyof EnhancementItem, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return updated;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password.trim()) {
      setError('수정 및 삭제 시 사용할 비밀번호를 입력해주세요.');
      return;
    }

    // Validate items
    const invalidItem = items.find((it) => !it.itemName.trim());
    if (invalidItem) {
      setError('모든 요청 아이템의 이름을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      const sanitizedItems = items.map((it) => ({
        ...it,
        itemName: it.itemName.trim(),
        targetLevel: Number(it.targetLevel),
        count: Math.max(1, Math.min(99, Number(it.count) || 1)),
      }));

      // 동일한 아이템이 등록된 경우 하나로 병합 후 가나다순/목표강화순 정렬
      const consolidatedItems = consolidateEnhancementItems(sanitizedItems);
      const sortedItems = sortEnhancementItems(consolidatedItems);

      const payload: EnhancementRequestGroup = {
        id: requestToEdit ? requestToEdit.id : `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        userId: requestToEdit ? requestToEdit.userId : currentUserId,
        password: password.trim(),
        memo: memo.trim(),
        items: sortedItems,
        createdAt: requestToEdit ? requestToEdit.createdAt : now,
        updatedAt: now,
      };

      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-purple-500/40 rounded-2xl shadow-2xl shadow-purple-950/50 p-5 sm:p-6 text-slate-100 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>{requestToEdit ? '강화 요청 수정' : '신규 수집템 강화 요청 등록'}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-500/40 text-purple-300">
                  아이디: {requestToEdit ? requestToEdit.userId : currentUserId}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                수집템 도감 등록을 위한 강화 요청 리스트를 등록합니다.
              </p>
            </div>
          </div>
          <button
            id="close-enhancement-modal-button"
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-medium">
              {error}
            </div>
          )}

          {/* Password Protection Field */}
          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
            <label className="block text-xs font-bold text-amber-300 mb-1 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>수정/삭제 보안 비밀번호 *</span>
              <span className="text-[11px] text-slate-400 font-normal">
                (다른 유저가 임의로 수정/삭제할 수 없도록 보호합니다)
              </span>
            </label>
            <input
              id="enhancement-password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="수정/삭제 시 사용할 비밀번호 입력 (예: 1234)"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-mono"
              required
            />
          </div>

          {/* Request Items Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-cyan-400" />
                <span>요청 수집템 목록 ({items.length}개)</span>
              </label>
              <button
                id="add-enhancement-item-row-button"
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 rounded-lg text-xs font-bold text-purple-200 transition-all cursor-pointer active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>아이템 추가</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/90 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center gap-2.5"
                >
                  <span className="text-xs font-mono font-bold text-purple-400 w-5 shrink-0 text-center sm:text-left">
                    #{index + 1}
                  </span>

                  {/* 1) 요청 아이템 이름 (텍스트 박스) */}
                  <div className="flex-1 min-w-[160px]">
                    <input
                      id={`enhancement-item-name-${index}`}
                      type="text"
                      value={item.itemName}
                      onChange={(e) => handleItemChange(index, 'itemName', e.target.value)}
                      placeholder="요청아이템 이름 (예: 고대의 기사 투구)"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>

                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    {/* 2) 강화단계 (0~9 리스트 선택 목록) */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-slate-400 font-medium">강화:</span>
                      <select
                        id={`enhancement-item-level-${index}`}
                        value={item.targetLevel}
                        onChange={(e) => handleItemChange(index, 'targetLevel', Number(e.target.value))}
                        className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-amber-300 focus:outline-none focus:border-amber-500 cursor-pointer font-mono"
                      >
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => (
                          <option key={lvl} value={lvl}>
                            +{lvl}강
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 3) 수량 (갯수) */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-slate-400 font-medium">수량:</span>
                      <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => handleItemChange(index, 'count', Math.max(1, (item.count || 1) - 1))}
                          className="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-xs font-bold cursor-pointer"
                          title="1개 감소"
                        >
                          -
                        </button>
                        <input
                          id={`enhancement-item-count-${index}`}
                          type="number"
                          min={1}
                          max={99}
                          value={item.count || 1}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            handleItemChange(index, 'count', isNaN(val) ? 1 : Math.max(1, Math.min(99, val)));
                          }}
                          className="w-10 py-1 text-xs font-bold text-amber-300 text-center bg-transparent focus:outline-none font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleItemChange(index, 'count', Math.min(99, (item.count || 1) + 1))}
                          className="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-xs font-bold cursor-pointer"
                          title="1개 증가"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-xs text-slate-400 font-medium">개</span>
                    </div>

                    {/* Delete Item Row Button */}
                    {items.length > 1 && (
                      <button
                        id={`enhancement-item-delete-${index}`}
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors shrink-0"
                        title="이 아이템 행 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Memo / Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              요청 메모 / 의뢰 내용 (선택 사항)
            </label>
            <textarea
              id="enhancement-memo-input"
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="예: 대리 강화 부탁드립니다. 주문서 및 비용 전액 지원해드립니다!"
              className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800 shrink-0">
            <button
              id="cancel-enhancement-modal-button"
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              id="save-enhancement-modal-button"
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 hover:from-purple-500 hover:via-fuchsia-500 hover:to-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-purple-900/40 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? '저장 중...' : requestToEdit ? '수정 완료' : '요청 등록하기'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
