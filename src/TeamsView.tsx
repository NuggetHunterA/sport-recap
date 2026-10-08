import { useMemo, useState } from 'preact/hooks';
import { FilterBar } from './App';
import { Badge, Icon } from './components';
import { FAVORITES } from './config';
import { matches } from './favorites';
import { setupPush } from './push';
import type { Favorite } from './favorites';
import type { League } from './types';
import { LEAGUES } from './types';
import { TEAMS } from './teams';
import type { TeamInfo } from './teams';

type Filter = 'Alle' | League;

export function TeamsView({ favorites, setFavorites }: { favorites: Favorite[]; setFavorites: (f: Favorite[]) => void }) {
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
  const [filter, setFilter] = useState<Filter>('Alle');
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
        <p class="lead">Deine Teams stehen bei „Letzte Nacht“ und „Heute Abend“ immer ganz oben. Die Auswahl wird auf diesem Gerät gespeichert.</p>
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
        <button type="button" class="more" onClick={() => setFavorites(FAVORITES)}>Auf meine ursprünglichen Teams zurücksetzen</button>
        <section class="section">
          <div class="section-head"><h2>Benachrichtigungen</h2></div>
          <p class="lead">Morgens um 8 Uhr deine Teams und ein Top-Tipp, nachmittags um 15 Uhr nur, wenn vor 23 Uhr etwas Wichtiges startet. Nie mit Ergebnis. Nach dem Einrichten den kopierten Code auf GitHub unter Settings → Secrets and variables → Actions als Secret <b>PUSH_CONFIG</b> speichern. Ändern sich deine Teams, den Code neu kopieren.</p>
          <button type="button" class="more" onClick={setup}>{push.code ? 'Code kopiert' : 'Benachrichtigungen einrichten'}</button>
          {push.code && <textarea class="push-code" readOnly value={push.code} onFocus={(e) => e.currentTarget.select()} />}
          {push.error && <div class="error">{push.error}</div>}
        </section>
      </main>
    </>
  );
}
