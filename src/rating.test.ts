import { describe, expect, it } from 'vitest';
import { parseEvent, parseHalves, parseLeaders, parsePlays } from './espn';
import spiele from './fixtures/spiele.json';
import { addDays, berlinTime, liveLabel, tierOf } from './nights';
import { LABELS, rate, reason } from './rating';
import type { Game, League, ScoringPlay } from './types';

function game(league: League, away: [string, number], home: [string, number], plays: ScoringPlay[] = [], extra: Partial<Game> = {}): Game {
  const t = (name: string, score: number) => ({ name, short: name.split(' ').pop()!, abbr: 'X', color: '#000000', score });
  return { id: '1', league, start: '2026-10-07T00:00:00Z', state: 'post', season: 'regular', away: t(...away), home: t(...home), plays, ...extra };
}
const p = (away: number, home: number, period: number, clock?: number, text?: string): ScoringPlay => ({ away, home, period, clock, text });

/** MLB-Spiel aus Runs pro Inning */
function mlb(away: number[], home: number[], extra: Partial<Game> = {}): Game {
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  return game('MLB', ['A', sum(away)], ['B', sum(home)], [], { lines: { away, home }, ...extra });
}
const real = (name: keyof typeof spiele) => spiele[name] as unknown as Game;

describe('Spannungskurve: echte Spiele der letzten Saison', () => {
  it.each([
    ['Dodgers 5:4 Blue Jays', 5], // World Series Game 7, 11 Innings
    ['Phillies 1:2 Dodgers', 5], // NLDS, 11 Innings
    ['Knicks 105:104 Spurs', 5], // NBA Finals, 14 Punkte Rückstand 6 Minuten vor Schluss aufgeholt
    ['Packers 27:31 Bears', 4], // NFL Playoffs, drei Viertel klar, dann Aufholjagd
    ['Rangers 7:4 Cardinals', 3], // offen bis ins 9. Inning
    ['Celtics 109:108 76ers', 2], // erst in den letzten Sekunden eng
    ['Jazz 97:137 Timberwolves', 1],
  ] as const)('%s: %i Balken', (name, level) => {
    expect(rate(real(name)).level).toBe(level);
  });
  it('verrät nicht, wer gewonnen hat: Heim und Auswärts getauscht ergibt dieselbe Stufe', () => {
    for (const name of Object.keys(spiele) as (keyof typeof spiele)[]) {
      const g = real(name);
      const swapped: Game = {
        ...g, away: g.home, home: g.away,
        plays: g.plays?.map((x) => ({ ...x, away: x.home, home: x.away })),
      };
      if (g.league === 'MLB') continue; // Halbinnings sind nicht spiegelbar (Heim schlägt zuletzt)
      expect(rate(swapped).level, name).toBe(rate(g).level);
    }
  });
});

