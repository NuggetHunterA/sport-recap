import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { formatTime, liveLabel } from './nights';
import type { RatedGame, Tier, Upcoming } from './nights';
import type { Game, Team } from './types';
import type { Favorite } from './favorites';
import { historicFeats } from './rating';
import { TEAMS } from './teams';

export const Icon = {
  close: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  table: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 10v10" /></svg>,
  shield: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" /></svg>,
  flame: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5 1 1.5 2 2 3 2-.5-2.5-1-4.5 0-7z" /></svg>,
  eye: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>,
  moon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>,
  clock: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  star: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 6.9L12 17.6 5.7 21l1.5-6.9L2 9.3l7-.8z" /></svg>,
  starFilled: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 6.9L12 17.6 5.7 21l1.5-6.9L2 9.3l7-.8z" /></svg>,
  left: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>,
  trophy: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" /></svg>,
  right: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>,
};

/** ESPN-Logo in der Variante für dunkle Hintergründe, mit dem normalen Logo als Ersatz. */
function logoCandidates(logo?: string): string[] {
  if (!logo) return [];
  const dark = logo.replace('/500/scoreboard/', '/500/').replace('/500/', '/500-dark/');
  return dark === logo ? [logo] : [dark, logo];
}

/** `light`: Logo für hellen Hintergrund (Trikotkarte), sonst zuerst die Variante für dunklen */
export function Badge({ team, size, light }: { team: Pick<Team, 'color' | 'logo' | 'abbr'>; size: number; light?: boolean }) {
  const candidates = light && team.logo ? [team.logo] : logoCandidates(team.logo);
  const [attempt, setAttempt] = useState(0);
  const src = candidates[attempt];
  return (
    <span class="badge" style={{ width: size, height: size, background: team.color, fontSize: Math.round(size * 0.36) }}>
      {src
        ? <img key={src} src={src} alt={team.abbr} loading="lazy" onError={() => setAttempt(attempt + 1)} />
        : team.abbr}
    </span>
  );
}

type CardProps = { item: RatedGame; open: boolean; toggle: () => void; onBox?: () => void };

/** Fußzeile einer aufgedeckten Karte: Boxscore */
function CardFoot({ onBox }: { onBox: () => void }) {
  return (
    <div class="card-foot">
      <button type="button" class="box-btn" onClick={onBox}>{Icon.table} Boxscore</button>
    </div>
  );
}

/** Tippen auf eine aufgedeckte Karte öffnet den Boxscore, außer auf Knöpfe */
function openBox(onBox?: () => void) {
  return onBox ? (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest('button')) onBox();
  } : undefined;
}

function Meter({ level, big }: { level: number; big?: boolean }) {
  return (
    <span class={`meter${big ? ' big' : ''}${level >= 4 ? ' hot' : ''}`} role="img" aria-label={`Spannung ${level} von 5`}>
      {[1, 2, 3, 4, 5].map((i) => <i key={i} class={i <= level ? 'on' : ''} />)}
    </span>
  );
}

function Score({ game, open }: { game: Game; open: boolean }) {
  return open
    ? <span class="reveal">{game.away.score} : {game.home.score}</span>
    : <span class="blur" aria-hidden="true">88 : 88</span>;
}

// Entwurfsauswahl für die Screenshots, z. B. ?feat=b
const FEAT_STYLE = new URLSearchParams(location.search).get('feat') ?? 'a';

