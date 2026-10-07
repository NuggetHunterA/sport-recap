// Spoilerfreie Bewertung eines beendeten Spiels.
//
// Kern ist ein Spannungswert von 0 bis 100 aus den Regeln der Home-Assistant-
// Automationen, die auch die spoilerfreien Gründe liefern. Rivalität, Playoffs
// und Duelle starker Teams geben einen Bonus, besondere Leistungen eine Untergrenze.
import { CONTENDER_MIN_GAMES, CONTENDER_WIN_PCT, RIVALRIES } from './config';
import type { DramaKind, Game, League, Rating } from './types';

interface LeagueRules {
  /** Ab dieser Periode zählt ein Führungswechsel als spät */
  changePeriod: number;
  regulation: number;
  /** Ab dieser Periode zählt ein Rückstand als später Rückstand */
  latePeriod: number;
  /** Schlussphase, in der Garbage Time und enge Enden geprüft werden */
  inWindow: (period: number, clock: number | undefined) => boolean;
  /** So eng muss es in der Schlussphase werden */
  windowClose: number;
  /** Rückstand, ab dem ein Comeback zählt */
  comeback: number;
  /** Früher Rückstand zählt nur bei höchstens diesem Endabstand als Comeback */
  comebackMargin: number;
  /** Führung zu Beginn der Schlussphase, ab der ein nie engeres Ende Garbage Time ist */
  garbageLead: number;
  margins: { normal: number; playoff: number; rivalry: number; preseason: number };
}

const RULES: Record<League, LeagueRules> = {
  MLB: {
    changePeriod: 7, regulation: 9, latePeriod: 6,
    inWindow: (p) => p >= 8, windowClose: 1,
    comeback: 3, comebackMargin: 3, garbageLead: Infinity,
    margins: { normal: 2, playoff: 3, rivalry: 3, preseason: 1 },
  },
  NBA: {
    changePeriod: 3, regulation: 4, latePeriod: 3,
    inWindow: (p, c) => (p === 4 && (c ?? 720) <= 180) || p > 4, windowClose: 5,
    comeback: 12, comebackMargin: 10, garbageLead: 10,
    margins: { normal: 6, playoff: 10, rivalry: 10, preseason: 5 },
  },
  NFL: {
    changePeriod: 4, regulation: 4, latePeriod: 3,
    inWindow: (p, c) => (p === 4 && (c ?? 900) <= 300) || p > 4, windowClose: 8,
    comeback: 14, comebackMargin: 10, garbageLead: 14,
    margins: { normal: 8, playoff: 14, rivalry: 10, preseason: 3 },
  },
};

export interface Trace {
  maxAway: number; // größte Führung Auswärts
  maxHome: number; // größte Führung Heim
  lateMaxAway: number; // größte Führung Auswärts ab latePeriod
  lateMaxHome: number;
  changes: number;
  lateChanges: number;
  lateClose: boolean;
  extra: boolean;
  walkoffText: boolean;
  before: number; // Führung vor dem letzten Scoring-Play
  lastPeriod: number;
  /** Führung zu Beginn der Schlussphase und kleinster Abstand darin */
  windowStart: number;
  windowMin: number;
}

export function trace(game: Game): Trace {
  const r = RULES[game.league];
  const final = game.away.score - game.home.score;
  const t: Trace = {
    maxAway: 0, maxHome: 0, lateMaxAway: 0, lateMaxHome: 0, changes: 0, lateChanges: 0,
    lateClose: false, extra: false, walkoffText: false, before: 0, lastPeriod: 0,
    windowStart: final, windowMin: Math.abs(final),
  };
  let prev = 0;
  let cur = 0;
  let inWindow = false;
  for (const p of game.plays ?? []) {
    const lead = p.away - p.home;
    if (lead > t.maxAway) t.maxAway = lead;
    if (-lead > t.maxHome) t.maxHome = -lead;
    if (p.period >= r.latePeriod) {
      // Auch der Stand vor dem Play gilt, er bestand schon in der späten Phase
      t.lateMaxAway = Math.max(t.lateMaxAway, lead, cur);
      t.lateMaxHome = Math.max(t.lateMaxHome, -lead, -cur);
    }
    if (prev !== 0 && lead !== 0 && prev > 0 !== lead > 0) {
      t.changes++;
      if (p.period >= r.changePeriod) t.lateChanges++;
    }
    if (r.inWindow(p.period, p.clock)) {
      if (!inWindow) {
        inWindow = true;
        t.windowStart = cur;
        t.windowMin = Math.abs(cur);
      }
      t.windowMin = Math.min(t.windowMin, Math.abs(lead));
      if (Math.abs(lead) <= r.windowClose) t.lateClose = true;
    }
    if (p.period > r.regulation) t.extra = true;
    const txt = (p.text ?? '').toLowerCase();
    if (txt.includes('walk-off') || txt.includes('walkoff')) t.walkoffText = true;
    t.before = cur;
    cur = lead;
    t.lastPeriod = p.period;
    if (lead !== 0) prev = lead;
  }
  return t;
}

