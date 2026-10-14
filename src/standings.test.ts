import { describe, expect, it } from 'vitest';
import { parseEntry, parseStandings } from './standings';

/** ESPN-Eintrag wie in /standings: Team plus Statistikliste */
function entry(abbr: string, wins: number, losses: number, extra: { ties?: number; gb?: number; seed?: number; clinch?: string } = {}) {
  const stats = [
    { name: 'wins', value: wins }, { name: 'losses', value: losses }, { name: 'ties', value: extra.ties ?? 0 },
    { name: 'winPercent', value: wins / (wins + losses), displayValue: (wins / (wins + losses)).toFixed(3).replace(/^0/, '') },
    { name: 'gamesBehind', value: extra.gb ?? 0 },
    { name: 'playoffSeed', value: extra.seed ?? 0 },
  ];
  if (extra.clinch) stats.push({ name: 'clincher', value: 1, displayValue: extra.clinch });
  return { team: { abbreviation: abbr, displayName: `Team ${abbr}` }, stats };
}
const division = (shortName: string, entries: unknown[]) => ({ name: shortName, shortName, standings: { seasonDisplayName: '2026', entries } });

const mlb = {
  children: [{
    abbreviation: 'AL',
    children: [
      // absichtlich unsortiert, wie ESPN es teils liefert
      division('AL East', [entry('TOR', 91, 71, { gb: 3 }), entry('NYY', 94, 68, { clinch: 'y' }), entry('BAL', 75, 87, { gb: 19, clinch: 'e' })]),
      division('AL Central', [entry('CLE', 90, 72), entry('KC', 86, 76, { gb: 4 }), entry('DET', 85, 77, { gb: 5 })]),
      division('AL West', [entry('SEA', 92, 70), entry('HOU', 87, 75, { gb: 5 }), entry('ATH', 79, 83, { gb: 13 })]),
    ],
  }],
};

describe('Tabellen', () => {
  it('sortiert Divisionen nach Bilanz und hängt die Wild Card an', () => {
    const { tables, season, final } = parseStandings('MLB', mlb);
    expect(tables.map((t) => t.title)).toEqual(['AL East', 'AL Central', 'AL West', 'AL Wild Card']);
    expect(tables[0].rows.map((r) => r.abbr)).toEqual(['NYY', 'TOR', 'BAL']);
    expect(tables[0].rows.map((r) => r.gb)).toEqual(['–', '3', '19']);
    expect(season).toBe('2026');
    expect(final).toBe(true);
  });

  it('Wild Card: ohne Divisionssieger, Abstand zum dritten Platz', () => {
    const wc = parseStandings('MLB', mlb).tables[3];
    expect(wc.lines).toEqual([3]);
    expect(wc.rows.map((r) => [r.abbr, r.gb])).toEqual([
      ['TOR', '+5'], ['HOU', '+1'], ['KC', '–'], ['DET', '1'], ['ATH', '7'], ['BAL', '11'],
    ]);
  });

  it('halbe Spiele Rückstand', () => {
    const data = { children: [{ abbreviation: 'NL', children: [
      division('A', [entry('A1', 90, 70), entry('A2', 85, 76)]),
      division('B', [entry('B1', 90, 70), entry('B2', 84, 76)]),
      division('C', [entry('C1', 90, 70), entry('C2', 84, 77)]),
    ] }] };
    const wc = parseStandings('MLB', data).tables[3];
    expect(wc.rows.map((r) => r.gb)).toEqual(['+1', '+0.5', '–']);
  });

  it('NBA: Conferences nach Setzplatz, Linien nach 6 und 10', () => {
    const data = { children: [{ name: 'Eastern Conference', standings: { seasonDisplayName: '2025-26', entries: [
      entry('ATL', 46, 36, { seed: 6 }), entry('DET', 60, 22, { seed: 1, clinch: 'z' }), entry('BOS', 56, 26, { seed: 2 }),
    ] } }] };
    const { tables, season } = parseStandings('NBA', data);
    expect(tables).toHaveLength(1);
    expect(tables[0].lines).toEqual([6, 10]);
    expect(tables[0].rows.map((r) => r.abbr)).toEqual(['DET', 'BOS', 'ATL']);
    expect(season).toBe('2025-26');
  });

  it('NFL: Saison läuft noch, Unentschieden zählen halb', () => {
    const data = { children: [{ abbreviation: 'AFC', children: [
      division('AFC East', [entry('BUF', 3, 1), entry('NE', 2, 1, { ties: 1 }), entry('NYJ', 2, 2)]),
    ] }] };
    const { tables, final } = parseStandings('NFL', data);
    expect(final).toBe(false);
    expect(tables[0].rows.map((r) => r.abbr)).toEqual(['BUF', 'NE', 'NYJ']);
    expect(tables[1].title).toBe('AFC Wild Card');
  });

  it('übernimmt nur bekannte Markierungen und die Teamfarbe', () => {
    expect(parseEntry('MLB', entry('SD', 90, 72, { clinch: 'x' }))).toMatchObject({ clinch: 'x', color: '#2F241D' });
    expect(parseEntry('MLB', entry('SD', 90, 72, { clinch: '*' })).clinch).toBeUndefined();
  });
});
