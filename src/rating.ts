// Spoilerfreie Bewertung eines beendeten Spiels.
//
// Kern ist die Spannungskurve (curve.ts): wie lange und wie spät das Spiel offen war.
// Playoffs, Rivalität und Duelle starker Teams geben einen kleinen Bonus, besondere
// Leistungen eine Untergrenze. Die Stufen kommen aus festen Grenzen je Liga.
import { CONTENDER_MIN_GAMES, CONTENDER_WIN_PCT, RIVALRIES } from './config';
import { curve, openness } from './curve';
import type { Game, League, Rating } from './types';

/** Punktzahl, ab der Stufe 2, 3, 4 und 5 beginnen, kalibriert an der Saison Okt. 2025 bis Okt. 2026 (etwa 30/28/25/13/4 %). */
const LIMITS: Record<League, [number, number, number, number]> = {
  MLB: [33, 62, 83, 94],
  NBA: [23, 59, 80, 88],
  NFL: [30, 62, 80, 88],
};

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

/** Kontext zählt nur bei Spielen, die ohnehin mindestens Stufe 3 erreichen: Playoffs +5, Rivalität +3, Topduell +3, zusammen höchstens +8. */
function context(playoff: boolean, rivalry: boolean, strong: boolean): number {
  return Math.min(8, (playoff ? 5 : 0) + (rivalry ? 3 : 0) + (strong ? 3 : 0));
}

/** Höchster Spannungswert in der Preseason, entspricht Stufe 3 */
const PRESEASON_MAX = 57;

/** Rechnet die Punktzahl einer Liga auf 0 bis 100 um (Stufengrenzen bei 25, 42, 58, 75), damit Spiele verschiedener Ligen vergleichbar sind. */
function normalize(raw: number, t: number[]): number {
  const from = [0, ...t, t[3] + 20];
  const to = [0, 25, 42, 58, 75, 100];
  if (raw >= from[5]) return 100;
  const i = from.findIndex((x, k) => raw < from[k + 1]);
  return to[i] + (to[i + 1] - to[i]) * (raw - from[i]) / (from[i + 1] - from[i]);
}

export function rate(game: Game): Rating {
  const t = LIMITS[game.league];
  const rivalry = isRivalry(game.league, game.away.name, game.home.name);
  const playoff = game.season === 'playoff';
  const strong = bothStrong(game);
  const historic = isHistoric(game);

  // Ohne Spielverlauf zählt nur, wie offen der Endstand gewesen wäre
  let raw = curve(game)?.score ?? 100 * openness(game.league, Math.abs(game.away.score - game.home.score), 0);
  if (raw >= t[1]) raw += context(playoff, rivalry, strong);
  if (historic) raw = Math.max(raw, t[1]);

  let level = 1 + t.filter((x) => raw >= x).length;
  let score = normalize(raw, t);
  // Preseason ist nie Pflichtprogramm: höchstens 3 von 5 Balken
  if (game.season === 'preseason') {
    level = Math.min(level, 3);
    score = Math.min(score, PRESEASON_MAX);
  }
  score = Math.floor(score);

  const hot = level >= 3;
  return {
    rivalry, strong, historic, score, hot, level,
    reason: reason({ dramatic: level >= 4, hot, rivalry, playoff, historic, strong }, game.id),
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
  dramatic: boolean; hot: boolean; rivalry: boolean; playoff: boolean;
  historic?: boolean; strong?: boolean;
}, seed = ''): string {
  if (!r.hot) return pick(LABELS.skip, seed);
  const pool = [
    ...(r.historic ? LABELS.historic : []),
    ...(r.dramatic ? LABELS.drama : []),
    ...(r.rivalry ? LABELS.rivalry : []),
    ...(r.playoff ? LABELS.playoff : []),
    ...(r.strong ? LABELS.strong : []),
  ];
  return pick(pool.length ? pool : LABELS.close, seed);
}
