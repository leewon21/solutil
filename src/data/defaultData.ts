import { BossItem, GuildConfig, KillLogItem, EnhancementRequestGroup, HostileTarget, SsuljaEventRecord } from '../types';

export const DEFAULT_SSULJA_RECORDS: SsuljaEventRecord[] = [
  {
    id: 'ssulja-rec-1',
    occurredAt: '2026/09/28 00:10',
    contributionType: '처치',
    targetId: '욕정이',
    targetGuild: '스파르타A',
    uploaderId: '운영자',
    uploadedAt: '2026-09-28 00:10',
    notes: '사냥터 PK 제압',
  },
  {
    id: 'ssulja-rec-2',
    occurredAt: '2026/09/28 00:09',
    contributionType: '처치',
    targetId: '포르서',
    targetGuild: '스파르타A',
    uploaderId: '운영자',
    uploadedAt: '2026-09-28 00:09',
    notes: '사냥터 PK 제압',
  },
  {
    id: 'ssulja-rec-3',
    occurredAt: '2026/09/28 00:09',
    contributionType: '도움',
    targetId: '힐러핑',
    targetGuild: '스파르티A',
    uploaderId: '운영자',
    uploadedAt: '2026-09-28 00:09',
    notes: '합동 전투 지원',
  },
];

export const DELETED_HOSTILE_NAMES = new Set([
  '맛춘법성샌', '부함장', '신성힐', '아젠다', '올탈하드', '튜닉1', '힐러조아', '힐츄', 'HLB10만원감'
]);

export const DATED_HOSTILE_ITEMS: { name: string; date: string }[] = [
  // 09.08 추가
  { name: '마카허', date: '2026-09-08 12:00' },
  { name: '일리알리', date: '2026-09-08 12:00' },
  { name: '밀박사', date: '2026-09-08 12:00' },

  // 09.10 추가
  { name: '탑유', date: '2026-09-10 12:00' },
  { name: '초록빛', date: '2026-09-10 12:00' },

  // 09.11 추가
  { name: '예띠띠', date: '2026-09-11 12:00' },
  { name: '파라파라킹', date: '2026-09-11 12:00' },
  { name: '너굴맨', date: '2026-09-11 12:00' },

  // 09.12 추가
  { name: '솔에르다', date: '2026-09-12 12:00' },
  { name: '솔에르다2', date: '2026-09-12 12:00' },
  { name: '깻잎이', date: '2026-09-12 12:00' },
  { name: '킴깻잎', date: '2026-09-12 12:00' },
  { name: '측타', date: '2026-09-12 12:00' },
  { name: '쌀먹왕레인저', date: '2026-09-12 12:00' },
  { name: '조용한숲', date: '2026-09-12 12:00' },

  // 09.15 추가
  { name: '방대장', date: '2026-09-15 12:00' },
  { name: '루덴메아리', date: '2026-09-15 12:00' },

  // 09.19 추가
  { name: '빵9', date: '2026-09-19 12:00' },
  { name: '나무사이', date: '2026-09-19 12:00' },

  // 09.21 추가
  { name: '가슴D컴', date: '2026-09-21 12:00' },
  { name: '가슴D컵', date: '2026-09-21 12:00' },
  { name: '꽁지아빠', date: '2026-09-21 12:00' },
  { name: '선인쟝', date: '2026-09-21 12:00' },
  { name: '히루히', date: '2026-09-21 12:00' },
];

const OTHER_HOSTILE_NAMES = [
  '구타', '꾸꾸미', '독액B', '두푼', '디가인',
  '뜅', '루니v', '루피v', '리얼헌터', '린델수삼돼지',
  '벤델', '상선', '세라엘프', '세마A', '솔이지',
  '솔인챈트레인져', '수삼눈', '수삼와꾸오크', '스나이퍼킴', '싸물어',
  '얼름꽃', '에쎄체인지1', '오크전사', '왓칸', '정강이뼈',
  '정연', '진명이', '치약사', '킹박사', '활심'
];

