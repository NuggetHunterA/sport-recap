// Texte der Push-Benachrichtigungen (morgens und nachmittags). Ohne Ergebnisse, nur Balken.
import { favoriteOf } from './favorites';
import type { Favorite } from './favorites';
import { berlinTime, berlinToday, formatTime, tierOf } from './nights';
import type { RatedGame } from './nights';
import type { Game, Team } from './types';

export interface Message { title: string; body: string; url: string }

const bars = (level: number) => '▰'.repeat(level) + '▱'.repeat(5 - level);

/** Lieblingsteam zuerst, sonst Gast – Heim. */
function pairing(game: Game, favs: Favorite[]): string {
  const fav = favoriteOf(game, favs);
  const [a, b]: Team[] = fav && game.home.name.includes(fav.match) ? [game.home, game.away] : [game.away, game.home];
  return `${a.short} – ${b.short}`;
}

/** Morgens: alle Spiele der Lieblingsteams und ein Top-Tipp ohne Lieblingsteam und ohne NFL. */
export function morningMessage(games: RatedGame[], favs: Favorite[], url: string): Message {
  const hot = games.filter((g) => g.rating.hot);
  const isFav = (g: RatedGame) => favoriteOf(g.game, favs) !== null;
  const lines = favs
    .flatMap((f) => games.filter((g) => favoriteOf(g.game, [f])))
    .filter((g, i, all) => all.indexOf(g) === i)
    .map((g) => `${pairing(g.game, favs)} ${bars(g.rating.level)}`);
  const tip = hot
    .filter((g) => !isFav(g) && g.game.league !== 'NFL')
    .sort((a, b) => b.rating.level - a.rating.level || a.rating.sortKey - b.rating.sortKey)[0];
  lines.push(tip ? `Top-Tipp: ${pairing(tip.game, favs)} ${bars(tip.rating.level)}` : 'Kein Top-Tipp');
  return { title: `Letzte Nacht · ${hot.length} von ${games.length} sehenswert`, body: lines.join('\n'), url };
}

/** Nachmittags: Spiele der Lieblingsteams und höchstens ein Top-Matchup (ohne NFL), die heute vor 23 Uhr beginnen. */
export function afternoonMessage(games: Game[], favs: Favorite[], url: string, now = new Date()): Message | null {
  const until = berlinTime(berlinToday(now), 23).getTime();
  const soon = games
    .filter((g) => g.state === 'pre' && new Date(g.start).getTime() >= now.getTime() && new Date(g.start).getTime() < until)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const line = (g: Game) => `${pairing(g, favs)} · ${formatTime(g.start)}`;
  const lines = soon.filter((g) => favoriteOf(g, favs)).map(line);
  const top = soon.find((g) => g.league !== 'NFL' && tierOf(g, favs) === 'contender');
  if (top) lines.push(`Top-Matchup: ${line(top)}`);
  return lines.length ? { title: 'Heute Abend', body: lines.join('\n'), url } : null;
}
