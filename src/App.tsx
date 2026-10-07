import { useEffect, useMemo, useState } from 'preact/hooks';
import { GameCard, Hero, Icon, NoGameCard, Skeletons, UpcomingCard } from './components';
import { favoriteOf, loadFavorites, saveFavorites } from './favorites';
import type { Favorite } from './favorites';
import { TIER_TITLES, addDays, berlinToday, formatDay, loadNight, loadUpcoming, prioritize } from './nights';
import type { Night, Tier } from './nights';
import { TeamsView } from './TeamsView';
import { loadVotes, makeVote, saveVotes } from './votes';
import type { Vote } from './votes';
import type { RatedGame } from './nights';
import type { Game } from './types';
import type { League } from './types';
import { LEAGUES } from './types';

type Filter = 'Alle' | League;
type Tab = 'night' | 'tonight' | 'teams';

const REVEALED_KEY = 'revealed:v1';

function readRevealed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(REVEALED_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

export function App() {
  const today = berlinToday();
  const [tab, setTab] = useState<Tab>('night');
  const [date, setDate] = useState(today);
  const [filter, setFilter] = useState<Filter>('Alle');
  const [revealed, setRevealed] = useState(readRevealed);
  const [favorites, setFavorites] = useState(loadFavorites);
  const [votes, setVotes] = useState(loadVotes);
  const castVote = (item: RatedGame, v: 1 | -1) => {
    const next = { ...votes };
    // Nochmal tippen nimmt das Urteil zurück
    if (next[item.game.id]?.vote === v) delete next[item.game.id];
    else next[item.game.id] = makeVote(item, v);
    setVotes(next);
    saveVotes(next);
  };
  const updateFavorites = (next: Favorite[]) => {
    setFavorites(next);
    saveFavorites(next);
  };

  const toggle = (id: string) => () => {
    const next = new Set(revealed);
    next.has(id) ? next.delete(id) : next.add(id);
    setRevealed(next);
    try { localStorage.setItem(REVEALED_KEY, JSON.stringify([...next].slice(-500))); } catch { /* egal */ }
  };

  return (
    <div class="app">
      <div class="glow" aria-hidden="true" />
      {tab === 'night' && <NightView date={date} today={today} setDate={setDate} filter={filter} setFilter={setFilter} revealed={revealed} toggle={toggle} favorites={favorites} votes={votes} castVote={castVote} />}
      {tab === 'tonight' && <TonightView filter={filter} setFilter={setFilter} favorites={favorites} />}
      {tab === 'teams' && <TeamsView favorites={favorites} setFavorites={updateFavorites} votes={votes} />}
      <nav class="nav" aria-label="Hauptmenü">
        <button type="button" aria-current={tab === 'night' ? 'page' : undefined} onClick={() => setTab('night')}>{Icon.moon} Letzte Nacht</button>
        <button type="button" aria-current={tab === 'tonight' ? 'page' : undefined} onClick={() => setTab('tonight')}>{Icon.clock} Heute Abend</button>
        <button type="button" aria-current={tab === 'teams' ? 'page' : undefined} onClick={() => setTab('teams')}>{Icon.star} Meine Teams</button>
      </nav>
    </div>
  );
}

export function FilterBar({ filter, setFilter }: { filter: Filter; setFilter: (f: Filter) => void }) {
  return (
    <div class="filter" role="group" aria-label="Liga filtern">
      {(['Alle', ...LEAGUES] as Filter[]).map((f) => (
        <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>
      ))}
    </div>
  );
}

export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  useEffect(() => {
    let alive = true;
    setState({ loading: true });
    load().then(
      (data) => alive && setState({ data, loading: false }),
      (e) => alive && setState({ error: String(e?.message ?? e), loading: false }),
    );
    return () => { alive = false; };
  }, deps);
  return state;
}