/** Führte ein Team in der Schlussphase klar und wurde es nie wirklich eng? */
export function isGarbageTime(game: Game, t = trace(game)): boolean {
  const r = RULES[game.league];
  return Math.abs(t.windowStart) >= r.garbageLead && t.windowMin > r.windowClose;
}

/** Abstand, nach dem ein Spiel als eng gilt: bei Garbage Time die Führung vor der Schlussphase. */
export function effectiveMargin(game: Game, t = trace(game)): number {
  const abs = Math.abs(game.away.score - game.home.score);
  return isGarbageTime(game, t) ? Math.max(abs, Math.abs(t.windowStart)) : abs;
}

export function drama(game: Game, t = trace(game)): DramaKind | null {
  const r = RULES[game.league];
  const diff = game.away.score - game.home.score;
  const abs = Math.abs(diff);
  const margin = effectiveMargin(game, t);
  const garbage = isGarbageTime(game, t);
  // Rückstand des Siegers (gesamt und spät) und des Verlierers
  const winnerDeficit = diff > 0 ? t.maxHome : t.maxAway;
  const winnerLateDeficit = diff > 0 ? t.lateMaxHome : t.lateMaxAway;
  const loserDeficit = diff > 0 ? t.maxAway : t.maxHome;
  const comeback = diff !== 0 && (
    winnerLateDeficit >= r.comeback || (winnerDeficit >= r.comeback && abs <= r.comebackMargin)
  );

  switch (game.league) {
    case 'MLB': {
      const walkoff = t.walkoffText || (diff < 0 && t.lastPeriod >= 9 && t.before >= 0);
      if (walkoff) return 'walkoff';
      if (t.extra) return 'extra';
      if (comeback) return 'comeback';
      if (abs <= 1 && loserDeficit >= r.comeback) return 'comeback';
      if (t.lateChanges >= 1 && abs <= 3) return 'leadchanges';
      if (t.changes >= 3 && abs <= 3) return 'leadchanges';
      if (t.lateClose && abs <= 2) return 'lateclose';
      if (abs <= 1) return 'close';
      return null;
    }
    case 'NBA': {
      if (t.extra) return 'ot';
      if (comeback) return 'comeback';
      if (!garbage && abs <= 5 && loserDeficit >= r.comeback) return 'comeback';
      if (t.lateChanges >= 3 && abs <= 10) return 'leadchanges';
      if (t.lateClose && abs <= 8) return 'lateclose';
      if (margin <= 5) return 'close';
      return null;
    }
    case 'NFL': {
      if (t.extra) return 'ot';
      if (comeback) return 'comeback';
      if (!garbage && abs <= 3 && loserDeficit >= r.comeback) return 'comeback';
      if (t.lateChanges >= 1 && abs <= 8) return 'leadchanges';
      if (t.lateClose && abs <= 8) return 'lateclose';
      if (margin <= 3) return 'close';
      return null;
    }
  }
}

export function isRivalry(league: League, a: string, b: string): boolean {
  return RIVALRIES[league].some(
    ([x, y]) => (a.includes(x) && b.includes(y)) || (a.includes(y) && b.includes(x)),
  );
}

