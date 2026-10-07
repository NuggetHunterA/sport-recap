// Dein Urteil nach dem Aufdecken, um die Bewertung später nachzuschärfen.
import type { RatedGame } from './nights';

export interface Vote {
  id: string;
  league: string;
  start: string;
  matchup: string;
  /** 1 = hat sich gelohnt, -1 = langweilig */
  vote: 1 | -1;
  score: number;
  level: number;
  reason: string;
  drama: string | null;
  margin: number;
}

const KEY = 'votes:v1';

export function loadVotes(): Record<string, Vote> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function saveVotes(votes: Record<string, Vote>): void {
  try { localStorage.setItem(KEY, JSON.stringify(votes)); } catch { /* voll oder gesperrt */ }
}

export function makeVote({ game, rating }: RatedGame, vote: 1 | -1): Vote {
  return {
    id: game.id,
    league: game.league,
    start: game.start,
    matchup: `${game.away.short} @ ${game.home.short}`,
    vote,
    score: rating.score,
    level: rating.level,
    reason: rating.reason,
    drama: rating.drama,
    margin: Math.abs(game.away.score - game.home.score),
  };
}
