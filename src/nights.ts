// Zeitfenster („letzte Nacht“, „heute Abend“) und Priorisierung.
import { CONTENDER_MIN_GAMES, CONTENDER_WIN_PCT, FAVORITES } from './config';
import { scoreboards, withPlays } from './espn';
import { isRivalry, rate } from './rating';
import type { Game, Rating } from './types';

export const TZ = 'Europe/Berlin';

/** Heutiges Datum in Berlin als YYYY-MM-DD. */
export function berlinToday(now = new Date()): string {
  return now.toLocaleDateString('sv-SE', { timeZone: TZ });
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** UTC-Zeitpunkt für eine Berliner Uhrzeit an einem Datum. */
export function berlinTime(date: string, hour: number): Date {
  const guess = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00Z`);
  const local = new Date(guess.toLocaleString('en-US', { timeZone: TZ }));
  const utc = new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(guess.getTime() - (local.getTime() - utc.getTime()));
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
}

export function formatDay(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('de-DE', {
    timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short',
  });
}

export function favoriteOf(game: Game): string | null {
  const f = FAVORITES.find((f) => f.league === game.league
    && (game.away.name.includes(f.match) || game.home.name.includes(f.match)));
  return f ? f.label : null;
}

export interface RatedGame { game: Game; rating: Rating; favorite: string | null }

export interface Night {
  date: string;
  games: RatedGame[];
  failed: string[];
}

const cacheKey = (date: string) => `night:v1:${date}`;

/**
 * Beendete Spiele der Nacht vor `date`: Start zwischen Vortag 12:00 und `date` 12:00 Berliner Zeit.
 * In US-Zeit ist das der ESPN-Spieltag `date - 1`.
 */
export async function loadNight(date: string, now = new Date()): Promise<Night> {
  try {
    const cached = localStorage.getItem(cacheKey(date));
    if (cached) return JSON.parse(cached);
  } catch { /* kein Cache verfügbar */ }

  const from = berlinTime(addDays(date, -1), 12).getTime();
  const to = Math.min(berlinTime(date, 12).getTime(), now.getTime());
  const { games, failed } = await scoreboards([addDays(date, -1), date]);
  const inWindow = games.filter((g) => {
    const t = new Date(g.start).getTime();
    return t >= from && t < to;
  });
  const finished = await Promise.all(inWindow.filter((g) => g.state === 'post').map(withPlays));
  const night: Night = {
    date,
    games: finished.map((game) => ({ game, rating: rate(game), favorite: favoriteOf(game) })),
    failed,
  };

  // Abgeschlossene Nächte ändern sich nicht mehr
  const complete = to === berlinTime(date, 12).getTime() && inWindow.every((g) => g.state === 'post');
  if (complete && failed.length === 0) {
    try { localStorage.setItem(cacheKey(date), JSON.stringify(night)); } catch { /* voll oder gesperrt */ }
  }
  return night;
}

export type Tier = 'favorite' | 'contender' | 'rivalry' | 'other';

export const TIER_TITLES: Record<Tier, string> = {
  favorite: 'Meine Teams',
  contender: 'Top-Matchups',
  rivalry: 'Rivalitäten',
  other: 'Weitere Spiele',
};

function winPct(record?: string): number | null {
  const parts = (record ?? '').split('-').map((n) => parseInt(n, 10));
  if (parts.length < 2 || parts.some(isNaN)) return null;
  const [w, l, t = 0] = parts;
  const games = w + l + t;
  return games >= CONTENDER_MIN_GAMES ? (w + t / 2) / games : null;
}

export function isContenderMatchup(game: Game): boolean {
  if (game.season === 'playoff') return true;
  const a = winPct(game.away.record);
  const b = winPct(game.home.record);
  return a !== null && b !== null && a >= CONTENDER_WIN_PCT && b >= CONTENDER_WIN_PCT;
}

export function tierOf(game: Game): Tier {
  if (favoriteOf(game)) return 'favorite';
  if (isContenderMatchup(game)) return 'contender';
  if (isRivalry(game.league, game.away.name, game.home.name)) return 'rivalry';
  return 'other';
}

export interface Upcoming { game: Game; tier: Tier; favorite: string | null }

/** Alle Spiele, die in den nächsten 24 Stunden beginnen, nach Interesse und Uhrzeit sortiert. */
export async function loadUpcoming(now = new Date()): Promise<{ games: Upcoming[]; failed: string[] }> {
  const today = berlinToday(now);
  const { games, failed } = await scoreboards([addDays(today, -1), today, addDays(today, 1)]);
  const until = now.getTime() + 24 * 3600 * 1000;
  const order: Tier[] = ['favorite', 'contender', 'rivalry', 'other'];
  const list = games
    .filter((g) => g.state === 'pre')
    .filter((g) => {
      const t = new Date(g.start).getTime();
      return t >= now.getTime() - 15 * 60 * 1000 && t <= until;
    })
    .map((game) => ({ game, tier: tierOf(game), favorite: favoriteOf(game) }))
    .sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier)
      || new Date(a.game.start).getTime() - new Date(b.game.start).getTime());
  return { games: list, failed };
}