const rawHostileList: HostileTarget[] = [
  ...DATED_HOSTILE_ITEMS.map((item, index) => ({
    id: `hostile-dated-${index + 1}`,
    targetId: item.name,
    createdAt: item.date,
    createdBy: '운영자',
    memo: '기존 경계 대상',
  })),
  ...OTHER_HOSTILE_NAMES.map((name, index) => ({
    id: `hostile-other-${index + 1}`,
    targetId: name,
    createdAt: '2026-09-27 13:02',
    createdBy: '운영자',
    memo: '기존 경계 대상',
  })),
];

// Ensure DEFAULT_HOSTILE_TARGETS contains strictly unique targetIds
const seenDefaultNames = new Set<string>();
export const DEFAULT_HOSTILE_TARGETS: HostileTarget[] = [];
for (const item of rawHostileList) {
  const key = item.targetId.trim().toLowerCase();
  if (!seenDefaultNames.has(key)) {
    seenDefaultNames.add(key);
    DEFAULT_HOSTILE_TARGETS.push(item);
  }
}

export const DEFAULT_ENHANCEMENT_REQUESTS: EnhancementRequestGroup[] = [
  {
    id: 'req-sample-1',
    userId: '단풍대장',
    password: '0000',
    memo: '고대 투구 7강 목표입니다! 강화서 10장 지원해 드립니다.',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    items: [
      { id: 'item-1', itemName: '고대의 기사 투구', targetLevel: 7, isBound: true, isCompleted: false },
      { id: 'item-2', itemName: '심연의 마법 망토', targetLevel: 5, isBound: false, isCompleted: false },
      { id: 'item-3', itemName: '용사의 은빛 반지', targetLevel: 3, isBound: true, isCompleted: true },
    ],
  },
  {
    id: 'req-sample-2',
    userId: '마검사',
    password: '0000',
    memo: '수집 도감 등록용 비귀속 템 강화 의뢰',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    items: [
      { id: 'item-4', itemName: '검붉은 수정 목걸이', targetLevel: 6, isBound: false, isCompleted: false },
      { id: 'item-5', itemName: '정예 수호자의 장갑', targetLevel: 4, isBound: false, isCompleted: false },
    ],
  },
];

export const DEFAULT_BOSSES: BossItem[] = [
  {
    id: 'boss-forsaken-god',
    name: '신을 버린자',
    region: '황혼의 심연 (지하 2층)',
    channel: '1채널',
    respawnMinutes: 240, // 4 hours
    lastKillTime: null,
    lastKillerId: null,
    nextSpawnTime: null,
    notes: '광폭화 스킬 주의! 전설 솔 스톤 및 심연의 파편 드랍',
    difficulty: 'SS',
    dropItems: ['심연의 영혼석', '버려진 자의 비수', '전설 인챈트 주문서'],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'boss-creation-core',
    name: '창조의 핵',
    region: '태초의 성소 (중앙 제단)',
    channel: '전 채널 순차',
    respawnMinutes: 360, // 6 hours
    lastKillTime: null,
    lastKillerId: null,
    nextSpawnTime: null,
    notes: '전 범위 파멸 광역기 시전, 신성 보호막 필수',
    difficulty: 'SS',
    dropItems: ['창조의 파편', '태초의 심장', '고대 마력 증폭서'],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'boss-corrupted-seraph',
    name: '타락한 세라프',
    region: '망각의 성채 (최상층)',
    channel: '1채널',
    respawnMinutes: 180, // 3 hours
    lastKillTime: null,
    lastKillerId: null,
    nextSpawnTime: null,
    notes: '공중 폭격 패턴, 회피 이동 권장',
    difficulty: 'S',
    dropItems: ['타락의 깃털', '세라프의 관', '영혼 봉인석'],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'boss-abyss-gargoyle',
    name: '심연의 가고일',
    region: '통곡의 회랑 (동쪽 입구)',
    channel: '2채널',
    respawnMinutes: 120, // 2 hours
    lastKillTime: null,
    lastKillerId: null,
    nextSpawnTime: null,
    notes: '석화 공격 주의, 근접 딜러 방어력 버프 필요',
    difficulty: 'A',
    dropItems: ['가고일의 석핵', '견고한 비늘 갑옷'],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'boss-tree-of-life',
    name: '생명의 트리',
    region: '엘프의 과수원 (신비의 정원)',
    channel: '1채널',
    respawnMinutes: 480, // 8 hours
    lastKillTime: null,
    lastKillerId: null,
    nextSpawnTime: null,
    notes: '8시간 주기 과수원 농사 관리 및 수확',
    difficulty: 'A',
    dropItems: ['생명의 열매', '풍요의 나뭇가지', '대지의 씨앗'],
    updatedAt: new Date().toISOString(),
  },
];