function NightView(props: {
  date: string; today: string; setDate: (d: string) => void;
  filter: Filter; setFilter: (f: Filter) => void;
  revealed: Set<string>; toggle: (id: string) => () => void; favorites: Favorite[];
  votes: Record<string, Vote>; castVote: (item: RatedGame, v: 1 | -1) => void;
}) {
  const { date, today, setDate, filter, setFilter, revealed, toggle, favorites, votes, castVote } = props;
  const card = (item: RatedGame) => ({
    item,
    open: revealed.has(item.game.id),
    toggle: toggle(item.game.id),
    vote: votes[item.game.id]?.vote,
    onVote: (v: 1 | -1) => castVote(item, v),
  });
  const { data, error, loading } = useLoad<Night>(() => loadNight(date), [date]);
  const [showRest, setShowRest] = useState(false);
  useEffect(() => setShowRest(false), [date]);

  const view = useMemo(() => {
    const all = data?.games ?? [];
    const shown = all.filter((g) => filter === 'Alle' || g.game.league === filter);
    const hotSorted = shown.filter((g) => g.rating.hot).sort((a, b) => a.rating.sortKey - b.rating.sortKey);
    // Das spannendste sehenswerte Spiel, egal wie viele Balken
    const hero = [...hotSorted].sort((a, b) => b.rating.score - a.rating.score || a.rating.sortKey - b.rating.sortKey)[0] ?? null;
    const isFav = (g: { game: Game }) => favoriteOf(g.game, favorites) !== null;
    const favs = favorites
      .filter((f) => filter === 'Alle' || f.league === filter)
      .map((f) => ({ fav: f, item: shown.find((g) => favoriteOf(g.game, [f])) }));
    const tips = hotSorted.filter((g) => !isFav(g) && g !== hero);
    const rest = shown.filter((g) => !isFav(g) && !g.rating.hot);
    return {
      hero, favs, tips, rest,
      played: all.length,
      hot: all.filter((g) => g.rating.hot).length,
    };
  }, [data, filter, favorites]);

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
        <h1>{isToday ? <>Letzte<br /><span>Nacht</span></> : <>Archiv<br /><span>{formatDay(date).split(',')[0].replace('.', '')}</span></>}</h1>
        <div class="stats">
          <div class="stat"><b>{loading ? '–' : view.played}</b><small>Spiele</small></div>
          <div class="stat"><b class="hot">{loading ? '–' : view.hot}</b><small>Sehenswert</small></div>
          <div class="stat"><b>{loading ? '–' : view.played - view.hot}</b><small>Verzichtbar</small></div>
        </div>
      </header>
      <FilterBar filter={filter} setFilter={setFilter} />
      <main>
        {loading && <Skeletons />}
        {error && <div class="error">Die Ergebnisse konnten nicht geladen werden ({error}).</div>}
        {data && data.failed.length > 0 && <div class="error">Keine Daten für: {data.failed.join(', ')}</div>}
        {data && !loading && (
          <>
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
                  : <button type="button" class="more" onClick={() => setShowRest(true)}>{view.rest.length} weniger spannende Spiele anzeigen</button>}
              </section>
            )}
            {view.played === 0 && <div class="empty">In dieser Nacht gab es keine Spiele.</div>}
          </>
        )}
      </main>
    </>
  );
}

function TonightView({ filter, setFilter, favorites }: { filter: Filter; setFilter: (f: Filter) => void; favorites: Favorite[] }) {
  const { data, error, loading } = useLoad<{ games: Game[]; failed: string[] }>(() => loadUpcoming(), []);
  const all = useMemo(() => prioritize(data?.games ?? [], favorites), [data, favorites]);
  const groups = useMemo(() => {
    const shown = all.filter((u) => filter === 'Alle' || u.game.league === filter);
    const order: Tier[] = ['favorite', 'contender', 'rivalry', 'other'];
    return order.map((tier) => ({ tier, items: shown.filter((u) => u.tier === tier) })).filter((g) => g.items.length);
  }, [all, filter]);
  const total = all.length;
  const highlights = all.filter((u) => u.tier !== 'other').length;

  return (
    <>
      <header class="head">
        <div class="head-row">
          <div class="date">Nächste 24 Stunden</div>
          <div class="pill">{Icon.clock} Deutsche Zeit</div>
        </div>
        <h1>Heute<br /><span>Abend</span></h1>
        <div class="stats">
          <div class="stat"><b>{loading ? '–' : total}</b><small>Spiele</small></div>
          <div class="stat"><b class="hot">{loading ? '–' : highlights}</b><small>Highlights</small></div>
          <div class="stat"><b>{loading || !data?.games[0] ? '–' : new Date(data.games[0].start).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })}</b><small>Erstes Spiel</small></div>
        </div>
      </header>
      <FilterBar filter={filter} setFilter={setFilter} />
      <main>
        {loading && <Skeletons />}
        {error && <div class="error">Der Spielplan konnte nicht geladen werden ({error}).</div>}
        {data && data.failed.length > 0 && <div class="error">Keine Daten für: {data.failed.join(', ')}</div>}
        {groups.map(({ tier, items }) => (
          <section class="section" key={tier}>
            <div class="section-head"><h2>{TIER_TITLES[tier]}</h2><span class="count">{items.length} {items.length === 1 ? 'Spiel' : 'Spiele'}</span></div>
            {items.map((u) => <UpcomingCard key={u.game.id} item={u} />)}
          </section>
        ))}
        {data && !loading && groups.length === 0 && <div class="empty">In den nächsten 24 Stunden stehen keine Spiele an.</div>}
      </main>
    </>
  );
}
