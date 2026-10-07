import { useEffect, useState } from 'preact/hooks';
import { Badge, Icon } from './components';
import { hasBoxScore, loadBoxScore } from './boxscore';
import type { BoxScore, LineScore, Table, TeamBox } from './boxscore';
import type { Game } from './types';

/** Ligen, für die es einen Boxscore gibt */
export const BOX_LEAGUES: Game['league'][] = ['NBA', 'MLB', 'NFL'];

export function canShowBox(game: Game): boolean {
  return game.state === 'post' && BOX_LEAGUES.includes(game.league);
}

function Line({ line }: { line: LineScore }) {
  const innings = Array.from({ length: line.innings }, (_, i) => i + 1);
  const row = (t: LineScore['away']) => (
    <tr>
      <th scope="row">{t.abbr}</th>
      {innings.map((i) => <td key={i}>{t.runs[i - 1] ?? ''}</td>)}
      <td class="sum first">{t.r ?? '–'}</td><td class="sum">{t.h ?? '–'}</td><td class="sum">{t.e ?? '–'}</td>
    </tr>
  );
  return (
    <div class="box-scroll">
      <table class="box-table line">
        <thead><tr><th />{innings.map((i) => <th key={i}>{i}</th>)}<th class="sum first">R</th><th class="sum">H</th><th class="sum">E</th></tr></thead>
        <tbody>{row(line.away)}{row(line.home)}</tbody>
      </table>
    </div>
  );
}

/** Höchstwert je Spalte hervorheben, z. B. Topscorer */
function best(table: Table): number[] {
  return table.columns.map((_, c) => Math.max(...table.rows.map((r) => parseFloat(r.stats[c]) || 0)));
}

function StatTable({ table, highlight }: { table: Table; highlight: boolean }) {
  const top = best(table);
  return (
    <div class="box-scroll">
      <table class="box-table">
        <thead><tr><th class="name">{table.title}</th>{table.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i}>
              <th scope="row" class="name">{r.name}{r.note && <small>{r.note}</small>}</th>
              {r.stats.map((v, c) => (
                <td key={c} class={highlight && c > 0 && top[c] > 0 && parseFloat(v) === top[c] ? 'top' : ''}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TeamTables({ team, league }: { team?: TeamBox; league: Game['league'] }) {
  if (!team || (team.tables.length === 0 && !team.touchdowns)) return <div class="empty">Keine Spielerwerte verfügbar.</div>;
  return (
    <>
      {team.touchdowns && (
        <div class="box-scroll td-list">
          <h3>Touchdowns</h3>
          <ul>{team.touchdowns.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )}
      {team.tables.map((t) => <StatTable key={t.title} table={t} highlight={league === 'NBA'} />)}
    </>
  );
}

export function BoxSheet({ game, onClose }: { game: Game; onClose: () => void }) {
  const [state, setState] = useState<{ box?: BoxScore; error?: boolean }>({});
  const [side, setSide] = useState<'away' | 'home'>('away');

  useEffect(() => {
    let alive = true;
    loadBoxScore(game).then((box) => alive && setState({ box }), () => alive && setState({ error: true }));
    return () => { alive = false; };
  }, [game.id]);

  // Zurück-Taste am Handy schließt nur die Ansicht, nicht die App
  useEffect(() => {
    history.pushState({ box: game.id }, '');
    const onPop = () => onClose();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && history.back();
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKey);
    document.body.classList.add('locked');
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('locked');
    };
  }, []);

  const close = () => history.back();
  const { box, error } = state;
  return (
    <div class="sheet-backdrop" onClick={close}>
      <section class="sheet" role="dialog" aria-modal="true" aria-label="Boxscore" onClick={(e) => e.stopPropagation()}>
        <div class="grip" aria-hidden="true" />
        <header class="sheet-head">
          <span class="league">{game.league}</span>
          <h2>Boxscore</h2>
          <button type="button" class="sheet-close" aria-label="Schließen" onClick={close}>{Icon.close}</button>
        </header>
        <div class="sheet-score">
          <div class="sheet-side"><Badge team={game.away} size={40} /><span>{game.away.short}</span></div>
          <b>{game.away.score} : {game.home.score}</b>
          <div class="sheet-side home"><Badge team={game.home} size={40} /><span>{game.home.short}</span></div>
        </div>
        {!box && !error && <div class="skeleton box-skeleton" />}
        {(error || (box && !hasBoxScore(box))) && <div class="empty">Für dieses Spiel gibt es noch keinen Boxscore.</div>}
        {box && hasBoxScore(box) && (
          <>
            {box.line && <Line line={box.line} />}
            {(box.away || box.home) && (
              <>
                <div class="seg" role="group" aria-label="Team wählen">
                  <button type="button" aria-pressed={side === 'away'} onClick={() => setSide('away')}>{game.away.short}</button>
                  <button type="button" aria-pressed={side === 'home'} onClick={() => setSide('home')}>{game.home.short}</button>
                </div>
                <TeamTables team={side === 'away' ? box.away : box.home} league={game.league} />
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
