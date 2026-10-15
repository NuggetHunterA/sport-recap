import { describe, expect, it } from 'vitest';
import { findMlbGame, findNbaGame, mlbTvUrl, nbaUrl, pickHighlight, pruneWatch, slimNbaSchedule, usDate } from './watch';
import type { Game, Team } from './types';
import type { Favorite } from './favorites';

const team = (name: string, short: string, abbr: string): Team => ({ name, short, abbr, color: '#000', score: 0 });

const mlb: Game = {
  id: '1', league: 'MLB', start: '2025-10-14T00:08Z', state: 'post', season: 'playoff',
  away: team('Los Angeles Dodgers', 'Dodgers', 'LAD'), home: team('Milwaukee Brewers', 'Brewers', 'MIL'),
};
const nba: Game = {
  id: '2', league: 'NBA', start: '2025-10-22T02:00Z', state: 'post', season: 'regular',
  away: team('Golden State Warriors', 'Warriors', 'GS'), home: team('Los Angeles Lakers', 'Lakers', 'LAL'),
};

const broadcasts = [
  { type: 'AM', homeAway: 'home', language: 'en', availableForStreaming: true, mediaId: 'radio' },
  { type: 'TV', homeAway: 'away', language: 'en', availableForStreaming: true, mediaId: 'away' },
  { type: 'TV', homeAway: 'home', language: 'es', availableForStreaming: true, mediaId: 'spanisch' },
  { type: 'TV', homeAway: 'home', language: 'en', availableForStreaming: true, mediaId: 'home' },
];
const mlbGame = (pk: number, date: string, away = 'Los Angeles Dodgers', home = 'Milwaukee Brewers') => ({
  gamePk: pk, gameDate: date,
  teams: { away: { team: { name: away } }, home: { team: { name: home } } },
  broadcasts,
});

describe('MLB.TV', () => {
  it('nimmt den Spieltag in Ostküstenzeit', () => {
    expect(usDate('2025-10-14T00:08Z')).toBe('2025-10-13');
  });

  it('findet das Spiel über die Teams, bei Doubleheadern das zeitlich nächste', () => {
    const schedule = { dates: [{ games: [
      mlbGame(1, '2025-10-13T17:00Z'),
      mlbGame(2, '2025-10-14T00:10Z'),
      mlbGame(3, '2025-10-14T00:10Z', 'Seattle Mariners', 'Toronto Blue Jays'),
    ] }] };
    expect(findMlbGame(schedule, mlb)?.gamePk).toBe(2);
    expect(findMlbGame({ dates: [] }, mlb)).toBeNull();
  });

  it('spielt den Heim-Feed, außer ein Lieblingsteam ist auswärts', () => {
    const g = mlbGame(7, '2025-10-14T00:10Z');
    expect(mlbTvUrl(g, mlb, [])).toBe('https://www.mlb.com/tv/g7/vhome');
    const dodgers: Favorite = { league: 'MLB', match: 'Dodgers', label: 'Dodgers' };
    expect(mlbTvUrl(g, mlb, [dodgers])).toBe('https://www.mlb.com/tv/g7/vaway');
  });

  it('nimmt in den Playoffs die nationale Übertragung, die gestreamt wird', () => {
    // NLCS 2026: FS1 gibt es für beide Seiten, gestreamt wird nur die Heim-Übertragung
    const playoff = { gamePk: 849811, broadcasts: [
      { type: 'TV', homeAway: 'away', language: 'en', isNational: true, availableForStreaming: false, mediaId: 'fs1-away' },
      { type: 'TV', homeAway: 'home', language: 'en', isNational: true, availableForStreaming: true, mediaId: 'fs1-home' },
      { type: 'AM', homeAway: 'home', language: 'en', availableForStreaming: true, mediaId: 'radio' },
    ] };
    const dodgers: Favorite = { league: 'MLB', match: 'Dodgers', label: 'Dodgers' };
    expect(mlbTvUrl(playoff, mlb, [dodgers])).toBe('https://www.mlb.com/tv/g849811/vfs1-home');
  });

  it('fällt ohne Übertragungen auf die Spielseite zurück', () => {
    expect(mlbTvUrl({ gamePk: 7 }, mlb, [])).toBe('https://www.mlb.com/tv/g7');
  });
});

