import { describe, expect, it } from 'vitest';
import { parseEvent, parseLeaders, parsePlays, parseWinProbability } from './espn';
import { addDays, berlinTime, tierOf } from './nights';
import { isGarbageTime, rate, reason, wpScore } from './rating';
import type { Game, League, ScoringPlay } from './types';

function game(league: League, away: [string, number], home: [string, number], plays: ScoringPlay[] = [], extra: Partial<Game> = {}): Game {
  const t = (name: string, score: number) => ({ name, short: name.split(' ').pop()!, abbr: 'X', color: '#000000', score });
  return { id: '1', league, start: '2026-10-07T00:00:00Z', state: 'post', season: 'regular', away: t(...away), home: t(...home), plays, ...extra };
}
const p = (away: number, home: number, period: number, clock?: number, text?: string): ScoringPlay => ({ away, home, period, clock, text });

describe('MLB', () => {
  it('erkennt Walk-off ohne Text: Heimteam dreht im 9. Inning', () => {
    const r = rate(game('MLB', ['Milwaukee Brewers', 4], ['San Diego Padres', 5], [p(2, 0, 3), p(4, 3, 6), p(4, 5, 9)]));
    expect(r.drama).toBe('walkoff');
    expect(r.level).toBe(5);
    expect(r.reason).toBe('Krimi bis zum Schluss');
  });
  it('Extra Innings', () => {
    expect(rate(game('MLB', ['A', 3], ['B', 2], [p(1, 1, 2), p(2, 2, 7), p(3, 2, 11)])).drama).toBe('extra');
  });
  it('Klarer Sieg ist nicht sehenswert', () => {
    const r = rate(game('MLB', ['A', 9], ['B', 1], [p(5, 0, 2), p(9, 1, 6)]));
    expect(r.hot).toBe(false);
    expect(r.level).toBe(1);
    expect(r.reason).toBe('Kannst du auslassen');
  });
  it('Rivalität mit 3 Runs Abstand ist sehenswert', () => {
    const r = rate(game('MLB', ['New York Yankees', 5], ['Boston Red Sox', 2], [p(5, 2, 4)]));
    expect(r.rivalry).toBe(true);
    expect(r.hot).toBe(true);
    expect(r.reason).toBe('Rivalitätsduell');
  });
  it('Preseason nur bei sehr engem Spiel', () => {
    expect(rate(game('MLB', ['A', 4], ['B', 2], [], { season: 'preseason' })).hot).toBe(false);
  });
});

describe('NBA', () => {
  it('Overtime', () => {
    expect(rate(game('NBA', ['A', 120], ['B', 118], [p(100, 100, 4, 0), p(120, 118, 5, 0)])).drama).toBe('ot');
  });
  it('Comeback nach 15 Punkten Rückstand', () => {
    const r = rate(game('NBA', ['A', 110], ['B', 100], [p(10, 25, 2, 300), p(110, 100, 4, 10)]));
    expect(r.drama).toBe('comeback');
    expect(r.reason).toBe('Comeback');
  });
  it('Spannende Schlussphase', () => {
    const r = rate(game('NBA', ['A', 104], ['B', 98], [p(90, 80, 3, 100), p(100, 97, 4, 120), p(104, 98, 4, 5)]));
    expect(r.drama).toBe('lateclose');
    expect(r.level).toBe(4);
  });
});

describe('NFL', () => {
  it('Führungswechsel im 4. Viertel', () => {
    const r = rate(game('NFL', ['Kansas City Chiefs', 28], ['Jacksonville Jaguars', 31], [p(21, 17, 3), p(28, 24, 4, 600), p(28, 31, 4, 40)]));
    expect(r.drama).toBe('leadchanges');
    expect(r.reason).toBe('Hin und her bis zuletzt');
  });
  it('Blowout', () => {
    expect(rate(game('NFL', ['A', 42], ['B', 10], [p(21, 3, 2), p(42, 10, 4)])).level).toBe(1);
  });
});

