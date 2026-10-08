// Lädt beendete Spiele eines Zeitraums von ESPN und speichert sie kompakt für den Backtest der Bewertung.
// Aufruf: FROM=2025-10-06 TO=2026-10-04 npx vite-node scripts/backtest-fetch.ts
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { mlbFeats } from '../src/boxscore';
import { parseEvent, parsePlays, parsePressure } from '../src/espn';
import { TEAMS } from '../src/teams';
import type { Game, League } from '../src/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
const PATHS: Record<League, string> = { MLB: 'baseball/mlb', NBA: 'basketball/nba', NFL: 'football/nfl' };
const BASE = 'https://site.api.espn.com/apis/site/v2/sports';

async function get(url: string): Promise<any> {
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      if (res.status === 404) return null;
    } catch { /* erneut versuchen */ }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
  }
  throw new Error(`fehlgeschlagen: ${url}`);
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

const isRunner = (x: any) => /^on(First|Second|Third)$/.test(x?.type);

/** MLB: pro Halbinning der kleinste „effektive Rückstand“ (Rückstand minus Runner auf Base) des schlagenden Teams. */
function halfPressure(plays: any[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of plays) {
    const half = p?.period?.type;
    const inning = p?.period?.number;
    if ((half !== 'Top' && half !== 'Bottom') || !inning || (p.outs ?? 0) >= 3) continue;
    const away = parseInt(p.awayScore ?? 0, 10) || 0;
    const home = parseInt(p.homeScore ?? 0, 10) || 0;
    const deficit = half === 'Top' ? home - away : away - home;
    if (deficit <= 0) continue;
    const runners = new Set((p.participants ?? []).filter(isRunner).map((x: any) => x.type)).size;
    const key = `${inning}${half[0]}`;
    out[key] = Math.min(out[key] ?? Infinity, Math.max(0, deficit - runners));
  }
  return out;
}

const hasRunners = (plays: any[]) => plays.some((p) => Array.isArray(p?.participants) && p.participants.some(isRunner));

function dates(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = new Date(`${from}T12:00:00Z`); d <= new Date(`${to}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

const from = process.env.FROM ?? '2025-10-06';
const to = process.env.TO ?? '2026-10-04';
const stats = { events: 0, summaryParticipants: 0, coreFetched: 0, failed: 0 };

const boards = await pool(dates(from, to).flatMap((d) => (['MLB', 'NBA', 'NFL'] as League[]).map((l) => ({ d, l }))), 8, async ({ d, l }) => {
  const data = await get(`${BASE}/${PATHS[l]}/scoreboard?dates=${d.replaceAll('-', '')}&limit=100`).catch(() => null);
  return (data?.events ?? []).map((e: any) => ({ l, d, e }));
});
const seen = new Set<string>();
const events = boards.flat().filter(({ e }: any) => {
  if (seen.has(e.id) || e.status?.type?.state !== 'post' || (e.season?.type ?? 2) === 1) return false;
  seen.add(e.id);
  return true;
});
stats.events = events.length;
console.error(`${events.length} Spiele`);

const games = await pool(events, 8, async ({ l, d, e }: any) => {
  const game = parseEvent(l, e) as Game & Record<string, any>;
  // Nur echte Teams, keine All-Star-Spiele oder Pro Bowl
  if (!game || ![game.away.name, game.home.name].every((n) => TEAMS.some((t) => t.league === l && t.name === n))) return null;
  game.date = d;
  const cs: any[] = e.competitions?.[0]?.competitors ?? [];
  const lines = (side: string) => (cs.find((c) => c.homeAway === side)?.linescores ?? []).map((x: any) => Number(x.value) || 0);
  game.lines = { away: lines('away'), home: lines('home') };
  try {
    const s = await get(`${BASE}/${PATHS[l]}/summary?event=${game.id}`);
    game.plays = parsePlays(s);
    if (l === 'MLB') {
      game.feats = mlbFeats(s, game);
      let plays: any[] = s?.plays ?? [];
      if (hasRunners(plays)) stats.summaryParticipants++;
      else {
        stats.coreFetched++;
        plays = (await get(`https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/events/${game.id}/competitions/${game.id}/plays?limit=1000`).catch(() => null))?.items ?? [];
      }
      const pressure = parsePressure(plays);
      if (pressure !== undefined) game.pressure = pressure;
      if (hasRunners(plays)) game.halves = halfPressure(plays);
    }
  } catch {
    stats.failed++;
  }
  return game;
});

const out = games.filter(Boolean);
writeFileSync('backtest/games.json.gz', gzipSync(JSON.stringify(out)));
writeFileSync('backtest/stats.json', JSON.stringify({ from, to, ...stats, saved: out.length }, null, 2));
console.error(JSON.stringify(stats));