export const DEFAULT_CONFIG: GuildConfig = {
  guildName: '솔 인챈트 1군 정예 길드',
  guildPassword: '1234',
  adminPassword: '0606', // 운영자 비밀번호 (초기: 0606)
  announcement: '📢 [공지] 보스 처치 즉시 [처치 기록] 버튼을 눌러주세요. 실시간으로 타이머가 계산 및 동기화됩니다.',
  activeMembers: 1,
};

export const DEFAULT_SERVER_BOSSES: BossItem[] = [
  {
    id: 'server-boss-belial',
    name: '심연의 군주 벨리알',
    region: '망자의 대협곡 (서버 분쟁 지역)',
    channel: '서버 1채널',
    respawnMinutes: 480, // 8 hours
    lastKillTime: null,
    lastKillerId: null,
    nextSpawnTime: null,
    notes: '전 서버 연합 레이드 보스. 대규모 즉사기 및 암흑 결계 발동',
    difficulty: 'SS',
    dropItems: ['심연 군주의 대검', '전설 승급 스톤', '초월자의 정수'],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'server-boss-charybdis',
    name: '고대 파멸룡 카리브디스',
    region: '용의 둥지 (화산 중심부)',
    channel: '서버 2채널',
    respawnMinutes: 360, // 6 hours
    lastKillTime: null,
    lastKillerId: null,
    nextSpawnTime: null,
    notes: '화염 브레스 및 공중 비행 패턴 주의. 넉백 방지 물약 필수',
    difficulty: 'SS',
    dropItems: ['파멸룡의 심장', '고대 드래곤 비늘', '신화 무기 조각'],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'server-boss-baphomet',
    name: '원한의 마녀 바포메트',
    region: '마녀의 숲 (저주받은 신전)',
    channel: '전 채널',
    respawnMinutes: 240, // 4 hours
    lastKillTime: null,
    lastKillerId: null,
    nextSpawnTime: null,
    notes: '소환수 군단 출현, 침묵 마법 해제 스킬 대기 필요',
    difficulty: 'S',
    dropItems: ['흑마법의 고서', '원한의 수정구', '고대 마법 링'],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'server-boss-hellhound',
    name: '지옥 수호자 헬하운드',
    region: '불타는 협곡 (남부 평원)',
    channel: '서버 1채널',
    respawnMinutes: 180, // 3 hours
    lastKillTime: null,
    lastKillerId: null,
    nextSpawnTime: null,
    notes: '삼두 돌진 공격 주의. 원거리 디버프 유지',
    difficulty: 'S',
    dropItems: ['지옥불 송곳니', '마수 가죽 갑옷', '영혼 봉인 파편'],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'server-boss-balrog',
    name: '황혼의 파수꾼 발록',
    region: '황천의 사막 (폐허 유적)',
    channel: '서버 2채널',
    respawnMinutes: 120, // 2 hours
    lastKillTime: null,
    lastKillerId: null,
    nextSpawnTime: null,
    notes: '지진 충격파 패턴 점프 회피 권장',
    difficulty: 'A',
    dropItems: ['황천의 광석', '파수꾼의 방패'],
    updatedAt: new Date().toISOString(),
  },
];