describe('NBA League Pass', () => {
  const raw = { leagueSchedule: { gameDates: [{ games: [
    { gameId: '0022500001', gameDateTimeUTC: '2025-10-22T02:00:00Z', awayTeam: { teamName: 'Warriors', teamTricode: 'GSW' }, homeTeam: { teamName: 'Lakers', teamTricode: 'LAL' } },
    { gameId: '0022500099', gameDateTimeUTC: '2025-12-25T02:00:00Z', awayTeam: { teamName: 'Warriors', teamTricode: 'GSW' }, homeTeam: { teamName: 'Lakers', teamTricode: 'LAL' } },
    { gameId: '0012500007', gameDateTimeUTC: '2025-10-05T10:00:00Z', awayTeam: { teamName: 'Breakers', teamTricode: null }, homeTeam: { teamName: 'Pelicans', teamTricode: 'NOP' } },
  ] }] } };
  const games = slimNbaSchedule(raw);

  it('verkleinert den Spielplan und lässt Spiele ohne Kürzel weg', () => {
    expect(games).toEqual([
      { id: '0022500001', t: '2025-10-22T02:00:00Z', at: 'GSW', an: 'Warriors', ht: 'LAL', hn: 'Lakers' },
      { id: '0022500099', t: '2025-12-25T02:00:00Z', at: 'GSW', an: 'Warriors', ht: 'LAL', hn: 'Lakers' },
    ]);
  });

  it('findet das Spiel über Teams und Anwurf', () => {
    expect(findNbaGame(games, nba)?.id).toBe('0022500001');
    expect(findNbaGame(games, { ...nba, start: '2025-11-01T02:00Z' })).toBeNull();
  });

  it('baut den Link auf die Spielseite', () => {
    expect(nbaUrl(findNbaGame(games, nba)!)).toBe('https://www.nba.com/game/gsw-vs-lal-0022500001?watch');
  });
});

describe('YouTube-Highlights', () => {
  const video = (id: string, title: string) => ({ id: { videoId: id }, snippet: { title } });

  it('verlangt beide Teams und „Highlights“ im Titel und bevorzugt das ganze Spiel', () => {
    const items = [
      video('a', 'Stephen Curry 30 PTS vs Lakers | Highlights'),
      video('b', 'WARRIORS at LAKERS | FULL GAME HIGHLIGHTS | October 21, 2025'),
      video('c', 'Warriors vs Lakers postgame interview'),
    ];
    expect(pickHighlight(items, nba)).toBe('https://www.youtube.com/watch?v=b');
  });

  it('kennt abweichende Schreibweisen', () => {
    const dbacks: Game = { ...mlb, away: team('Arizona Diamondbacks', 'Diamondbacks', 'ARI') };
    expect(pickHighlight([video('x', 'D-backs vs. Brewers Game Highlights (10/13/25)')], dbacks)).toBe('https://www.youtube.com/watch?v=x');
  });

  it('liefert nichts ohne passendes Video', () => {
    expect(pickHighlight([video('a', 'Top 10 Plays of the Night')], nba)).toBeUndefined();
  });
});

describe('pruneWatch', () => {
  it('verwirft Links, die älter als zwei Wochen sind, und alte Versionen', () => {
    const store = new Map<string, string>([
      ['watch:v2:1', JSON.stringify({ full: 'x', at: 0 })],
      ['watch:v2:2', JSON.stringify({ full: 'y', at: 20 * 24 * 3600e3 })],
      ['watch:v1:3', JSON.stringify({ full: 'z', at: 20 * 24 * 3600e3 })],
      ['night:v3:x', '{}'],
    ]);
    const storage = {
      get length() { return store.size; },
      key: (i: number) => [...store.keys()][i] ?? null,
      getItem: (k: string) => store.get(k) ?? null,
      removeItem: (k: string) => { store.delete(k); },
    } as unknown as Storage;
    pruneWatch(storage, 21 * 24 * 3600e3);
    expect([...store.keys()]).toEqual(['watch:v2:2', 'night:v3:x']);
  });
});