describe('spoilerfreie Gründe', () => {
  it('nennen weder Sieger noch Richtung', () => {
    const kinds = ['walkoff', 'extra', 'ot', 'comeback', 'leadchanges', 'lateclose', 'close', null] as const;
    for (const k of kinds) {
      const text = reason({ drama: k, hot: true, rivalry: false, playoff: false });
      expect(text).not.toMatch(/walk-off|sieg|gewinn|verlier|heim|auswärts/i);
    }
  });
});

describe('ESPN-Daten', () => {
  it('liest Scoreboard-Events', () => {
    const g = parseEvent('MLB', {
      id: '401', date: '2026-10-07T00:07Z', season: { type: 3 },
      status: { type: { state: 'post' } },
      competitions: [{
        notes: [{ headline: 'NLDS - Game 2' }],
        competitors: [
          { homeAway: 'home', score: '7', records: [{ summary: '93-69' }], team: { displayName: 'Los Angeles Dodgers', shortDisplayName: 'Dodgers', abbreviation: 'LAD', color: '005a9c', logo: 'x.png' } },
          { homeAway: 'away', score: '6', records: [{ summary: '88-74' }], team: { displayName: 'Atlanta Braves', shortDisplayName: 'Braves', abbreviation: 'ATL', color: 'ce1141' } },
        ],
      }],
    })!;
    expect(g.season).toBe('playoff');
    expect(g.home.score).toBe(7);
    expect(g.away.color).toBe('#ce1141');
    expect(g.note).toBe('NLDS - Game 2');
    expect(tierOf(g, [])).toBe('contender');
    expect(tierOf(g, [{ league: 'MLB', match: 'Braves', label: 'Braves' }])).toBe('favorite');
  });
  it('liest Scoring-Plays aus plays und scoringPlays', () => {
    expect(parsePlays({ plays: [{ scoringPlay: false }, { scoringPlay: true, awayScore: 2, homeScore: 0, period: { number: 4 }, clock: { displayValue: '2:31' } }] }))
      .toEqual([{ away: 2, home: 0, period: 4, clock: 151, text: undefined }]);
    expect(parsePlays({ scoringPlays: [{ awayScore: 7, homeScore: 0, period: { number: 1 }, clock: { value: 400 } }] })[0].clock).toBe(400);
  });
});

describe('Zeitfenster', () => {
  it('rechnet Berliner Mittag in UTC um (Sommerzeit)', () => {
    expect(berlinTime('2026-10-07', 12).toISOString()).toBe('2026-10-07T10:00:00.000Z');
    expect(berlinTime('2026-12-07', 12).toISOString()).toBe('2026-12-07T11:00:00.000Z');
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
  });
});

describe('NFL-Rivalitäten', () => {
  it('erkennt Chiefs gegen Raiders unabhängig vom Heimteam', () => {
    expect(rate(game('NFL', ['Las Vegas Raiders', 20], ['Kansas City Chiefs', 27])).rivalry).toBe(true);
    expect(rate(game('NFL', ['Las Vegas Raiders', 20], ['Kansas City Chiefs', 27])).hot).toBe(true);
  });
});

describe('Zwischenspeicher', () => {
  it('fragt dasselbe Scoreboard innerhalb von 5 Minuten nur einmal ab', async () => {
    const { scoreboard } = await import('./espn');
    let calls = 0;
    const orig = globalThis.fetch;
    globalThis.fetch = (async () => { calls++; return new Response(JSON.stringify({ events: [] })); }) as typeof fetch;
    try {
      await scoreboard('NBA', '2026-10-01');
      await scoreboard('NBA', '2026-10-01');
      expect(calls).toBe(1);
    } finally {
      globalThis.fetch = orig;
    }
  });
});