export function winPct(record?: string): number | null {
  const parts = (record ?? '').split('-').map((n) => parseInt(n, 10));
  if (parts.length < 2 || parts.some(isNaN)) return null;
  const [w, l, t = 0] = parts;
  const games = w + l + t;
  return games >= CONTENDER_MIN_GAMES ? (w + t / 2) / games : null;
}

/** Beide Teams mit starker Bilanz */
export function bothStrong(game: Game): boolean {
  const a = winPct(game.away.record);
  const b = winPct(game.home.record);
  return a !== null && b !== null && a >= CONTENDER_WIN_PCT && b >= CONTENDER_WIN_PCT;
}

/** Ab diesen Werten gilt eine Einzelleistung als historisch. */
const HISTORIC: Record<string, number> = {
  points: 50, rebounds: 25, assists: 20, // NBA
  passingYards: 450, rushingYards: 200, receivingYards: 200, // NFL
};

/** No-Hitter (MLB) oder herausragende Einzelleistung. Verrät nicht, welches Team. */
export function isHistoric(game: Game): boolean {
  if (game.league === 'MLB') {
    return game.away.hits === 0 || game.home.hits === 0;
  }
  return (game.leaders ?? []).some((l) => HISTORIC[l.stat] !== undefined && l.value >= HISTORIC[l.stat]);
}

/** Spannung aus den Regeln. */
function ruleScore(game: Game, d: DramaKind | null, margin: number): number {
  const m = RULES[game.league].margins;
  const limit = game.season === 'preseason' ? m.preseason : m.normal;
  if (d && BIG.includes(d)) return 85;
  if (d === 'leadchanges' || d === 'lateclose') return 65;
  if (d || margin <= limit) return 50;
  return margin <= limit * 2 ? 30 : 10;
}

const BIG: DramaKind[] = ['walkoff', 'extra', 'ot', 'comeback'];

export function levelOf(score: number): number {
  return score >= 75 ? 5 : score >= 58 ? 4 : score >= 42 ? 3 : score >= 25 ? 2 : 1;
}

export function rate(game: Game): Rating {
  const t = trace(game);
  const d = drama(game, t);
  const margin = effectiveMargin(game, t);
  const m = RULES[game.league].margins;
  const rivalry = isRivalry(game.league, game.away.name, game.home.name);
  const playoff = game.season === 'playoff';
  const strong = bothStrong(game);
  const historic = isHistoric(game);
  const big = d !== null && BIG.includes(d);

  let score = ruleScore(game, d, margin);
  // Rivalität und Playoffs zählen nur, wenn das Spiel nicht völlig einseitig war
  if (playoff && margin <= m.playoff) score += 12;
  if (rivalry && margin <= m.rivalry) score += 12;
  if (strong) score += 6;
  if (big) score = Math.max(score, 70);
  if (historic) score = Math.max(score, 65);
  score = Math.min(100, Math.max(0, Math.round(score)));

  const level = levelOf(score);
  const hot = level >= 3;
  return {
    drama: d, rivalry, strong, historic, score, hot, level,
    reason: reason({ drama: d, hot, rivalry, playoff, historic, strong, score }),
    sortKey: (playoff ? 0 : 1000) + (100 - score),
  };
}

/** Spoilerfreie Begründung: verrät nie, wer geführt oder gewonnen hat. */
export function reason(r: {
  drama: DramaKind | null; hot: boolean; rivalry: boolean; playoff: boolean;
  historic?: boolean; strong?: boolean; score?: number;
}): string {
  if (!r.hot) return 'Kannst du auslassen';
  if (r.historic) return 'Historischer Abend';
  switch (r.drama) {
    case 'walkoff': return 'Krimi bis zum Schluss';
    case 'extra': return 'Extra Innings';
    case 'ot': return 'Overtime';
    case 'comeback': return 'Comeback';
  }
  if (r.rivalry) return 'Rivalitätsduell';
  if (r.drama === 'leadchanges') return 'Hin und her bis zuletzt';
  if (r.drama === 'lateclose') return 'Spannende Schlussphase';
  if ((r.score ?? 0) >= 58) return 'Spannend bis zuletzt';
  if (r.playoff) return 'Playoff-Spiel';
  if (r.strong) return 'Topduell';
  return 'Enges Spiel';
}
