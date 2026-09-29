import { EnhancementItem, EnhancementRequestGroup } from '../types';

export interface GroupedEnhancementItem {
  id: string;
  itemName: string;
  targetLevel: number;
  count: number;
  isCompleted?: boolean;
  itemIds: string[];
}

/**
 * 카드 내 동일 아이템 그룹화 함수
 * 카드에 노출되는 리스트에서 동일한 아이템(이름 및 목표강화 수치)이 있을 경우
 * 하나로 합쳐서 노출하고 총 갯수(count)를 함께 계산합니다.
 */
export function groupCardEnhancementItems(items: EnhancementItem[]): GroupedEnhancementItem[] {
  if (!items || items.length === 0) return [];

  const map = new Map<string, GroupedEnhancementItem>();

  for (const item of items) {
    const rawName = (item.itemName || '').trim();
    if (!rawName) continue;

    const level = Number(item.targetLevel) || 0;
    const count = Math.max(1, Number(item.count) || 1);
    const key = `${rawName.toLowerCase()}___${level}`;

    if (!map.has(key)) {
      map.set(key, {
        id: item.id || `grouped-${Date.now()}-${Math.random()}`,
        itemName: rawName,
        targetLevel: level,
        count: 0,
        isCompleted: Boolean(item.isCompleted),
        itemIds: [],
      });
    }

    const grouped = map.get(key)!;
    grouped.count += count;
    grouped.itemIds.push(item.id);
  }

  return Array.from(map.values()).sort((a, b) => {
    const comp = a.itemName.localeCompare(b.itemName, 'ko');
    if (comp !== 0) return comp;
    const lvlDiff = b.targetLevel - a.targetLevel;
    if (lvlDiff !== 0) return lvlDiff;
    return b.count - a.count;
  });
}

/**
 * 아이템 중복 병합 함수 (등록/수정 시 같은 이름, 목표강화인 경우 하나로 병합)
 */
export function consolidateEnhancementItems(items: EnhancementItem[]): EnhancementItem[] {
  if (!items || items.length <= 1) return items ? [...items] : [];

  const map = new Map<string, EnhancementItem>();

  for (const item of items) {
    const rawName = (item.itemName || '').trim();
    if (!rawName) continue;

    const level = Number(item.targetLevel) || 0;
    const count = Math.max(1, Number(item.count) || 1);
    const key = `${rawName.toLowerCase()}___${level}`;

    if (!map.has(key)) {
      map.set(key, {
        ...item,
        itemName: rawName,
        targetLevel: level,
        count,
      });
    } else {
      const existing = map.get(key)!;
      existing.count = (existing.count || 1) + count;
    }
  }

  return Array.from(map.values());
}

/**
 * 아이템 목록 정렬 함수
 * 1. 아이템 이름 가나다순 (한국어 로케일)
 * 2. 동일한 아이템인 경우 목표 강화 레벨 높은순
 */
export function sortEnhancementItems(items: EnhancementItem[]): EnhancementItem[] {
  if (!items || items.length <= 1) return items ? [...items] : [];
  return [...items].sort((a, b) => {
    const nameA = (a.itemName || '').trim();
    const nameB = (b.itemName || '').trim();
    const nameComp = nameA.localeCompare(nameB, 'ko');
    if (nameComp !== 0) return nameComp;

    return (b.targetLevel || 0) - (a.targetLevel || 0);
  });
}

/**
 * 요청 그룹(카드) 정렬 함수: 동일한 아이템이 비슷한 위치에 오도록 정렬
 * 수정이나 등록이 일어날 때마다 각 카드의 내부 아이템을 가나다순으로 정렬한 뒤,
 * 동일한 아이템을 요청한 카드들이 바로 인접한 위치에 오도록 정렬합니다.
 */
