import { useMemo, useState } from 'preact/hooks';
import { FilterBar } from './App';
import { Badge, Icon } from './components';
import { matches } from './favorites';
import { setupPush } from './push';
import type { Favorite } from './favorites';
import type { LeagueFilter } from './types';
import { LEAGUES } from './types';
import { TEAMS } from './teams';
import type { TeamInfo } from './teams';
import type { Session } from '@supabase/supabase-js';
import { signOut, supabase } from './sync';

export function TeamsView({ favorites, setFavorites, session }: { favorites: Favorite[]; setFavorites: (f: Favorite[]) => void; session: Session | null }) {
  const [push, setPush] = useState<{ code?: string; error?: string }>({});
  const setup = async () => {
    try {
      const code = await setupPush(favorites);
      setPush({ code });
      await navigator.clipboard.writeText(code).catch(() => { /* Code steht im Feld */ });
    } catch (e) {
      setPush({ error: `Einrichtung fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}` });
    }
  };
  const [filter, setFilter] = useState<LeagueFilter>('Alle');
  const data = TEAMS;

  const isFav = (t: TeamInfo) => favorites.some((f) => f.league === t.league && matches(f, t.name));
  const toggle = (t: TeamInfo) => setFavorites(isFav(t)
    ? favorites.filter((f) => !(f.league === t.league && matches(f, t.name)))
    : [...favorites, { league: t.league, match: t.short, label: t.short }]);

  const groups = useMemo(() => LEAGUES
    .filter((l) => filter === 'Alle' || filter === l)
    .map((league) => ({ league, teams: data.filter((t) => t.league === league) }))
    .filter((g) => g.teams.length), [filter]);

  const selected = data.filter(isFav);

  return (
    <>
      <header class="head">
        <div class="head-row">
          <div class="date">Lieblingsteams</div>
          <div class="pill">{Icon.starFilled} {favorites.length} ausgewählt</div>
        </div>
        <h1>Meine<br /><span>Teams</span></h1>
        <p class="lead">Deine Teams stehen bei „Letzte Nacht“ und „Heute Abend“ immer ganz oben. {session ? 'Die Auswahl wird in deinem Konto gespeichert und auf allen Geräten abgeglichen.' : 'Die Auswahl wird auf diesem Gerät gespeichert.'}</p>
      </header>
      <FilterBar filter={filter} setFilter={setFilter} />
      <main>
        {selected.length > 0 && (
          <section class="section">
            <div class="section-head"><h2>Ausgewählt</h2><span class="count">{selected.length} Teams</span></div>
            <div class="chips">
              {selected.map((t) => (
                <button key={t.league + t.name} type="button" class="chip" onClick={() => toggle(t)} aria-label={`${t.name} entfernen`}>
                  <Badge team={t} size={26} /> {t.short} <span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
          </section>
        )}
        {groups.map(({ league, teams }) => (
          <section class="section" key={league}>
            <div class="section-head"><h2>{league}</h2><span class="count">{teams.length} Teams</span></div>
            <div class="team-list">
              {teams.map((t) => {
                const on = isFav(t);
                return (
                  <button key={t.name} type="button" class={`team-row${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggle(t)}>
                    <Badge team={t} size={36} />
                    <span class="team-name">{t.name}</span>
                    <span class="team-star">{on ? Icon.starFilled : Icon.star}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        <Account session={session} />
        <section class="section">
          <div class="section-head"><h2>Benachrichtigungen</h2></div>
          <p class="lead">Morgens um 8 Uhr deine Teams und ein Top-Tipp, nachmittags um 15 Uhr nur, wenn vor 23 Uhr etwas Wichtiges startet. Nie mit Ergebnis. Nach dem Einrichten den kopierten Code auf GitHub unter Settings → Secrets and variables → Actions als Secret <b>PUSH_CONFIG</b> speichern. Ändern sich deine Teams oder installierst du die App neu, den Code neu kopieren.</p>
          <button type="button" class="more" onClick={setup}>{push.code ? 'Code kopiert' : 'Benachrichtigungen einrichten'}</button>
          {push.code && <textarea class="push-code" readOnly value={push.code} onFocus={(e) => e.currentTarget.select()} />}
          {push.error && <div class="error">{push.error}</div>}
        </section>
      </main>
    </>
  );
}

/** Anmeldung per E-Mail und Passwort, damit Teams und aufgedeckte Spiele auf allen Geräten gleich sind. */
function Account({ session }: { session: Session | null }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);

  const run = (signUp: boolean) => async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      const db = await supabase();
      if (signUp) {
        const { data, error } = await db.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + import.meta.env.BASE_URL } });
        if (error) throw error;
        if (!data.session) setNote({ text: 'Fast fertig: Bestätige den Link in der E-Mail und melde dich dann hier an.' });
      } else {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      setPassword('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setNote({ error: true, text: /invalid login/i.test(msg) ? 'E-Mail oder Passwort stimmt nicht.'
        : /not confirmed/i.test(msg) ? 'Bitte zuerst den Link in der Bestätigungs-E-Mail öffnen.'
        : /already registered/i.test(msg) ? 'Für diese E-Mail gibt es schon ein Konto. Bitte anmelden.'
        : /password/i.test(msg) ? 'Das Passwort braucht mindestens 6 Zeichen.'
        : `Anmeldung fehlgeschlagen: ${msg}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section class="section">
      <div class="section-head"><h2>Konto</h2></div>
      {session ? (
        <>
          <p class="lead">Angemeldet als <b>{session.user.email}</b>. Lieblingsteams und aufgedeckte Spiele sind auf allen Geräten mit diesem Konto gleich.</p>
          <button type="button" class="more" onClick={() => signOut()}>Abmelden</button>
        </>
      ) : (
        <form class="account" onSubmit={run(false)}>
          <p class="lead">Melde dich an, damit Lieblingsteams und aufgedeckte Spiele auf Handy und PC gleich sind. Was du bisher auf diesem Gerät ausgewählt hast, wird beim ersten Anmelden übernommen.</p>
          <input type="email" autoComplete="email" placeholder="E-Mail" required value={email} onInput={(e) => setEmail(e.currentTarget.value)} />
          <input type="password" autoComplete="current-password" placeholder="Passwort" required minLength={6} value={password} onInput={(e) => setPassword(e.currentTarget.value)} />
          <div class="account-actions">
            <button type="submit" class="more primary" disabled={busy}>Anmelden</button>
            <button type="button" class="more" disabled={busy || !email || password.length < 6} onClick={run(true)}>Konto erstellen</button>
          </div>
        </form>
      )}
      {note && <div class={note.error ? 'error' : 'pending'}>{note.text}</div>}
    </section>
  );
}
