import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { formatTime } from './nights';
import type { RatedGame, Tier, Upcoming } from './nights';
import type { Game, Team } from './types';

export const Icon = {
  shield: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" /></svg>,
  flame: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5 1 1.5 2 2 3 2-.5-2.5-1-4.5 0-7z" /></svg>,
  eye: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>,
  moon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>,
  clock: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  star: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 6.9L12 17.6 5.7 21l1.5-6.9L2 9.3l7-.8z" /></svg>,
  starFilled: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 6.9L12 17.6 5.7 21l1.5-6.9L2 9.3l7-.8z" /></svg>,
  thumbUp: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3zm0 0l4-8a3 3 0 0 1 3 3v4h5.5a2 2 0 0 1 2 2.3l-1.4 8A2 2 0 0 1 18.1 21H7" /></svg>,
  thumbDown: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 14V3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-3zm0 0l-4 8a3 3 0 0 1-3-3v-4H4.5a2 2 0 0 1-2-2.3l1.4-8A2 2 0 0 1 5.9 3H17" /></svg>,
  left: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>,
  right: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>,
};

/** ESPN-Logo in der Variante für dunkle Hintergründe, mit dem normalen Logo als Ersatz. */
export function logoCandidates(logo?: string): string[] {
  if (!logo) return [];
  const dark = logo.replace('/500/scoreboard/', '/500/').replace('/500/', '/500-dark/');
  return dark === logo ? [logo] : [dark, logo];
}

export function Badge({ team, size }: { team: Pick<Team, 'color' | 'logo' | 'abbr'>; size: number }) {
  const candidates = logoCandidates(team.logo);
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

export function VoteButtons({ vote, onVote }: { vote?: 1 | -1; onVote: (v: 1 | -1) => void }) {
  return (
    <div class="vote" role="group" aria-label="Hat sich das Spiel gelohnt?">
      <span>Gelohnt?</span>
      <button type="button" aria-pressed={vote === 1} aria-label="Hat sich gelohnt" onClick={() => onVote(1)}>{Icon.thumbUp}</button>
      <button type="button" aria-pressed={vote === -1} aria-label="War langweilig" onClick={() => onVote(-1)}>{Icon.thumbDown}</button>
    </div>
  );
}

export function Meter({ level, big }: { level: number; big?: boolean }) {
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

function label(game: Game): string {
  if (game.note) return game.note;
  return game.season === 'preseason' ? 'Preseason' : game.season === 'playoff' ? 'Playoffs' : 'Regular Season';
}

export function Hero({ item, open, toggle, vote, onVote }: { item: RatedGame; open: boolean; toggle: () => void; vote?: 1 | -1; onVote: (v: 1 | -1) => void }) {
  const { game, rating } = item;
  const bg = `linear-gradient(125deg, ${game.away.color} 0%, ${game.away.color} 48%, ${game.home.color} 52%, ${game.home.color} 100%)`;
  return (
    <section class="section" aria-label="Spiel der Nacht">
      <div class="kicker">{Icon.flame} Spiel der Nacht</div>
      <article class="hero" style={{ background: bg }}>
        <div class="hero-league" aria-hidden="true">{game.league}</div>
        <div class="hero-body">
          <div class="hero-top">
            <span class="tag">{label(game)}</span>
            <span class="reason-chip">{rating.reason}</span>
          </div>
          <div class="versus">
            <div class="side"><Badge team={game.away} size={62} /><span class="side-name">{game.away.short}</span></div>
            <div class="big-score"><Score game={game} open={open} /></div>
            <div class="side"><Badge team={game.home} size={62} /><span class="side-name">{game.home.short}</span></div>
          </div>
          <div class="hero-foot">
            <div><div class="meter-label">Spannung</div><Meter level={rating.level} big /></div>
            <button type="button" class="glass" onClick={toggle}>{Icon.eye} {open ? 'Verbergen' : 'Aufdecken'}</button>
          </div>
          {open && <VoteButtons vote={vote} onVote={onVote} />}
        </div>
      </article>
    </section>
  );
}

function Shell({ away, home, hot, children }: { away: string; home: string; hot: boolean; children: ComponentChildren }) {
  return (
    <article class="card">
      <div class="stripe" aria-hidden="true" style={{ background: `linear-gradient(180deg, ${away}, ${home})` }} />
      {hot && <div class="wash" aria-hidden="true" style={{ background: `radial-gradient(120% 90% at 0% 0%, ${away}33, transparent 60%)` }} />}
      {children}
    </article>
  );
}

export function GameCard({ item, open, toggle, vote, onVote }: { item: RatedGame; open: boolean; toggle: () => void; vote?: 1 | -1; onVote: (v: 1 | -1) => void }) {
  const { game, rating } = item;
  return (
    <Shell away={game.away.color} home={game.home.color} hot={rating.hot}>
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
      {open && <VoteButtons vote={vote} onVote={onVote} />}
    </Shell>
  );
}

export function NoGameCard({ name, league }: { name: string; league: string }) {
  return (
    <article class="card">
      <div class="card-top"><div class="meta"><span class="league">{league}</span></div></div>
      <div class="card-main">
        <div class="matchup"><b>{name}</b><small class="none">Kein Spiel letzte Nacht</small></div>
      </div>
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
        <div class="time">{formatTime(game.start)}<small>Uhr</small></div>
      </div>
    </Shell>
  );
}

export function Skeletons() {
  return <>{[0, 1, 2].map((i) => <div key={i} class="skeleton" />)}</>;
}
