import { useMemo, useState } from 'preact/hooks';
import { FilterBar, useLoad } from './App';
import { Badge, Icon, Skeletons } from './components';
import { FAVORITES } from './config';
import { teams } from './espn';
import type { TeamInfo } from './espn';
import { matches } from './favorites';
import type { Favorite } from './favorites';
import type { League } from './types';
import { LEAGUES } from './types';

type Filter = 'Alle' | League;

export function TeamsView({ favorites, setFavorites }: { favorites: Favorite[]; setFavorites: (f: Favorite[]) => void }) {
  const [filter, setFilter] = useState<Filter>('Alle');
  const { data, error, loading } = useLoad<TeamInfo[]>(
    async () => (await Promise.all(LEAGUES.map((l) => teams(l).catch(() => [])))).flat(),
    [],
  );

  const isFav = (t: TeamInfo) => favorites.some((f) => f.league === t.league && matches(f, t.name));
  const toggle = (t: TeamInfo) => setFavorites(isFav(t)
    ? favorites.filter((f) => !(f.league === t.league && matches(f, t.name)))
    : [...favorites, { league: t.league, match: t.name, label: t.short }]);

  const groups = useMemo(() => LEAGUES
    .filter((l) => filter === 'Alle' || filter === l)
    .map((league) => ({ league, teams: (data ?? []).filter((t) => t.league === league) }))
    .filter((g) => g.teams.length), [data, filter]);

  const selected = (data ?? []).filter(isFav);

  return (
    <>
      <header class="head">
        <div class="head-row">
          <div class="date">Lieblingsteams</div>
          <div class="pill">{Icon.starFilled} {favorites.length} ausgewählt</div>
        </div>
        <h1>Meine<br /><span>Teams</span></h1>
        <p class="lead">Deine Teams stehen bei „Letzte Nacht“ und „Heute Abend“ immer ganz oben. Die Auswahl wird auf diesem Gerät gespeichert.</p>
      </header>
      <FilterBar filter={filter} setFilter={setFilter} />
      <main>
        {loading && <Skeletons />}
        {error && <div class="error">Die Teams konnten nicht geladen werden ({error}).</div>}
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
        {data && !loading && (
          <button type="button" class="more" onClick={() => setFavorites(FAVORITES)}>Auf meine ursprünglichen Teams zurücksetzen</button>
        )}
      </main>
    </>
  );
}
