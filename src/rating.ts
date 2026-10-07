// Spoilerfreie Bewertung eines beendeten Spiels.
// Die Regeln für MLB und NBA entsprechen den Home-Assistant-Automationen
// „Sport Ergebnisse sammeln MLB/NBA“, NFL ist neu und analog aufgebaut.
import { RIVALRIES } from './config';
import type { DramaKind, Game, League, Rating } from './types';

interface Trace {
  maxAway: number; // größte Führung Auswärts
  maxHome: number; // größte Führung Heim
  changes: number; // Führungswechsel gesamt
  lateChanges: number; // Führungswechsel in der Schlussphase
  lateClose: boolean; // Schlussphase eng
  extra: boolean; // Verlängerung / Extra Innings
  walkoffText: boolean;
  before: number; // Führung vor dem letzten Scoring-Play
  lastPeriod: number;
}

/** Ab welcher Periode gilt ein Führungswechsel als „spät“, und wann ist die Schlussphase eng. */
const LATE: Record<League, {
  changePeriod: number;
  regulation: number;
  isLateClose: (period: number, clock: number | undefined, lead: number) => boolean;
}> = {
  MLB: { changePeriod: 7, regulation: 9, isLateClose: (p, _c, lead) => p >= 8 && Math.abs(lead) <= 1 },
  NBA: {
    changePeriod: 3,
    regulation: 4,
    isLateClose: (p, c, lead) => ((p === 4 && (c ?? 720) <= 180) || p > 4) && Math.abs(lead) <= 5,
  },
  NFL: {
    changePeriod: 4,
    regulation: 4,
    isLateClose: (p, c, lead) => ((p === 4 && (c ?? 900) <= 300) || p > 4) && Math.abs(lead) <= 8,
  },
};

export function trace(game: Game): Trace {
  const cfg = LATE[game.league];
  const t: Trace = {
    maxAway: 0, maxHome: 0, changes: 0, lateChanges: 0, lateClose: false,
    extra: false, walkoffText: false, before: 0, lastPeriod: 0,
  };
  let prev = 0;
  let cur = 0;
  for (const p of game.plays ?? []) {
    const lead = p.away - p.home;
    if (lead > t.maxAway) t.maxAway = lead;
    if (-lead > t.maxHome) t.maxHome = -lead;
    if (prev !== 0 && lead !== 0 && prev > 0 !== lead > 0) {
      t.changes++;
      if (p.period >= cfg.changePeriod) t.lateChanges++;
    }
    if (cfg.isLateClose(p.period, p.clock, lead)) t.lateClose = true;
    if (p.period > cfg.regulation) t.extra = true;
    const txt = (p.text ?? '').toLowerCase();
    if (txt.includes('walk-off') || txt.includes('walkoff')) t.walkoffText = true;
    t.before = cur;
    cur = lead;
    t.lastPeriod = p.period;
    if (lead !== 0) prev = lead;
  }
  return t;
}

export function drama(game: Game, t = trace(game)): DramaKind | null {
  const diff = game.away.score - game.home.score;
  const abs = Math.abs(diff);
  // Rückstand, den der Sieger aufgeholt hat, und den der Verlierer zwischendurch hatte
  const winnerDeficit = diff > 0 ? t.maxHome : t.maxAway;
  const loserDeficit = diff > 0 ? t.maxAway : t.maxHome;

  switch (game.league) {
    case 'MLB': {
      const walkoff = t.walkoffText || (diff < 0 && t.lastPeriod >= 9 && t.before >= 0);
      if (walkoff) return 'walkoff';
      if (t.extra) return 'extra';
      if (diff !== 0 && winnerDeficit >= 3) return 'comeback';
      if (abs <= 1 && loserDeficit >= 3) return 'comeback';
      if (t.lateChanges >= 1 && abs <= 3) return 'leadchanges';
      if (t.changes >= 3 && abs <= 3) return 'leadchanges';
      if (t.lateClose && abs <= 2) return 'lateclose';
      if (abs <= 1) return 'close';
      return null;
    }
    case 'NBA': {
      if (t.extra) return 'ot';
      if (diff !== 0 && winnerDeficit >= 12) return 'comeback';
      if (abs <= 5 && loserDeficit >= 12) return 'comeback';
      if (t.lateChanges >= 3 && abs <= 10) return 'leadchanges';
      if (t.lateClose && abs <= 8) return 'lateclose';
      if (abs <= 5) return 'close';
      return null;
    }
    case 'NFL': {
      if (t.extra) return 'ot';
      if (diff !== 0 && winnerDeficit >= 14) return 'comeback';
      if (abs <= 3 && loserDeficit >= 14) return 'comeback';
      if (t.lateChanges >= 1 && abs <= 8) return 'leadchanges';
      if (t.lateClose && abs <= 8) return 'lateclose';
      if (abs <= 3) return 'close';
      return null;
    }
  }
}

