import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  getDocFromServer,
  query,
  orderBy,
  limit,
  Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { BossItem, GuildConfig, KillLogItem, EnhancementRequestGroup, HostileTarget, SsuljaEventRecord } from './types';
import {
  DEFAULT_BOSSES,
  DEFAULT_CONFIG,
  DEFAULT_SERVER_BOSSES,
  DEFAULT_ENHANCEMENT_REQUESTS,
  DEFAULT_HOSTILE_TARGETS,
  DATED_HOSTILE_ITEMS,
  DELETED_HOSTILE_NAMES,
  DEFAULT_SSULJA_RECORDS,
  localDb,
} from './data/defaultData';

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test as mandated by Firebase skill
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or network is disconnected.');
    }
  }
}
testConnection();

// Initial database seeding if collections are empty
let isSeeding = false;
async function seedDefaultDataIfEmpty(bossCount: number) {
  if (bossCount === 0 && !isSeeding) {
    isSeeding = true;
    try {
      for (const boss of DEFAULT_BOSSES) {
        await setDoc(doc(db, 'bosses', boss.id), boss);
      }
      await setDoc(doc(db, 'guildConfig', 'main'), DEFAULT_CONFIG);
    } catch (e) {
      console.warn('Auto-seed default bosses skipped or completed:', e);
    } finally {
      isSeeding = false;
    }
  }
}

/**
 * 1. 실시간 보스 목록 구독 (onSnapshot)
 * - 데이터 변경 시 즉시 콜백 호출
 * - cleanup 함수(Unsubscribe) 반환
 */
export function subscribeToBosses(
  onData: (bosses: BossItem[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const path = 'bosses';
  const bossesCol = collection(db, path);

  const unsubscribe = onSnapshot(
    bossesCol,
    (snapshot) => {
      if (snapshot.empty) {
        seedDefaultDataIfEmpty(0);
        onData(DEFAULT_BOSSES);
        return;
      }
      const list: BossItem[] = [];
      snapshot.forEach((d) => {
        const item = d.data() as BossItem;
        list.push({ ...item, id: d.id });
      });
      onData(list);
    },
    (error) => {
      console.error('onSnapshot error (bosses):', error);
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );

  return unsubscribe;
}

/**
 * 2. 실시간 길드 설정 구독 (onSnapshot)
 * - 공지사항, 길드명, 비밀번호 등 변경 시 즉시 반영
 * - cleanup 함수(Unsubscribe) 반환
 */
export function subscribeToGuildConfig(
  onData: (config: GuildConfig) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const path = 'guildConfig';
  const configDocRef = doc(db, path, 'main');

  const unsubscribe = onSnapshot(
    configDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as GuildConfig;
        onData({ ...DEFAULT_CONFIG, ...data });
      } else {
        // Document not yet created; create it
        setDoc(configDocRef, DEFAULT_CONFIG).catch(() => {});
        onData(DEFAULT_CONFIG);
      }
    },
    (error) => {
      console.error('onSnapshot error (guildConfig):', error);
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, `${path}/main`);
    }
  );

  return unsubscribe;
}

/**
 * 3. 실시간 보스 처치 기록 로그 구독 (onSnapshot)
 * - 다른 길드원이 처치 기록 시 즉시 반영
 * - cleanup 함수(Unsubscribe) 반환
 */
