import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

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
  guildPassword: string;
  announcement: string;
  discordWebhookUrl?: string;
}

interface DatabaseSchema {
  config: GuildConfig;
  bosses: BossItem[];
  logs: KillLogItem[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'soul_enchant_db.json');

// Default starting bosses based on user requirements: "신을 버린자", "창조의 핵" + additional Sol Enchant targets
const DEFAULT_BOSSES: BossItem[] = [
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
];

const DEFAULT_CONFIG: GuildConfig = {
  guildName: '솔 인챈트 1군 정예 길드',
  guildPassword: '1234',
  announcement: '📢 [공지] 보스 처치 즉시 [처치 기록] 버튼을 눌러주세요. 길드원 전원에게 실시간 팝업 및 타이머가 동기화됩니다.',
};

function loadDatabase(): DatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return {
        config: { ...DEFAULT_CONFIG, ...(parsed.config || {}) },
        bosses: Array.isArray(parsed.bosses) && parsed.bosses.length > 0 ? parsed.bosses : DEFAULT_BOSSES,
        logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      };
    }
  } catch (err) {
    console.error('Error reading database file, using defaults', err);
  }
  return {
    config: DEFAULT_CONFIG,
    bosses: DEFAULT_BOSSES,
    logs: [],
  };
}

function saveDatabase(db: DatabaseSchema) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing database file', err);
  }
}

let db = loadDatabase();

// Connected SSE clients for real-time broadcasts
const sseClients: { id: number; res: Response; userId?: string }[] = [];
let nextClientId = 1;

