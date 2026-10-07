import { describe, expect, it } from 'vitest';
import { hasBoxScore, parseBoxScore } from './boxscore';
import type { Game } from './types';

const team = (abbr: string) => ({ name: abbr, short: abbr, abbr, color: '#000', score: 0 });
const game = (league: Game['league']) => ({ league, away: team('GS'), home: team('LAL') });
const ath = (name: string, stats: string[], extra = {}) => ({ athlete: { shortName: name, position: { abbreviation: 'G' } }, stats, ...extra });

describe('Boxscore', () => {
  it('NBA: Minuten, Punkte, Rebounds, Assists über die Bezeichnungen, ohne DNP', () => {
    const labels = ['MIN', 'FG', '3PT', 'FT', 'OREB', 'DREB', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PF', '+/-', 'PTS'];
    const s = { boxscore: { players: [
      { team: { abbreviation: 'LAL' }, statistics: [{ labels, athletes: [ath('L. James', ['36', '11-20', '2-5', '5-6', '1', '7', '8', '9', '1', '0', '3', '2', '+5', '29'])] }] },
      { team: { abbreviation: 'GS' }, statistics: [{ labels, athletes: [
        ath('S. Curry', ['35', '12-22', '6-12', '4-4', '0', '5', '5', '7', '2', '0', '4', '1', '-5', '34']),
        ath('Bankspieler', [], { didNotPlay: true }),
      ] }] },
    ] } };
    const box = parseBoxScore(s, game('NBA'));
    expect(box.away?.tables[0].columns).toEqual(['MIN', 'PTS', 'REB', 'AST']);
    expect(box.away?.tables[0].rows).toEqual([{ name: 'S. Curry', note: 'G', stats: ['35', '34', '5', '7'] }]);
    expect(box.home?.tables[0].rows[0].stats).toEqual(['36', '29', '8', '9']);
    expect(box.line).toBeUndefined();
  });

  it('MLB: Linescore, Schlagmänner und Pitcher', () => {
    const s = {
      header: { competitions: [{ competitors: [
        { homeAway: 'home', score: '5', hits: 9, errors: 0, linescores: [0, 0, 1, 0, 0, 2, 0, 0, 2].map((v) => ({ displayValue: String(v) })) },
        { homeAway: 'away', score: '4', hits: 7, errors: 1, linescores: [0, 2, 0, 0, 0, 2, 0, 0, 0].map((v) => ({ displayValue: String(v) })) },
      ] }] },
      boxscore: { players: [
        { team: { abbreviation: 'GS' }, statistics: [
          { type: 'batting', labels: ['H-AB', 'AB', 'R', 'H', 'RBI', 'HR', 'BB', 'K', '#P', 'AVG', 'OBP', 'SLG'], athletes: [ath('C. Yelich', ['2-4', '4', '1', '2', '1', '1', '0', '1', '18', '.300', '.380', '.500'])] },
          { type: 'pitching', labels: ['IP', 'H', 'R', 'ER', 'BB', 'K', 'HR', 'PC-ST', 'ERA', 'PC'], athletes: [ath('F. Peralta', ['6.0', '5', '3', '3', '2', '8', '1', '98-64', '3.20', '98'])] },
        ] },
        { team: { abbreviation: 'LAL' }, statistics: [] },
      ] },
    };
    const box = parseBoxScore(s, game('MLB'));
    expect(box.line?.innings).toBe(9);
    expect(box.line?.away).toMatchObject({ abbr: 'GS', r: '4', h: '7', e: '1' });
    expect(box.line?.home.runs[8]).toBe('2');
    expect(box.away?.tables.map((t) => t.title)).toEqual(['Schlagmänner', 'Pitcher']);
    expect(box.away?.tables[0].rows[0].stats).toEqual(['4', '1', '2', '1', '1', '0', '1']);
    expect(box.away?.tables[1].rows[0].stats).toEqual(['6.0', '5', '3', '3', '2', '8']);
    expect(box.home?.tables).toEqual([]);
  });

  it('fehlende Daten ergeben einen leeren Boxscore statt eines Fehlers', () => {
    expect(hasBoxScore(parseBoxScore({}, game('NBA')))).toBe(false);
    expect(hasBoxScore(parseBoxScore(null, game('MLB')))).toBe(false);
  });
});