export function subscribeToKillLogs(
  onData: (logs: KillLogItem[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const path = 'killLogs';
  const logsQuery = query(collection(db, path), orderBy('loggedAt', 'desc'), limit(100));

  const unsubscribe = onSnapshot(
    logsQuery,
    (snapshot) => {
      const logs: KillLogItem[] = [];
      snapshot.forEach((d) => {
        logs.push(d.data() as KillLogItem);
      });
      onData(logs);
    },
    (error) => {
      console.error('onSnapshot error (killLogs):', error);
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );

  return unsubscribe;
}

/**
 * Firestore Mutations
 */
export async function saveBossToFirestore(boss: BossItem): Promise<void> {
  const path = `bosses/${boss.id}`;
  try {
    await setDoc(doc(db, 'bosses', boss.id), boss, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteBossFromFirestore(bossId: string): Promise<void> {
  const path = `bosses/${bossId}`;
  try {
    await deleteDoc(doc(db, 'bosses', bossId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveGuildConfigToFirestore(config: Partial<GuildConfig>): Promise<void> {
  const path = 'guildConfig/main';
  try {
    await setDoc(doc(db, 'guildConfig', 'main'), config, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function addKillLogToFirestore(log: KillLogItem): Promise<void> {
  const path = `killLogs/${log.id}`;
  try {
    await setDoc(doc(db, 'killLogs', log.id), log);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * 서버 보스타임 진행 (Server Bosses) Firestore 실시간 동기화
 */
let isServerSeeding = false;
async function seedServerBossesIfEmpty(count: number) {
  if (count === 0 && !isServerSeeding) {
    isServerSeeding = true;
    try {
      for (const b of DEFAULT_SERVER_BOSSES) {
        await setDoc(doc(db, 'serverBosses', b.id), b);
      }
    } catch (e) {
      console.warn('Auto-seed server bosses skipped or completed:', e);
    } finally {
      isServerSeeding = false;
    }
  }
}

export function subscribeToServerBosses(
  onData: (bosses: BossItem[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const path = 'serverBosses';
  const bossesCol = collection(db, path);

  const unsubscribe = onSnapshot(
    bossesCol,
    (snapshot) => {
      if (snapshot.empty) {
        seedServerBossesIfEmpty(0);
        onData(DEFAULT_SERVER_BOSSES);
        return;
      }
      const list: BossItem[] = [];
      snapshot.forEach((d) => {
        const item = d.data() as BossItem;
        list.push({ ...item, id: d.id });
      });
      onData(list);
    },
    (error) => {
      console.error('onSnapshot error (serverBosses):', error);
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );

  return unsubscribe;
}

export async function saveServerBossToFirestore(boss: BossItem): Promise<void> {
  const path = `serverBosses/${boss.id}`;
  try {
    await setDoc(doc(db, 'serverBosses', boss.id), boss, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteServerBossFromFirestore(bossId: string): Promise<void> {
  const path = `serverBosses/${bossId}`;
  try {
    await deleteDoc(doc(db, 'serverBosses', bossId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToServerKillLogs(
  onData: (logs: KillLogItem[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const path = 'serverKillLogs';
  const logsQuery = query(collection(db, path), orderBy('loggedAt', 'desc'), limit(100));

  const unsubscribe = onSnapshot(
    logsQuery,
    (snapshot) => {
      const logs: KillLogItem[] = [];
      snapshot.forEach((d) => {
        logs.push(d.data() as KillLogItem);
      });
      onData(logs);
    },
    (error) => {
      console.error('onSnapshot error (serverKillLogs):', error);
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );

  return unsubscribe;
}

export async function addServerKillLogToFirestore(log: KillLogItem): Promise<void> {
  const path = `serverKillLogs/${log.id}`;
  try {
    await setDoc(doc(db, 'serverKillLogs', log.id), log);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * 4. 실시간 접속자 상태 관리 (Presence / Heartbeat)
 */
export interface PresenceUser {
  userId: string;
  sessionId: string;
  lastSeen: number;
  updatedAt: string;
}

/**
 * 현재 클라이언트의 접속 상태(Heartbeat)를 주기적으로 Firestore에 기록하고,
 * 종료나 로그아웃 시 삭제하는 트래커
 */
export function trackPresence(userId: string, sessionId: string): () => void {
  const presenceDocRef = doc(db, 'presence', sessionId);

  const sendHeartbeat = async () => {
    try {
      await setDoc(
        presenceDocRef,
        {
          userId,
          sessionId,
          lastSeen: Date.now(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (e) {
      console.warn('Presence heartbeat error:', e);
    }
  };

  // 1) 즉시 초기 하트비트 전송
  sendHeartbeat();

  // 2) 15초마다 하트비트 갱신
  const intervalId = setInterval(sendHeartbeat, 15000);

  // 3) 페이지 종료 / 이동 시 정리
  const handlePageUnload = () => {
    try {
      deleteDoc(presenceDocRef).catch(() => {});
    } catch {}
  };

  window.addEventListener('beforeunload', handlePageUnload);
  window.addEventListener('pagehide', handlePageUnload);

  // 4) 클린업 (로그아웃 또는 세션 종료 시)
  return () => {
    clearInterval(intervalId);
    window.removeEventListener('beforeunload', handlePageUnload);
    window.removeEventListener('pagehide', handlePageUnload);
    try {
      deleteDoc(presenceDocRef).catch(() => {});
    } catch {}
  };
}

/**
 * 실시간 접속자 목록을 Firestore에서 구독 (onSnapshot)
 */
export function subscribeToPresence(
  onData: (activeUsers: PresenceUser[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const path = 'presence';
  const presenceCol = collection(db, path);

  const unsubscribe = onSnapshot(
    presenceCol,
    (snapshot) => {
      const now = Date.now();
      const active: PresenceUser[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as PresenceUser;
        // 45초 이내에 하트비트가 전송된 접속자만 활성 상태로 인정
        if (data.lastSeen && now - data.lastSeen < 45000) {
          active.push(data);
        } else if (data.lastSeen && now - data.lastSeen > 90000) {
          // 비정상 종료된 오래된 세션은 정리
          deleteDoc(doc(db, 'presence', d.id)).catch(() => {});
        }
      });
      onData(active);
    },
    (error) => {
      console.error('onSnapshot error (presence):', error);
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );

  return unsubscribe;
}

/**
 * 수집템 강화 요청소 (Enhancement Requests) Firestore 실시간 동기화
 */
let isEnhancementSeeding = false;
async function seedEnhancementRequestsIfEmpty(count: number) {
  if (count === 0 && !isEnhancementSeeding) {
    isEnhancementSeeding = true;
    try {
      for (const req of DEFAULT_ENHANCEMENT_REQUESTS) {
        await setDoc(doc(db, 'enhancementRequests', req.id), req);
      }
    } catch (e) {
      console.warn('Enhancement requests seeding error (handled):', e);
    } finally {
      isEnhancementSeeding = false;
    }
  }
}

export function subscribeToEnhancementRequests(
  onData: (requests: EnhancementRequestGroup[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const path = 'enhancementRequests';
  const requestsCol = collection(db, path);

  const unsubscribe = onSnapshot(
    requestsCol,
    (snapshot) => {
      const requests: EnhancementRequestGroup[] = [];
      snapshot.forEach((d) => {
        requests.push(d.data() as EnhancementRequestGroup);
      });

      if (requests.length === 0) {
        seedEnhancementRequestsIfEmpty(snapshot.size);
      }

      // 최신 등록/수정 순 정렬
      requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onData(requests);
    },
    (error) => {
      console.error('onSnapshot error (enhancementRequests):', error);
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );

  return unsubscribe;
}

export async function saveEnhancementRequestToFirestore(request: EnhancementRequestGroup): Promise<void> {
  const path = `enhancementRequests/${request.id}`;
  try {
    await setDoc(doc(db, 'enhancementRequests', request.id), request, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteEnhancementRequestFromFirestore(requestId: string): Promise<void> {
  const path = `enhancementRequests/${requestId}`;
  try {
    await deleteDoc(doc(db, 'enhancementRequests', requestId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * 개인 적대 목록 (Hostile Targets) Firestore 실시간 동기화
 */
let isHostileSeeding = false;
const remoteDeletedHostileNames = new Set<string>();
let isDeletedListenerStarted = false;

function ensureDeletedHostileTargetsListener() {
  if (isDeletedListenerStarted) return;
  isDeletedListenerStarted = true;
  const path = 'deletedHostileTargets';
  try {
    onSnapshot(
      collection(db, path),
      (snapshot) => {
        snapshot.forEach((d) => {
          remoteDeletedHostileNames.add(d.id.trim().toLowerCase());
          const data = d.data();
          if (data?.targetName) {
            remoteDeletedHostileNames.add(String(data.targetName).trim().toLowerCase());
          }
        });
      },
      (error) => {
        console.warn('Deleted hostile targets snapshot warning:', error);
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  } catch (err) {
    console.warn('Deleted hostile targets listener error', err);
  }
}

async function syncHostileTargetsToFirestore(currentTargets: HostileTarget[]) {
  if (isHostileSeeding) return;
  const dateMap = new Map(DATED_HOSTILE_ITEMS.map((d) => [d.name, d.date]));
  const localDeleted = localDb.getHostileDeletedNames();

  // If completely empty on first initialization ever, seed defaults (excluding any deleted ones)
  if (currentTargets.length === 0) {
    isHostileSeeding = true;
    try {
      for (const item of DEFAULT_HOSTILE_TARGETS) {
        const key = item.targetId.trim().toLowerCase();
        if (!DELETED_HOSTILE_NAMES.has(item.targetId) && !localDeleted.has(key) && !remoteDeletedHostileNames.has(key)) {
          await setDoc(doc(db, 'hostileTargets', item.id), item);
        }
      }
    } catch (e) {
      console.warn('Hostile targets initial seed error:', e);
    } finally {
      isHostileSeeding = false;
    }
    return;
  }

  // 1. Group by targetId (case-insensitive, trimmed) to find and remove duplicates
  const grouped = new Map<string, HostileTarget[]>();
  for (const t of currentTargets) {
    const key = t.targetId.trim().toLowerCase();
    const list = grouped.get(key) || [];
    list.push(t);
    grouped.set(key, list);
  }

  const duplicatesToDelete: HostileTarget[] = [];
  const uniqueItems: HostileTarget[] = [];

  for (const [, list] of grouped.entries()) {
    if (list.length > 1) {
      // Sort to prioritize keeping the best record
      list.sort((a, b) => {
        const expectedDate = dateMap.get(a.targetId) || dateMap.get(b.targetId);
        if (expectedDate) {
          if (a.createdAt === expectedDate && b.createdAt !== expectedDate) return -1;
          if (b.createdAt === expectedDate && a.createdAt !== expectedDate) return 1;
        }
        if (a.id.startsWith('hostile-dated-') && !b.id.startsWith('hostile-dated-')) return -1;
        if (b.id.startsWith('hostile-dated-') && !a.id.startsWith('hostile-dated-')) return 1;
        return a.id.localeCompare(b.id);
      });

      uniqueItems.push(list[0]);
      for (let i = 1; i < list.length; i++) {
        duplicatesToDelete.push(list[i]);
      }
    } else {
      uniqueItems.push(list[0]);
    }
  }

  // 2. Find targets explicitly marked for deletion or legacy sample items
  const samplesToDelete = uniqueItems.filter((t) => {
    const key = t.targetId.trim().toLowerCase();
    return (
      DELETED_HOSTILE_NAMES.has(t.targetId) ||
      localDeleted.has(key) ||
      remoteDeletedHostileNames.has(key) ||
      t.id === 'hostile-sample-1' ||
      t.id === 'hostile-sample-2'
    );
  });

  const keptItems = uniqueItems.filter((t) => {
    const key = t.targetId.trim().toLowerCase();
    return (
      !DELETED_HOSTILE_NAMES.has(t.targetId) &&
      !localDeleted.has(key) &&
      !remoteDeletedHostileNames.has(key) &&
      t.id !== 'hostile-sample-1' &&
      t.id !== 'hostile-sample-2'
    );
  });

  // 3. Find items whose dates should be updated
  const itemsToUpdateDate: HostileTarget[] = [];
  for (const t of keptItems) {
    const expectedDate = dateMap.get(t.targetId);
    if (expectedDate && t.createdAt !== expectedDate) {
      itemsToUpdateDate.push({
        ...t,
        createdAt: expectedDate,
      });
    }
  }

  const allToDelete = [...duplicatesToDelete, ...samplesToDelete];
  if (allToDelete.length === 0 && itemsToUpdateDate.length === 0) {
    return;
  }

  isHostileSeeding = true;
  try {
    // Delete duplicate & deleted documents
    for (const item of allToDelete) {
      try {
        await deleteDoc(doc(db, 'hostileTargets', item.id));
      } catch (err) {
        console.warn('Could not remove hostile item', err);
      }
    }
    // Update dates
    for (const item of itemsToUpdateDate) {
      await setDoc(doc(db, 'hostileTargets', item.id), item, { merge: true });
    }
  } catch (e) {
    console.warn('Hostile targets cleanup error (handled):', e);
  } finally {
    isHostileSeeding = false;
  }
}

export function subscribeToHostileTargets(
  onData: (targets: HostileTarget[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  ensureDeletedHostileTargetsListener();
  const path = 'hostileTargets';
  const targetsCol = collection(db, path);
  const dateMap = new Map(DATED_HOSTILE_ITEMS.map((d) => [d.name, d.date]));

  const unsubscribe = onSnapshot(
    targetsCol,
    (snapshot) => {
      const targets: HostileTarget[] = [];
      snapshot.forEach((d) => {
        targets.push(d.data() as HostileTarget);
      });

      const localDeleted = localDb.getHostileDeletedNames();

      const seenKeys = new Set<string>();
      let hasDuplicates = false;
      for (const t of targets) {
        const key = t.targetId.trim().toLowerCase();
        if (seenKeys.has(key)) {
          hasDuplicates = true;
          break;
        }
        seenKeys.add(key);
      }

      const hasDeleted = targets.some((t) => {
        const key = t.targetId.trim().toLowerCase();
        return (
          DELETED_HOSTILE_NAMES.has(t.targetId) ||
          localDeleted.has(key) ||
          remoteDeletedHostileNames.has(key)
        );
      });

      const hasOldDate = targets.some((t) => {
        const d = dateMap.get(t.targetId);
        return d && t.createdAt !== d;
      });

      if (
        targets.length === 0 ||
        targets.some((t) => t.id === 'hostile-sample-1' || t.id === 'hostile-sample-2') ||
        hasDuplicates ||
        hasDeleted ||
        hasOldDate
      ) {
        syncHostileTargetsToFirestore(targets);
      }

      // Filter out any deleted items and duplicates immediately for client view
      const validTargets: HostileTarget[] = [];
      const seenNames = new Set<string>();
      for (const t of targets) {
        const key = t.targetId.trim().toLowerCase();
        if (
          DELETED_HOSTILE_NAMES.has(t.targetId) ||
          localDeleted.has(key) ||
          remoteDeletedHostileNames.has(key) ||
          t.id === 'hostile-sample-1' ||
          t.id === 'hostile-sample-2'
        ) {
          continue;
        }
        if (!seenNames.has(key)) {
          seenNames.add(key);
          validTargets.push(t);
        }
      }

      onData(validTargets);
    },
    (error) => {
      console.error('onSnapshot error (hostileTargets):', error);
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );

  return unsubscribe;
}

export async function saveHostileTargetToFirestore(target: HostileTarget): Promise<void> {
  const path = `hostileTargets/${target.id}`;
  try {
    // If target was previously marked as deleted, unmark it
    const cleanName = target.targetId.trim().toLowerCase();
    remoteDeletedHostileNames.delete(cleanName);
    try {
      await deleteDoc(doc(db, 'deletedHostileTargets', cleanName));
    } catch (e) {}

    await setDoc(doc(db, 'hostileTargets', target.id), target, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteHostileTargetFromFirestore(
  targetId: string,
  targetName?: string
): Promise<void> {
  const path = `hostileTargets/${targetId}`;
  try {
    await deleteDoc(doc(db, 'hostileTargets', targetId));
    if (targetName) {
      const cleanName = targetName.trim().toLowerCase();
      remoteDeletedHostileNames.add(cleanName);
      try {
        await setDoc(doc(db, 'deletedHostileTargets', cleanName), {
          targetId,
          targetName,
          deletedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Could not record deleted hostile target in Firestore', err);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * 썰자 이벤트 참여 (Ssulja Records) Firestore 실시간 동기화
 */
let isSsuljaSeeding = false;
async function seedSsuljaRecordsIfEmpty(count: number) {
  if (count === 0 && !isSsuljaSeeding) {
    isSsuljaSeeding = true;
    try {
      for (const rec of DEFAULT_SSULJA_RECORDS) {
        await setDoc(doc(db, 'ssuljaRecords', rec.id), rec);
      }
    } catch (e) {
      console.warn('Ssulja records seeding error (handled):', e);
    } finally {
      isSsuljaSeeding = false;
    }
  }
}

export function subscribeToSsuljaRecords(
  onData: (records: SsuljaEventRecord[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const path = 'ssuljaRecords';
  const recordsCol = collection(db, path);

  const unsubscribe = onSnapshot(
    recordsCol,
    (snapshot) => {
      const records: SsuljaEventRecord[] = [];
      snapshot.forEach((d) => {
        records.push(d.data() as SsuljaEventRecord);
      });

      if (records.length === 0) {
        seedSsuljaRecordsIfEmpty(snapshot.size);
      }

      // Default sort: occurrence time descending (latest battle logs first)
      records.sort((a, b) => (b.occurredAt || '').localeCompare(a.occurredAt || ''));
      onData(records);
    },
    (error) => {
      console.error('onSnapshot error (ssuljaRecords):', error);
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );

  return unsubscribe;
}

export async function saveSsuljaRecordToFirestore(record: SsuljaEventRecord): Promise<void> {
  const path = `ssuljaRecords/${record.id}`;
  try {
    await setDoc(doc(db, 'ssuljaRecords', record.id), record, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveMultipleSsuljaRecordsToFirestore(records: SsuljaEventRecord[]): Promise<void> {
  try {
    for (const rec of records) {
      await setDoc(doc(db, 'ssuljaRecords', rec.id), rec, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'ssuljaRecords');
  }
}

export async function deleteSsuljaRecordFromFirestore(recordId: string): Promise<void> {
  const path = `ssuljaRecords/${recordId}`;
  try {
    await deleteDoc(doc(db, 'ssuljaRecords', recordId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}




