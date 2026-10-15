// Links zum Anschauen: Highlights auf YouTube (@NBA, @MLB) und das ganze Spiel bei MLB.TV oder NBA League Pass.
// ESPN kennt die IDs dieser Dienste nicht, darum ordnen wir das Spiel über Datum und Teams zu.
import { getJson } from './espn';
import { favoriteOf, loadFavorites } from './favorites';
import type { Favorite } from './favorites';
import type { Game } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */

const HOUR = 60 * 60 * 1000;

export type WatchLeague = 'MLB' | 'NBA';

export function canWatch(game: Game): game is Game & { league: WatchLeague } {
  return game.league === 'MLB' || game.league === 'NBA';
}

export function serviceName(game: Game): string {
  return game.league === 'NBA' ? 'League Pass' : 'MLB.TV';
}

export interface WatchLinks {
  highlights?: string;
  full?: string;
}

/* ---------- MLB.TV ---------- */

/** Spieltag in US-Ostküstenzeit, so wie die MLB-API ihn erwartet */
export function usDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(iso));
}

const sameTeam = (name: string, espnName: string, espnShort: string) =>
  name === espnName || name.endsWith(` ${espnShort}`) || name === espnShort;

/** Passendes Spiel aus dem MLB-Spielplan, bei Doubleheadern das zeitlich nächste. */
export function findMlbGame(schedule: any, game: Game): any | null {
  const games: any[] = (schedule?.dates ?? []).flatMap((d: any) => d.games ?? []);
  const start = Date.parse(game.start);
  return games
    .filter((g) => sameTeam(g.teams?.away?.team?.name ?? '', game.away.name, game.away.short)
      && sameTeam(g.teams?.home?.team?.name ?? '', game.home.name, game.home.short))
    .sort((a, b) => Math.abs(Date.parse(a.gameDate) - start) - Math.abs(Date.parse(b.gameDate) - start))[0] ?? null;
}

/** Heim-Feed, außer ein Lieblingsteam spielt auswärts. Ohne Feed die Spielseite von MLB.TV. */
export function mlbTvUrl(mlbGame: any, game: Game, favs: Favorite[]): string {
  const epg: any[] = mlbGame?.content?.media?.epg ?? [];
  const feeds: any[] = epg.find((e) => e.title === 'MLBTV')?.items ?? [];
  const fav = favoriteOf(game, favs);
  const wanted = fav && game.away.name.includes(fav.match) && !game.home.name.includes(fav.match) ? 'AWAY' : 'HOME';
  const feed = feeds.find((f) => f.mediaFeedType === wanted)
    ?? feeds.find((f) => f.mediaFeedType === 'NATIONAL')
    ?? feeds[0];
  const base = `https://www.mlb.com/tv/g${mlbGame.gamePk}`;
  return feed?.mediaId ? `${base}/v${feed.mediaId}` : base;
}

async function mlbFull(game: Game): Promise<string | undefined> {
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${usDate(game.start)}&hydrate=game(content(media(epg)))`;
  const mlbGame = findMlbGame(await getJson(url, game.state === 'in' ? 5 * 60 * 1000 : 12 * HOUR), game);
  return mlbGame ? mlbTvUrl(mlbGame, game, loadFavorites()) : undefined;
}

/* ---------- NBA League Pass ---------- */

/** Passendes Spiel aus dem NBA-Spielplan: gleiche Teams, Anwurf höchstens drei Stunden daneben. */
export function findNbaGame(schedule: any, game: Game): any | null {
  const start = Date.parse(game.start);
  for (const day of schedule?.leagueSchedule?.gameDates ?? []) {
    for (const g of day.games ?? []) {
      if (g.awayTeam?.teamName === game.away.short && g.homeTeam?.teamName === game.home.short
        && Math.abs(Date.parse(g.gameDateTimeUTC) - start) < 3 * HOUR) return g;
    }
  }
  return null;
}

/** Spielseite auf nba.com, `?watch` öffnet dort den Player. */
export function nbaUrl(nbaGame: any): string {
  const slug = `${nbaGame.awayTeam.teamTricode}-vs-${nbaGame.homeTeam.teamTricode}-${nbaGame.gameId}`.toLowerCase();
  return `https://www.nba.com/game/${slug}?watch`;
}

