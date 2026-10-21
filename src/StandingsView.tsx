import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { FilterBar, Icon, Skeletons } from './components';
import { matches } from './favorites';
import type { Favorite } from './favorites';
import { useLoad } from './refresh';
import { loadStandings } from './standings';
import type { LeagueStandings, Standing, Table } from './standings';
import type { League } from './types';

const CLINCH = ['x', 'y', 'z', 'e'];
const LEGEND: Record<string, string> = {
  x: 'Playoffs sicher',
  y: 'Division gewonnen',
  z: 'Bester Platz',
  e: 'Ausgeschieden',
};

/** `league` folgt dem gemeinsamen Ligafilter; die Wahl hier gilt für die ganze App. */
export function StandingsView({ league, setLeague, favorites }: { league: League; setLeague: (l: League) => void; favorites: Favorite[] }) {
  // Bei jedem Öffnen des Tabs wieder verdeckt: der Zustand lebt nur, solange der Tab offen ist
  const [revealed, setRevealed] = useState<Set<League>>(new Set());
  const { data, error, loading } = useLoad<LeagueStandings>(() => loadStandings(league), [league]);

  const open = revealed.has(league);
  const toggle = () => {
    const next = new Set(revealed);
    open ? next.delete(league) : next.add(league);
    setRevealed(next);
  };
  const clinches = new Set(data?.tables.flatMap((t) => t.rows.map((r) => r.clinch)).filter(Boolean));

  return (
    <>
      <header class="head">
        <div class="kicker">{data ? `${data.final ? 'Endstand ' : ''}Saison ${data.season}` : 'Saison'}</div>
        <div class="head-row">
          <h1>Tabel<span>len</span></h1>
          <button type="button" class={`reveal-btn${open ? ' done' : ''}`} onClick={toggle}>
            {open ? Icon.eyeOff : Icon.eye} {open ? 'Verdecken' : 'Aufdecken'}
          </button>
        </div>
      </header>
      <FilterBar filter={league} setFilter={setLeague} all={false} />
      <main class="boards">
        {loading && <Skeletons />}
        {error && <div class="error">Die Tabellen konnten nicht geladen werden ({error}).</div>}
        {data && !loading && data.tables.map((t) => (
          <StandingsTable key={t.title} table={t} league={league} open={open} favorites={favorites} />
        ))}
        {data && !loading && clinches.size > 0 && (
          <div class="legend">{CLINCH.filter((c) => clinches.has(c)).map((c) => `${c} ${LEGEND[c]}`).join(' · ')}</div>
        )}
      </main>
    </>
  );
}

function StandingsTable({ table, league, open, favorites }: { table: Table; league: League; open: boolean; favorites: Favorite[] }) {
  const nfl = league === 'NFL';
  const isFav = (s: Standing) => favorites.some((f) => f.league === league && matches(f, s.name));
  return (
    <section class={`board${open ? '' : ' veiled'}${nfl ? ' nfl' : ''}`}>
      <div class="board-head">
        <h3>{table.title}</h3>
        <span>{table.wildCard ? `Abstand zu Platz ${table.lines[0]}` : league === 'NBA' ? 'Conference' : 'Division'}</span>
      </div>
      <div class="board-cols"><span>#</span><span /><span /><span>{nfl ? 'S–N–U' : 'S–N'}</span><span>{table.wildCard ? 'WC' : nfl ? 'Pct' : 'GB'}</span></div>
      <div aria-hidden={!open}>
        {table.rows.map((s, i) => (
          <Fragment key={s.abbr}>
            <div class={`board-row${open && isFav(s) ? ' fav' : ''}${open && s.clinch === 'e' ? ' out' : ''}`} style={{ '--c': s.color }}>
              <span class="rk">{i + 1}</span>
              <span class="ab">{s.abbr}</span>
              <span class="tm">{s.name}{s.clinch && <span class="mk">{s.clinch}</span>}{open && isFav(s) && <span class="fav-star">{Icon.starFilled}</span>}</span>
              <span class="num">{nfl ? `${s.wins}–${s.losses}–${s.ties}` : `${s.wins}–${s.losses}`}</span>
              <span class="num gb">{nfl && !table.wildCard ? s.pct : s.gb}</span>
            </div>
            {table.lines.includes(i + 1) && i + 1 < table.rows.length && (
              <div class="board-line"><span>{lineLabel(league, table, i + 1)}</span></div>
            )}
          </Fragment>
        ))}
      </div>
    </section>
  );
}

function lineLabel(league: League, table: Table, place: number): string {
  if (table.wildCard) return 'Wild Card';
  if (league === 'NBA') return place === 6 ? 'Playoffs' : 'Play-In';
  return '';
}
