// Boxscore aus der ESPN-Spielzusammenfassung (summary.boxscore und summary.header).
// Spalten werden über ihre Bezeichnung gesucht, nicht über die Position,
// damit eine geänderte Reihenfolge bei ESPN nichts durcheinanderbringt.
import { summary } from './espn';
import type { Game } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Column {
  label: string;
  /** Mögliche Bezeichnungen bei ESPN (labels, keys oder names) */
  match: string[];
}

export interface Table {
  title: string;
  columns: string[];
  rows: { name: string; note?: string; stats: string[] }[];
}

export interface TeamBox {
  abbr: string;
  name: string;
  tables: Table[];
}

export interface LineScore {
  innings: number;
  away: { abbr: string; runs: (string | null)[]; r?: string; h?: string; e?: string };
  home: { abbr: string; runs: (string | null)[]; r?: string; h?: string; e?: string };
}

export interface BoxScore {
  line?: LineScore;
  away?: TeamBox;
  home?: TeamBox;
}

const NBA: Column[] = [
  { label: 'MIN', match: ['min', 'minutes'] },
  { label: 'PTS', match: ['pts', 'points'] },
  { label: 'REB', match: ['reb', 'rebounds', 'totalrebounds'] },
  { label: 'AST', match: ['ast', 'assists'] },
];

const BATTING: Column[] = [
  { label: 'AB', match: ['ab', 'atbats'] },
  { label: 'R', match: ['r', 'runs'] },
  { label: 'H', match: ['h', 'hits'] },
  { label: 'RBI', match: ['rbi', 'rbis', 'runsbattedin'] },
  { label: 'HR', match: ['hr', 'homeruns'] },
  { label: 'BB', match: ['bb', 'walks'] },
  { label: 'K', match: ['k', 'so', 'strikeouts'] },
];

const PITCHING: Column[] = [
  { label: 'IP', match: ['ip', 'fullinnings.partinnings', 'inningspitched'] },
  { label: 'H', match: ['h', 'hits'] },
  { label: 'R', match: ['r', 'runs'] },
  { label: 'ER', match: ['er', 'earnedruns'] },
  { label: 'BB', match: ['bb', 'walks'] },
  { label: 'K', match: ['k', 'so', 'strikeouts'] },
];

const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9.]/g, '');

/** Index jeder gewünschten Spalte in einer ESPN-Statistikgruppe, -1 wenn nicht vorhanden. */
function indexes(group: any, columns: Column[]): number[] {
  const lists = [group?.labels, group?.keys, group?.names].filter(Array.isArray).map((l: any[]) => l.map(norm));
  return columns.map((c) => {
    for (const list of lists) {
      const i = list.findIndex((x) => c.match.includes(x));
      if (i >= 0) return i;
    }
    return -1;
  });
}

function table(group: any, columns: Column[], title: string): Table | null {
  const idx = indexes(group, columns);
  if (idx.every((i) => i < 0)) return null;
  const rows = (group?.athletes ?? [])
    .filter((a: any) => !a?.didNotPlay && Array.isArray(a?.stats) && a.stats.length > 0)
    .map((a: any) => ({
      name: a?.athlete?.shortName ?? a?.athlete?.displayName ?? '?',
      note: a?.athlete?.position?.abbreviation,
      stats: idx.map((i) => (i >= 0 ? String(a.stats[i] ?? '–') : '–')),
    }))
    // NBA: Spieler ohne Einsatzminuten weglassen
    .filter((r: Table['rows'][number]) => !(title === 'Spieler' && /^(0|--|)$/.test(r.stats[0])));
  return rows.length ? { title, columns: columns.map((c) => c.label), rows } : null;
}

function groupOf(groups: any[], type: string): any {
  return groups.find((g) => norm(g?.type) === type || norm(g?.name) === type);
}