function broadcast(eventType: string, payload: any) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.res.write(message);
    } catch (e) {
      // client connection might have dropped
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // CORS & Preflight handling
  app.use((req: Request, res: Response, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // SSE Heartbeat every 25s
  setInterval(() => {
    for (const client of sseClients) {
      try {
        client.res.write(': heartbeat\n\n');
      } catch (e) {}
    }
  }, 25000);

  // --- API Routes ---

  // Health check endpoint for OCR service
  app.get(['/api/ssulja/parse-image', '/api/ssulja/parse-image/'], (req: Request, res: Response) => {
    res.json({ success: true, message: 'OCR analysis endpoint is online' });
  });

  // 썰자 이벤트 스크린샷 이미지 분석 (Gemini OCR with Multi-Model Fallback, Auto-Retry & Robust Extraction)
  app.post(['/api/ssulja/parse-image', '/api/ssulja/parse-image/'], async (req: Request, res: Response) => {
    try {
      const { imageBase64, mimeType } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: '이미지 데이터가 전달되지 않았습니다.' });
      }

      // Clean base64 prefix if present & strip whitespaces
      const cleanBase64 = imageBase64
        .replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '')
        .replace(/\s+/g, '');

      const imagePart = {
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: cleanBase64,
        },
      };

      const promptText = `당신은 MMORPG 게임(리니지, 아키에이지, 솔인챈트 등)의 PvP 전투 기록(처치/도움 로그) 전문 OCR 분석 AI입니다.
첨부된 스크린샷 이미지에서 '처치' 또는 '도움' 전투 로그 목록을 찾아내어 모든 행을 순서대로 추출하세요.

[필수 추출 규칙]
1. 발생시간(occurredAt):
   - 이미지 내 시간 표시(예: "2026/09/28 00:10", "09/28 14:05", "2026-09-28 12:30", "09.28 01:20", "14:05:20", "5분 전")를 추출합니다.
   - 연도가 생략된 경우(예: "09/28 14:05")에는 현재 연도 2026을 붙여 "2026/09/28 14:05" 형식으로 만드세요.
   - 날짜가 없고 시:분만 있는 경우 오늘의 날짜를 앞에 붙여 "2026/09/29 HH:mm" 형식으로 만드세요.
   - 상대 시간(예: "1분 전", "방금 전")인 경우 오늘 현재 시간 기준으로 변환하세요.
2. 기여내역(contributionType):
   - 반드시 "처치" 또는 "도움" 중 하나로 표기하세요.
   - 킬, 처치, 사망시킴, 청록색/하늘색/민트색 텍스트, 칼 아이콘 -> "처치"
   - 어시스트, 도움, 지원, 노란색/골드색/주황색 텍스트, 방패 아이콘 -> "도움"
   - 불확실한 경우 "처치"를 기본값으로 합니다.
3. 대상자 아이디(targetId):
   - 처치 또는 도움을 받은 적대 플레이어의 캐릭터 닉네임만 순수하게 추출하세요.
   - [길드명], 서버명, 직업 아이콘, 레벨(Lv.XX), 칭호, 특수기호는 제거합니다.
4. 대상자 길드(targetGuild):
   - 대상자 캐릭터명 앞뒤 또는 괄호([])에 적힌 길드명 텍스트입니다. 없으면 "-"로 지정하세요.

[반환 형식]
반드시 순수 JSON 배열([]) 형식으로만 반환하세요. 마크다운 코드블록이나 다른 설명 문장은 일체 제외하세요.
예시:
[
  {"occurredAt": "2026/09/29 14:05", "contributionType": "처치", "targetId": "적대유저1", "targetGuild": "혈맹A"},
  {"occurredAt": "2026/09/29 14:02", "contributionType": "도움", "targetId": "적대유저2", "targetGuild": "-"}
]
기록이 전혀 발견되지 않는 경우 빈 배열 [] 을 반환하세요.`;

      // Multi-model list with proven fast and resilient models that have available quota
      const modelsToTry = [
        'gemini-3.1-flash-lite',
        'gemini-flash-lite-latest',
        'gemini-3-flash-preview',
      ];

      let rawResponseText = '';
      let lastModelError: any = null;

      for (const modelName of modelsToTry) {
        // Retry up to 2 attempts per model for transient 503 / 429
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`응답 시간 초과 (${modelName})`)), 25000)
            );

            const generatePromise = ai.models.generateContent({
              model: modelName,
              contents: {
                parts: [imagePart, { text: promptText }],
              },
              config: {
                responseMimeType: 'application/json',
              },
            });

            const response: any = await Promise.race([generatePromise, timeoutPromise]);

            if (response?.text && response.text.trim()) {
              rawResponseText = response.text.trim();
              break;
            }
          } catch (err: any) {
            lastModelError = err;
            const errMsg = err?.message || String(err);
            console.warn(`[OCR Retry Warning] Model ${modelName} attempt ${attempt} failed:`, errMsg);

            // If 503 (high demand) or 429 (rate limit), wait 1000ms before attempt 2
            if (attempt === 1 && (errMsg.includes('503') || errMsg.includes('429') || errMsg.includes('high demand'))) {
              await new Promise((r) => setTimeout(r, 1000));
            }
          }
        }

        if (rawResponseText) {
          break;
        }
      }

      if (!rawResponseText) {
        const errorMsg = lastModelError?.message || '';
        if (errorMsg.includes('503') || errorMsg.includes('high demand')) {
          throw new Error('AI 분석 서버가 일시적으로 사용량이 많습니다. 2~3초 후 [다시 분석 시도하기] 버튼을 누르면 정상 처리됩니다.');
        } else if (errorMsg.includes('초과')) {
          throw new Error('스크린샷 분석 응답 대기 시간이 초과되었습니다. 잠시 후 [다시 분석 시도하기]를 눌러주세요.');
        } else {
          throw new Error('스크린샷 분석 처리에 일시적 오류가 발생했습니다. 아래 [다시 분석 시도하기]를 눌러주세요.');
        }
      }

      // Clean JSON text (strip markdown code blocks if any)
      let cleanedJsonText = rawResponseText;
      if (cleanedJsonText.includes('```json')) {
        cleanedJsonText = cleanedJsonText.replace(/```json\s*/i, '').replace(/```\s*$/i, '');
      } else if (cleanedJsonText.includes('```')) {
        cleanedJsonText = cleanedJsonText.replace(/```\s*/, '').replace(/```\s*$/i, '');
      }
      cleanedJsonText = cleanedJsonText.trim();

      let parsedList: any = [];
      try {
        parsedList = JSON.parse(cleanedJsonText);
      } catch (e) {
        // Fallback 1: Extract JSON array with regex
        const arrayMatch = cleanedJsonText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (arrayMatch) {
          try {
            parsedList = JSON.parse(arrayMatch[0]);
          } catch (e2) {
            // continue
          }
        }
        // Fallback 2: Extract JSON object with regex if array regex failed
        if (!Array.isArray(parsedList)) {
          const objMatch = cleanedJsonText.match(/\{[\s\S]*\}/);
          if (objMatch) {
            try {
              parsedList = JSON.parse(objMatch[0]);
            } catch (e3) {
              // ignore
            }
          }
        }
      }

      // If the model wrapped the result in an object (e.g., { records: [...] } or { logs: [...] })
      if (!Array.isArray(parsedList) && typeof parsedList === 'object' && parsedList !== null) {
        for (const key of ['records', 'logs', 'events', 'items', 'list', 'data', 'result', 'combatLogs', 'pvpLogs']) {
          if (Array.isArray(parsedList[key])) {
            parsedList = parsedList[key];
            break;
          }
        }
        if (!Array.isArray(parsedList)) {
          const anyArray = Object.values(parsedList).find((v) => Array.isArray(v));
          if (anyArray) {
            parsedList = anyArray as any[];
          }
        }
      }

      if (!Array.isArray(parsedList)) {
        parsedList = [];
      }

      // Sanitize and normalize parsed records
      const currentYear = new Date().getFullYear();
      const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '/');
      const nowStr = new Date().toTimeString().slice(0, 5);

      const sanitizedRecords = parsedList
        .filter((item: any) => item && typeof item === 'object')
        .map((item: any) => {
          let occurredAt = String(item.occurredAt || item.time || item.date || '').trim();
          // Normalize separators: dots or dashes to slashes
          occurredAt = occurredAt.replace(/\./g, '/').replace(/-/g, '/');

          // If relative time e.g. "5분 전"
          if (occurredAt.includes('분 전')) {
            const min = parseInt(occurredAt, 10) || 1;
            const d = new Date(Date.now() - min * 60000);
            occurredAt = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          } else if (occurredAt.includes('방금') || occurredAt.includes('초 전')) {
            occurredAt = `${todayStr} ${nowStr}`;
          } else if (/^\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}/.test(occurredAt)) {
            // "09/28 14:20" -> "2026/09/28 14:20"
            occurredAt = `${currentYear}/${occurredAt}`;
          } else if (/^\d{1,2}:\d{2}/.test(occurredAt)) {
            // "14:20" or "14:20:10"
            const timePart = occurredAt.slice(0, 5);
            occurredAt = `${todayStr} ${timePart}`;
          }

          let contrib = String(item.contributionType || item.type || item.action || '').trim();
          if (contrib.includes('도움') || contrib.includes('어시') || contrib.toLowerCase().includes('assist')) {
            contrib = '도움';
          } else {
            contrib = '처치';
          }

          let targetId = String(item.targetId || item.target || item.name || item.victim || '')
            .replace(/[\[\]\(\)\{\}]/g, '')
            .replace(/^Lv\.\s*\d+\s*/i, '')
            .trim();

          let targetGuild = String(item.targetGuild || item.guild || item.clan || '-').trim();
          if (!targetGuild || targetGuild === '없음' || targetGuild === 'null' || targetGuild === 'undefined') {
            targetGuild = '-';
          }

          return {
            occurredAt,
            contributionType: contrib,
            targetId,
            targetGuild,
          };
        })
        .filter((item: any) => item.targetId.length > 0);

      return res.json({
        success: true,
        records: sanitizedRecords,
      });
    } catch (err: any) {
      console.error('Error in /api/ssulja/parse-image:', err);
      return res.status(500).json({
        error: err?.message || '스크린샷 이미지 분석 중 오류가 발생했습니다. [다시 분석 시도하기]를 눌러주세요.',
      });
    }
  });


  // Guild Login verification
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { userId, guildPassword } = req.body;
    if (!userId || !userId.trim()) {
      return res.status(400).json({ error: '아이디를 입력해주세요.' });
    }
    if (!guildPassword || guildPassword.trim() !== db.config.guildPassword) {
      return res.status(401).json({ error: '길드 비밀번호가 일치하지 않습니다.' });
    }

    const token = `token_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    return res.json({
      success: true,
      token,
      userId: userId.trim(),
      guildName: db.config.guildName,
    });
  });

  // Get guild info & announcements
  app.get('/api/guild/info', (req: Request, res: Response) => {
    res.json({
      guildName: db.config.guildName,
      announcement: db.config.announcement,
      activeMembers: Math.max(1, sseClients.length),
      defaultPasswordHint: '1234',
    });
  });

  // Update guild configuration
  app.post('/api/guild/config', (req: Request, res: Response) => {
    const { guildName, guildPassword, announcement } = req.body;
    if (guildName && guildName.trim()) {
      db.config.guildName = guildName.trim();
    }
    if (guildPassword && guildPassword.trim()) {
      db.config.guildPassword = guildPassword.trim();
    }
    if (typeof announcement === 'string') {
      db.config.announcement = announcement.trim();
    }
    saveDatabase(db);
    broadcast('guild-updated', {
      guildName: db.config.guildName,
      announcement: db.config.announcement,
    });
    res.json({ success: true, config: db.config });
  });

  // Get all bosses
  app.get('/api/bosses', (req: Request, res: Response) => {
    res.json({ bosses: db.bosses });
  });

  // Add a new boss
  app.post('/api/bosses', (req: Request, res: Response) => {
    const { name, region, channel, respawnMinutes, notes, difficulty, dropItems } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: '보스 이름을 입력해주세요.' });
    }
    const minutes = Number(respawnMinutes);
    if (isNaN(minutes) || minutes <= 0) {
      return res.status(400).json({ error: '유효한 리젠 시간(분)을 입력해주세요.' });
    }

    const newBoss: BossItem = {
      id: `boss_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      region: region?.trim() || '미지정 지역',
      channel: channel?.trim() || '1채널',
      respawnMinutes: minutes,
      lastKillTime: null,
      lastKillerId: null,
      nextSpawnTime: null,
      notes: notes?.trim() || '',
      difficulty: difficulty || 'S',
      dropItems: Array.isArray(dropItems) ? dropItems : [],
      updatedAt: new Date().toISOString(),
    };

    db.bosses.push(newBoss);
    saveDatabase(db);
    broadcast('boss-added', { boss: newBoss });
    res.status(201).json({ success: true, boss: newBoss });
  });

  // Update existing boss
  app.put('/api/bosses/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, region, channel, respawnMinutes, notes, difficulty, dropItems, lastKillTime } = req.body;
    const bossIndex = db.bosses.findIndex((b) => b.id === id);
    if (bossIndex === -1) {
      return res.status(404).json({ error: '해당 보스를 찾을 수 없습니다.' });
    }

    const currentBoss = db.bosses[bossIndex];
    const minutes = respawnMinutes !== undefined ? Number(respawnMinutes) : currentBoss.respawnMinutes;

    let updatedNextSpawn = currentBoss.nextSpawnTime;
    let updatedKillTime = currentBoss.lastKillTime;

    if (lastKillTime !== undefined) {
      if (lastKillTime) {
        const killDate = new Date(lastKillTime);
        if (!isNaN(killDate.getTime())) {
          updatedKillTime = killDate.toISOString();
          updatedNextSpawn = new Date(killDate.getTime() + minutes * 60 * 1000).toISOString();
        }
      } else {
        updatedKillTime = null;
        updatedNextSpawn = null;
      }
    } else if (respawnMinutes !== undefined && currentBoss.lastKillTime) {
      const killDate = new Date(currentBoss.lastKillTime);
      updatedNextSpawn = new Date(killDate.getTime() + minutes * 60 * 1000).toISOString();
    }

    const updatedBoss: BossItem = {
      ...currentBoss,
      name: name?.trim() || currentBoss.name,
      region: region?.trim() || currentBoss.region,
      channel: channel?.trim() || currentBoss.channel,
      respawnMinutes: minutes,
      lastKillTime: updatedKillTime,
      nextSpawnTime: updatedNextSpawn,
      notes: notes !== undefined ? notes.trim() : currentBoss.notes,
      difficulty: difficulty || currentBoss.difficulty,
      dropItems: Array.isArray(dropItems) ? dropItems : currentBoss.dropItems,
      updatedAt: new Date().toISOString(),
    };

    db.bosses[bossIndex] = updatedBoss;
    saveDatabase(db);
    broadcast('boss-updated', { boss: updatedBoss });
    res.json({ success: true, boss: updatedBoss });
  });

  // Delete boss
  app.delete('/api/bosses/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const beforeCount = db.bosses.length;
    db.bosses = db.bosses.filter((b) => b.id !== id);
    if (db.bosses.length === beforeCount) {
      return res.status(404).json({ error: '해당 보스를 찾을 수 없습니다.' });
    }
    saveDatabase(db);
    broadcast('boss-deleted', { id });
    res.json({ success: true, id });
  });

  // Record a Boss Kill (처치 기록)
  app.post('/api/bosses/:id/kill', (req: Request, res: Response) => {
    const { id } = req.params;
    const { killerId, killTime, notes } = req.body;

    const boss = db.bosses.find((b) => b.id === id);
    if (!boss) {
      return res.status(404).json({ error: '해당 보스를 찾을 수 없습니다.' });
    }

    const recordedKillDate = killTime ? new Date(killTime) : new Date();
    if (isNaN(recordedKillDate.getTime())) {
      return res.status(400).json({ error: '유효한 처치 시간 형식이 아닙니다.' });
    }

    const killIso = recordedKillDate.toISOString();
    const nextSpawnIso = new Date(recordedKillDate.getTime() + boss.respawnMinutes * 60 * 1000).toISOString();
    const actualKiller = killerId?.trim() || '익명 길드원';

    boss.lastKillTime = killIso;
    boss.lastKillerId = actualKiller;
    boss.nextSpawnTime = nextSpawnIso;
    boss.updatedAt = new Date().toISOString();

    // Create log record
    const logItem: KillLogItem = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      bossId: boss.id,
      bossName: boss.name,
      region: boss.region,
      channel: boss.channel,
      killerId: actualKiller,
      killTime: killIso,
      nextSpawnTime: nextSpawnIso,
      loggedAt: new Date().toISOString(),
      notes: notes?.trim() || undefined,
    };

    db.logs.unshift(logItem);
    // Keep max 100 logs
    if (db.logs.length > 100) {
      db.logs = db.logs.slice(0, 100);
    }

    saveDatabase(db);

    // Real-time broadcast to all guild members
    broadcast('kill-recorded', {
      boss,
      log: logItem,
      message: `[${actualKiller}] 길드원이 '${boss.name}' 처치를 기록했습니다!`,
    });

    res.json({ success: true, boss, log: logItem });
  });

  // Reset/Clear boss kill status (리셋)
  app.post('/api/bosses/:id/reset', (req: Request, res: Response) => {
    const { id } = req.params;
    const boss = db.bosses.find((b) => b.id === id);
    if (!boss) {
      return res.status(404).json({ error: '해당 보스를 찾을 수 없습니다.' });
    }
    boss.lastKillTime = null;
    boss.lastKillerId = null;
    boss.nextSpawnTime = null;
    boss.updatedAt = new Date().toISOString();

    saveDatabase(db);
    broadcast('boss-updated', { boss });
    res.json({ success: true, boss });
  });

  // Get kill logs
  app.get('/api/logs', (req: Request, res: Response) => {
    res.json({ logs: db.logs });
  });

  // Server-Sent Events (SSE) stream for real-time live synchronization
  app.get('/api/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const clientId = nextClientId++;
    const client = { id: clientId, res };
    sseClients.push(client);

    // Send initial snapshot on connect
    const initialPayload = {
      bosses: db.bosses,
      logs: db.logs.slice(0, 30),
      config: {
        guildName: db.config.guildName,
        announcement: db.config.announcement,
      },
      activeMembers: sseClients.length,
    };
    res.write(`event: init\ndata: ${JSON.stringify(initialPayload)}\n\n`);

    // Notify others of member count change
    broadcast('member-count', { activeMembers: sseClients.length });

    req.on('close', () => {
      const idx = sseClients.findIndex((c) => c.id === clientId);
      if (idx !== -1) {
        sseClients.splice(idx, 1);
      }
      broadcast('member-count', { activeMembers: sseClients.length });
    });
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Soul Enchant Timer Server] running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
