// Daten von der (inoffiziellen) ESPN-API, dieselbe Quelle wie in Home Assistant.
import type { Game, League, ScoringPlay, SeasonType, Team } from './types';
import { LEAGUES } from './types';

const PATHS: Record<League, string> = {
  MLB: 'baseball/mlb',
  NBA: 'basketball/nba',
  NFL: 'football/nfl',
};

const BASE = 'https://site.api.espn.com/apis/site/v2/sports';

/* eslint-disable @typescript-eslint/no-explicit-any */

async function getJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  return res.json();
}

function team(c: any): Team {
  const t = c?.team ?? {};
  return {
    name: t.displayName ?? t.name ?? '?',
    short: t.shortDisplayName ?? t.name ?? t.abbreviation ?? '?',
    abbr: t.abbreviation ?? '?',
    color: t.color ? `#${t.color}` : '#2A313C',
    logo: t.logo,
    record: c?.records?.[0]?.summary,
    score: parseInt(c?.score ?? '0', 10) || 0,
  };
}

function season(type: number | undefined): SeasonType {
  return type === 3 ? 'playoff' : type === 1 ? 'preseason' : 'regular';
}

export function parseEvent(league: League, e: any): Game | null {
  const comp = e?.competitions?.[0];
  const cs: any[] = comp?.competitors ?? [];
  const away = cs.find((c) => c.homeAway === 'away');
  const home = cs.find((c) => c.homeAway === 'home');
  if (!away || !home) return null;
  return {
    id: String(e.id),
    league,
    start: e.date,
    state: e.status?.type?.state ?? 'pre',
    season: season(e.season?.type ?? comp?.season?.type),
    note: comp?.notes?.[0]?.headline,
    away: team(away),
    home: team(home),
  };
}

function clockSeconds(clock: any): number | undefined {
  if (typeof clock?.value === 'number') return clock.value;
  const m = /^(\d+):(\d+)/.exec(clock?.displayValue ?? '');
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : undefined;
}

/** Scoring-Plays aus der Spielzusammenfassung (MLB/NBA: plays, NFL: scoringPlays). */
export function parsePlays(summary: any): ScoringPlay[] {
  const all: any[] = Array.isArray(summary?.plays) && summary.plays.length
    ? summary.plays.filter((p: any) => p?.scoringPlay)
    : summary?.scoringPlays ?? [];
  return all.map((p) => ({
    away: parseInt(p.awayScore ?? 0, 10) || 0,
    home: parseInt(p.homeScore ?? 0, 10) || 0,
    period: p.period?.number ?? 0,
    clock: clockSeconds(p.clock),
    text: p.text,
  }));
}

/** YYYYMMDD für die ESPN-API. */
export function ymd(d: string): string {
  return d.replaceAll('-', '');
}

export async function scoreboard(league: League, date: string): Promise<Game[]> {
  const data = await getJson(`${BASE}/${PATHS[league]}/scoreboard?dates=${ymd(date)}`);
  return (data?.events ?? []).map((e: any) => parseEvent(league, e)).filter(Boolean) as Game[];
}

export async function withPlays(game: Game): Promise<Game> {
  try {
    const s = await getJson(`${BASE}/${PATHS[game.league]}/summary?event=${game.id}`);
    return { ...game, plays: parsePlays(s) };
  } catch {
    // Ohne Spielverlauf wird nur nach Endabstand bewertet, wie in HA
    return game;
  }
}

/** Alle Ligen für mehrere Tage, Fehler einzelner Ligen werden toleriert. */
export async function scoreboards(dates: string[]): Promise<{ games: Game[]; failed: League[] }> {
  const failed: League[] = [];
  const parts = await Promise.all(
    LEAGUES.flatMap((l) => dates.map(async (d) => {
      try {
        return await scoreboard(l, d);
      } catch {
        if (!failed.includes(l)) failed.push(l);
        return [];
      }
    })),
  );
  const seen = new Set<string>();
  const games = parts.flat().filter((g) => (seen.has(g.id) ? false : (seen.add(g.id), true)));
  return { games, failed };
}

export interface TeamInfo {
  league: League;
  name: string;
  short: string;
  abbr: string;
  color: string;
  logo?: string;
}

/** Alle Teams einer Liga, alphabetisch. */
export async function teams(league: League): Promise<TeamInfo[]> {
  const data = await getJson(`${BASE}/${PATHS[league]}/teams`);
  const list: any[] = data?.sports?.[0]?.leagues?.[0]?.teams ?? [];
  return list
    .map(({ team: t }) => ({
      league,
      name: t?.displayName ?? '?',
      short: t?.shortDisplayName ?? t?.name ?? '?',
      abbr: t?.abbreviation ?? '?',
      color: t?.color ? `#${t.color}` : '#2A313C',
      logo: t?.logos?.[0]?.href,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