function teamBox(entry: any, league: Game['league']): TeamBox {
  const groups: any[] = entry?.statistics ?? [];
  const tables: Table[] = [];
  if (league === 'NBA') {
    const t = table(groups[0], NBA, 'Spieler');
    if (t) tables.push(t);
  } else if (league === 'MLB') {
    const bat = table(groupOf(groups, 'batting') ?? groups[0], BATTING, 'Schlagmänner');
    const pit = table(groupOf(groups, 'pitching') ?? groups[1], PITCHING, 'Pitcher');
    if (bat) tables.push(bat);
    if (pit) tables.push(pit);
  }
  return { abbr: entry?.team?.abbreviation ?? '?', name: entry?.team?.shortDisplayName ?? entry?.team?.displayName ?? '?', tables };
}

/** Ordnet die beiden Teams aus ESPN dem Auswärts- und Heimteam zu. */
function side(list: any[], game: Pick<Game, 'away' | 'home'>, which: 'away' | 'home'): any {
  const abbr = game[which].abbr;
  return list.find((x) => x?.homeAway === which)
    ?? list.find((x) => x?.team?.abbreviation === abbr)
    ?? list[which === 'away' ? 0 : 1];
}

/** Sucht einen Teamwert wie „errors“ in boxscore.teams, egal wie tief er verschachtelt ist. */
function teamStat(entry: any, name: string): string | undefined {
  const stack: any[] = [entry?.statistics];
  while (stack.length) {
    const cur = stack.pop();
    if (Array.isArray(cur)) stack.push(...cur);
    else if (cur && typeof cur === 'object') {
      if (norm(cur.name) === name && (cur.displayValue ?? cur.value) !== undefined) return String(cur.displayValue ?? cur.value);
      if (cur.stats) stack.push(cur.stats);
      if (cur.statistics) stack.push(cur.statistics);
    }
  }
  return undefined;
}

function lineScore(s: any, game: Pick<Game, 'away' | 'home'>): LineScore | undefined {
  const cs: any[] = s?.header?.competitions?.[0]?.competitors ?? [];
  const a = side(cs, game, 'away');
  const h = side(cs, game, 'home');
  const runs = (c: any): (string | null)[] => (c?.linescores ?? []).map((l: any) => {
    const v = l?.displayValue ?? l?.value;
    return v === undefined || v === null ? null : String(v);
  });
  const ar = runs(a);
  const hr = runs(h);
  if (!ar.length && !hr.length) return undefined;
  const innings = Math.max(9, ar.length, hr.length);
  const str = (v: unknown) => (v === undefined || v === null ? undefined : String(v));
  const teams: any[] = s?.boxscore?.teams ?? [];
  const ta = side(teams, game, 'away');
  const th = side(teams, game, 'home');
  return {
    innings,
    away: {
      abbr: game.away.abbr, runs: ar, r: str(a?.score ?? game.away.score),
      h: str(a?.hits ?? game.away.hits) ?? teamStat(ta, 'hits'), e: str(a?.errors) ?? teamStat(ta, 'errors'),
    },
    home: {
      abbr: game.home.abbr, runs: hr, r: str(h?.score ?? game.home.score),
      h: str(h?.hits ?? game.home.hits) ?? teamStat(th, 'hits'), e: str(h?.errors) ?? teamStat(th, 'errors'),
    },
  };
}

export function parseBoxScore(s: any, game: Pick<Game, 'league' | 'away' | 'home'>): BoxScore {
  const players: any[] = s?.boxscore?.players ?? [];
  const box: BoxScore = {};
  if (players.length) {
    box.away = teamBox(side(players, game, 'away'), game.league);
    box.home = teamBox(side(players, game, 'home'), game.league);
  }
  if (game.league === 'MLB') box.line = lineScore(s, game);
  return box;
}

export function hasBoxScore(box: BoxScore): boolean {
  return Boolean(box.line || box.away?.tables.length || box.home?.tables.length);
}

export async function loadBoxScore(game: Game): Promise<BoxScore> {
  return parseBoxScore(await summary(game), game);
}
