import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Plus, 
  Swords, 
  Sparkles, 
  Filter, 
  RefreshCw, 
  Layers, 
  Calendar,
  AlertCircle,
  LayoutList,
  LayoutGrid,
  Search,
  X,
  Globe
} from 'lucide-react';
import { BossItem, KillLogItem, GuildConfig, UserSession, AlarmSettings, ServerBossState, EnhancementRequestGroup, HostileTarget, SsuljaEventRecord } from './types';
import { LoginScreen } from './components/LoginScreen';
import { Header } from './components/Header';
import { StatsBar } from './components/StatsBar';
import { BossCard } from './components/BossCard';
import { BossListItem } from './components/BossListItem';
import { BossFormModal } from './components/BossFormModal';
import { ConfirmModal } from './components/ConfirmModal';
import { CustomKillModal } from './components/CustomKillModal';
import { KillLogDrawer } from './components/KillLogDrawer';
import { GuildSettingsModal } from './components/GuildSettingsModal';
import { LiveToast, ToastMessage } from './components/LiveToast';
import { ServerBossView } from './components/ServerBossView';
import { EnhancementRequestsView } from './components/EnhancementRequestsView';
import { SsuljaEventView } from './components/SsuljaEventView';
import { BossHistoryModal } from './components/BossHistoryModal';
import { 
  soundService, 
  requestNotificationPermission, 
  sendBrowserNotification 
} from './utils/audioAlerts';
import { localDb, subscribeToLocalSync } from './data/defaultData';
import {
  subscribeToBosses,
  subscribeToGuildConfig,
  subscribeToKillLogs,
  saveBossToFirestore,
  deleteBossFromFirestore,
  saveGuildConfigToFirestore,
  addKillLogToFirestore,
  subscribeToServerBosses,
  saveServerBossToFirestore,
  deleteServerBossFromFirestore,
  subscribeToServerKillLogs,
  addServerKillLogToFirestore,
  subscribeToEnhancementRequests,
  saveEnhancementRequestToFirestore,
  deleteEnhancementRequestFromFirestore,
  subscribeToHostileTargets,
  saveHostileTargetToFirestore,
  deleteHostileTargetFromFirestore,
  subscribeToSsuljaRecords,
  saveSsuljaRecordToFirestore,
  saveMultipleSsuljaRecordsToFirestore,
  deleteSsuljaRecordFromFirestore,
  trackPresence,
  subscribeToPresence,
  PresenceUser,
} from './firebase';
import { sortEnhancementGroups, sortEnhancementItems } from './utils/enhancementUtils';

