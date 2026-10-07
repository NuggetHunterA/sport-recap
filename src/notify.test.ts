import { describe, expect, it } from 'vitest';
import type { Favorite } from './favorites';
import type { RatedGame } from './nights';
import { afternoonMessage, morningMessage } from './notify';
import type { Game, League, Rating } from './types';

const favs: Favorite[] = [
  { league: 'MLB', match: 'Padres', label: 'Padres' },
  { league: 'NBA', match: 'Lakers', label: 'Lakers' },
];
let id = 0;
function game(league: League, away: string, home: string, extra: Partial<Game> = {}): Game {
  const t = (name: string) => ({ name, short: name.split(' ').pop()!, abbr: 'X', color: '#000000', score: 0 });
  return { id: String(++id), league, start: '2026-10-07T00:00:00Z', state: 'post', season: 'regular', away: t(away), home: t(home), ...extra };
}
const rated = (g: Game, level: number, sortKey = 1000): RatedGame =>
  ({ game: g, rating: { level, hot: level >= 3, sortKey } as Rating });

describe('Morgens', () => {
  it('Lieblingsteams zuerst mit Gegner und Balken, dann ein Top-Tipp ohne NFL', () => {
    const m = morningMessage([
      rated(game('MLB', 'Milwaukee Brewers', 'San Diego Padres'), 4),
      rated(game('NBA', 'Los Angeles Lakers', 'Golden State Warriors'), 2),
      rated(game('NFL', 'Kansas City Chiefs', 'Jacksonville Jaguars'), 5),
      rated(game('MLB', 'Atlanta Braves', 'Los Angeles Dodgers'), 4),
      rated(game('MLB', 'Boston Red Sox', 'New York Yankees'), 1),
    ], favs, 'u');
    expect(m.title).toBe('Letzte Nacht · 3 von 5 sehenswert');
    expect(m.body).toBe('Padres – Brewers ▰▰▰▰▱\nLakers – Warriors ▰▰▱▱▱\nTop-Tipp: Braves – Dodgers ▰▰▰▰▱');
  });
  it('Lieblingsteams ohne Spiel fehlen, ohne sehenswertes Spiel kein Top-Tipp', () => {
    const m = morningMessage([rated(game('NBA', 'Miami Heat', 'Orlando Magic'), 2)], favs, 'u');
    expect(m.body).toBe('Kein Top-Tipp');
  });
  it('Top-Tipp: meiste Balken vor Playoffs', () => {
    const m = morningMessage([
      rated(game('MLB', 'A Playoff', 'B Playoff'), 3, 40),
      rated(game('NBA', 'C Vier', 'D Vier'), 4, 1040),
    ], favs, 'u');
    expect(m.body).toBe('Top-Tipp: Vier – Vier ▰▰▰▰▱');
  });
});

describe('Nachmittags', () => {
  // 7. Oktober 2026, 15:00 in Berlin (Sommerzeit)
  const now = new Date('2026-10-07T13:00:00Z');
  const at = (utc: string) => ({ state: 'pre' as const, start: `2026-10-07T${utc}:00Z` });
  it('Lieblingsteams und ein Top-Matchup vor 23 Uhr', () => {
    const m = afternoonMessage([
      game('NBA', 'Chicago Bulls', 'Los Angeles Lakers', at('17:00')),
      game('MLB', 'Boston Red Sox', 'New York Yankees', { ...at('18:00'), season: 'playoff' }),
      game('MLB', 'Atlanta Braves', 'Los Angeles Dodgers', { ...at('19:00'), season: 'playoff' }),
      game('NFL', 'Detroit Lions', 'Buffalo Bills', { ...at('16:00'), season: 'playoff' }),
    ], favs, 'u', now);
    expect(m?.body).toBe('Lakers – Bulls · 19:00\nTop-Matchup: Sox – Yankees · 20:00');
  });
  it('Nichts vor 23 Uhr: keine Nachricht', () => {
    expect(afternoonMessage([game('NBA', 'Chicago Bulls', 'Los Angeles Lakers', at('21:30'))], favs, 'u', now)).toBeNull();
  });
});
