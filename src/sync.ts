// Abgleich von Lieblingsteams und aufgedeckten Spielen über Supabase, nur mit Konto.
// Ohne Anmeldung bleibt alles wie bisher im Browser; der lokale Stand dient auch angemeldet als Zwischenspeicher.
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { Favorite } from './favorites';

// Öffentliche Werte (Zugriff regelt Row Level Security), per Umgebung überschreibbar
const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'https://towpmroicvnsbobktsfz.supabase.co';
const KEY = (import.meta.env.VITE_SUPABASE_KEY as string | undefined) ?? 'sb_publishable_-QgQ6wlQVClXnZlKveY0LA_hAscxxlI';

/** Benutzer, dessen Daten dieser Browser zuletzt übernommen hat. Fehlt er, wird beim Anmelden der lokale Stand hochgeladen. */
const SYNCED_KEY = 'sync:user';
/** Gesetzt, wenn eine Änderung nicht gespeichert werden konnte (offline); dann gewinnt beim nächsten Abgleich der lokale Stand. */
const DIRTY_KEY = 'sync:dirty';
/** So viele aufgedeckte Spiele werden geladen, wie lokal behalten werden. */
export const REVEALED_LIMIT = 500;

let client: Promise<SupabaseClient> | null = null;

export function supabase(): Promise<SupabaseClient> {
  client ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(URL, KEY));
  return client;
}

export interface SyncState {
  favorites: Favorite[];
  revealed: string[];
}

/**
 * Stand nach dem Abgleich.
 * - `first`: erste Anmeldung in diesem Browser. Lieblingsteams übernimmt der Server nur, wenn er noch keine hat.
 * - `dirty`: lokale Änderungen konnten nicht gespeichert werden; die lokalen Lieblingsteams gewinnen.
 * In beiden Fällen werden aufgedeckte Spiele vereinigt. Sonst ist der Server maßgeblich,
 * damit Entfernen auf einem Gerät auch auf dem anderen wirkt.
 */
export type MergeMode = 'first' | 'dirty' | 'normal';

export function merge(local: SyncState, remote: SyncState, mode: MergeMode): SyncState {
  if (mode === 'normal') return remote;
  return {
    favorites: mode === 'dirty' || !remote.favorites.length ? local.favorites : remote.favorites,
    revealed: [...new Set([...remote.revealed, ...local.revealed])].slice(-REVEALED_LIMIT),
  };
}

const sameFav = (a: Favorite, b: Favorite) => a.league === b.league && a.match === b.match;

/** Hinzugekommene und entfernte Lieblingsteams. */
export function diffFavorites(before: Favorite[], after: Favorite[]) {
  return {
    added: after.filter((f) => !before.some((b) => sameFav(b, f))),
    removed: before.filter((f) => !after.some((a) => sameFav(a, f))),
  };
}

function flag(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function setFlag(key: string, value: string | null) {
  try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* egal */ }
}

async function fetchRemote(db: SupabaseClient): Promise<SyncState> {
  const [favs, rev] = await Promise.all([
    db.from('favorites').select('league, match, label').order('created_at'),
    db.from('revealed').select('game_id').order('revealed_at', { ascending: false }).limit(REVEALED_LIMIT),
  ]);
  if (favs.error) throw favs.error;
  if (rev.error) throw rev.error;
  return {
    favorites: favs.data as Favorite[],
    revealed: rev.data.map((r) => r.game_id as string).reverse(),
  };
}

/** Schreibt den ganzen Stand: Lieblingsteams werden ersetzt, aufgedeckte Spiele ergänzt. */
async function pushAll(db: SupabaseClient, state: SyncState, userId: string) {
  const del = await db.from('favorites').delete().eq('user_id', userId);
  if (del.error) throw del.error;
  // Fortlaufende Zeitstempel erhalten die Reihenfolge
  const t = Date.now();
  if (state.favorites.length) {
    const ins = await db.from('favorites').insert(state.favorites.map((f, i) => ({
      league: f.league, match: f.match, label: f.label, created_at: new Date(t + i).toISOString(),
    })));
    if (ins.error) throw ins.error;
  }
  if (state.revealed.length) {
    const up = await db.from('revealed').upsert(state.revealed.map((game_id, i) => ({
      game_id, revealed_at: new Date(t - (state.revealed.length - i)).toISOString(),
    })), { ignoreDuplicates: true });
    if (up.error) throw up.error;
  }
}

/** Gleicht mit dem Server ab und liefert den neuen Stand. */
export async function pull(session: Session, local: SyncState): Promise<SyncState> {
  const db = await supabase();
  const mode: MergeMode = flag(SYNCED_KEY) !== session.user.id ? 'first' : flag(DIRTY_KEY) ? 'dirty' : 'normal';
  const remote = await fetchRemote(db);
  const next = merge(local, remote, mode);
  if (mode !== 'normal') {
    await pushAll(db, next, session.user.id);
    setFlag(SYNCED_KEY, session.user.id);
    setFlag(DIRTY_KEY, null);
  }
  return next;
}

/** Führt eine Änderung aus; schlägt sie fehl, holt der nächste Abgleich sie nach. */
async function write(run: (db: SupabaseClient) => PromiseLike<{ error: unknown }>[]) {
  try {
    const db = await supabase();
    const results = await Promise.all(run(db));
    if (results.some((r) => r.error)) throw new Error('Speichern fehlgeschlagen');
  } catch {
    setFlag(DIRTY_KEY, '1');
  }
}

export function saveFavoritesRemote(before: Favorite[], after: Favorite[]) {
  const { added, removed } = diffFavorites(before, after);
  return write((db) => [
    ...(added.length ? [db.from('favorites').upsert(added.map(({ league, match, label }) => ({ league, match, label })))] : []),
    ...removed.map((f) => db.from('favorites').delete().eq('league', f.league).eq('match', f.match)),
  ]);
}

export function saveRevealedRemote(id: string, open: boolean) {
  return write((db) => [open
    ? db.from('revealed').upsert({ game_id: id, revealed_at: new Date().toISOString() })
    : db.from('revealed').delete().eq('game_id', id)]);
}

/** Abmelden: lokaler Stand bleibt, der nächste Login lädt ihn wieder hoch. */
export async function signOut() {
  const db = await supabase();
  await db.auth.signOut();
  setFlag(SYNCED_KEY, null);
}