describe('Spannungskurve: Regeln', () => {
  it('MLB: Hin und her bis in die Extra Innings ist Stufe 5, früh klar ist Stufe 1', () => {
    expect(rate(mlb([1, 0, 0, 0, 0, 0, 0, 1, 0, 1], [0, 1, 0, 0, 0, 0, 1, 0, 1, 0])).level).toBe(5);
    expect(rate(mlb([4, 3, 0, 0, 1, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0])).level).toBe(1);
  });
  it('MLB: Runner auf Base verringern den Rückstand', () => {
    const lines = { away: [0, 0, 2, 0, 0, 0, 0, 0, 0], home: [0, 0, 0, 0, 0, 0, 0, 0, 0] };
    const without = rate(mlb(lines.away, lines.home));
    const loaded = rate(mlb(lines.away, lines.home, { halves: { '7B': 0, '8B': 0, '9B': 0 } }));
    expect(loaded.score).toBeGreaterThan(without.score);
  });
  it('NBA: klare Führung, die erst am Ende schrumpft (Garbage Time), ist nicht sehenswert', () => {
    expect(rate(game('NBA', ['A', 104], ['B', 98], [p(60, 40, 2, 0), p(100, 80, 4, 200), p(104, 98, 4, 10)])).hot).toBe(false);
  });
  it('NFL: Blowout ist Stufe 1', () => {
    expect(rate(game('NFL', ['A', 42], ['B', 10], [p(21, 3, 2), p(42, 10, 4)])).level).toBe(1);
  });
  it('Playoffs, Rivalität und Topduell heben klare Spiele nicht an', () => {
    const blowout = (extra: Partial<Game>) => rate(game('NFL', ['Kansas City Chiefs', 42], ['Las Vegas Raiders', 10], [p(21, 3, 2), p(42, 10, 4)], extra));
    expect(blowout({ season: 'playoff' }).level).toBe(1);
  });
  it('Playoffs geben bei offenen Spielen einen Bonus', () => {
    const plays = [p(0, 7, 1), p(7, 7, 2), p(14, 10, 3), p(17, 17, 4, 400), p(20, 17, 4, 120)];
    expect(rate(game('NFL', ['A', 20], ['B', 17], plays, { season: 'playoff' })).score)
      .toBeGreaterThan(rate(game('NFL', ['A', 20], ['B', 17], plays)).score);
  });
  it('No-Hitter und 50-Punkte-Spiel heben auf mindestens 3 Balken', () => {
    const nh = mlb([0, 0, 0, 0, 0, 0, 0, 0, 0], [3, 2, 1, 0, 0, 0, 0, 0]);
    nh.away.hits = 0;
    expect(rate(nh).level).toBe(3);
    expect(LABELS.historic).toContain(rate(nh).reason);
    expect(rate(game('NBA', ['A', 130], ['B', 100], [p(70, 50, 2, 0), p(130, 100, 4, 0)], { leaders: [{ stat: 'points', value: 52 }] })).level).toBe(3);
  });
  it('MLB historisch: 14 Strikeouts, 3 Home Runs, 7 RBI oder 5 Hits', () => {
    const blowout = (feats: Game['feats']) => rate(mlb([5, 0, 0, 0, 0, 4, 0, 0, 0], [0, 0, 0, 0, 0, 1, 0, 0, 0], { feats }));
    expect(blowout([{ stat: 'strikeouts', value: 13 }, { stat: 'homeRuns', value: 2 }]).historic).toBe(false);
    for (const f of [{ stat: 'strikeouts', value: 14 }, { stat: 'homeRuns', value: 3 }, { stat: 'rbis', value: 7 }, { stat: 'hits', value: 5 }]) {
      expect(blowout([f]).level).toBe(3);
    }
  });
  it('Preseason bekommt höchstens 3 Balken', () => {
    const r = rate(game('NBA', ['A', 120], ['B', 118], [p(100, 100, 4, 60), p(108, 108, 4, 0), p(120, 118, 5, 0)], { season: 'preseason' }));
    expect(r.level).toBe(3);
  });
  it('ohne Spielverlauf zählt nur der Endabstand', () => {
    expect(rate(game('NBA', ['A', 130], ['B', 100])).level).toBe(1);
    expect(rate(game('NBA', ['A', 101], ['B', 100])).hot).toBe(true);
  });
  it('Punktzahl ist ligaübergreifend vergleichbar: Stufe 5 ab 75', () => {
    for (const name of Object.keys(spiele) as (keyof typeof spiele)[]) {
      const r = rate(real(name));
      expect(r.level === 5, name).toBe(r.score >= 75);
    }
  });
});

