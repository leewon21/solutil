export type ServerBossState = '출현 중' | '멍' | '처치완료';

export interface BossItem {
  id: string;
  name: string;
  region: string;
  channel: string;
  respawnMinutes: number;
  lastKillTime: string | null;
  lastKillerId: string | null;
  nextSpawnTime: string | null;
  notes?: string;
  difficulty?: 'SS' | 'S' | 'A' | 'B';
  dropItems?: string[];
  updatedAt: string;
  serverStatus?: ServerBossState;
  statusUpdatedAt?: string;
  statusRecorderId?: string;
  teljiScout?: string;
  bossRoomScout?: string;
  spawnTimes?: string[];
}

export interface KillLogItem {
  id: string;
  bossId: string;
  bossName: string;
  region: string;
  channel: string;
  killerId: string;
  killTime: string;
  nextSpawnTime: string;
  loggedAt: string;
  notes?: string;
}

export interface GuildConfig {
  guildName: string;
  announcement: string;
  activeMembers?: number;
  guildPassword?: string;
  adminPassword?: string; // 운영자 비밀번호 (초기: '0606')
  defaultPasswordHint?: string;
}

export interface HostileTarget {
  id: string;
  targetId: string; // 경계 대상의 아이디
  createdAt: string; // 추가된 일자 (YYYY-MM-DD HH:mm:ss or ISO)
  createdBy: string; // 추가한 사람의 아이디 (등록자)
  memo?: string; // 사유/특이사항 (선택사항)
}

export interface UserSession {
  userId: string;
  guildName: string;
  token: string;
  loginAt: string;
}

export interface AlarmSettings {
  soundEnabled: boolean;
  browserNotificationEnabled: boolean;
  alertAt10Min: boolean;
  alertAt5Min: boolean;
  alertAt1Min: boolean;
  alertAtSpawn: boolean;
  volume: number; // 0 to 1
}

export type BossStatus = 'SPAWNED' | 'IMMINENT' | 'WAITING' | 'NO_RECORD';

export interface EnhancementItem {
  id: string;
  itemName: string;
  targetLevel: number; // 0 ~ 9
  isBound?: boolean; // 귀속 여부 (선택/하위호환)
  isCompleted?: boolean; // 강화 완료 여부
  count?: number; // 요청 수량/갯수 (기본 1)
}

export interface EnhancementRequestGroup {
  id: string;
  userId: string;
  password: string; // 수정/삭제 시 검증 비밀번호
  items: EnhancementItem[];
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

export type SsuljaContributionType = '처치' | '도움';

export interface SsuljaEventRecord {
  id: string;
  occurredAt: string; // 발생시간 e.g. "2026/09/28 00:10"
  contributionType: SsuljaContributionType; // '처치' | '도움'
  targetId: string; // 대상자 아이디
  targetGuild: string; // 대상자 길드 (없으면 '-')
  uploaderId: string; // 업로드/등록한 사람의 로그인 아이디
  uploadedAt: string; // 등록 일시 (ISO)
  notes?: string; // 추가 메모/비고
}