const STORAGE_KEYS = {
  BOSSES: 'soul_enchant_bosses_data',
  SERVER_BOSSES: 'soul_enchant_server_bosses_data',
  CONFIG: 'soul_enchant_guild_config',
  LOGS: 'soul_enchant_kill_logs',
  SERVER_LOGS: 'soul_enchant_server_kill_logs',
  ENHANCEMENT_REQUESTS: 'soul_enchant_enhancement_requests_data',
  HOSTILE_TARGETS: 'soul_enchant_hostile_targets_data',
  DELETED_HOSTILE_TARGETS: 'soul_enchant_deleted_hostile_targets',
  SSULJA_RECORDS: 'soul_enchant_ssulja_records_data',
};

// Client-side local storage fallback helpers
export const localDb = {
  getBosses(): BossItem[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BOSSES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasTree = parsed.some((b: any) => b.name?.includes('생명의 트리'));
          if (!hasTree) {
            const treeItem = DEFAULT_BOSSES.find(b => b.id === 'boss-tree-of-life');
            if (treeItem) {
              const merged = [...parsed, treeItem];
              try {
                localStorage.setItem(STORAGE_KEYS.BOSSES, JSON.stringify(merged));
              } catch (err) {}
              return merged;
            }
          }
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to read local bosses', e);
    }
    return DEFAULT_BOSSES;
  },

  saveBosses(bosses: BossItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.BOSSES, JSON.stringify(bosses));
      notifyBroadcast({ type: 'bosses-updated', bosses });
    } catch (e) {
      console.error('Failed to save local bosses', e);
    }
  },

  getServerBosses(): BossItem[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SERVER_BOSSES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to read local server bosses', e);
    }
    return DEFAULT_SERVER_BOSSES;
  },

  saveServerBosses(bosses: BossItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SERVER_BOSSES, JSON.stringify(bosses));
      notifyBroadcast({ type: 'server-bosses-updated', bosses });
    } catch (e) {
      console.error('Failed to save local server bosses', e);
    }
  },

  getConfig(): GuildConfig {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CONFIG);
      if (saved) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Failed to read local config', e);
    }
    return DEFAULT_CONFIG;
  },

  saveConfig(config: Partial<GuildConfig>): GuildConfig {
    try {
      const current = this.getConfig();
      const updated = { ...current, ...config };
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(updated));
      notifyBroadcast({ type: 'config-updated', config: updated });
      return updated;
    } catch (e) {
      console.error('Failed to save local config', e);
      return DEFAULT_CONFIG;
    }
  },

  getLogs(): KillLogItem[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LOGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to read local logs', e);
    }
    return [];
  },

  addLog(log: KillLogItem): void {
    try {
      const logs = [log, ...this.getLogs()].slice(0, 100);
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
      notifyBroadcast({ type: 'log-added', log });
    } catch (e) {
      console.error('Failed to add local log', e);
    }
  },

  getServerLogs(): KillLogItem[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SERVER_LOGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to read local server logs', e);
    }
    return [];
  },

  addServerLog(log: KillLogItem): void {
    try {
      const logs = [log, ...this.getServerLogs()].slice(0, 100);
      localStorage.setItem(STORAGE_KEYS.SERVER_LOGS, JSON.stringify(logs));
      notifyBroadcast({ type: 'server-log-added', log });
    } catch (e) {
      console.error('Failed to add local server log', e);
    }
  },

  getEnhancementRequests(): EnhancementRequestGroup[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ENHANCEMENT_REQUESTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((item: EnhancementRequestGroup) => {
            if (item.id === 'req-sample-1' || item.id === 'req-sample-2') {
              return { ...item, password: '0000' };
            }
            return item;
          });
        }
      }
    } catch (e) {
      console.error('Failed to read local enhancement requests', e);
    }
    return DEFAULT_ENHANCEMENT_REQUESTS;
  },

  saveEnhancementRequests(requests: EnhancementRequestGroup[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ENHANCEMENT_REQUESTS, JSON.stringify(requests));
      notifyBroadcast({ type: 'enhancement-requests-updated', requests });
    } catch (e) {
      console.error('Failed to save local enhancement requests', e);
    }
  },

  getHostileDeletedNames(): Set<string> {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DELETED_HOSTILE_TARGETS);
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) {
          return new Set([...DELETED_HOSTILE_NAMES, ...arr.map((s: string) => s.trim().toLowerCase())]);
        }
      }
    } catch (e) {}
    return new Set(Array.from(DELETED_HOSTILE_NAMES).map((s) => s.trim().toLowerCase()));
  },

  markHostileTargetAsDeleted(targetIdOrName: string): void {
    try {
      const deletedSet = this.getHostileDeletedNames();
      deletedSet.add(targetIdOrName.trim().toLowerCase());
      localStorage.setItem(
        STORAGE_KEYS.DELETED_HOSTILE_TARGETS,
        JSON.stringify(Array.from(deletedSet))
      );
    } catch (e) {
      console.error('Failed to mark hostile target as deleted', e);
    }
  },

  getHostileTargets(): HostileTarget[] {
    const deletedNames = this.getHostileDeletedNames();
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HOSTILE_TARGETS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Remove deleted names and legacy sample items
          const cleaned = parsed.filter(
            (t) =>
              !deletedNames.has(t.targetId.trim().toLowerCase()) &&
              t.id !== 'hostile-sample-1' &&
              t.id !== 'hostile-sample-2'
          );

          // Deduplicate by targetId (keep only 1 entry per targetId)
          const seenIds = new Set<string>();
          const deduped: HostileTarget[] = [];
          for (const item of cleaned) {
            const key = item.targetId.trim().toLowerCase();
            if (!seenIds.has(key)) {
              seenIds.add(key);
              deduped.push(item);
            }
          }

          // If cleaned/deduped altered the list, save back to local storage
          if (deduped.length !== parsed.length) {
            localStorage.setItem(STORAGE_KEYS.HOSTILE_TARGETS, JSON.stringify(deduped));
          }
          return deduped;
        }
      }
    } catch (e) {
      console.error('Failed to read local hostile targets', e);
    }
    return DEFAULT_HOSTILE_TARGETS.filter(
      (t) => !deletedNames.has(t.targetId.trim().toLowerCase())
    );
  },

  saveHostileTargets(targets: HostileTarget[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.HOSTILE_TARGETS, JSON.stringify(targets));
      notifyBroadcast({ type: 'hostile-targets-updated', targets });
    } catch (e) {
      console.error('Failed to save local hostile targets', e);
    }
  },

  getSsuljaRecords(): SsuljaEventRecord[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SSULJA_RECORDS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to read local ssulja records', e);
    }
    return DEFAULT_SSULJA_RECORDS;
  },

  saveSsuljaRecords(records: SsuljaEventRecord[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SSULJA_RECORDS, JSON.stringify(records));
      notifyBroadcast({ type: 'ssulja-records-updated', records });
    } catch (e) {
      console.error('Failed to save local ssulja records', e);
    }
  },
};

// Broadcast Channel for multi-tab synchronization on the same browser/device
let syncChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    syncChannel = new BroadcastChannel('soul_enchant_sync_channel');
  }
} catch (e) {
  console.warn('BroadcastChannel not supported', e);
}

function notifyBroadcast(message: any) {
  if (syncChannel) {
    try {
      syncChannel.postMessage(message);
    } catch (e) {
      console.warn('BroadcastChannel postMessage failed', e);
    }
  }
}

export function subscribeToLocalSync(callback: (event: any) => void): () => void {
  if (!syncChannel) return () => {};

  const handler = (event: MessageEvent) => {
    callback(event.data);
  };

  syncChannel.addEventListener('message', handler);
  return () => {
    syncChannel?.removeEventListener('message', handler);
  };
}