describe('spoilerfreie Gründe', () => {
  it('nennen weder Sieger noch Richtung', () => {
    for (const dramatic of [true, false]) {
      const text = reason({ dramatic, hot: true, rivalry: false, playoff: false });
      expect(text).not.toMatch(/walk-off|sieg|gewinn|verlier|heim|auswärts/i);
    }
    // Kein Label verrät Comeback oder Verlängerung
    expect(Object.values(LABELS).flat().join(' ')).not.toMatch(/comeback|overtime|verlängerung|extra|walk-off/i);
  });
  it('ab 4 Balken aus dem Drama-Topf, für dieselbe ID immer gleich', () => {
    const r = rate(real('Dodgers 5:4 Blue Jays'));
    expect([...LABELS.drama, ...LABELS.playoff, ...LABELS.strong]).toContain(r.reason);
    const multi = { dramatic: true, hot: true, rivalry: true, playoff: false };
    const seen = new Set(Array.from({ length: 60 }, (_, i) => reason(multi, String(i))));
    expect([...seen].some((x) => LABELS.rivalry.includes(x))).toBe(true);
    expect([...seen].some((x) => LABELS.drama.includes(x))).toBe(true);
    expect(reason(multi, '401')).toBe(reason(multi, '401'));
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

describe('MLB: Runner auf Base je Halbinning', () => {
  // Nach jedem Play: Inning, Hälfte, Outs, Spielstand und besetzte Bases
  const play = (number: number, type: string, outs: number, away: number, home: number, ...bases: string[]) => ({
    period: { type, number }, outs, awayScore: away, homeScore: home,
    participants: [{ type: 'pitcher' }, { type: 'batter' }, ...bases.map((b) => ({ type: b }))],
  });
  it('kleinster Rückstand abzüglich Runner des schlagenden Teams', () => {
    expect(parseHalves([
      play(7, 'Bottom', 0, 3, 1), play(7, 'Bottom', 1, 3, 1, 'onFirst'), play(7, 'Bottom', 2, 3, 1, 'onFirst', 'onSecond'),
      play(8, 'Top', 0, 3, 1, 'onFirst'), // führendes Team zählt nicht
      play(9, 'Bottom', 3, 3, 1, 'onFirst', 'onSecond', 'onThird'), // nach dem 3. Out zählt nicht
    ])).toEqual({ '7B': 0 });
  });
  it('ohne Daten zu besetzten Bases: unbekannt', () => {
    expect(parseHalves([{ period: { type: 'Top', number: 7 }, outs: 0, awayScore: 0, homeScore: 2 }])).toBeUndefined();
  });
  it('liest Runs pro Inning aus dem Scoreboard', () => {
    const e = { id: '1', date: '2026-10-07T23:00Z', status: { type: { state: 'post' } }, competitions: [{ competitors: [
      { homeAway: 'away', team: {}, linescores: [{ value: 0 }, { value: 2 }] }, { homeAway: 'home', team: {}, linescores: [{ value: 1 }] },
    ] }] };
    expect(parseEvent('MLB', e)?.lines).toEqual({ away: [0, 2], home: [1] });
    expect(parseEvent('NBA', e)?.lines).toBeUndefined();
  });
});

describe('Spieluhr', () => {
  it('liest auch Sekunden ohne Minuten (letzte Minute)', () => {
    const plays = parsePlays({ plays: [{ scoringPlay: true, awayScore: 2, homeScore: 0, period: { number: 4 }, clock: { displayValue: '45.2' } }] });
    expect(plays[0].clock).toBe(45);
  });
});

describe('Bestwerte', () => {
  it('liest Bestwerte', () => {
    expect(parseLeaders([{ leaders: [{ name: 'points', leaders: [{ value: 51 }] }] }])).toEqual([{ stat: 'points', value: 51 }]);
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

describe('gespeicherte Nächte', () => {
  it('werden mit den aktuellen Regeln neu bewertet (Preseason höchstens 3 Balken)', async () => {
    const { loadNight } = await import('./nights');
    const game: Game = {
      id: '9', league: 'NBA', start: '2026-10-06T23:30:00Z', state: 'post', season: 'preseason',
      away: { name: 'A', short: 'A', abbr: 'A', color: '#000', score: 120 }, home: { name: 'B', short: 'B', abbr: 'B', color: '#000', score: 118 }, plays: [],
    };
    const store = new Map([['night:v7:2026-10-07', JSON.stringify({ date: '2026-10-07', failed: [], games: [{ game, rating: { level: 5, score: 90 } }] })]]);
    (globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: () => {} };
    const night = await loadNight('2026-10-07');
    expect(night.games[0].rating.level).toBeLessThanOrEqual(3);
  });
});

describe('laufende Spiele', () => {
  it('zeigen Viertel oder Inning, aber ab der Schlussphase nichts, was ein enges Spiel verrät', () => {
    const g = (league: League, period?: number) => ({ ...game(league, ['A', 0], ['B', 0]), state: 'in' as const, period });
    expect(liveLabel(g('NBA', 2))).toBe('2. Viertel');
    expect(liveLabel(g('NBA', 5))).toBe('Schlussphase');
    expect(liveLabel(g('MLB', 7))).toBe('7. Inning');
    expect(liveLabel(g('MLB', 9))).toBe('Schlussphase');
    expect(liveLabel(g('MLB', 11))).toBe('Schlussphase');
    expect(liveLabel(g('NFL'))).toBe('Läuft');
  });
  it('ESPN-Periode wird übernommen', () => {
    const e = { id: '1', date: '2026-10-07T23:00Z', status: { period: 3, type: { state: 'in' } }, competitions: [{ competitors: [{ homeAway: 'away', team: {} }, { homeAway: 'home', team: {} }] }] };
    expect(parseEvent('NBA', e)?.period).toBe(3);
  });
});

