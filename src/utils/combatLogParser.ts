import { SsuljaContributionType } from '../types';

export interface ParsedLogEntry {
  occurredAt: string;
  contributionType: SsuljaContributionType;
  targetId: string;
  targetGuild: string;
}

/**
 * Parses raw text lines from game chat or combat log
 * Supports various formats:
 * - "[전투] 09/29 14:20 '플레이어' 님을 처치하였습니다."
 * - "14:20 [처치] 닉네임 (혈맹)"
 * - "2026/09/29 14:20 처치 닉네임 혈맹"
 * - "09/29 14:20 도움 닉네임 [혈맹]"
 * - "처치 닉네임"
 */
export function parseCombatLogText(rawText: string): ParsedLogEntry[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const currentYear = new Date().getFullYear();
  const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '/');
  const nowStr = new Date().toTimeString().slice(0, 5);

  const results: ParsedLogEntry[] = [];

  for (const line of lines) {
    // 1) Detect contribution type
    let contrib: SsuljaContributionType = '처치';
    if (line.includes('도움') || line.includes('어시') || line.toLowerCase().includes('assist') || line.includes('지원')) {
      contrib = '도움';
    }

    // 2) Detect timestamp
    let occurredAt = `${todayStr} ${nowStr}`;
    const fullDateMatch = line.match(/(20\d{2}[\/\.-]\d{1,2}[\/\.-]\d{1,2}\s+\d{1,2}:\d{2})/);
    const shortDateMatch = line.match(/(\d{1,2}[\/\.-]\d{1,2}\s+\d{1,2}:\d{2})/);
    const timeOnlyMatch = line.match(/(?:\[|\s|^)(\d{1,2}:\d{2})(?:\]|\s|$)/);

    if (fullDateMatch) {
      occurredAt = fullDateMatch[1].replace(/[\.-]/g, '/');
    } else if (shortDateMatch) {
      occurredAt = `${currentYear}/${shortDateMatch[1].replace(/[\.-]/g, '/')}`;
    } else if (timeOnlyMatch) {
      occurredAt = `${todayStr} ${timeOnlyMatch[1]}`;
    } else if (line.includes('분 전')) {
      const minMatch = line.match(/(\d+)\s*분\s*전/);
      const min = minMatch ? parseInt(minMatch[1], 10) : 1;
      const d = new Date(Date.now() - min * 60000);
      occurredAt = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    // 3) Detect Guild name in brackets [길드명] or (길드명)
    let targetGuild = '-';
    const guildMatch = line.match(/[\[\(]([가-힣a-zA-Z0-9_]{1,16})[\]\)]/);
    if (guildMatch && !['전투', '시스템', '처치', '도움', '알림', '혈맹'].includes(guildMatch[1])) {
      targetGuild = guildMatch[1];
    }

    // 4) Extract target nickname
    // Look for quoted nickname: '닉네임' or "닉네임"
    let targetId = '';
    const quoteMatch = line.match(/['"']([^'"'\s]{1,16})['"']/);
    if (quoteMatch) {
      targetId = quoteMatch[1];
    } else {
      // Tokenize line and find appropriate word
      const tokens = line
        .replace(/\[[^\]]+\]/g, ' ')
        .replace(/\([^\)]+\)/g, ' ')
        .replace(/20\d{2}[\/\.-]\d{1,2}[\/\.-]\d{1,2}/g, ' ')
        .replace(/\d{1,2}[\/\.-]\d{1,2}/g, ' ')
        .replace(/\d{1,2}:\d{2}(?::\d{2})?/g, ' ')
        .replace(/(처치|도움|어시스트|기여|하였습니다|했습니다|님을|대상을|플레이어|사망시킴)/g, ' ')
        .replace(/[^\w가-힣]/g, ' ')
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && !/^\d+$/.test(t));

      if (tokens.length > 0) {
        targetId = tokens[0];
      }
    }

    if (targetId && targetId.length > 0) {
      results.push({
        occurredAt,
        contributionType: contrib,
        targetId,
        targetGuild,
      });
    }
  }

  return results;
}