export default function App() {
  // Session State
  const [session, setSession] = useState<UserSession | null>(() => {
    try {
      const saved = localStorage.getItem('soul_enchant_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Guild & Boss State
  const [guildConfig, setGuildConfig] = useState<GuildConfig>(() => localDb.getConfig());
  const [bosses, setBosses] = useState<BossItem[]>(() => localDb.getBosses());
  const [logs, setLogs] = useState<KillLogItem[]>(() => localDb.getLogs());
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Server Bosses & Server Logs State (서버 보스타임 진행)
  const [serverBosses, setServerBosses] = useState<BossItem[]>(() => localDb.getServerBosses());
  const [serverLogs, setServerLogs] = useState<KillLogItem[]>(() => localDb.getServerLogs());

  // 수집템 강화 요청소 State
  const [enhancementRequests, setEnhancementRequests] = useState<EnhancementRequestGroup[]>(() => localDb.getEnhancementRequests());

  // 개인 적대 목록 State
  const [hostileTargets, setHostileTargets] = useState<HostileTarget[]>(() => localDb.getHostileTargets());

  // 썰자 이벤트 참여 State
  const [ssuljaRecords, setSsuljaRecords] = useState<SsuljaEventRecord[]>(() => localDb.getSsuljaRecords());

  // Page Routing State ('MAIN' | 'SERVER_BOSS' | 'ENHANCEMENT_REQUESTS' | 'SSULJA_EVENT')
  const [currentPage, setCurrentPage] = useState<'MAIN' | 'SERVER_BOSS' | 'ENHANCEMENT_REQUESTS' | 'SSULJA_EVENT'>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash === '#server-boss') return 'SERVER_BOSS';
      if (window.location.hash === '#enhancement-requests' || window.location.hash === '#requests') return 'ENHANCEMENT_REQUESTS';
      if (window.location.hash === '#ssulja-event' || window.location.hash === '#ssulja') return 'SSULJA_EVENT';
    }
    return 'MAIN';
  });

  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#server-boss') {
        setCurrentPage('SERVER_BOSS');
      } else if (window.location.hash === '#enhancement-requests' || window.location.hash === '#requests') {
        setCurrentPage('ENHANCEMENT_REQUESTS');
      } else if (window.location.hash === '#ssulja-event' || window.location.hash === '#ssulja') {
        setCurrentPage('SSULJA_EVENT');
      } else if (window.location.hash === '#main' || !window.location.hash) {
        setCurrentPage('MAIN');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateToPage = (page: 'MAIN' | 'SERVER_BOSS' | 'ENHANCEMENT_REQUESTS' | 'SSULJA_EVENT') => {
    setCurrentPage(page);
    if (page === 'SERVER_BOSS') {
      window.location.hash = 'server-boss';
    } else if (page === 'ENHANCEMENT_REQUESTS') {
      window.location.hash = 'enhancement-requests';
    } else if (page === 'SSULJA_EVENT') {
      window.location.hash = 'ssulja-event';
    } else {
      window.location.hash = 'main';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Real-time Active Presence Users
  const [activePresenceUsers, setActivePresenceUsers] = useState<PresenceUser[]>([]);

  // Calculate unique real-time active users count
  const activeUsersCount = useMemo(() => {
    if (!session) return 0;
    const now = Date.now();
    const live = activePresenceUsers.filter((u) => u.lastSeen && now - u.lastSeen < 45000);
    const uniqueIds = new Set(live.map((u) => u.userId));
    // Always include current logged in user
    uniqueIds.add(session.userId);
    return uniqueIds.size;
  }, [activePresenceUsers, session]);

  // Periodic local purge of expired users (every 5 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setActivePresenceUsers((prev) => {
        const next = prev.filter((u) => u.lastSeen && now - u.lastSeen < 45000);
        if (next.length !== prev.length) return next;
        return prev;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // View Mode & Real-time Clock
  const [viewMode, setViewMode] = useState<'LIST' | 'CARD'>('LIST');
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());

  // Filter & Search
  const [presetFilter, setPresetFilter] = useState<'ALL' | '신을 버린자' | '창조의 핵' | '신의탑 상자' | '과수원 농사' | '리퍼 & 드레이크' | '라자엘 & 아리엘'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1-second interval ticker for real-time cooldown sorting & countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Modals & Drawers
  const [isAddBossOpen, setIsAddBossOpen] = useState(false);
  const [bossToEdit, setBossToEdit] = useState<BossItem | null>(null);
  const [customKillBoss, setCustomKillBoss] = useState<BossItem | null>(null);
  const [historyBoss, setHistoryBoss] = useState<BossItem | null>(null);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'primary';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Alarm Preferences
  const [alarmSettings, setAlarmSettings] = useState<AlarmSettings>(() => {
    try {
      const saved = localStorage.getItem('soul_enchant_alarms');
      return saved
        ? JSON.parse(saved)
        : {
            soundEnabled: true,
            browserNotificationEnabled: false,
            alertAt10Min: true,
            alertAt5Min: true,
            alertAt1Min: true,
            alertAtSpawn: true,
            volume: 0.6,
          };
    } catch {
      return {
        soundEnabled: true,
        browserNotificationEnabled: false,
        alertAt10Min: true,
        alertAt5Min: true,
        alertAt1Min: true,
        alertAtSpawn: true,
        volume: 0.6,
      };
    }
  });

  // Track fired alerts per boss spawn cycle to prevent repeated alarms
  const alertedCyclesRef = useRef<Record<string, { [key: string]: boolean }>>({});

  // Save alarm settings to localStorage
  const handleUpdateAlarmSettings = (updates: Partial<AlarmSettings>) => {
    setAlarmSettings((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem('soul_enchant_alarms', JSON.stringify(next));
      return next;
    });
  };

  // Add a toast notification
  const addToast = useCallback((title: string, message: string, type: 'kill' | 'spawn' | 'info' = 'kill') => {
    const newToast: ToastMessage = {
      id: `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title,
      message,
      timestamp: new Date().toISOString(),
      type,
    };
    setToasts((prev) => [newToast, ...prev].slice(0, 5));
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Request browser push notification permission
  const handleRequestPushPermission = async () => {
    const granted = await requestNotificationPermission();
    handleUpdateAlarmSettings({ browserNotificationEnabled: granted });
    if (granted) {
      addToast('알림 승인 완료', '브라우저 푸시 알림이 활성화되었습니다.', 'info');
      sendBrowserNotification('솔 인챈트 신을 버린자 · 창조의 핵 실시간 리젠 & 공유', '푸시 알림이 정상 작동합니다!');
    }
  };

  // Handle Login
  const handleLogin = async (userId: string, guildPassword: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, guildPassword }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (!res.ok) {
          return { success: false, error: data.error || '비밀번호가 일치하지 않습니다.' };
        }

        const newSession: UserSession = {
          userId: data.userId,
          guildName: data.guildName,
          token: data.token,
          loginAt: new Date().toISOString(),
        };
        setSession(newSession);
        localStorage.setItem('soul_enchant_session', JSON.stringify(newSession));
        soundService.playPing(0.5);
        return { success: true };
      }
    } catch (e: any) {
      // Backend not reachable (e.g. Vercel static deployment) -> fall through to local fallback
    }

    // Local / Offline / Vercel fallback authentication
    const currentConfig = localDb.getConfig();
    const expectedPassword = currentConfig.guildPassword || '1234';
    if (guildPassword.trim() !== expectedPassword.trim()) {
      return { success: false, error: '길드 비밀번호가 일치하지 않습니다.' };
    }

    const localSession: UserSession = {
      userId: userId.trim(),
      guildName: currentConfig.guildName || '솔 인챈트 길드',
      token: `local_${Date.now()}`,
      loginAt: new Date().toISOString(),
    };
    setSession(localSession);
    localStorage.setItem('soul_enchant_session', JSON.stringify(localSession));
    setIsLiveConnected(true);
    setIsLoading(false);
    soundService.playPing(0.5);
    return { success: true };
  };

  // Handle Logout
  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem('soul_enchant_session');
    setActivePresenceUsers([]);
  };

  // Establish Firebase Firestore onSnapshot subscriptions with auto cleanup
  useEffect(() => {
    if (!session) return;

    let isMounted = true;
    setIsLoading(true);

    const initialLoadedRef = { logs: false };

    // 1. Subscribe to Bosses collection (real-time onSnapshot)
    const unsubscribeBosses = subscribeToBosses(
      (updatedBosses) => {
        if (!isMounted) return;
        setBosses(updatedBosses);
        localDb.saveBosses(updatedBosses);
        setIsLiveConnected(true);
        setIsLoading(false);
      },
      (error) => {
        console.error('Firestore bosses onSnapshot error:', error);
      }
    );

    // 2. Subscribe to GuildConfig document (real-time onSnapshot)
    const unsubscribeConfig = subscribeToGuildConfig(
      (updatedConfig) => {
        if (!isMounted) return;
        setGuildConfig((prev) => ({
          ...prev,
          ...updatedConfig,
          activeMembers: updatedConfig.activeMembers || prev.activeMembers || 1,
        }));
        localDb.saveConfig(updatedConfig);
      },
      (error) => {
        console.error('Firestore guildConfig onSnapshot error:', error);
      }
    );

    // 3. Subscribe to KillLogs collection (real-time onSnapshot)
    const unsubscribeKillLogs = subscribeToKillLogs(
      (updatedLogs) => {
        if (!isMounted) return;

        // Detect new kills from other users after initial load
        if (initialLoadedRef.logs && updatedLogs.length > 0) {
          const newest = updatedLogs[0];
          const previousFirst = logs[0];
          if (newest && (!previousFirst || newest.id !== previousFirst.id)) {
            if (newest.killerId !== session.userId) {
              if (alarmSettings.soundEnabled) {
                soundService.playKillRecordSound(alarmSettings.volume);
              }
              const spawnTimeStr = newest.nextSpawnTime
                ? new Date(newest.nextSpawnTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                : '';
              addToast(
                `⚔️ [${newest.killerId}] 처치 기록 공유`,
                `'${newest.bossName}' 처치 완료! 다음 리젠: ${spawnTimeStr}`,
                'kill'
              );
              if (alarmSettings.browserNotificationEnabled) {
                sendBrowserNotification(
                  `[솔 인챈트] ${newest.bossName} 처치 알림`,
                  `${newest.killerId}님이 ${newest.bossName} 처치를 기록했습니다. 다음 리젠: ${spawnTimeStr}`
                );
              }
            }
          }
        }

        initialLoadedRef.logs = true;
        setLogs(updatedLogs);
      },
      (error) => {
        console.error('Firestore killLogs onSnapshot error:', error);
      }
    );

    // 4. Same-browser / Multi-tab sync fallback
    const unsubLocal = subscribeToLocalSync((data: any) => {
      if (!isMounted) return;
      if (data.type === 'bosses-updated' && Array.isArray(data.bosses)) {
        setBosses(data.bosses);
      } else if (data.type === 'config-updated' && data.config) {
        setGuildConfig((prev) => ({ ...prev, ...data.config }));
      } else if (data.type === 'log-added' && data.log) {
        setLogs((prev) => [data.log, ...prev.slice(0, 99)]);
      } else if (data.type === 'hostile-targets-updated' && Array.isArray(data.targets)) {
        setHostileTargets(data.targets);
      }
    });

    // 5. Subscribe to ServerBosses collection (real-time onSnapshot)
    const unsubscribeServerBosses = subscribeToServerBosses(
      (updatedServerBosses) => {
        if (!isMounted) return;
        setServerBosses(updatedServerBosses);
        localDb.saveServerBosses(updatedServerBosses);
      },
      (error) => {
        console.error('Firestore serverBosses onSnapshot error:', error);
      }
    );

    // 6. Subscribe to ServerKillLogs collection (real-time onSnapshot)
    const unsubscribeServerKillLogs = subscribeToServerKillLogs(
      (updatedServerLogs) => {
        if (!isMounted) return;
        setServerLogs(updatedServerLogs);
      },
      (error) => {
        console.error('Firestore serverKillLogs onSnapshot error:', error);
      }
    );

    // 7. 수집템 강화 요청소 실시간 구독
    const unsubscribeEnhancementRequests = subscribeToEnhancementRequests(
      (remoteRequests) => {
        if (!isMounted) return;
        const normalized = remoteRequests.map((r) => {
          if (r.id === 'req-sample-1' || r.id === 'req-sample-2') {
            return { ...r, password: '0000', items: sortEnhancementItems(r.items || []) };
          }
          return { ...r, items: sortEnhancementItems(r.items || []) };
        });
        const sorted = sortEnhancementGroups(normalized);
        setEnhancementRequests(sorted);
        localDb.saveEnhancementRequests(sorted);
      },
      (error) => {
        console.error('Firestore enhancementRequests onSnapshot error:', error);
      }
    );

    // 8. 개인 적대 목록 (Hostile Targets) 실시간 구독
    const unsubscribeHostileTargets = subscribeToHostileTargets(
      (remoteTargets) => {
        if (!isMounted) return;
        setHostileTargets(remoteTargets);
        localDb.saveHostileTargets(remoteTargets);
      },
      (error) => {
        console.error('Firestore hostileTargets onSnapshot error:', error);
      }
    );

    // 9. 썰자 이벤트 참여 (Ssulja Records) 실시간 구독
    const unsubscribeSsuljaRecords = subscribeToSsuljaRecords(
      (remoteRecords) => {
        if (!isMounted) return;
        setSsuljaRecords(remoteRecords);
        localDb.saveSsuljaRecords(remoteRecords);
      },
      (error) => {
        console.error('Firestore ssuljaRecords onSnapshot error:', error);
      }
    );

    // 10. 실시간 접속자 하트비트 트래킹 및 접속자 목록 실시간 구독
    const stopPresenceTracker = trackPresence(session.userId, session.token);
    const unsubscribePresence = subscribeToPresence(
      (users) => {
        if (!isMounted) return;
        setActivePresenceUsers(users);
      },
      (error) => {
        console.warn('Presence subscription warning:', error);
      }
    );

    // Clean up all Firestore listeners, presence heartbeat, and local channels when component unmounts
    return () => {
      isMounted = false;
      unsubscribeBosses();
      unsubscribeConfig();
      unsubscribeKillLogs();
      unsubscribeServerBosses();
      unsubscribeServerKillLogs();
      unsubscribeEnhancementRequests();
      unsubscribeHostileTargets();
      unsubscribeSsuljaRecords();
      unsubLocal();
      unsubscribePresence();
      stopPresenceTracker();
    };
  }, [session, alarmSettings.soundEnabled, alarmSettings.volume, alarmSettings.browserNotificationEnabled, addToast]);

  // Periodic Timer & Notification Checker (Runs every 4 seconds)
  // Only applies to guild timer bosses (서버 보스타임 진행에서는 알림음 및 타이머 경보음 미사용)
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const now = Date.now();

      bosses.forEach((boss) => {
        if (!boss.nextSpawnTime) return;

        const spawnTime = new Date(boss.nextSpawnTime).getTime();
        const diffMs = spawnTime - now;
        const diffMinutes = Math.floor(diffMs / 60000);

        // Key for this specific spawn cycle
        const cycleKey = `${boss.id}_${boss.nextSpawnTime}`;
        if (!alertedCyclesRef.current[cycleKey]) {
          alertedCyclesRef.current[cycleKey] = {};
        }
        const cycleAlerts = alertedCyclesRef.current[cycleKey];

        // 10 minutes warning
        if (alarmSettings.alertAt10Min && diffMs > 0 && diffMinutes <= 10 && diffMinutes > 5 && !cycleAlerts['10m']) {
          cycleAlerts['10m'] = true;
          if (alarmSettings.soundEnabled) soundService.playWarningAlarm(alarmSettings.volume);
          soundService.speak(`${boss.name} 리젠 10분 전입니다.`);
          if (alarmSettings.browserNotificationEnabled) {
            sendBrowserNotification(`[솔 인챈트 리젠 경고] ${boss.name}`, `${boss.region}에 10분 후 리젠됩니다!`);
          }
          addToast(`⚠️ [리젠 10분 전] ${boss.name}`, `${boss.region} 집결 준비를 권장합니다.`, 'spawn');
        }

        // 5 minutes warning
        if (alarmSettings.alertAt5Min && diffMs > 0 && diffMinutes <= 5 && diffMinutes > 1 && !cycleAlerts['5m']) {
          cycleAlerts['5m'] = true;
          if (alarmSettings.soundEnabled) soundService.playWarningAlarm(alarmSettings.volume);
          soundService.speak(`${boss.name} 리젠 5분 전입니다.`);
          if (alarmSettings.browserNotificationEnabled) {
            sendBrowserNotification(`[솔 인챈트 리젠 임박] ${boss.name}`, `${boss.region}에 5분 후 출현합니다!`);
          }
          addToast(`🚨 [리젠 5분 전] ${boss.name}`, `${boss.region} - 곧 리젠됩니다!`, 'spawn');
        }

        // 1 minute warning
        if (alarmSettings.alertAt1Min && diffMs > 0 && diffMinutes <= 1 && !cycleAlerts['1m']) {
          cycleAlerts['1m'] = true;
          if (alarmSettings.soundEnabled) soundService.playWarningAlarm(alarmSettings.volume);
          soundService.speak(`${boss.name} 리젠 1분 전입니다. 대기하세요.`);
          if (alarmSettings.browserNotificationEnabled) {
            sendBrowserNotification(`[리젠 1분 전] ${boss.name}`, `${boss.region} 즉시 출현 임박!`);
          }
          addToast(`🔥 [리젠 1분 전] ${boss.name}`, `출현 지점으로 신속 이동하세요!`, 'spawn');
        }

        // Respawned! (diff <= 0)
        if (alarmSettings.alertAtSpawn && diffMs <= 0 && diffMs > -60000 && !cycleAlerts['spawned']) {
          cycleAlerts['spawned'] = true;
          if (alarmSettings.soundEnabled) soundService.playSpawnAlarm(alarmSettings.volume);
          soundService.speak(`${boss.name} 리젠 완료! 처치하세요.`);
          if (alarmSettings.browserNotificationEnabled) {
            sendBrowserNotification(`[리젠 완료!] ${boss.name}`, `${boss.region}에 보스가 출현했습니다!`);
          }
          addToast(`🔴 [리젠 완료] ${boss.name}`, `${boss.region} 보스 처치 대기중!`, 'spawn');
        }
      });
    }, 4000);

    return () => clearInterval(checkInterval);
  }, [bosses, alarmSettings, addToast]);

  // Fetch bosses list from server (fallback / refresh)
  const refreshBosses = async () => {
    try {
      const res = await fetch('/api/bosses');
      if (res.ok) {
        const data = await res.json();
        if (data.bosses) setBosses(data.bosses);
      }
    } catch {}
  };

  // Action: Instant Record Kill (처치 기록 원클릭)
  const handleInstantKill = async (bossId: string) => {
    if (!session) return;
    const nowIso = new Date().toISOString();

    const targetBoss = bosses.find((b) => b.id === bossId);
    if (!targetBoss) return;

    const nextSpawnMs = Date.now() + targetBoss.respawnMinutes * 60 * 1000;
    const nextSpawnIso = new Date(nextSpawnMs).toISOString();

    const updatedBoss: BossItem = {
      ...targetBoss,
      lastKillTime: nowIso,
      lastKillerId: session.userId,
      nextSpawnTime: nextSpawnIso,
      updatedAt: nowIso,
    };

    // 1. Optimistically update local state & localDb
    const updatedBosses = bosses.map((b) => (b.id === bossId ? updatedBoss : b));
    setBosses(updatedBosses);
    localDb.saveBosses(updatedBosses);

    const logItem: KillLogItem = {
      id: `log_${Date.now()}`,
      bossId,
      bossName: targetBoss.name,
      region: targetBoss.region,
      channel: targetBoss.channel,
      killerId: session.userId,
      killTime: nowIso,
      nextSpawnTime: nextSpawnIso,
      loggedAt: nowIso,
    };
    setLogs((prev) => [logItem, ...prev.slice(0, 99)]);
    localDb.addLog(logItem);

    soundService.playPing(0.5);
    addToast('처치 기록 완료', `'${targetBoss.name}' 처치 기록이 저장되었습니다.`, 'kill');

    // 2. Persist to Firebase Firestore (instantly triggers onSnapshot for all connected users)
    try {
      await Promise.all([
        saveBossToFirestore(updatedBoss),
        addKillLogToFirestore(logItem),
      ]);
    } catch (err) {
      console.warn('Firestore kill record sync warning:', err);
    }

    // 3. Try remote backend if present
    try {
      await fetch(`/api/bosses/${bossId}/kill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          killerId: session.userId,
          killTime: nowIso,
        }),
      });
    } catch {
      // Remote call ignored on static/Vercel mode
    }
  };

  // Action: 멍 (미출현/스킵 처리 - 직전 리젠 시간에 주기를 더해 다음 리젠시간 산정)
  const handleMissedSpawn = async (bossId: string) => {
    if (!session) return;
    const targetBoss = bosses.find((b) => b.id === bossId);
    if (!targetBoss) return;

    const nowIso = new Date().toISOString();

    // 직전 리젠 시간 기준:
    // targetBoss.nextSpawnTime이 설정되어 있으면 그 시각을 기준으로,
    // 없으면 lastKillTime 또는 현재 시간을 기준으로 산정
    let baseSpawnMs = Date.now();
    if (targetBoss.nextSpawnTime) {
      const parsed = new Date(targetBoss.nextSpawnTime).getTime();
      if (!isNaN(parsed)) baseSpawnMs = parsed;
    } else if (targetBoss.lastKillTime) {
      const parsed = new Date(targetBoss.lastKillTime).getTime();
      if (!isNaN(parsed)) baseSpawnMs = parsed;
    }

    const nextSpawnMs = baseSpawnMs + targetBoss.respawnMinutes * 60 * 1000;
    const nextSpawnIso = new Date(nextSpawnMs).toISOString();
    const prevSpawnIso = new Date(baseSpawnMs).toISOString();

    const updatedBoss: BossItem = {
      ...targetBoss,
      lastKillTime: prevSpawnIso,
      lastKillerId: `${session.userId} (멍)`,
      nextSpawnTime: nextSpawnIso,
      updatedAt: nowIso,
    };

    // 1. Optimistically update local state & localDb
    const updatedBosses = bosses.map((b) => (b.id === bossId ? updatedBoss : b));
    setBosses(updatedBosses);
    localDb.saveBosses(updatedBosses);

    const logItem: KillLogItem = {
      id: `log_${Date.now()}`,
      bossId,
      bossName: targetBoss.name,
      region: targetBoss.region,
      channel: targetBoss.channel,
      killerId: `${session.userId} (멍)`,
      killTime: prevSpawnIso,
      nextSpawnTime: nextSpawnIso,
      loggedAt: nowIso,
      notes: '멍 (미출현 주기 연장)',
    };
    setLogs((prev) => [logItem, ...prev.slice(0, 99)]);
    localDb.addLog(logItem);

    soundService.playPing(0.5);

    const baseTimeFormatted = new Date(baseSpawnMs).toLocaleTimeString('ko-KR', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
    const nextTimeFormatted = new Date(nextSpawnMs).toLocaleTimeString('ko-KR', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
    addToast(
      '멍 처리 완료',
      `'${targetBoss.name}' 직전 리젠(${baseTimeFormatted}) + 주기(${targetBoss.respawnMinutes}분) ➔ 다음 리젠 ${nextTimeFormatted}`,
      'info'
    );

    // 2. Persist to Firebase Firestore
    try {
      await Promise.all([
        saveBossToFirestore(updatedBoss),
        addKillLogToFirestore(logItem),
      ]);
    } catch (err) {
      console.warn('Firestore missed spawn sync warning:', err);
    }

    // 3. Try remote backend if present
    try {
      await fetch(`/api/bosses/${bossId}/kill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          killerId: `${session.userId} (멍)`,
          killTime: prevSpawnIso,
          notes: '멍 (미출현 주기 연장)',
        }),
      });
    } catch {}
  };

  // Action: Custom Kill Time
  const handleCustomKill = async (
    bossId: string,
    killTimeIso: string,
    killerId: string,
    notes?: string
  ) => {
    const targetBoss = bosses.find((b) => b.id === bossId);
    if (!targetBoss) return;

    const killTimeMs = new Date(killTimeIso).getTime();
    const nextSpawnMs = killTimeMs + targetBoss.respawnMinutes * 60 * 1000;
    const nextSpawnIso = new Date(nextSpawnMs).toISOString();
    const nowIso = new Date().toISOString();

    const updatedBoss: BossItem = {
      ...targetBoss,
      lastKillTime: killTimeIso,
      lastKillerId: killerId,
      nextSpawnTime: nextSpawnIso,
      notes: notes !== undefined ? notes : targetBoss.notes,
      updatedAt: nowIso,
    };

    // 1. Optimistic update local state & localDb
    const updatedBosses = bosses.map((b) => (b.id === bossId ? updatedBoss : b));
    setBosses(updatedBosses);
    localDb.saveBosses(updatedBosses);

    const logItem: KillLogItem = {
      id: `log_${Date.now()}`,
      bossId,
      bossName: targetBoss.name,
      region: targetBoss.region,
      channel: targetBoss.channel,
      killerId,
      killTime: killTimeIso,
      nextSpawnTime: nextSpawnIso,
      loggedAt: nowIso,
      notes,
    };
    setLogs((prev) => [logItem, ...prev.slice(0, 99)]);
    localDb.addLog(logItem);

    soundService.playPing(0.5);
    addToast('처치 시간 기록', `'${targetBoss.name}' 시간이 업데이트되었습니다.`, 'kill');

    // 2. Persist to Firebase Firestore (instantly triggers onSnapshot for all connected users)
    try {
      await Promise.all([
        saveBossToFirestore(updatedBoss),
        addKillLogToFirestore(logItem),
      ]);
    } catch (err) {
      console.warn('Firestore custom kill sync warning:', err);
    }

    // 3. Try remote backend if present
    try {
      await fetch(`/api/bosses/${bossId}/kill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          killerId,
          killTime: killTimeIso,
          notes,
        }),
      });
    } catch {
      // Remote call ignored on static/Vercel mode
    }
  };

  // Action: Save or Add Boss
  const handleSaveBoss = async (data: {
    name: string;
    region: string;
    channel: string;
    respawnMinutes: number;
    notes: string;
    difficulty: 'SS' | 'S' | 'A' | 'B';
  }) => {
    const nowIso = new Date().toISOString();
    let targetToSave: BossItem;

    if (bossToEdit) {
      targetToSave = {
        ...bossToEdit,
        ...data,
        updatedAt: nowIso,
      };
      const updatedList = bosses.map((b) => (b.id === bossToEdit.id ? targetToSave : b));
      setBosses(updatedList);
      localDb.saveBosses(updatedList);
      addToast('지역 정보 수정', `'${data.name}' 정보가 저장되었습니다.`, 'info');

      try {
        await saveBossToFirestore(targetToSave);
      } catch (err) {
        console.warn('Firestore save boss warning:', err);
      }

      try {
        await fetch(`/api/bosses/${bossToEdit.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } catch {}
    } else {
      targetToSave = {
        id: `boss-${Date.now()}`,
        name: data.name,
        region: data.region,
        channel: data.channel || '1채널',
        respawnMinutes: data.respawnMinutes,
        lastKillTime: null,
        lastKillerId: null,
        nextSpawnTime: null,
        notes: data.notes,
        difficulty: data.difficulty,
        updatedAt: nowIso,
      };
      const updatedList = [...bosses, targetToSave];
      setBosses(updatedList);
      localDb.saveBosses(updatedList);
      addToast('신규 지역 등록', `'${data.name}' 지역이 추가되었습니다.`, 'info');

      try {
        await saveBossToFirestore(targetToSave);
      } catch (err) {
        console.warn('Firestore create boss warning:', err);
      }

      try {
        await fetch('/api/bosses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } catch {}
    }
  };

  // Action: Reset Boss Timer
  const handleResetBoss = (bossId: string) => {
    const boss = bosses.find((b) => b.id === bossId);
    const targetName = boss?.name || '지역';
    setConfirmModal({
      isOpen: true,
      title: '타이머 초기화',
      message: `'${targetName}'의 리젠 타이머를 초기화하시겠습니까?\n처치 기록이 삭제되고 대기 상태로 전환됩니다.`,
      confirmLabel: '초기화',
      cancelLabel: '취소',
      variant: 'warning',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        const updatedList = bosses.map((b) => {
          if (b.id !== bossId) return b;
          return {
            ...b,
            lastKillTime: null,
            lastKillerId: null,
            nextSpawnTime: null,
            updatedAt: new Date().toISOString(),
          };
        });
        setBosses(updatedList);
        localDb.saveBosses(updatedList);
        addToast('타이머 초기화', `'${targetName}' 타이머가 초기화되었습니다.`, 'info');

        const target = updatedList.find((b) => b.id === bossId);
        if (target) {
          try {
            await saveBossToFirestore(target);
          } catch (err) {
            console.warn('Firestore reset boss warning:', err);
          }
        }

        try {
          await fetch(`/api/bosses/${bossId}/reset`, {
            method: 'POST',
          });
        } catch {}
      },
    });
  };

  // Action: Delete Boss
  const handleDeleteBoss = (bossId: string) => {
    const boss = bosses.find((b) => b.id === bossId);
    const targetName = boss?.name || '지역';
    setConfirmModal({
      isOpen: true,
      title: '리젠 타이머 삭제',
      message: `'${targetName}'을(를) 목록에서 영구히 삭제하시겠습니까?\n삭제 즉시 목록 및 실시간 타이머에서 제거됩니다.`,
      confirmLabel: '삭제하기',
      cancelLabel: '취소',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        const updatedList = bosses.filter((b) => b.id !== bossId);
        setBosses(updatedList);
        localDb.saveBosses(updatedList);
        addToast('삭제 완료', `'${targetName}'이(가) 삭제되었습니다.`, 'info');

        try {
          await deleteBossFromFirestore(bossId);
        } catch (err) {
          console.warn('Firestore delete boss warning:', err);
        }

        try {
          await fetch(`/api/bosses/${bossId}`, {
            method: 'DELETE',
          });
        } catch {}
      },
    });
  };

  // Action: Save Guild Config
  const handleSaveGuildConfig = async (configData: {
    guildName?: string;
    guildPassword?: string;
    announcement?: string;
  }) => {
    setGuildConfig((prev) => {
      const updated = { ...prev, ...configData };
      localDb.saveConfig(updated);
      return updated;
    });
    addToast('길드 설정 저장', '길드 정보가 저장되었습니다.', 'info');

    try {
      await saveGuildConfigToFirestore(configData);
    } catch (err) {
      console.warn('Firestore save guild config warning:', err);
    }

    try {
      await fetch('/api/guild/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData),
      });
    } catch {}
  };

  // ==========================================
  // 서버 보스타임 진행 (Server Bosses) 액션 핸들러
  // ==========================================

  // Server Boss Action: Instant Record Kill (처치 기록 원클릭)
  const handleInstantKillServerBoss = async (bossId: string) => {
    const targetBoss = serverBosses.find((b) => b.id === bossId);
    if (!targetBoss || !session) return;

    const now = new Date();
    const nowIso = now.toISOString();
    const nextSpawnMs = now.getTime() + targetBoss.respawnMinutes * 60 * 1000;
    const nextSpawnIso = new Date(nextSpawnMs).toISOString();

    const updatedBoss: BossItem = {
      ...targetBoss,
      serverStatus: '처치완료',
      statusUpdatedAt: nowIso,
      statusRecorderId: session.userId,
      lastKillTime: nowIso,
      lastKillerId: session.userId,
      nextSpawnTime: nextSpawnIso,
      updatedAt: nowIso,
    };

    const newLog: KillLogItem = {
      id: `server-log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      bossId: targetBoss.id,
      bossName: targetBoss.name,
      region: targetBoss.region,
      channel: targetBoss.channel,
      killerId: session.userId,
      killTime: nowIso,
      nextSpawnTime: nextSpawnIso,
      loggedAt: nowIso,
      notes: '원클릭 즉시 처치 기록',
    };

    const updatedList = serverBosses.map((b) => (b.id === bossId ? updatedBoss : b));
    setServerBosses(updatedList);
    setServerLogs((prev) => [newLog, ...prev]);

    localDb.saveServerBosses(updatedList);
    localDb.addServerLog(newLog);

    try {
      await saveServerBossToFirestore(updatedBoss);
      await addServerKillLogToFirestore(newLog);
    } catch (e) {
      console.warn('Firestore server kill error:', e);
    }

    addToast('⚔️ 서버 보스 처치 기록 완료', `'${targetBoss.name}' 처치 기록이 공유되었습니다.`, 'kill');
  };

  // Server Boss Action: Missed Spawn ("멍" - 직전 리젠 시간에 주기 추가)
  const handleMissedSpawnServerBoss = async (bossId: string) => {
    const targetBoss = serverBosses.find((b) => b.id === bossId);
    if (!targetBoss || !session) return;

    const now = Date.now();
    let baseSpawnMs = now;
    if (targetBoss.nextSpawnTime) {
      baseSpawnMs = new Date(targetBoss.nextSpawnTime).getTime();
    } else if (targetBoss.lastKillTime) {
      baseSpawnMs = new Date(targetBoss.lastKillTime).getTime();
    }

    const nextSpawnMs = baseSpawnMs + targetBoss.respawnMinutes * 60 * 1000;
    const nextSpawnIso = new Date(nextSpawnMs).toISOString();
    const nowIso = new Date().toISOString();
    const baseSpawnIso = new Date(baseSpawnMs).toISOString();

    const updatedBoss: BossItem = {
      ...targetBoss,
      serverStatus: '멍',
      statusUpdatedAt: nowIso,
      statusRecorderId: session.userId,
      lastKillTime: baseSpawnIso,
      lastKillerId: `${session.userId} (멍)`,
      nextSpawnTime: nextSpawnIso,
      updatedAt: nowIso,
    };

    const newLog: KillLogItem = {
      id: `server-log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      bossId: targetBoss.id,
      bossName: targetBoss.name,
      region: targetBoss.region,
      channel: targetBoss.channel,
      killerId: `${session.userId} (멍)`,
      killTime: baseSpawnIso,
      nextSpawnTime: nextSpawnIso,
      loggedAt: nowIso,
      notes: `멍 처리 (직전 젠 + ${targetBoss.respawnMinutes}분)`,
    };

    const updatedList = serverBosses.map((b) => (b.id === bossId ? updatedBoss : b));
    setServerBosses(updatedList);
    setServerLogs((prev) => [newLog, ...prev]);

    localDb.saveServerBosses(updatedList);
    localDb.addServerLog(newLog);

    try {
      await saveServerBossToFirestore(updatedBoss);
      await addServerKillLogToFirestore(newLog);
    } catch (e) {
      console.warn('Firestore server missed spawn error:', e);
    }

    const nextTimeStr = new Date(nextSpawnMs).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    addToast('💤 서버 보스 멍 처리 완료', `'${targetBoss.name}' 1사이클 추가 (다음 젠: ${nextTimeStr})`, 'info');
  };

  // Server Boss Action: Custom Kill Time
  const handleCustomKillServerBoss = async (bossId: string, killIso: string, notes?: string) => {
    const targetBoss = serverBosses.find((b) => b.id === bossId);
    if (!targetBoss || !session) return;

    const killTimeMs = new Date(killIso).getTime();
    const nextSpawnMs = killTimeMs + targetBoss.respawnMinutes * 60 * 1000;
    const nextSpawnIso = new Date(nextSpawnMs).toISOString();
    const nowIso = new Date().toISOString();

    const updatedBoss: BossItem = {
      ...targetBoss,
      serverStatus: '처치완료',
      statusUpdatedAt: nowIso,
      statusRecorderId: session.userId,
      lastKillTime: killIso,
      lastKillerId: session.userId,
      nextSpawnTime: nextSpawnIso,
      updatedAt: nowIso,
    };

    const newLog: KillLogItem = {
      id: `server-log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      bossId: targetBoss.id,
      bossName: targetBoss.name,
      region: targetBoss.region,
      channel: targetBoss.channel,
      killerId: session.userId,
      killTime: killIso,
      nextSpawnTime: nextSpawnIso,
      loggedAt: nowIso,
      notes: notes || '지정 시간 처치 기록',
    };

    const updatedList = serverBosses.map((b) => (b.id === bossId ? updatedBoss : b));
    setServerBosses(updatedList);
    setServerLogs((prev) => [newLog, ...prev]);

    localDb.saveServerBosses(updatedList);
    localDb.addServerLog(newLog);

    try {
      await saveServerBossToFirestore(updatedBoss);
      await addServerKillLogToFirestore(newLog);
    } catch (e) {
      console.warn('Firestore server custom kill error:', e);
    }

    addToast('⚔️ 서버 보스 지정 처치 기록', `'${targetBoss.name}' 처치 시간이 기록되었습니다.`, 'kill');
  };

  // Server Boss Action: Explicit status change ("리젠!" -> 출현 중, "멍" -> 멍, "처치" -> 처치완료)
  const handleSetServerBossStatus = async (bossId: string, newStatus: ServerBossState) => {
    const targetBoss = serverBosses.find((b) => b.id === bossId);
    if (!targetBoss || !session) return;

    const now = new Date();
    const nowIso = now.toISOString();

    let nextSpawnIso = targetBoss.nextSpawnTime;
    let lastKillIso = targetBoss.lastKillTime;
    let killerId = targetBoss.lastKillerId;
    let noteText = '';

    if (newStatus === '출현 중') {
      nextSpawnIso = nowIso;
      noteText = '보스 출현 확인 (리젠)';
      addToast('🔥 보스 출현 중!', `'${targetBoss.name}' 출현 확인 (기록자: ${session.userId})`, 'spawn');
    } else if (newStatus === '멍') {
      const baseMs = targetBoss.nextSpawnTime ? new Date(targetBoss.nextSpawnTime).getTime() : now.getTime();
      const nextSpawnMs = baseMs + targetBoss.respawnMinutes * 60 * 1000;
      nextSpawnIso = new Date(nextSpawnMs).toISOString();
      killerId = `${session.userId} (멍)`;
      noteText = '멍 처리';
      addToast('💤 멍 처리 완료', `'${targetBoss.name}' 멍 처리 (기록자: ${session.userId})`, 'info');
    } else if (newStatus === '처치완료') {
      lastKillIso = nowIso;
      killerId = session.userId;
      const nextSpawnMs = now.getTime() + targetBoss.respawnMinutes * 60 * 1000;
      nextSpawnIso = new Date(nextSpawnMs).toISOString();
      noteText = '처치 완료';
      addToast('⚔️ 처치 완료', `'${targetBoss.name}' 처치 완료 (기록자: ${session.userId})`, 'kill');
    }

    const updatedBoss: BossItem = {
      ...targetBoss,
      serverStatus: newStatus,
      statusUpdatedAt: nowIso,
      statusRecorderId: session.userId,
      lastKillTime: lastKillIso,
      lastKillerId: killerId,
      nextSpawnTime: nextSpawnIso,
      updatedAt: nowIso,
    };

    const newLog: KillLogItem = {
      id: `server-log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      bossId: targetBoss.id,
      bossName: targetBoss.name,
      region: targetBoss.region,
      channel: targetBoss.channel,
      killerId: killerId || session.userId,
      killTime: nowIso,
      nextSpawnTime: nextSpawnIso || nowIso,
      loggedAt: nowIso,
      notes: `[${newStatus}] ${noteText}`,
    };

    const updatedList = serverBosses.map((b) => (b.id === bossId ? updatedBoss : b));
    setServerBosses(updatedList);
    setServerLogs((prev) => [newLog, ...prev]);

    localDb.saveServerBosses(updatedList);
    localDb.addServerLog(newLog);

    try {
      await saveServerBossToFirestore(updatedBoss);
      await addServerKillLogToFirestore(newLog);
    } catch (e) {
      console.warn('Firestore update server boss status error:', e);
    }
  };

  // Server Boss Action: Save Boss (Add or Edit)
  const handleSaveServerBoss = async (bossData: Partial<BossItem>, isEdit: boolean) => {
    if (isEdit && bossData.id) {
      const existing = serverBosses.find((b) => b.id === bossData.id);
      if (!existing) return;
      const updated: BossItem = {
        ...existing,
        ...bossData,
        updatedAt: new Date().toISOString(),
      };
      const updatedList = serverBosses.map((b) => (b.id === bossData.id ? updated : b));
      setServerBosses(updatedList);
      localDb.saveServerBosses(updatedList);
      await saveServerBossToFirestore(updated);
    } else {
      const newBoss = bossData as BossItem;
      const updatedList = [...serverBosses, newBoss];
      setServerBosses(updatedList);
      localDb.saveServerBosses(updatedList);
      await saveServerBossToFirestore(newBoss);
    }
  };

  // Server Boss Action: Delete Boss
  const handleDeleteServerBoss = async (bossId: string) => {
    const updatedList = serverBosses.filter((b) => b.id !== bossId);
    setServerBosses(updatedList);
    localDb.saveServerBosses(updatedList);
    await deleteServerBossFromFirestore(bossId);
    addToast('🗑️ 서버 보스 삭제 완료', '해당 보스가 목록에서 제거되었습니다.', 'info');
  };

  // Server Boss Action: Reset Boss Timer
  const handleResetServerBoss = async (bossId: string) => {
    const target = serverBosses.find((b) => b.id === bossId);
    if (!target) return;
    const updated: BossItem = {
      ...target,
      serverStatus: undefined,
      statusUpdatedAt: undefined,
      statusRecorderId: undefined,
      lastKillTime: null,
      lastKillerId: null,
      nextSpawnTime: null,
      updatedAt: new Date().toISOString(),
    };
    const updatedList = serverBosses.map((b) => (b.id === bossId ? updated : b));
    setServerBosses(updatedList);
    localDb.saveServerBosses(updatedList);
    await saveServerBossToFirestore(updated);
    addToast('🔄 서버 보스 타이머 초기화', `'${target.name}'의 젠 정보가 초기화되었습니다.`, 'info');
  };

  // ==========================================
  // 수집템 강화 요청소 Action Handlers
  // ==========================================
  const handleSaveEnhancementRequest = async (request: EnhancementRequestGroup) => {
    // 1. 요청 내 아이템 정렬 (아이템명 가나다순 및 목표강화순)
    const sanitizedRequest: EnhancementRequestGroup = {
      ...request,
      items: sortEnhancementItems(request.items || []),
    };

    const exists = enhancementRequests.some((r) => r.id === sanitizedRequest.id);
    let updatedList: EnhancementRequestGroup[];
    if (exists) {
      updatedList = enhancementRequests.map((r) => (r.id === sanitizedRequest.id ? sanitizedRequest : r));
    } else {
      updatedList = [sanitizedRequest, ...enhancementRequests];
    }

    // 2. 전체 요청 목록 재정렬 (동일 아이템이 비슷한 위치에 오도록 정렬)
    const sortedList = sortEnhancementGroups(updatedList);

    setEnhancementRequests(sortedList);
    localDb.saveEnhancementRequests(sortedList);
    await saveEnhancementRequestToFirestore(sanitizedRequest);
  };

  const handleDeleteEnhancementRequest = async (requestId: string) => {
    const updatedList = enhancementRequests.filter((r) => r.id !== requestId);
    const sortedList = sortEnhancementGroups(updatedList);
    setEnhancementRequests(sortedList);
    localDb.saveEnhancementRequests(sortedList);
    await deleteEnhancementRequestFromFirestore(requestId);
  };

  // 개인 적대 목록 (Hostile Targets) 핸들러
  const handleSaveHostileTarget = async (targetData: Omit<HostileTarget, 'id'>) => {
    const trimmedId = targetData.targetId.trim();
    const isDuplicate = hostileTargets.some(
      (t) => t.targetId.trim().toLowerCase() === trimmedId.toLowerCase()
    );
    if (isDuplicate) {
      throw new Error(`'${trimmedId}'(은)는 이미 등록되어 있는 중복 아이디입니다.`);
    }

    const newTarget: HostileTarget = {
      id: `hostile-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      ...targetData,
      targetId: trimmedId,
    };
    const updatedList = [newTarget, ...hostileTargets];
    setHostileTargets(updatedList);
    localDb.saveHostileTargets(updatedList);
    await saveHostileTargetToFirestore(newTarget);
  };

  const handleDeleteHostileTarget = async (targetId: string) => {
    const targetToDelete = hostileTargets.find((t) => t.id === targetId);
    const targetName = targetToDelete?.targetId;
    const updatedList = hostileTargets.filter(
      (t) =>
        t.id !== targetId &&
        (!targetName || t.targetId.trim().toLowerCase() !== targetName.trim().toLowerCase())
    );
    setHostileTargets(updatedList);
    localDb.saveHostileTargets(updatedList);
    if (targetName) {
      localDb.markHostileTargetAsDeleted(targetName);
    }
    await deleteHostileTargetFromFirestore(targetId, targetName);
  };

  const handleUpdateHostileTarget = async (updatedTarget: HostileTarget) => {
    const updatedList = hostileTargets.map((t) => (t.id === updatedTarget.id ? updatedTarget : t));
    setHostileTargets(updatedList);
    localDb.saveHostileTargets(updatedList);
    await saveHostileTargetToFirestore(updatedTarget);
  };

  // 썰자 이벤트 참여 (Ssulja Records) 핸들러
  const handleSaveSsuljaRecord = async (record: SsuljaEventRecord) => {
    const exists = ssuljaRecords.some((r) => r.id === record.id);
    const updated = exists
      ? ssuljaRecords.map((r) => (r.id === record.id ? record : r))
      : [record, ...ssuljaRecords];
    setSsuljaRecords(updated);
    localDb.saveSsuljaRecords(updated);
    await saveSsuljaRecordToFirestore(record);
  };

  const handleSaveMultipleSsuljaRecords = async (newRecords: SsuljaEventRecord[]) => {
    const updated = [...newRecords, ...ssuljaRecords];
    setSsuljaRecords(updated);
    localDb.saveSsuljaRecords(updated);
    await saveMultipleSsuljaRecordsToFirestore(newRecords);
  };

  const handleDeleteSsuljaRecord = async (recordId: string) => {
    const updated = ssuljaRecords.filter((r) => r.id !== recordId);
    setSsuljaRecords(updated);
    localDb.saveSsuljaRecords(updated);
    await deleteSsuljaRecordFromFirestore(recordId);
  };

  const handleDeleteMultipleSsuljaRecords = async (recordIds: string[]) => {
    const idSet = new Set(recordIds);
    const updated = ssuljaRecords.filter((r) => !idSet.has(r.id));
    setSsuljaRecords(updated);
    localDb.saveSsuljaRecords(updated);
    for (const id of recordIds) {
      await deleteSsuljaRecordFromFirestore(id);
    }
  };


  // Counts for preset filters
  const filterCounts = useMemo(() => {
    return {
      ALL: bosses.length,
      '신을 버린자': bosses.filter(b => b.name.includes('신을 버린자') || (b.region && b.region.includes('신을 버린자'))).length,
      '창조의 핵': bosses.filter(b => b.name.includes('창조의 핵') || (b.region && b.region.includes('창조의 핵'))).length,
      '신의탑 상자': bosses.filter(b => b.name.includes('신의탑 상자') || (b.region && b.region.includes('신의탑 상자'))).length,
      '과수원 농사': bosses.filter(b => 
        b.name.includes('생명의 트리') || (b.region && b.region.includes('생명의 트리')) ||
        b.name.includes('과수원') || (b.region && b.region.includes('과수원'))
      ).length,
      '리퍼 & 드레이크': bosses.filter(b => 
        b.name.includes('리퍼') || (b.region && b.region.includes('리퍼')) ||
        b.name.includes('드레이크') || (b.region && b.region.includes('드레이크'))
      ).length,
      '라자엘 & 아리엘': bosses.filter(b => 
        b.name.includes('라자엘') || (b.region && b.region.includes('라자엘')) ||
        b.name.includes('아리엘') || (b.region && b.region.includes('아리엘'))
      ).length,
    };
  }, [bosses]);

  // Filtered and Sorted Bosses:
  // 1) 프리셋 버튼 필터 (신을 버린자, 창조의 핵, 신의탑 상자, 리퍼 & 드레이크, 라자엘 & 아리엘)
  // 2) 명칭 / 지역 실시간 검색
  // 3) 쿨타임 진행 중 / 출현 보스 (기록 있음) 을 위로 정렬 (쿨타임 잔여시간 짧은 순서대로 실시간 정렬)
  // 4) 기록이 없는 것은 맨 아래로 배치 (이름순 정렬)
  const sortedBosses = useMemo(() => {
    let list = bosses;

    // 프리셋 필터링
    if (presetFilter === '신을 버린자') {
      list = list.filter(b => b.name.includes('신을 버린자') || (b.region && b.region.includes('신을 버린자')));
    } else if (presetFilter === '창조의 핵') {
      list = list.filter(b => b.name.includes('창조의 핵') || (b.region && b.region.includes('창조의 핵')));
    } else if (presetFilter === '신의탑 상자') {
      list = list.filter(b => b.name.includes('신의탑 상자') || (b.region && b.region.includes('신의탑 상자')));
    } else if (presetFilter === '과수원 농사') {
      list = list.filter(b =>
        b.name.includes('생명의 트리') || (b.region && b.region.includes('생명의 트리')) ||
        b.name.includes('과수원') || (b.region && b.region.includes('과수원'))
      );
    } else if (presetFilter === '리퍼 & 드레이크') {
      list = list.filter(b =>
        b.name.includes('리퍼') || (b.region && b.region.includes('리퍼')) ||
        b.name.includes('드레이크') || (b.region && b.region.includes('드레이크'))
      );
    } else if (presetFilter === '라자엘 & 아리엘') {
      list = list.filter(b =>
        b.name.includes('라자엘') || (b.region && b.region.includes('라자엘')) ||
        b.name.includes('아리엘') || (b.region && b.region.includes('아리엘'))
      );
    }

    // 명칭 및 지역 검색
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter(b => 
        b.name.toLowerCase().includes(query) ||
        (b.region && b.region.toLowerCase().includes(query))
      );
    }

    return [...list].sort((a, b) => {
      const hasRecordA = Boolean(a.nextSpawnTime);
      const hasRecordB = Boolean(b.nextSpawnTime);

      // 기록 있는 항목을 위로, 기록 없는 것은 아래로
      if (hasRecordA && !hasRecordB) return -1;
      if (!hasRecordA && hasRecordB) return 1;

      // 둘 다 기록이 없는 경우: 가나다 이름순 정렬
      if (!hasRecordA && !hasRecordB) {
        return a.name.localeCompare(b.name, 'ko-KR');
      }

      // 둘 다 기록이 있는 경우: 쿨타임 잔여 시간이 짧은 순서대로 오름차순 실시간 정렬
      const timeA = new Date(a.nextSpawnTime!).getTime();
      const timeB = new Date(b.nextSpawnTime!).getTime();
      const diffA = timeA - currentTime;
      const diffB = timeB - currentTime;

      return diffA - diffB;
    });
  }, [bosses, presetFilter, searchQuery, currentTime]);

  // If not logged in, render the login screen
  if (!session) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        defaultPasswordHint="1234"
      />
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#080c15] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200 overflow-x-hidden">
      {/* Header */}
      <Header
        userId={session.userId}
        guildConfig={guildConfig}
        alarmSettings={alarmSettings}
        isLiveConnected={isLiveConnected}
        activeUsersCount={activeUsersCount}
        activeUsers={activePresenceUsers}
        currentPage={currentPage}
        onNavigatePage={navigateToPage}
        onUpdateAlarmSettings={handleUpdateAlarmSettings}
        onRequestPushPermission={handleRequestPushPermission}
        onOpenAddBoss={() => {
          setBossToEdit(null);
          setIsAddBossOpen(true);
        }}
        onOpenGuildSettings={() => setIsSettingsOpen(true)}
        onLogout={handleLogout}
        onOpenLogs={() => setIsLogsOpen(true)}
        unreadLogsCount={logs.length}
      />

      {currentPage === 'SERVER_BOSS' ? (
        <ServerBossView
          hostileTargets={hostileTargets}
          session={session}
          adminPassword={guildConfig.adminPassword || '0606'}
          onSaveHostileTarget={handleSaveHostileTarget}
          onUpdateHostileTarget={handleUpdateHostileTarget}
          onDeleteHostileTarget={handleDeleteHostileTarget}
          onNavigateToMain={() => navigateToPage('MAIN')}
          onNavigateToEnhancement={() => navigateToPage('ENHANCEMENT_REQUESTS')}
          onAddToast={addToast}
        />
      ) : currentPage === 'ENHANCEMENT_REQUESTS' ? (
        <EnhancementRequestsView
          requests={enhancementRequests}
          session={session}
          onNavigateToMain={() => navigateToPage('MAIN')}
          onNavigateToServerBoss={() => navigateToPage('SERVER_BOSS')}
          onSaveRequest={handleSaveEnhancementRequest}
          onDeleteRequest={handleDeleteEnhancementRequest}
          onAddToast={addToast}
        />
      ) : currentPage === 'SSULJA_EVENT' ? (
        <SsuljaEventView
          records={ssuljaRecords}
          session={session}
          onNavigateToMain={() => navigateToPage('MAIN')}
          onNavigateToServerBoss={() => navigateToPage('SERVER_BOSS')}
          onNavigateToEnhancement={() => navigateToPage('ENHANCEMENT_REQUESTS')}
          onSaveRecord={handleSaveSsuljaRecord}
          onSaveMultipleRecords={handleSaveMultipleSsuljaRecords}
          onDeleteRecord={handleDeleteSsuljaRecord}
          onDeleteMultipleRecords={handleDeleteMultipleSsuljaRecords}
          onAddToast={addToast}
        />
      ) : (
        /* Main Container */
        <main className="flex-1 w-full max-w-[1920px] mx-auto px-3 sm:px-6 lg:px-8 py-5">
          {/* Overview Stats Bar */}
          <StatsBar bosses={bosses} />

          {/* Section Header with Sort and View Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Swords className="w-4 h-4 text-cyan-400" />
                <span>
                  리젠 타이머 목록 ({sortedBosses.length}
                  {sortedBosses.length !== bosses.length && (
                    <span className="text-xs font-normal text-slate-400 ml-1">/ {bosses.length}</span>
                  )}
                  )
                </span>
              </h2>

              {/* 눈에 띄는 "개인 적대 목록" 페이지 이동 버튼 */}
              <button
                id="server-boss-time-nav-button"
                type="button"
                onClick={() => navigateToPage('SERVER_BOSS')}
                className="relative inline-flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 hover:from-amber-400 hover:via-orange-400 hover:to-rose-500 active:scale-95 text-slate-950 font-black text-xs sm:text-sm shadow-md shadow-orange-500/30 border border-amber-300/60 ring-2 ring-amber-400/50 hover:ring-amber-300 transition-all cursor-pointer group"
                title="개인 적대 목록 페이지로 이동"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-90"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                <Globe className="w-4 h-4 text-slate-950 group-hover:rotate-12 transition-transform" />
                <span className="tracking-tight text-slate-950 font-black">개인 적대 목록</span>
                <span className="bg-black/25 text-slate-950 px-1.5 py-0.2 rounded text-[10px] font-bold">
                  이동 ➔
                </span>
              </button>

              {/* 눈에 띄는 "수집템 강화 요청소" 페이지 이동 버튼 */}
              <button
                id="enhancement-requests-nav-button"
                type="button"
                onClick={() => navigateToPage('ENHANCEMENT_REQUESTS')}
                className="relative inline-flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 hover:from-purple-500 hover:via-fuchsia-500 hover:to-indigo-500 active:scale-95 text-white font-black text-xs sm:text-sm shadow-md shadow-purple-900/50 border border-purple-300/70 ring-2 ring-purple-400/60 hover:ring-purple-300 transition-all cursor-pointer group"
                title="수집템 강화 요청소 페이지로 이동"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-300 opacity-90"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                <Sparkles className="w-4 h-4 text-white group-hover:rotate-12 transition-transform" />
                <span className="tracking-tight text-white font-black">수집템 강화 요청소</span>
                <span className="bg-black/30 text-purple-200 px-1.5 py-0.2 rounded text-[10px] font-bold">
                  이동 ➔
                </span>
              </button>

              {/* 눈에 띄는 "썰자 이벤트 참여" 페이지 이동 버튼 */}
              <button
                id="ssulja-event-nav-button"
                type="button"
                onClick={() => navigateToPage('SSULJA_EVENT')}
                className="relative inline-flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 hover:from-rose-500 hover:via-red-500 hover:to-amber-500 active:scale-95 text-white font-black text-xs sm:text-sm shadow-md shadow-rose-950/60 border border-rose-300/70 ring-2 ring-rose-400/60 hover:ring-rose-300 transition-all cursor-pointer group"
                title="썰자 이벤트 참여 페이지로 이동"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-300 opacity-90"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                <Swords className="w-4 h-4 text-white group-hover:rotate-12 transition-transform" />
                <span className="tracking-tight text-white font-black">썰자 이벤트 참여</span>
                <span className="bg-black/30 text-rose-200 px-1.5 py-0.2 rounded text-[10px] font-bold">
                  이동 ➔
                </span>
              </button>

              <span className="text-xs text-slate-400 hidden xl:inline">
                쿨타임 진행순 실시간 자동 정렬
              </span>
            </div>

          <div className="flex items-center gap-2 text-xs flex-wrap">
            {/* View Mode Toggle: List (Default) vs Card */}
            <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('LIST')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  viewMode === 'LIST'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="리스트 형식으로 보기"
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>리스트형</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('CARD')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  viewMode === 'CARD'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="카드 형식으로 보기"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>카드형</span>
              </button>
            </div>

            <button
              onClick={() => {
                setBossToEdit(null);
                setIsAddBossOpen(true);
              }}
              className="sm:hidden px-3 py-1.5 rounded-xl bg-cyan-600 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>추가</span>
            </button>
          </div>
        </div>

        {/* Single-Row Filter & Search Bar */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-2 sm:p-2.5 mb-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 backdrop-blur-sm shadow-sm">
          {/* Preset Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 shrink-0 ml-1 mr-0.5">
              <Filter className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">필터:</span>
            </span>

            <button
              type="button"
              onClick={() => setPresetFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                presetFilter === 'ALL'
                  ? 'bg-slate-700 text-white shadow-sm ring-1 ring-slate-500/50'
                  : 'bg-slate-950/70 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-slate-800/80'
              }`}
            >
              <span>전체</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${presetFilter === 'ALL' ? 'bg-slate-800 text-cyan-300' : 'bg-slate-900 text-slate-400'}`}>
                {filterCounts.ALL}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPresetFilter('신을 버린자')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                presetFilter === '신을 버린자'
                  ? 'bg-purple-950/90 text-purple-200 border border-purple-500/80 shadow-sm shadow-purple-950/50'
                  : 'bg-slate-950/70 text-slate-400 hover:text-purple-300 hover:bg-purple-950/30 border border-slate-800/80'
              }`}
            >
              <span>신을 버린자</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${presetFilter === '신을 버린자' ? 'bg-purple-900 text-purple-200' : 'bg-slate-900 text-slate-400'}`}>
                {filterCounts['신을 버린자']}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPresetFilter('창조의 핵')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                presetFilter === '창조의 핵'
                  ? 'bg-cyan-950/90 text-cyan-200 border border-cyan-500/80 shadow-sm shadow-cyan-950/50'
                  : 'bg-slate-950/70 text-slate-400 hover:text-cyan-300 hover:bg-cyan-950/30 border border-slate-800/80'
              }`}
            >
              <span>창조의 핵</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${presetFilter === '창조의 핵' ? 'bg-cyan-900 text-cyan-200' : 'bg-slate-900 text-slate-400'}`}>
                {filterCounts['창조의 핵']}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPresetFilter('신의탑 상자')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                presetFilter === '신의탑 상자'
                  ? 'bg-amber-950/90 text-amber-200 border border-amber-500/80 shadow-sm shadow-amber-950/50'
                  : 'bg-slate-950/70 text-slate-400 hover:text-amber-300 hover:bg-amber-950/30 border border-slate-800/80'
              }`}
            >
              <span>신의탑 상자</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${presetFilter === '신의탑 상자' ? 'bg-amber-900 text-amber-200' : 'bg-slate-900 text-slate-400'}`}>
                {filterCounts['신의탑 상자']}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPresetFilter('과수원 농사')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                presetFilter === '과수원 농사'
                  ? 'bg-emerald-950/90 text-emerald-200 border border-emerald-500/80 shadow-sm shadow-emerald-950/50'
                  : 'bg-slate-950/70 text-slate-400 hover:text-emerald-300 hover:bg-emerald-950/30 border border-slate-800/80'
              }`}
            >
              <span>과수원 농사</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${presetFilter === '과수원 농사' ? 'bg-emerald-900 text-emerald-200' : 'bg-slate-900 text-slate-400'}`}>
                {filterCounts['과수원 농사']}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPresetFilter('리퍼 & 드레이크')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                presetFilter === '리퍼 & 드레이크'
                  ? 'bg-rose-950/90 text-rose-200 border border-rose-500/80 shadow-sm shadow-rose-950/50'
                  : 'bg-slate-950/70 text-slate-400 hover:text-rose-300 hover:bg-rose-950/30 border border-slate-800/80'
              }`}
            >
              <span>리퍼 &amp; 드레이크</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${presetFilter === '리퍼 & 드레이크' ? 'bg-rose-900 text-rose-200' : 'bg-slate-900 text-slate-400'}`}>
                {filterCounts['리퍼 & 드레이크']}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPresetFilter('라자엘 & 아리엘')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                presetFilter === '라자엘 & 아리엘'
                  ? 'bg-indigo-950/90 text-indigo-200 border border-indigo-500/80 shadow-sm shadow-indigo-950/50'
                  : 'bg-slate-950/70 text-slate-400 hover:text-indigo-300 hover:bg-indigo-950/30 border border-slate-800/80'
              }`}
            >
              <span>라자엘 &amp; 아리엘</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${presetFilter === '라자엘 & 아리엘' ? 'bg-indigo-900 text-indigo-200' : 'bg-slate-900 text-slate-400'}`}>
                {filterCounts['라자엘 & 아리엘']}
              </span>
            </button>
          </div>

          {/* Search by Name / Location Input */}
          <div className="relative w-full md:w-64 lg:w-72 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="명칭 또는 지역명 검색..."
              className="w-full pl-8.5 pr-8 py-1.5 bg-slate-950/90 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-100 p-0.5 cursor-pointer"
                title="검색어 지우기"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Boss List or Cards Grid */}
        {bosses.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-12 text-center my-8">
            <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3 stroke-1" />
            <h3 className="text-base font-bold text-slate-300">
              등록된 리젠 타이머가 없습니다.
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              상단의 '+ 지역 추가' 버튼을 눌러 새로운 지역 리젠 정보를 등록해보세요.
            </p>
            <button
              onClick={() => {
                setBossToEdit(null);
                setIsAddBossOpen(true);
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs text-white font-bold transition-colors cursor-pointer"
            >
              + 지역 추가하기
            </button>
          </div>
        ) : sortedBosses.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-10 text-center my-6">
            <Filter className="w-10 h-10 text-slate-600 mx-auto mb-2 stroke-1" />
            <h3 className="text-sm font-bold text-slate-300">
              조건에 일치하는 대상이 없습니다
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              선택한 필터 또는 검색어에 일치하는 보스나 지역이 없습니다.
            </p>
            <button
              onClick={() => {
                setPresetFilter('ALL');
                setSearchQuery('');
              }}
              className="mt-3 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-semibold transition-colors cursor-pointer"
            >
              필터 및 검색 초기화
            </button>
          </div>
        ) : viewMode === 'LIST' ? (
          <div className="flex flex-col gap-2.5">
            {sortedBosses.map((boss) => (
              <BossListItem
                key={boss.id}
                boss={boss}
                currentUserId={session.userId}
                onInstantKill={handleInstantKill}
                onMissedSpawn={handleMissedSpawn}
                onOpenCustomKill={(b) => setCustomKillBoss(b)}
                onOpenEditBoss={(b) => {
                  setBossToEdit(b);
                  setIsAddBossOpen(true);
                }}
                onResetBoss={handleResetBoss}
                onDeleteBoss={handleDeleteBoss}
                onOpenHistory={(b) => setHistoryBoss(b)}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sortedBosses.map((boss) => (
              <BossCard
                key={boss.id}
                boss={boss}
                currentUserId={session.userId}
                onInstantKill={handleInstantKill}
                onMissedSpawn={handleMissedSpawn}
                onOpenCustomKill={(b) => setCustomKillBoss(b)}
                onOpenEditBoss={(b) => {
                  setBossToEdit(b);
                  setIsAddBossOpen(true);
                }}
                onResetBoss={handleResetBoss}
                onDeleteBoss={handleDeleteBoss}
                onOpenHistory={(b) => setHistoryBoss(b)}
              />
            ))}
          </div>
        )}
      </main>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500">
        <p>
          솔 인챈트 (Soul Enchant) 실시간 보스 리젠 타이머 & 길드 공유 시스템 · 다크 모드
        </p>
        <p className="text-[11px] text-slate-600 mt-1">
          신을 버린자, 창조의 핵을 포함한 모든 필드/던전 보스의 처치 시간 자동 계산 및 실시간 동기화
        </p>
      </footer>

      {/* Modals & Drawers */}
      <BossFormModal
        isOpen={isAddBossOpen}
        bossToEdit={bossToEdit}
        onClose={() => {
          setIsAddBossOpen(false);
          setBossToEdit(null);
        }}
        onSave={handleSaveBoss}
      />

      <CustomKillModal
        isOpen={!!customKillBoss}
        boss={customKillBoss}
        currentUserId={session.userId}
        onClose={() => setCustomKillBoss(null)}
        onConfirmKill={handleCustomKill}
      />

      <BossHistoryModal
        isOpen={!!historyBoss}
        boss={historyBoss}
        logs={logs}
        onClose={() => setHistoryBoss(null)}
      />

      <KillLogDrawer
        isOpen={isLogsOpen}
        logs={logs}
        onClose={() => setIsLogsOpen(false)}
      />

      <GuildSettingsModal
        isOpen={isSettingsOpen}
        guildConfig={guildConfig}
        alarmSettings={alarmSettings}
        onClose={() => setIsSettingsOpen(false)}
        onSaveGuildConfig={handleSaveGuildConfig}
        onUpdateAlarmSettings={handleUpdateAlarmSettings}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        cancelLabel={confirmModal.cancelLabel}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Real-time floating toast alerts */}
      <LiveToast toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
}
