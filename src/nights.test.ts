import { describe, expect, it } from 'vitest';
import type { Favorite } from './favorites';
import { arrangeNight, pruneNights } from './nights';
import type { RatedGame } from './nights';
import type { Game, League } from './types';

function fakeStorage(keys: string[]): Storage {
  const data = new Map(keys.map((k) => [k, '{}']));
  return {
    get length() { return data.size; },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
    clear: () => data.clear(),
  };
}
const keysOf = (s: Storage) => Array.from({ length: s.length }, (_, i) => s.key(i)!).sort();

describe('pruneNights', () => {
  it('löscht Nächte älterer Versionen und lässt andere Einträge stehen', () => {
    const s = fakeStorage(['night:v7:2026-10-01', 'night:v8:2026-10-02', 'revealed:v1', 'favorites:v1']);
    pruneNights(s);
    expect(keysOf(s)).toEqual(['favorites:v1', 'night:v8:2026-10-02', 'revealed:v1']);
  });

  it('behält nur die neuesten Nächte', () => {
    const dates = Array.from({ length: 20 }, (_, i) => `night:v8:2026-09-${String(i + 1).padStart(2, '0')}`);
    const s = fakeStorage(dates);
    pruneNights(s, 14);
    expect(keysOf(s)).toEqual(dates.slice(6));
  });
});