export function isRivalry(league: League, a: string, b: string): boolean {
  return RIVALRIES[league].some(
    ([x, y]) => (a.includes(x) && b.includes(y)) || (a.includes(y) && b.includes(x)),
  );
}

/** Grenzen für den Endabstand: normal, Playoff, Rivalität, Preseason. */
const MARGINS: Record<League, { normal: number; playoff: number; rivalry: number; preseason: number }> = {
  MLB: { normal: 2, playoff: 3, rivalry: 3, preseason: 1 },
  NBA: { normal: 6, playoff: 10, rivalry: 10, preseason: 5 },
  NFL: { normal: 8, playoff: 14, rivalry: 10, preseason: 3 },
};

const BIG: DramaKind[] = ['walkoff', 'extra', 'ot', 'comeback'];

export function rate(game: Game): Rating {
  const d = drama(game);
  const diff = Math.abs(game.away.score - game.home.score);
  const m = MARGINS[game.league];
  const rivalry = isRivalry(game.league, game.away.name, game.home.name);
  const playoff = game.season === 'playoff';
  const big = d !== null && BIG.includes(d);

  const hot = game.season === 'preseason'
    ? (d !== null && ['walkoff', 'extra', 'ot'].includes(d)) || diff <= m.preseason
    : d !== null || diff <= m.normal || (playoff && diff <= m.playoff) || (rivalry && diff <= m.rivalry);

  let level: number;
  if (hot && big) level = 5;
  else if (hot && (d === 'leadchanges' || d === 'lateclose')) level = 4;
  else if (hot) level = 3;
  else level = diff <= m.normal * 2 ? 2 : 1;

  return { drama: d, rivalry, hot, level, reason: reason(d, hot, rivalry, playoff), sortKey: sortKey(game, d, rivalry, big) };
}

/** Spoilerfreie Begründung: verrät nie, wer geführt oder gewonnen hat. */
export function reason(d: DramaKind | null, hot: boolean, rivalry: boolean, playoff: boolean): string {
  if (!hot) return 'Kannst du auslassen';
  switch (d) {
    case 'walkoff': return 'Krimi bis zum Schluss';
    case 'extra': return 'Extra Innings';
    case 'ot': return 'Overtime';
    case 'comeback': return 'Comeback';
  }
  if (rivalry) return 'Rivalitätsduell';
  if (d === 'leadchanges') return 'Hin und her bis zuletzt';
  if (d === 'lateclose') return 'Spannende Schlussphase';
  if (!d && playoff) return 'Playoff-Spiel';
  return 'Enges Spiel';
}

/** Reihenfolge wie in HA: Playoff > großes Drama > Rivalität > übriges Drama. */
function sortKey(game: Game, d: DramaKind | null, rivalry: boolean, big: boolean): number {
  const season = game.season === 'playoff' ? 0 : game.season === 'preseason' ? 2 : 1;
  return season * 1000 + (big ? 0 : 100) + (rivalry ? 0 : 10) + (d ? 0 : 1);
}
