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
  /** Warum der Link zum ganzen Spiel fehlt, z. B. „nba.com nicht erreichbar“ */
  problem?: string;
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

/**
 * Video-Übertragung mit Stream: die des Heimteams, außer ein Lieblingsteam spielt auswärts.
 * In den Playoffs gibt es nur nationale Sender (FOX, TBS), dort zählt dieselbe Seite.
 * Ohne passende Übertragung die Spielseite von MLB.TV.
 */
export function mlbTvUrl(mlbGame: any, game: Game, favs: Favorite[]): string {
  const tv: any[] = (mlbGame?.broadcasts ?? []).filter((b: any) => b.type === 'TV' && b.mediaId);
  const fav = favoriteOf(game, favs);
  const wanted = fav && game.away.name.includes(fav.match) && !game.home.name.includes(fav.match) ? 'away' : 'home';
  const streams = tv.filter((b) => b.availableForStreaming);
  const english = (list: any[]) => list.filter((b) => !b.language || b.language === 'en');
  const feed = english(streams).find((b) => b.homeAway === wanted)
    ?? english(streams)[0]
    ?? streams[0]
    ?? tv.find((b) => b.homeAway === wanted);
  const base = `https://www.mlb.com/tv/g${mlbGame.gamePk}`;
  return feed ? `${base}/v${feed.mediaId}` : base;
}

async function mlbFull(game: Game): Promise<string | undefined> {
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${usDate(game.start)}&hydrate=broadcasts(all)`;
  const mlbGame = findMlbGame(await getJson(url, game.state === 'in' ? 5 * 60 * 1000 : 12 * HOUR), game);
  return mlbGame ? mlbTvUrl(mlbGame, game, loadFavorites()) : undefined;
}

/* ---------- NBA League Pass ---------- */

/** Ein Spiel aus dem verkleinerten NBA-Spielplan */
export interface NbaGame {
  id: string;
  /** Anwurf, ISO in UTC */
  t: string;
  /** Kürzel und Spitzname von Auswärts- und Heimteam, z. B. "GSW", "Warriors" */
  at: string; an: string;
  ht: string; hn: string;
}

/**
 * Verkleinert den Saisonspielplan von nba.com auf das, was die App braucht. Läuft beim Build
 * (`scripts/nba-schedule.ts`), weil nba.com den Abruf direkt aus dem Browser sperrt.
 */
export function slimNbaSchedule(schedule: any): NbaGame[] {
  const out: NbaGame[] = [];
  for (const day of schedule?.leagueSchedule?.gameDates ?? []) {
    for (const g of day.games ?? []) {
      if (!g.gameId || !g.awayTeam?.teamTricode || !g.homeTeam?.teamTricode) continue;
      out.push({
        id: g.gameId, t: g.gameDateTimeUTC,
        at: g.awayTeam.teamTricode, an: g.awayTeam.teamName ?? '',
        ht: g.homeTeam.teamTricode, hn: g.homeTeam.teamName ?? '',
      });
    }
  }
  return out;
}

/** Passendes Spiel: gleiche Teams, Anwurf höchstens drei Stunden daneben. */
export function findNbaGame(games: NbaGame[], game: Game): NbaGame | null {
  const start = Date.parse(game.start);
  return games.find((g) => g.an === game.away.short && g.hn === game.home.short
    && Math.abs(Date.parse(g.t) - start) < 3 * HOUR) ?? null;
}

/** Spielseite auf nba.com, `?watch` öffnet dort den Player. */
export function nbaUrl(g: NbaGame): string {
  return `https://www.nba.com/game/${`${g.at}-vs-${g.ht}-${g.id}`.toLowerCase()}?watch`;
}

async function nbaFull(game: Game): Promise<string | undefined> {
  const games: NbaGame[] = await getJson(`${import.meta.env.BASE_URL}nba-schedule.json`, 12 * HOUR);
  const nbaGame = findNbaGame(games, game);
  return nbaGame ? nbaUrl(nbaGame) : undefined;
}

/** Link zum ganzen Spiel (live oder als Aufzeichnung), sonst der Grund, warum er fehlt. */
type FullGame = { url?: string; problem?: string };

async function fullGame(game: Game): Promise<FullGame> {
  if (!canWatch(game)) return {};
  const source = game.league === 'MLB' ? 'MLB-Spielplan' : 'nba.com-Spielplan';
  try {
    const url = await (game.league === 'MLB' ? mlbFull(game) : nbaFull(game));
    return url ? { url } : { problem: `Spiel nicht im ${source} gefunden` };
  } catch {
    return { problem: `${source} nicht erreichbar` };
  }
}

export async function fullGameLink(game: Game): Promise<string | undefined> {
  return (await fullGame(game)).url;
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

// v2: v1 merkte sich bei Playoff-Spielen Links ohne Feed
const CACHE = 'watch:v2:';

/** Gemerkte Links nach zwei Wochen verwerfen */
export function pruneWatch(storage: Storage = localStorage, now = Date.now()): void {
  try {
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((k): k is string => !!k?.startsWith('watch:'));
    for (const k of keys) {
      const at = k.startsWith(CACHE) ? JSON.parse(storage.getItem(k) ?? '{}').at : undefined;
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
    known.full ? Promise.resolve<FullGame>({ url: known.full }) : fullGame(game),
  ]);
  const found: WatchLinks = { ...(hl ? { highlights: hl } : {}), ...(full.url ? { full: full.url } : {}) };
  try {
    if (found.highlights || found.full) localStorage.setItem(CACHE + game.id, JSON.stringify({ ...found, at: Date.now() }));
  } catch { /* gesperrt */ }
  return full.problem ? { ...found, problem: full.problem } : found;
}
