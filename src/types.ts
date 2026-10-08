export type League = 'MLB' | 'NBA' | 'NFL';

export const LEAGUES: League[] = ['MLB', 'NBA', 'NFL'];

export type SeasonType = 'preseason' | 'regular' | 'playoff';

export interface Team {
  name: string; // "San Diego Padres"
  short: string; // "Padres"
  abbr: string; // "SD"
  color: string; // "#2F241D"
  /** Zweitfarbe für die Trikotstreifen, z. B. "#FFC425" */
  alt?: string;
  logo?: string;
  record?: string; // "90-72"
  score: number;
  /** Nur MLB: Hits des Teams */
  hits?: number;
}

/** Statistik-Bestwert eines Spielers aus dem Scoreboard, z. B. points 52 */
export interface Leader {
  stat: string;
  value: number;
}

/** Punktestand nach einem Scoring-Play, aus Sicht Auswärts/Heim. */
export interface ScoringPlay {
  away: number;
  home: number;
  period: number;
  /** Verbleibende Sekunden in der Periode, falls bekannt. */
  clock?: number;
  text?: string;
}

export interface Game {
  id: string;
  league: League;
  start: string; // ISO
  state: 'pre' | 'in' | 'post';
  /** Laufende Periode (Viertel oder Inning), nur bei laufenden Spielen relevant */
  period?: number;
  season: SeasonType;
  note?: string; // z. B. "NLDS - Game 2"
  away: Team;
  home: Team;
  plays?: ScoringPlay[];
  leaders?: Leader[];
  /** Nur MLB: Bestwerte des Spiels aus dem Boxscore (strikeouts, homeRuns, rbis, hits) */
  feats?: Leader[];
}

export type DramaKind = 'walkoff' | 'extra' | 'ot' | 'comeback' | 'leadchanges' | 'lateclose' | 'close';

export interface Rating {
  drama: DramaKind | null;
  rivalry: boolean;
  /** Beide Teams mit starker Bilanz */
  strong: boolean;
  /** No-Hitter, 50-Punkte-Spiel und Ähnliches */
  historic: boolean;
  /** Spannungswert 0 bis 100 */
  score: number;
  hot: boolean;
  /** 1 (auslassen) bis 5 (Pflichtprogramm) */
  level: number;
  /** Spoilerfreier Grund */
  reason: string;
  /** Kleiner = weiter oben bei den Tipps */
  sortKey: number;
}
