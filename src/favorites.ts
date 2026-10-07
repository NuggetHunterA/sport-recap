// Lieblingsteams: in der App auswählbar, gespeichert im Browser.
import { FAVORITES } from './config';
import type { Game, League } from './types';

export interface Favorite {
  league: League;
  /** Text, der im ESPN-Teamnamen vorkommen muss (bei Auswahl in der App der volle Name). */
  match: string;
  /** Anzeigename, z. B. „Padres“ */
  label: string;
}

const KEY = 'favorites:v1';

export function loadFavorites(): Favorite[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* Standard verwenden */ }
  return FAVORITES;
}

export function saveFavorites(favs: Favorite[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(favs)); } catch { /* gesperrt */ }
}

export function matches(fav: Favorite, teamName: string): boolean {
  return teamName.includes(fav.match);
}

export function favoriteOf(game: Game, favs: Favorite[]): Favorite | null {
  return favs.find((f) => f.league === game.league
    && (matches(f, game.away.name) || matches(f, game.home.name))) ?? null;
}
