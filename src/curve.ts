// Vorschlag A: Spannungskurve. Bewertet, wie lange und wie spät ein Spiel offen war.
import type { Game, League } from './types';

/** Streuung des Endabstands über ein ganzes Spiel (Runs bzw. Punkte), gemessen an Okt. 2025 bis Sep. 2026. */
const SIGMA: Record<League, number> = { MLB: 4.6, NBA: 16.4, NFL: 13.8 };
/** Was auch kurz vor Schluss noch aufholbar ist: MLB gut ein Run, NBA ein bis zwei Würfe, NFL ein Touchdown. */
const LATE: Record<League, number> = { MLB: 1.2, NBA: 5, NFL: 7 };
/** Regulär: MLB 18 Halbinnings, NBA 48 Minuten, NFL 60 Minuten (in Sekunden). */
const REG: Record<League, number> = { MLB: 18, NBA: 2880, NFL: 3600 };
const PERIOD: Record<'NBA' | 'NFL', { len: number; ot: number; count: number }> = {
  NBA: { len: 720, ot: 300, count: 4 },
  NFL: { len: 900, ot: 600, count: 4 },
};
/** Ab diesem Spielfortschritt beginnt die Schlussphase (MLB: 8. Inning). */
const FINAL_FROM = 0.77;
/** Ab hier zählen die letzten Minuten extra (NBA gut 2,5 Min., NFL gut 3,5 Min., MLB Bottom 9). */
const LAST_FROM = 0.94;
/** Gewichtete Wendungen, ab denen der Anteil voll ist. */
const TURN_CAP: Record<League, number> = { MLB: 2, NBA: 5, NFL: 3 };

export interface State {
  /** Spielfortschritt, 1 = Ende der regulären Spielzeit */
  t: number;
  /** Verbleibender Anteil der Spielzeit (in der Verlängerung: Rest der Verlängerung) */
  r: number;
  /** Auswärts minus Heim */
  margin: number;
  /** Abstand, der für die Offenheit zählt (MLB: abzüglich Runner auf Base) */
  effective: number;
}

export interface Curve {
  final: number;
  course: number;
  turns: number;
  score: number;
}

/** Standardnormalverteilung */
function phi(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** Offenheit 0 bis 1: 1 bei Gleichstand, sinkt mit dem Abstand im Verhältnis zur Restzeit. */
export function openness(league: League, effective: number, r: number): number {
  if (effective <= 0) return 1;
  return 2 * (1 - phi(effective / (SIGMA[league] * Math.sqrt(Math.max(r, 0)) + LATE[league])));
}

type Extra = { lines?: { away: number[]; home: number[] }; halves?: Record<string, number> };

/** MLB: Stand zu Beginn jedes Halbinnings aus dem Linescore. */
function mlbStates(game: Game & Extra): State[] {
  const { away = [], home = [] } = game.lines ?? {};
  const sum = (xs: number[], n: number) => xs.slice(0, n).reduce((a, b) => a + b, 0);
  const out: State[] = [];
  for (let i = 1; i <= away.length; i++) {
    for (const top of [true, false]) {
      if (!top && home.length < i) continue;
      const done = 2 * (i - 1) + (top ? 0 : 1);
      const margin = sum(away, top ? i - 1 : i) - sum(home, i - 1);
      // Rückstand des schlagenden Teams abzüglich Runner auf Base, falls bekannt
      const trailing = top ? margin < 0 : margin > 0;
      const pressure = trailing ? game.halves?.[`${i}${top ? 'T' : 'B'}`] : undefined;
      out.push({
        t: done / 18,
        r: Math.max(18 - done, 1) / 18,
        margin,
        effective: Math.min(Math.abs(margin), pressure ?? Infinity),
      });
    }
  }
  return out;
}

/** NBA/NFL: Stand alle 30 Sekunden aus den Scoring-Plays. */
function clockStates(game: Game): State[] {
  const p = PERIOD[game.league as 'NBA' | 'NFL'];
  const len = (n: number) => (n <= p.count ? p.len : p.ot);
  const start = (n: number) => Array.from({ length: n - 1 }, (_, i) => len(i + 1)).reduce((a, b) => a + b, 0);
  const plays = (game.plays ?? []).map((x) => ({
    at: start(x.period) + len(x.period) - (x.clock ?? 0),
    margin: x.away - x.home,
    period: x.period,
  })).sort((a, b) => a.at - b.at);
  const last = Math.max(p.count, ...plays.map((x) => x.period));
  const end = start(last) + len(last);
  const reg = REG[game.league];
  const out: State[] = [];
  let i = 0;
  let margin = 0;
  for (let s = 0; s < end; s += 30) {
    while (i < plays.length && plays[i].at <= s) margin = plays[i++].margin;
    const period = Math.min(last, Math.max(1, s < reg ? Math.floor(s / p.len) + 1 : p.count + 1 + Math.floor((s - reg) / p.ot)));
    const periodEnd = start(period) + len(period);
    const remaining = s < reg ? reg - s : periodEnd - s;
    out.push({ t: s / reg, r: Math.max(remaining, 15) / reg, margin, effective: Math.abs(margin) });
  }
  return out;
}

export function states(game: Game): State[] {
  return game.league === 'MLB' ? mlbStates(game as Game & Extra) : clockStates(game);
}

/** Kennzahlen der Kurve und Punktzahl 0 bis 100 (ohne Kontext). */
export function curve(game: Game): Curve | null {
  const all = states(game);
  if (all.length < 4) return null;
  const o = all.map((s) => openness(game.league, s.effective, s.r));
  // Schlussphase: je später, desto stärker gewichtet
  let fw = 0;
  let fo = 0;
  all.forEach((s, i) => {
    if (s.t < FINAL_FROM) return;
    const w = Math.min(s.t, 1) - FINAL_FROM + 0.05;
    fw += w;
    fo += w * o[i];
  });
  // Die letzten Minuten (MLB: Bottom 9 und Extra Innings) zählen mindestens fast so viel wie die ganze Schlussphase
  const last = all.map((s, i) => (s.t >= LAST_FROM ? o[i] : null)).filter((x): x is number => x !== null);
  const lastMean = last.length ? last.reduce((a, b) => a + b, 0) / last.length : 0;
  const final = Math.max(fw ? fo / fw : 0, 0.9 * lastMean);
  let wsum = 0;
  let osum = 0;
  all.forEach((s, i) => {
    const w = 0.5 + Math.min(s.t, 1);
    wsum += w;
    osum += w * o[i];
  });
  const course = osum / wsum;
  // Ausgleiche und Führungswechsel, spätere zählen mehr
  let turns = 0;
  for (let i = 1; i < all.length; i++) {
    const a = Math.sign(all[i - 1].margin);
    const b = Math.sign(all[i].margin);
    if (a !== 0 && a !== b) turns += Math.min(all[i].t, 1);
  }
  const turnShare = Math.min(1, turns / TURN_CAP[game.league]);
  return { final, course, turns: turnShare, score: 100 * (0.5 * final + 0.3 * course + 0.2 * turnShare) };
}
