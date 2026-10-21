import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { FilterBar, GameCard, Hero, Icon, NoGameCard, Skeletons, UpcomingCard } from './components';
import { loadFavorites, saveFavorites } from './favorites';
import type { Favorite } from './favorites';
import { TIER_TITLES, addDays, arrangeNight, berlinToday, formatDay, formatTime, loadNight, loadUpcoming, prioritize } from './nights';
import type { Night, Tier } from './nights';
import { TeamsView } from './TeamsView';
import { StandingsView } from './StandingsView';
import { BoxSheet, canShowBox } from './BoxSheet';
import { PullToRefresh, Refresh, useLoad } from './refresh';
import type { RatedGame } from './nights';
import type { Game } from './types';
import type { League, LeagueFilter as Filter } from './types';
import { parseRoute, routeSearch, sameRoute } from './route';
import type { Route, Tab } from './route';
import type { Session } from '@supabase/supabase-js';
import { REVEALED_LIMIT, pull, saveFavoritesRemote, saveRevealedRemote, supabase } from './sync';

const REVEALED_KEY = 'revealed:v1';

function readRevealed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(REVEALED_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

function writeRevealed(ids: Set<string>) {
  try { localStorage.setItem(REVEALED_KEY, JSON.stringify([...ids].slice(-REVEALED_LIMIT))); } catch { /* egal */ }
}

export function App() {
  const [today, setToday] = useState(berlinToday);
  // Tab und Datum kommen aus der Adresse, z. B. ?tab=tonight aus der Nachmittags-Benachrichtigung
  const [route, setRoute] = useState<Route>(() => parseRoute(location.search, today));
  const { tab } = route;
  // Ohne Datum in der Adresse gilt immer die aktuelle Nacht, auch nach dem Datumswechsel
  const date = route.date ?? today;
  const go = (next: Route) => {
    if (sameRoute(next, route)) return;
    history.pushState({ route: true }, '', location.pathname + routeSearch(next, location.search) + location.hash);
    setRoute(next);
  };
  const setTab = (t: Tab) => go({ tab: t, date: t === 'night' ? route.date : null });
  const setDate = (d: string) => go({ tab: 'night', date: d < today ? d : null });
  // Zurück aus den Einstellungen: im Verlauf, wenn er aus der App kommt, sonst zu „Letzte Nacht“
  const leaveSettings = () => history.state?.route ? history.back() : go({ tab: 'night', date: null });

  useEffect(() => {
    // Adresse vereinheitlichen, z. B. ?tab=teams zu ?tab=settings
    history.replaceState(history.state, '', location.pathname + routeSearch(parseRoute(location.search, today), location.search) + location.hash);
    const onPop = () => {
      const next = parseRoute(location.search, berlinToday());
      setRoute((r) => sameRoute(r, next) ? r : next);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  // Jede Erhöhung lädt die sichtbare Ansicht neu
  const [stamp, setStamp] = useState(0);
  const [pulling, setPulling] = useState(false);
  const settled = useCallback(() => setPulling(false), []);

  // Zurück in der App: Datum neu bestimmen. Wer auf der aktuellen Nacht stand, springt zur neuen,
  // ein bewusst geöffnetes Archiv (Datum in der Adresse) bleibt stehen.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      setToday(berlinToday());
      setStamp((n) => n + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Ziehen nutzt wie alles andere den 5-Minuten-Zwischenspeicher in getJson
  const onPull = useCallback(() => {
    setPulling(true);
    setStamp((n) => n + 1);
  }, []);
  // Die Einstellungen laden nichts nach; dort und falls etwas hängt, endet die Anzeige von selbst
  useEffect(() => {
    if (!pulling) return;
    const t = setTimeout(() => setPulling(false), tab === 'settings' ? 600 : 15000);
    return () => clearTimeout(t);
  }, [pulling, tab]);
  // Ein Ligafilter für alle Tabs. „Tabellen“ kennt kein „Alle“ und zeigt dann die zuletzt gewählte Liga.
  const [filter, setFilterState] = useState<Filter>('Alle');
  const [lastLeague, setLastLeague] = useState<League>('MLB');
  const setFilter = (f: Filter) => {
    setFilterState(f);
    if (f !== 'Alle') setLastLeague(f);
  };
  const [revealed, setRevealed] = useState(readRevealed);
  const [favorites, setFavorites] = useState(loadFavorites);
  const [session, setSession] = useState<Session | null>(null);
  const updateFavorites = (next: Favorite[]) => {
    if (session) saveFavoritesRemote(favorites, next);
    setFavorites(next);
    saveFavorites(next);
  };

  const toggle = (id: string) => () => {
    const next = new Set(revealed);
    const open = !next.has(id);
    open ? next.add(id) : next.delete(id);
    setRevealed(next);
    writeRevealed(next);
    if (session) saveRevealedRemote(id, open);
  };

  // Anmeldung beobachten; Supabase wird erst nach dem ersten Bild nachgeladen
  useEffect(() => {
    let unsubscribe = () => {};
    let gone = false;
    supabase().then((db) => {
      if (gone) return;
      const { data } = db.auth.onAuthStateChange((_event, s) => setSession(s));
      unsubscribe = () => data.subscription.unsubscribe();
    }).catch(() => { /* offline: lokal weiter */ });
    return () => { gone = true; unsubscribe(); };
  }, []);

  // Abgleich nach dem Anmelden, beim Zurückkehren in die App und beim Ziehen
  const local = useRef({ favorites, revealed });
  local.current = { favorites, revealed };
  const userId = session?.user.id;
  useEffect(() => {
    if (!session) return;
    let gone = false;
    pull(session, { favorites: local.current.favorites, revealed: [...local.current.revealed] }).then((next) => {
      if (gone) return;
      setFavorites(next.favorites);
      saveFavorites(next.favorites);
      const ids = new Set(next.revealed);
      setRevealed(ids);
      writeRevealed(ids);
    }).catch(() => { /* offline: lokaler Stand bleibt */ });
    return () => { gone = true; };
  }, [userId, stamp]);

  return (
    <Refresh.Provider value={{ stamp, settled }}>
    <PullToRefresh onPull={onPull} busy={pulling}>
    <div class="app">
      <div class="glow" aria-hidden="true" />
      {tab === 'night' && <NightView date={date} today={today} setDate={setDate} filter={filter} setFilter={setFilter} revealed={revealed} toggle={toggle} favorites={favorites} />}
      {tab === 'tonight' && <TonightView filter={filter} setFilter={setFilter} favorites={favorites} />}
      {tab === 'standings' && <StandingsView league={filter === 'Alle' ? lastLeague : filter} setLeague={setFilter} favorites={favorites} />}
      {tab === 'settings' && <TeamsView favorites={favorites} setFavorites={updateFavorites} session={session} filter={filter} setFilter={setFilter} onBack={leaveSettings} />}
      {tab !== 'settings' && (
        <button type="button" class="gear" aria-label="Einstellungen" onClick={() => setTab('settings')}>{Icon.gear}</button>
      )}
      <nav class="nav" aria-label="Hauptmenü">
        <button type="button" aria-current={tab === 'night' ? 'page' : undefined} onClick={() => setTab('night')}>{Icon.moon} Letzte Nacht</button>
        <button type="button" aria-current={tab === 'tonight' ? 'page' : undefined} onClick={() => setTab('tonight')}>{Icon.clock} Heute Abend</button>
        <button type="button" aria-current={tab === 'standings' ? 'page' : undefined} onClick={() => setTab('standings')}>{Icon.standings} Tabellen</button>
      </nav>
    </div>
    </PullToRefresh>
    </Refresh.Provider>
  );
}

function NightView(props: {
  date: string; today: string; setDate: (d: string) => void;
  filter: Filter; setFilter: (f: Filter) => void;
  revealed: Set<string>; toggle: (id: string) => () => void; favorites: Favorite[];
}) {
  const { date, today, setDate, filter, setFilter, revealed, toggle, favorites } = props;
  const card = <T extends RatedGame>(item: T) => ({
    item,
    open: revealed.has(item.game.id),
    toggle: toggle(item.game.id),
    onBox: canShowBox(item.game) ? () => setBox(item.game) : undefined,
  });
  const [box, setBox] = useState<Game | null>(null);
  const { data, error, loading } = useLoad<Night>(() => loadNight(date), [date]);
  const [showRest, setShowRest] = useState(false);
  useEffect(() => setShowRest(false), [date]);
  // Tipp auf „Sehenswert“ blendet alle übrigen Spiele aus
  const [hotOnly, setHotOnly] = useState(false);

  const view = useMemo(() => arrangeNight(data ?? { games: [] }, favorites, filter, hotOnly), [data, filter, favorites, hotOnly]);

  const isToday = date === today;
  return (
    <>
      <header class="head">
        <div class="head-row">
          <div class="date">
            <button type="button" class="step" aria-label="Nacht davor" onClick={() => setDate(addDays(date, -1))}>{Icon.left}</button>
            {formatDay(date)}
            <button type="button" class="step" aria-label="Nacht danach" disabled={isToday} onClick={() => setDate(addDays(date, 1))}>{Icon.right}</button>
          </div>
          <div class="pill">{Icon.shield} Spoilerfrei</div>
        </div>
        <h1>{isToday ? <>Letzte <span>Nacht</span></> : <>Archiv <span>{formatDay(date).split(',')[0].replace('.', '')}</span></>}</h1>
        <div class="stats">
          <div class="stat"><b>{loading ? '–' : view.played}</b><small>Spiele</small></div>
          <button type="button" class="stat" aria-pressed={hotOnly} aria-label="Nur sehenswerte Spiele zeigen" onClick={() => setHotOnly(!hotOnly)}>
            <b class="hot">{loading ? '–' : view.hot}</b><small>Sehenswert</small>
          </button>
        </div>
      </header>
      <FilterBar filter={filter} setFilter={setFilter} />
      <main>
        {loading && <Skeletons />}
        {error && <div class="error">Die Ergebnisse konnten nicht geladen werden ({error}).</div>}
        {data && data.failed.length > 0 && <div class="error">Keine Daten für: {data.failed.join(', ')}</div>}
        {data && !loading && (
          <>
            {view.pending > 0 && (
              <div class="pending">{Icon.clock} {view.pending === 1
                ? 'Ein Spiel läuft noch und erscheint, sobald es beendet ist.'
                : `${view.pending} Spiele laufen noch und erscheinen, sobald sie beendet sind.`}</div>
            )}
            {view.hero && <Hero {...card(view.hero)} />}
            {view.favs.length > 0 && (
              <section class="section">
                <div class="section-head"><h2>Meine Teams</h2><span class="count">{view.favs.length} Teams</span></div>
                {view.favs.map(({ fav, item }) => item && <GameCard key={fav.label} {...card(item)} />)}
                {view.favs.some(({ item }) => !item) && (
                  <NoGameCard favs={view.favs.filter(({ item }) => !item).map(({ fav }) => fav)} />
                )}
              </section>
            )}
            {view.tips.length > 0 && (
              <section class="section">
                <div class="section-head"><h2>Top-Tipps</h2><span class="count">{view.tips.length} sehenswert</span></div>
                {view.tips.map((item) => <GameCard key={item.game.id} {...card(item)} />)}
              </section>
            )}
            {view.rest.length > 0 && (
              <section class="section">
                <div class="section-head"><h2>Weitere Spiele</h2><span class="count">{view.rest.length} {view.rest.length === 1 ? 'Spiel' : 'Spiele'}</span></div>
                {showRest
                  ? view.rest.map((item) => <GameCard key={item.game.id} {...card(item)} />)
                  : <button type="button" class="more" onClick={() => setShowRest(true)}>{view.rest.length} weitere Spiele anzeigen</button>}
              </section>
            )}
            {view.played === 0 && view.pending === 0 && <div class="empty">{data.games.length ? 'In dieser Liga gab es keine Spiele.' : 'In dieser Nacht gab es keine Spiele.'}</div>}
            {hotOnly && view.played > 0 && view.hot === 0 && <div class="empty">Keine sehenswerten Spiele in dieser Nacht.</div>}
          </>
        )}
      </main>
      {box && <BoxSheet game={box} onClose={() => setBox(null)} />}
    </>
  );
}

function TonightView({ filter, setFilter, favorites }: { filter: Filter; setFilter: (f: Filter) => void; favorites: Favorite[] }) {
  const { data, error, loading } = useLoad<{ games: Game[]; failed: string[] }>(() => loadUpcoming(), []);
  const all = useMemo(() => prioritize(data?.games ?? [], favorites), [data, favorites]);
  // Kennzahlen und Gruppen folgen dem Ligafilter; laufende Spiele stehen getrennt oben
  const inFilter = useMemo(() => all.filter((u) => filter === 'Alle' || u.game.league === filter), [all, filter]);
  const live = inFilter.filter((u) => u.game.state === 'in');
  const shown = useMemo(() => inFilter.filter((u) => u.game.state === 'pre'), [inFilter]);
  const groups = useMemo(() => {
    const order: Tier[] = ['favorite', 'contender', 'rivalry', 'other'];
    return order.map((tier) => ({ tier, items: shown.filter((u) => u.tier === tier) })).filter((g) => g.items.length);
  }, [shown]);
  const total = shown.length;
  const highlights = shown.filter((u) => u.tier !== 'other').length;
  // loadUpcoming liefert die Spiele nach Uhrzeit sortiert
  const first = data?.games.find((g) => g.state === 'pre' && (filter === 'Alle' || g.league === filter));

  return (
    <>
      <header class="head">
        <div class="head-row">
          <div class="date">Nächste 24 Stunden</div>
          <div class="pill">{Icon.clock} Deutsche Zeit</div>
        </div>
        <h1>Heute <span>Abend</span></h1>
        <div class="stats">
          <div class="stat"><b>{loading ? '–' : total}</b><small>Spiele</small></div>
          <div class="stat"><b class="hot">{loading ? '–' : highlights}</b><small>Highlights</small></div>
          <div class="stat"><b>{loading || !first ? '–' : formatTime(first.start)}</b><small>Beginn</small></div>
        </div>
      </header>
      <FilterBar filter={filter} setFilter={setFilter} />
      <main>
        {loading && <Skeletons />}
        {error && <div class="error">Der Spielplan konnte nicht geladen werden ({error}).</div>}
        {data && data.failed.length > 0 && <div class="error">Keine Daten für: {data.failed.join(', ')}</div>}
        {live.length > 0 && (
          <section class="section">
            <div class="section-head"><h2>Läuft gerade</h2><span class="count">{live.length} {live.length === 1 ? 'Spiel' : 'Spiele'}</span></div>
            {live.map((u) => <UpcomingCard key={u.game.id} item={u} />)}
          </section>
        )}
        {groups.map(({ tier, items }) => (
          <section class="section" key={tier}>
            <div class="section-head"><h2>{TIER_TITLES[tier]}</h2><span class="count">{items.length} {items.length === 1 ? 'Spiel' : 'Spiele'}</span></div>
            {items.map((u) => <UpcomingCard key={u.game.id} item={u} />)}
          </section>
        ))}
        {data && !loading && groups.length === 0 && live.length === 0 && <div class="empty">In den nächsten 24 Stunden stehen keine Spiele an.</div>}
      </main>
    </>
  );
}
