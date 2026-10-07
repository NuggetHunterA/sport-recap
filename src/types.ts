export type League = 'MLB' | 'NBA' | 'NFL';

export const LEAGUES: League[] = ['MLB', 'NBA', 'NFL'];

export type SeasonType = 'preseason' | 'regular' | 'playoff';

export interface Team {
  name: string; // "San Diego Padres"
  short: string; // "Padres"
  abbr: string; // "SD"
  color: string; // "#2F241D"
  logo?: string;
  record?: string; // "90-72"
  score: number;
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
  season: SeasonType;
  note?: string; // z. B. "NLDS - Game 2"
  away: Team;
  home: Team;
  plays?: ScoringPlay[];
}

export type DramaKind = 'walkoff' | 'extra' | 'ot' | 'comeback' | 'leadchanges' | 'lateclose' | 'close';

export interface Rating {
  drama: DramaKind | null;
  rivalry: boolean;
  hot: boolean;
  /** 1 (auslassen) bis 5 (Pflichtprogramm) */
  level: number;
  /** Spoilerfreier Grund */
  reason: string;
  /** Kleiner = weiter oben bei den Tipps */
  sortKey: number;
}