export function sortEnhancementGroups(
  groups: EnhancementRequestGroup[],
  sortMode: 'ITEM_NAME' | 'LATEST' | 'TARGET_LEVEL' | 'USER' = 'ITEM_NAME'
): EnhancementRequestGroup[] {
  if (!groups || groups.length <= 1) return groups ? [...groups] : [];

  // 각 그룹 내부의 아이템들을 먼저 가나다순으로 정렬
  const normalizedGroups = groups.map((group) => ({
    ...group,
    items: sortEnhancementItems(group.items || []),
  }));

  if (sortMode === 'LATEST') {
    return normalizedGroups.sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt).getTime();
      return timeB - timeA;
    });
  }

  if (sortMode === 'TARGET_LEVEL') {
    return normalizedGroups.sort((a, b) => {
      const maxA = Math.max(...(a.items?.map((it) => it.targetLevel || 0) || [0]));
      const maxB = Math.max(...(b.items?.map((it) => it.targetLevel || 0) || [0]));
      if (maxA !== maxB) return maxB - maxA;
      const timeA = new Date(a.updatedAt || a.createdAt).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt).getTime();
      return timeB - timeA;
    });
  }

  if (sortMode === 'USER') {
    return normalizedGroups.sort((a, b) => {
      const userComp = (a.userId || '').localeCompare(b.userId || '', 'ko');
      if (userComp !== 0) return userComp;
      const timeA = new Date(a.updatedAt || a.createdAt).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt).getTime();
      return timeB - timeA;
    });
  }

  // 기본값: 'ITEM_NAME' (동일 아이템 모아보기)
  // 카드 내 아이템 이름을 순차적으로 비교하여 동일한 아이템을 포함한 카드가 나란히 위치하도록 정렬
  return normalizedGroups.sort((a, b) => {
    const itemsA = a.items || [];
    const itemsB = b.items || [];

    if (itemsA.length === 0 && itemsB.length === 0) return 0;
    if (itemsA.length === 0) return 1;
    if (itemsB.length === 0) return -1;

    // 대표 아이템 이름부터 순차적으로 비교
    const minLen = Math.min(itemsA.length, itemsB.length);
    for (let i = 0; i < minLen; i++) {
      const nameA = itemsA[i].itemName.trim();
      const nameB = itemsB[i].itemName.trim();
      const comp = nameA.localeCompare(nameB, 'ko');
      if (comp !== 0) return comp;

      // 이름이 같다면 목표 강화 레벨 높은순
      const levelDiff = (itemsB[i].targetLevel || 0) - (itemsA[i].targetLevel || 0);
      if (levelDiff !== 0) return levelDiff;
    }

    // 아이템 개수가 다른 경우
    if (itemsA.length !== itemsB.length) {
      return itemsA.length - itemsB.length;
    }

    // 작성 시간 최신순
    const timeA = new Date(a.updatedAt || a.createdAt).getTime();
    const timeB = new Date(b.updatedAt || b.createdAt).getTime();
    return timeB - timeA;
  });
}

export interface AggregatedItemEntry {
  itemName: string;
  totalCount: number;
  maxTargetLevel: number;
  entries: {
    groupId: string;
    userId: string;
    item: EnhancementItem;
    count: number;
    memo?: string;
    createdAt: string;
    group: EnhancementRequestGroup;
  }[];
}

/**
 * 아이템 이름별 집계 함수 (동일 아이템 한눈에 모아보기 전용)
 */
export function aggregateByItemName(groups: EnhancementRequestGroup[]): AggregatedItemEntry[] {
  const map = new Map<string, AggregatedItemEntry>();

  for (const group of groups) {
    // 그룹 내 동일 아이템을 먼저 하나로 합침
    const groupedItems = groupCardEnhancementItems(group.items || []);

    for (const gItem of groupedItems) {
      const key = (gItem.itemName || '').trim();
      if (!key) continue;

      if (!map.has(key)) {
        map.set(key, {
          itemName: key,
          totalCount: 0,
          maxTargetLevel: gItem.targetLevel || 0,
          entries: [],
        });
      }

      const agg = map.get(key)!;
      agg.totalCount += gItem.count;
      if (gItem.targetLevel > agg.maxTargetLevel) {
        agg.maxTargetLevel = gItem.targetLevel;
      }

      agg.entries.push({
        groupId: group.id,
        userId: group.userId,
        item: {
          id: gItem.id,
          itemName: gItem.itemName,
          targetLevel: gItem.targetLevel,
          isCompleted: gItem.isCompleted,
          count: gItem.count,
        },
        count: gItem.count,
        memo: group.memo,
        createdAt: group.createdAt,
        group,
      });
    }
  }

  // 아이템 이름 가나다순으로 정렬, 각 아이템 내에서는 목표레벨 높은순 정렬
  const result = Array.from(map.values()).sort((a, b) => a.itemName.localeCompare(b.itemName, 'ko'));
  for (const item of result) {
    item.entries.sort((a, b) => (b.item.targetLevel || 0) - (a.item.targetLevel || 0));
  }

  return result;
}
