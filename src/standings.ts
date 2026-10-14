// Tabellen von ESPN: Divisionen (MLB, NFL) bzw. Conferences (NBA) und Wild Card.
import { getJson, PATHS } from './espn';
import { TEAMS } from './teams';
import type { League } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Standing {
  name: string; // "San Diego Padres"
  abbr: string;
  color: string;
  wins: number;
  losses: number;
  ties: number;
  pct: string; // ".608"
  /** Rückstand: "–", "4.5", in der Wild-Card-Tabelle auch "+2" */
  gb: string;
  /** x, y, z oder e */
  clinch?: string;
  seed?: number;
}

export interface Table {
  title: string;
  /** Linien nach diesen Plätzen, z. B. [6, 10] bei der NBA */
  lines: number[];
  wildCard?: boolean;
  rows: Standing[];
}

export interface LeagueStandings {
  tables: Table[];
  season: string; // "2026" bzw. "2025-26"
  /** Alle Teams haben die reguläre Saison beendet */
  final: boolean;
}

const GAMES: Record<League, number> = { MLB: 162, NBA: 82, NFL: 17 };
const CLINCH = ['x', 'y', 'z', 'e'];
const URL = 'https://site.api.espn.com/apis/v2/sports';

function stat(entry: any, name: string): any {
  return entry.stats?.find((s: any) => s.name === name);
}

export function parseEntry(league: League, entry: any): Standing {
  const t = entry.team ?? {};
  const abbr = t.abbreviation ?? '?';
  const num = (n: string) => Number(stat(entry, n)?.value ?? 0);
  const clinch = stat(entry, 'clincher')?.displayValue;
  const seed = stat(entry, 'playoffSeed')?.value;
  return {
    name: t.displayName ?? t.name ?? abbr,
    abbr,
    color: TEAMS.find((x) => x.league === league && x.abbr === abbr)?.color ?? '#5c4a39',
    wins: num('wins'),
    losses: num('losses'),
    ties: num('ties'),
    pct: stat(entry, 'winPercent')?.displayValue ?? '',
    gb: '–',
    clinch: CLINCH.includes(clinch) ? clinch : undefined,
    seed: typeof seed === 'number' && seed > 0 ? seed : undefined,
  };
}

/** Bilanz als Siege minus Niederlagen; ein Unentschieden zählt halb, wie bei der NFL */
const margin = (s: Standing) => s.wins - s.losses;
const pctValue = (s: Standing) => (s.wins + s.ties / 2) / Math.max(1, s.wins + s.losses + s.ties);

/** Bessere Bilanz zuerst, bei Gleichstand der Platz laut ESPN */
function byRecord(a: Standing, b: Standing): number {
  return pctValue(b) - pctValue(a) || (a.seed ?? 99) - (b.seed ?? 99);
}

/** Rückstand in Spielen auf `ref`; ein Vorsprung erscheint als „+2“ */
function behind(rows: Standing[], ref: Standing | undefined): Standing[] {
  return rows.map((s) => {
    const gb = ref ? (margin(ref) - margin(s)) / 2 : 0;
    return { ...s, gb: gb === 0 ? '–' : gb < 0 ? `+${-gb}` : String(gb) };
  });
}

/** Wild Card: alle außer den Divisionssiegern, Abstand zum letzten Wild-Card-Platz */
export function wildCard(title: string, divisions: Standing[][], spots = 3): Table {
  const rows = divisions.flatMap((d) => d.slice(1)).sort(byRecord);
  return { title, lines: [spots], wildCard: true, rows: behind(rows, rows[spots - 1]) };
}

export function parseStandings(league: League, data: any): LeagueStandings {
  const groups: any[] = data.children ?? [];
  const tables: Table[] = [];
  let season = '';
  const all: Standing[] = [];
  const read = (node: any) => {
    season ||= node.standings?.seasonDisplayName ?? '';
    const sorted: Standing[] = (node.standings?.entries ?? []).map((e: any) => parseEntry(league, e)).sort(byRecord);
    const rows = behind(sorted, sorted[0]);
    all.push(...rows);
    return rows;
  };

  if (league === 'NBA') {
    // Conferences direkt; Plätze 1–6 Playoffs, 7–10 Play-In
    for (const conf of groups) tables.push({ title: conf.name, lines: [6, 10], rows: read(conf) });
  } else {
    const wildCards: Table[] = [];
    for (const conf of groups) {
      const divisions = (conf.children ?? []).map((div: any) => {
        const rows = read(div);
        tables.push({ title: div.shortName ?? div.name, lines: [], rows });
        return rows;
      });
      wildCards.push(wildCard(`${conf.abbreviation} Wild Card`, divisions));
    }
    tables.push(...wildCards);
  }
  const final = all.length > 0 && all.every((s) => s.wins + s.losses + s.ties >= GAMES[league]);
  return { tables, season, final };
}

export async function loadStandings(league: League): Promise<LeagueStandings> {
  const level = league === 'NBA' ? '' : '?level=3';
  const data = await getJson(`${URL}/${PATHS[league]}/standings${level}`, 30 * 60 * 1000);
  return parseStandings(league, data);
}