describe('Teamliste', async () => {
  const { TEAMS } = await import('./teams');
  const { FAVORITES, RIVALRIES } = await import('./config');
  it('hat 30 MLB-, 30 NBA- und 32 NFL-Teams', () => {
    expect(TEAMS.filter((t) => t.league === 'MLB')).toHaveLength(30);
    expect(TEAMS.filter((t) => t.league === 'NBA')).toHaveLength(30);
    expect(TEAMS.filter((t) => t.league === 'NFL')).toHaveLength(32);
  });
  it('jeder Spitzname trifft in seiner Liga genau ein Team', () => {
    for (const t of TEAMS) {
      expect(TEAMS.filter((o) => o.league === t.league && o.name.includes(t.short)).map((o) => o.name)).toEqual([t.name]);
    }
  });
  it('alle Lieblingsteams und Rivalitäten gibt es wirklich', () => {
    for (const f of FAVORITES) expect(TEAMS.some((t) => t.league === f.league && t.name.includes(f.match))).toBe(true);
    for (const [league, pairs] of Object.entries(RIVALRIES)) {
      for (const name of pairs.flat()) expect(TEAMS.some((t) => t.league === league && t.name.includes(name)), name).toBe(true);
    }
  });
});

describe('verbesserte Bewertung', () => {
  it('früher Rückstand und klarer Sieg ist kein Comeback', () => {
    const r = rate(game('NBA', ['A', 120], ['B', 100], [p(0, 12, 1, 100), p(60, 50, 2, 0), p(120, 100, 4, 0)]));
    expect(r.drama).not.toBe('comeback');
    expect(r.hot).toBe(false);
  });
  it('später Rückstand zählt als Comeback, auch bei klarem Ende', () => {
    const r = rate(game('NBA', ['A', 115], ['B', 100], [p(70, 84, 3, 300), p(115, 100, 4, 0)]));
    expect(r.drama).toBe('comeback');
  });
  it('Garbage Time: 15 vorne 3 Minuten vor Schluss, am Ende nur 6, ist nicht eng', () => {
    const g = game('NBA', ['A', 104], ['B', 98], [p(100, 85, 4, 200), p(102, 92, 4, 120), p(104, 98, 4, 10)]);
    expect(isGarbageTime(g)).toBe(true);
    expect(rate(g).hot).toBe(false);
  });
  it('Siegwahrscheinlichkeit: Achterbahn schlägt klaren Verlauf', () => {
    const wild = Array.from({ length: 40 }, (_, i) => 0.5 + 0.35 * Math.sin(i / 2));
    const flat = Array.from({ length: 40 }, (_, i) => Math.min(0.99, 0.6 + i / 80));
    expect(wpScore(game('NBA', ['A', 1], ['B', 2], [], { wp: wild }))!).toBeGreaterThan(60);
    expect(wpScore(game('NBA', ['A', 1], ['B', 2], [], { wp: flat }))!).toBeLessThan(25);
    expect(wpScore(game('NBA', ['A', 1], ['B', 2]))).toBeNull();
  });
  it('No-Hitter und 50-Punkte-Spiel sind historisch, auch bei klarem Ergebnis', () => {
    const nh = game('MLB', ['A', 0], ['B', 6]);
    nh.away.hits = 0;
    expect(rate(nh).reason).toBe('Historischer Abend');
    expect(rate(game('NBA', ['A', 130], ['B', 100], [], { leaders: [{ stat: 'points', value: 52 }] })).level).toBeGreaterThanOrEqual(4);
  });
  it('Duell zweier starker Teams gibt einen Bonus', () => {
    const base = game('NBA', ['A', 110], ['B', 101]);
    const strong = game('NBA', ['A', 110], ['B', 101]);
    strong.away.record = '40-10';
    strong.home.record = '38-12';
    expect(rate(strong).score).toBeGreaterThan(rate(base).score);
  });
  it('liest Bestwerte und Siegwahrscheinlichkeit', () => {
    expect(parseLeaders([{ leaders: [{ name: 'points', leaders: [{ value: 51 }] }] }])).toEqual([{ stat: 'points', value: 51 }]);
    expect(parseWinProbability({ winprobability: [{ homeWinPercentage: 0.5 }, { homeWinPercentage: 0.7 }] })).toEqual([0.5, 0.7]);
  });
});