describe('arrangeNight', () => {
  let n = 0;
  /** Bewertetes Spiel; sehenswert ab 3 Balken wie in `rate` */
  const rg = (league: League, away: string, home: string, level: number, score = level * 20, sortKey = 0): RatedGame => {
    const t = (name: string) => ({ name, short: name, abbr: 'X', color: '#000000', score: 0 });
    const game: Game = { id: String(++n), league, start: '2026-10-14T01:00:00Z', state: 'post', season: 'regular', away: t(away), home: t(home) };
    return { game, rating: { rivalry: false, strong: false, historic: false, score, hot: level >= 3, level, reason: '', sortKey } };
  };
  /** NFL-Spiel ohne Bewertung */
  const nfl = (away: string, home: string): RatedGame => ({ ...rg('NFL', away, home, 0), rating: null });
  const fav = (league: League, match: string): Favorite => ({ league, match, label: match });
  const ids = (xs: RatedGame[]) => xs.map((g) => `${g.game.away.name}-${g.game.home.name}`);

  it('Spiel der Nacht ist das sehenswerte Spiel mit dem höchsten Spannungswert, nicht das mit den meisten Balken', () => {
    const a = rg('MLB', 'A', 'B', 5, 80);
    const b = rg('NBA', 'C', 'D', 4, 90);
    const night = arrangeNight({ games: [a, b] }, [], 'Alle', false);
    expect(night.hero).toBe(b);
    expect(night.tips).toEqual([a]);
  });

  it('ohne sehenswertes Spiel gibt es kein Spiel der Nacht', () => {
    const night = arrangeNight({ games: [rg('MLB', 'A', 'B', 2), rg('NBA', 'C', 'D', 1)] }, [], 'Alle', false);
    expect(night.hero).toBeNull();
    expect(night.tips).toEqual([]);
    expect(night.rest).toHaveLength(2);
  });

  it('höchstens 2 Top-Tipps nach Balken, die übrigen sehenswerten stehen zuerst unter „Weitere Spiele“', () => {
    const games = [rg('MLB', 'A', 'B', 3, 99), rg('MLB', 'C', 'D', 4), rg('MLB', 'E', 'F', 5, 70), rg('MLB', 'G', 'H', 3), rg('MLB', 'I', 'J', 1)];
    const night = arrangeNight({ games }, [], 'Alle', false);
    expect(ids([night.hero!])).toEqual(['A-B']);
    expect(ids(night.tips)).toEqual(['E-F', 'C-D']);
    expect(ids(night.rest)).toEqual(['G-H', 'I-J']);
  });

  it('bei gleichen Balken entscheidet der kleinere sortKey (Playoffs, Spannung)', () => {
    const games = [rg('MLB', 'X', 'Y', 5, 100), rg('NBA', 'A', 'B', 4, 50, 2), rg('NBA', 'C', 'D', 4, 50, 1)];
    expect(ids(arrangeNight({ games }, [], 'Alle', false).tips)).toEqual(['C-D', 'A-B']);
  });

  it('ist das Spiel der Nacht von einem Lieblingsteam, gibt es 3 Top-Tipps und es steht zusätzlich unter „Meine Teams“', () => {
    const hero = rg('MLB', 'Padres', 'Dodgers', 5, 100);
    const games = [hero, rg('MLB', 'A', 'B', 4), rg('MLB', 'C', 'D', 4), rg('MLB', 'E', 'F', 4), rg('MLB', 'G', 'H', 4)];
    const night = arrangeNight({ games }, [fav('MLB', 'Padres')], 'Alle', false);
    expect(night.hero).toBe(hero);
    expect(night.tips).toHaveLength(3);
    expect(night.rest).toHaveLength(1);
    expect(night.favs.map(({ item }) => item)).toEqual([hero]);
  });

  it('Lieblingsteams sind nie Top-Tipp oder unter „Weitere Spiele“, ohne Spiel bleibt ihr Eintrag leer', () => {
    const lakers = rg('NBA', 'Lakers', 'Celtics', 4, 50);
    const games = [rg('MLB', 'A', 'B', 5, 90), lakers, rg('NBA', 'Bulls', 'Heat', 1)];
    const night = arrangeNight({ games }, [fav('NBA', 'Lakers'), fav('NBA', 'Bulls'), fav('MLB', 'Padres')], 'Alle', false);
    expect(night.tips).toEqual([]);
    expect(ids(night.rest)).toEqual([]);
    expect(night.favs.map(({ fav: f, item }) => [f.match, item && ids([item])[0]])).toEqual([
      ['Lakers', 'Lakers-Celtics'], ['Bulls', 'Bulls-Heat'], ['Padres', undefined],
    ]);
  });

  it('die unbewertete NFL ist nie Spiel der Nacht, Top-Tipp oder sehenswert und steht ganz unten unter „Weitere Spiele“', () => {
    const packers = nfl('Packers', 'Bears');
    const night = arrangeNight({ games: [packers, rg('MLB', 'A', 'B', 3, 90), rg('MLB', 'C', 'D', 4), rg('MLB', 'E', 'F', 1)] }, [], 'Alle', false);
    expect(ids([night.hero!])).toEqual(['A-B']);
    expect(ids(night.tips)).toEqual(['C-D']);
    expect(ids(night.rest)).toEqual(['E-F', 'Packers-Bears']);
    expect(night.hot).toBe(2);
  });

  it('mit NFL-Filter gibt es weder Spiel der Nacht noch Top-Tipps, nur Lieblingsteams und „Weitere Spiele“', () => {
    const chiefs = nfl('Chiefs', 'Bills');
    const night = arrangeNight({ games: [nfl('Packers', 'Bears'), chiefs, rg('MLB', 'C', 'D', 5)] }, [fav('NFL', 'Chiefs')], 'NFL', false);
    expect(night.hero).toBeNull();
    expect(night.tips).toEqual([]);
    expect(night.favs.map(({ item }) => item)).toEqual([chiefs]);
    expect(ids(night.rest)).toEqual(['Packers-Bears']);
    expect(night.played).toBe(2);
    expect(night.hot).toBe(0);
  });

  it('„Sehenswert“ blendet auch NFL-Spiele aus, auch die von Lieblingsteams', () => {
    const night = arrangeNight({ games: [nfl('Chiefs', 'Bills'), nfl('Packers', 'Bears'), rg('MLB', 'A', 'B', 4)] }, [fav('NFL', 'Chiefs')], 'Alle', true);
    expect(night.favs).toEqual([]);
    expect(night.rest).toEqual([]);
  });

  it('der Ligafilter gilt für Spiele, Lieblingsteams, Kennzahlen und laufende Spiele', () => {
    const games = [rg('MLB', 'Padres', 'B', 4), rg('NBA', 'C', 'D', 5), rg('NBA', 'E', 'F', 2)];
    const night = arrangeNight({ games, pending: ['NBA', 'MLB', 'NBA'] }, [fav('MLB', 'Padres'), fav('NBA', 'Lakers')], 'NBA', false);
    expect(night.played).toBe(2);
    expect(night.hot).toBe(1);
    expect(night.pending).toBe(2);
    expect(night.favs.map(({ fav: f }) => f.match)).toEqual(['Lakers']);
  });

  it('„Sehenswert“ blendet alles Nicht-Sehenswerte aus, auch Lieblingsteams ohne Spiel', () => {
    const games = [rg('MLB', 'A', 'B', 5), rg('MLB', 'C', 'D', 4), rg('MLB', 'E', 'F', 4), rg('MLB', 'G', 'H', 4), rg('MLB', 'I', 'J', 2), rg('MLB', 'Padres', 'K', 1)];
    const night = arrangeNight({ games }, [fav('MLB', 'Padres'), fav('MLB', 'Athletics')], 'Alle', true);
    expect(night.favs).toEqual([]);
    expect(ids(night.rest)).toEqual(['G-H']);
    expect(night.played).toBe(6);
    expect(night.hot).toBe(4);
  });
});
