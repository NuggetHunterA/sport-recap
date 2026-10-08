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
    margins: { normal: 2, playoff: 3, rivalry: 6, preseason: 1 },
  },
  NBA: {
    changePeriod: 3, regulation: 4, latePeriod: 3,
    inWindow: (p, c) => (p === 4 && (c ?? 720) <= 180) || p > 4, windowClose: 5,
    comeback: 12, comebackMargin: 10, garbageLead: 10,
    margins: { normal: 6, playoff: 10, rivalry: 19, preseason: 5 },
  },
  NFL: {
    changePeriod: 4, regulation: 4, latePeriod: 3,
    inWindow: (p, c) => (p === 4 && (c ?? 900) <= 300) || p > 4, windowClose: 8,
    comeback: 14, comebackMargin: 10, garbageLead: 14,
    margins: { normal: 8, playoff: 14, rivalry: 20, preseason: 3 },
  },
};

interface Trace {
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
  /** Ab changePeriod (MLB: 7. Inning) stand es mal unentschieden oder 1 auseinander */
  lateTight: boolean;
}

function trace(game: Game): Trace {
  const r = RULES[game.league];
  const final = game.away.score - game.home.score;
  const t: Trace = {
    maxAway: 0, maxHome: 0, lateMaxAway: 0, lateMaxHome: 0, changes: 0, lateChanges: 0,
    lateClose: false, extra: false, walkoffText: false, before: 0, lastPeriod: 0,
    windowStart: final, windowMin: Math.abs(final), lateTight: false,
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
    // Auch der Stand vor dem Play zählt, z. B. 2:2 nach dem 6. Inning
    if (p.period >= r.changePeriod && (Math.abs(cur) <= 1 || Math.abs(lead) <= 1)) t.lateTight = true;
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
function effectiveMargin(game: Game, t = trace(game)): number {
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

function winPct(record?: string): number | null {
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

/** MLB-Einzelleistungen aus dem Boxscore (Pitcher-Strikeouts, Home Runs, RBI, Hits eines Batters). */
const HISTORIC_MLB: Record<string, number> = { strikeouts: 14, homeRuns: 3, rbis: 7, hits: 5 };

/** No-Hitter oder herausragende Einzelleistung. Verrät nicht, welches Team. */
function isHistoric(game: Game): boolean {
  if (game.league === 'MLB') {
    return game.away.hits === 0 || game.home.hits === 0
      || (game.feats ?? []).some((f) => HISTORIC_MLB[f.stat] !== undefined && f.value >= HISTORIC_MLB[f.stat]);
  }
  return (game.leaders ?? []).some((l) => HISTORIC[l.stat] !== undefined && l.value >= HISTORIC[l.stat]);
}

/** Spannung aus den Regeln. */
function ruleScore(game: Game, d: DramaKind | null, margin: number, t: Trace): number {
  const m = RULES[game.league].margins;
  const limit = game.season === 'preseason' ? m.preseason : m.normal;
  if (d && BIG.includes(d)) return 85;
  if (d === 'leadchanges' || d === 'lateclose') return 65;
  // MLB: 2 Runs Abstand ist nur eng, wenn es ab dem 7. Inning noch knapp war oder der Ausgleich auf Base bzw. am Schlag stand (ohne Spielverlauf wie bisher)
  if (game.league === 'MLB' && !d && margin === 2 && game.plays?.length && !t.lateTight && !game.pressure) return 30;
  if (d || margin <= limit) return 50;
  return margin <= limit * 2 ? 30 : 10;
}

/** Höchster Spannungswert in der Preseason, entspricht Stufe 3 */
const PRESEASON_MAX = 57;

const BIG: DramaKind[] = ['walkoff', 'extra', 'ot', 'comeback'];

/** Mindestwert je Balkenzahl, passend zu levelOf */
const LEVEL_MIN = [0, 0, 25, 42, 58, 75];

function levelOf(score: number): number {
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

  let score = ruleScore(game, d, margin, t);
  // Playoffs zählen nur, wenn das Spiel nicht völlig einseitig war
  if (playoff && margin <= m.playoff) score += 12;
  if (strong) score += 6;
  if (big) score = Math.max(score, 70);
  if (historic) score = Math.max(score, 65);
  // Rivalität: ein Balken mehr, außer bei einer Klatsche (MLB ab 7 Runs, NBA ab 20, NFL ab 21 Punkten)
  if (rivalry && margin <= m.rivalry) score = Math.max(score, LEVEL_MIN[Math.min(5, levelOf(score) + 1)]);
  // Preseason ist nie Pflichtprogramm: höchstens 3 von 5 Balken
  if (game.season === 'preseason') score = Math.min(score, PRESEASON_MAX);
  score = Math.min(100, Math.max(0, Math.round(score)));

  const level = levelOf(score);
  const hot = level >= 3;
  return {
    drama: d, rivalry, strong, historic, score, hot, level,
    reason: reason({ drama: d, hot, rivalry, playoff, historic, strong }, game.id),
    sortKey: (playoff ? 0 : 1000) + (100 - score),
  };
}

/** Spoilerfreie Labels. Alles Dramatische teilt sich einen Topf, damit das Label nichts über den Verlauf verrät. */
export const LABELS = {
  drama: ['Krimi bis zum Schluss', 'Hin und her bis zuletzt', 'Spannende Schlussphase', 'Bis zum Ende offen',
    'Nichts für schwache Nerven', 'Achterbahnfahrt', 'Nervenkitzel pur', 'Herzschlagfinale', 'Spannend bis zuletzt'],
  rivalry: ['Rivalitätsduell', 'Erzrivalen unter sich', 'Prestigeduell'],
  playoff: ['Playoff-Spiel', 'Playoff-Atmosphäre', 'Es geht um alles'],
  strong: ['Topduell', 'Spitzenspiel', 'Duell der Großen'],
  close: ['Enges Spiel', 'Lange offen'],
  historic: ['Historischer Abend', 'Besondere Leistung'],
  skip: ['Kannst du auslassen', 'Kein Muss', 'Nur für Fans'],
};

/** Gleiche Spiel-ID ergibt immer dasselbe Label (auch nach Neuladen und in der Benachrichtigung). */
function pick(list: string[], seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}

/** Spoilerfreie Begründung: verrät nie, wer geführt oder gewonnen hat. Treffen mehrere Punkte zu, wird aus allen gewählt. */
export function reason(r: {
  drama: DramaKind | null; hot: boolean; rivalry: boolean; playoff: boolean;
  historic?: boolean; strong?: boolean;
}, seed = ''): string {
  if (!r.hot) return pick(LABELS.skip, seed);
  const dramatic = r.drama !== null && r.drama !== 'close';
  const pool = [
    ...(r.historic ? LABELS.historic : []),
    ...(dramatic ? LABELS.drama : []),
    ...(r.rivalry ? LABELS.rivalry : []),
    ...(r.playoff ? LABELS.playoff : []),
    ...(r.strong ? LABELS.strong : []),
  ];
  return pick(pool.length ? pool : LABELS.close, seed);
}