/** Historische Einzelleistung, erst nach dem Aufdecken sichtbar (Name verrät das Team). */
function Feats({ game, open }: { game: Game; open: boolean }) {
  const feats = open ? historicFeats(game) : [];
  if (!feats.length) return null;
  if (FEAT_STYLE === 'b') {
    return (
      <div class="feat-band">
        <span class="feat-icon">{Icon.trophy}</span>
        <div>
          <small>Historische Leistung</small>
          {feats.map((f) => <b key={f.label}>{f.label}{f.name && <span> · {f.name}</span>}</b>)}
        </div>
      </div>
    );
  }
  if (FEAT_STYLE === 'c') {
    return (
      <div class="feat-medals">
        {feats.map((f) => {
          const [num, ...unit] = f.label.split(' ');
          const numeric = /^\d+$/.test(num);
          return (
            <div class="feat-medal" key={f.label}>
              <span class="medal"><b>{numeric ? num : 'NH'}</b></span>
              <div><b>{numeric ? unit.join(' ') : f.label}</b><small>{f.name}</small></div>
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div class="feat-pills">
      {feats.map((f) => <span class="feat-pill" key={f.label}>{Icon.trophy} {f.label}{f.name && ` · ${f.name}`}</span>)}
    </div>
  );
}

function label(game: Game): string {
  if (game.note) return game.note;
  return game.season === 'preseason' ? 'Preseason' : game.season === 'playoff' ? 'Playoffs' : 'Regular Season';
}

export function Hero({ item, open, toggle, onBox }: CardProps) {
  const { game, rating } = item;
  // Trikotfarben: Hauptfarbe und Zweitfarbe je Team
  const colors = (t: Team) => ({ '--c': t.color, '--c2': t.alt ?? '#ffffff' });
  return (
    <section class="section" aria-label="Spiel der Nacht">
      <div class="kicker">{Icon.flame} Spiel der Nacht</div>
      <article class={`hero${open && onBox ? ' tappable' : ''}`} onClick={open ? openBox(onBox) : undefined}>
        <div class="jersey" aria-hidden="true">
          <span style={colors(game.away)} /><span style={colors(game.home)} />
        </div>
        <div class="hero-body">
          <div class="hero-top">
            <span class="tag">{label(game)}</span>
            <span class="reason-chip">{rating.reason}</span>
          </div>
          <div class="versus">
            <div class="side" style={colors(game.away)}><span class="disc"><Badge team={game.away} size={60} light /></span><span class="side-name">{game.away.short}</span></div>
            {open
              ? <div class="big-score"><Score game={game} open={open} /></div>
              : <button type="button" class="big-score" onClick={toggle} aria-label="Ergebnis aufdecken"><Score game={game} open={open} /></button>}
            <div class="side" style={colors(game.home)}><span class="disc"><Badge team={game.home} size={60} light /></span><span class="side-name">{game.home.short}</span></div>
          </div>
          <Feats game={game} open={open} />
          <div class="jersey-stripes" aria-hidden="true">
            <span style={colors(game.away)} /><span style={colors(game.home)} />
          </div>
          <div class="hero-foot">
            <div><div class="meter-label">Spannung</div><Meter level={rating.level} big /></div>
            <button type="button" class="glass" onClick={toggle}>{Icon.eye} {open ? 'Verbergen' : 'Aufdecken'}</button>
          </div>
          {open && onBox && <CardFoot onBox={onBox} />}
        </div>
      </article>
    </section>
  );
}

function Shell({ away, home, hot, children, onClick }: { away: string; home: string; hot: boolean; children: ComponentChildren; onClick?: (e: MouseEvent) => void }) {
  return (
    <article class={`card${onClick ? ' tappable' : ''}`} onClick={onClick}>
      <div class="stripe" aria-hidden="true" style={{ background: `linear-gradient(180deg, ${away}, ${home})` }} />
      {hot && <div class="wash" aria-hidden="true" style={{ background: `radial-gradient(120% 90% at 0% 0%, ${away}33, transparent 60%)` }} />}
      {children}
    </article>
  );
}

export function GameCard({ item, open, toggle, onBox }: CardProps) {
  const { game, rating } = item;
  return (
    <Shell away={game.away.color} home={game.home.color} hot={rating.hot} onClick={open ? openBox(onBox) : undefined}>
      <div class="card-top">
        <div class="meta"><span class="league">{game.league}</span><span>{label(game)}</span></div>
        <Meter level={rating.level} />
      </div>
      <div class="card-main">
        <div class="badges"><Badge team={game.away} size={40} /><Badge team={game.home} size={40} /></div>
        <div class="matchup">
          <b>{game.away.short} @ {game.home.short}</b>
          <small class={rating.level >= 4 ? 'hot' : ''}>{rating.reason}</small>
        </div>
        <button type="button" class={`score-btn${open ? ' open' : ''}`} onClick={toggle}
          aria-label={open ? 'Ergebnis verbergen' : 'Ergebnis aufdecken'}>
          <Score game={game} open={open} />
        </button>
      </div>
      <Feats game={game} open={open} />
      {open && onBox && <CardFoot onBox={onBox} />}
    </Shell>
  );
}

/** Eine kompakte Kachel für alle Lieblingsteams, die letzte Nacht nicht gespielt haben. */
export function NoGameCard({ favs }: { favs: Favorite[] }) {
  return (
    <article class="card idle">
      <div class="card-top"><div class="meta"><span>Kein Spiel letzte Nacht</span></div></div>
      <ul class="idle-teams">
        {favs.map((f) => {
          const team = TEAMS.find((t) => t.league === f.league && t.name.includes(f.match));
          return (
            <li key={`${f.league}:${f.label}`}>
              {team && <Badge team={team} size={24} />}
              <span>{f.label}</span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

const TIER_HINT: Record<Tier, string> = {
  favorite: 'Lieblingsteam',
  contender: 'Top-Matchup',
  rivalry: 'Rivalität',
  other: '',
};

export function UpcomingCard({ item }: { item: Upcoming }) {
  const { game, tier } = item;
  const records = game.away.record && game.home.record ? `${game.away.record} vs ${game.home.record}` : label(game);
  const hint = game.season === 'playoff' && tier === 'contender' ? 'Playoffs' : TIER_HINT[tier];
  return (
    <Shell away={game.away.color} home={game.home.color} hot={tier !== 'other'}>
      <div class="card-top">
        <div class="meta"><span class="league">{game.league}</span><span>{records}</span></div>
      </div>
      <div class="card-main">
        <div class="badges"><Badge team={game.away} size={40} /><Badge team={game.home} size={40} /></div>
        <div class="matchup">
          <b>{game.away.short} @ {game.home.short}</b>
          {hint && <small class="hot">{hint}</small>}
        </div>
        {game.state === 'in'
          ? <div class="time live">Live<small>{liveLabel(game)}</small></div>
          : <div class="time">{formatTime(game.start)}<small>Uhr</small></div>}
      </div>
    </Shell>
  );
}

export function Skeletons() {
  return <>{[0, 1, 2].map((i) => <div key={i} class="skeleton" />)}</>;
}