async function nbaFull(game: Game): Promise<string | undefined> {
  const schedule = await getJson('https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json', 12 * HOUR);
  const nbaGame = findNbaGame(schedule, game);
  return nbaGame ? nbaUrl(nbaGame) : undefined;
}

/** Link zum ganzen Spiel (live oder als Aufzeichnung), falls das Spiel zugeordnet werden kann. */
export function fullGameLink(game: Game): Promise<string | undefined> {
  if (!canWatch(game)) return Promise.resolve(undefined);
  return (game.league === 'MLB' ? mlbFull(game) : nbaFull(game)).catch(() => undefined);
}

/* ---------- YouTube ---------- */

const CHANNELS: Record<WatchLeague, string> = {
  NBA: 'UCWJ2lWNubArHWmf3FIHbfcQ',
  MLB: 'UCoLrcjPV5PbUrUyXq5mjc_A',
};

/** Schreibweisen in Videotiteln, die vom ESPN-Kurznamen abweichen */
const ALIASES: Record<string, string[]> = {
  Diamondbacks: ['d-backs', 'dbacks'],
  'Trail Blazers': ['blazers'],
};

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function names(short: string): string[] {
  return [norm(short), ...(ALIASES[short] ?? [])];
}

/** Bestes Highlight-Video: beide Teams im Titel, Zusammenfassungen des ganzen Spiels zuerst. */
export function pickHighlight(items: any[], game: Game): string | undefined {
  const fits = items.filter((it) => {
    const title = norm(it?.snippet?.title ?? '');
    return title.includes('highlight')
      && names(game.away.short).some((n) => title.includes(n))
      && names(game.home.short).some((n) => title.includes(n));
  });
  const score = (it: any) => /game highlights/.test(norm(it.snippet.title)) ? 0 : 1;
  const best = fits.sort((a, b) => score(a) - score(b))[0];
  const id = best?.id?.videoId;
  return id ? `https://www.youtube.com/watch?v=${id}` : undefined;
}

async function highlights(game: Game): Promise<string | undefined> {
  const key = import.meta.env.VITE_YT_KEY as string | undefined;
  if (!key || !canWatch(game) || game.state !== 'post') return undefined;
  const start = Date.parse(game.start);
  // Fenster bis 20 Stunden nach Anwurf, damit bei Serien nicht das nächste Spiel derselben Teams erwischt wird
  const params = new URLSearchParams({
    part: 'snippet',
    channelId: CHANNELS[game.league],
    q: `${game.away.short} ${game.home.short} highlights`,
    type: 'video',
    maxResults: '10',
    publishedAfter: new Date(start).toISOString(),
    publishedBefore: new Date(start + 20 * HOUR).toISOString(),
    key,
  });
  const data = await getJson(`https://www.googleapis.com/youtube/v3/search?${params}`, 30 * 60 * 1000);
  return pickHighlight(data?.items ?? [], game);
}

/* ---------- Beide Links, gefundene im Browser gemerkt ---------- */

const CACHE = 'watch:v1:';

/** Gemerkte Links nach zwei Wochen verwerfen */
export function pruneWatch(storage: Storage = localStorage, now = Date.now()): void {
  try {
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((k): k is string => !!k?.startsWith(CACHE));
    for (const k of keys) {
      const at = JSON.parse(storage.getItem(k) ?? '{}').at;
      if (typeof at !== 'number' || now - at > 14 * 24 * HOUR) storage.removeItem(k);
    }
  } catch { /* kein Speicher verfügbar */ }
}

function cached(game: Game): WatchLinks {
  try { return JSON.parse(localStorage.getItem(CACHE + game.id) ?? '{}'); } catch { return {}; }
}

/** Links für ein beendetes Spiel. Nur Treffer werden gemerkt, Fehlendes wird beim nächsten Öffnen erneut gesucht. */
export async function loadWatchLinks(game: Game): Promise<WatchLinks> {
  const known = cached(game);
  const [hl, full] = await Promise.all([
    known.highlights ? Promise.resolve(known.highlights) : highlights(game).catch(() => undefined),
    known.full ? Promise.resolve(known.full) : fullGameLink(game),
  ]);
  const links: WatchLinks = { ...(hl ? { highlights: hl } : {}), ...(full ? { full } : {}) };
  try {
    if (links.highlights || links.full) localStorage.setItem(CACHE + game.id, JSON.stringify({ ...links, at: Date.now() }));
  } catch { /* gesperrt */ }
  return links;
}
