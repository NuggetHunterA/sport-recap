// Persönliche Einstellungen. Übernommen aus den Home-Assistant-Automationen.
import type { League } from './types';

/** Lieblingsteams: Anzeigename und Suchbegriff im ESPN-Teamnamen. */
export const FAVORITES: { label: string; match: string; league: League }[] = [
  { label: 'Padres', match: 'Padres', league: 'MLB' },
  { label: 'Athletics', match: 'Athletics', league: 'MLB' },
  { label: 'Mavs', match: 'Mavericks', league: 'NBA' },
  { label: 'Magic', match: 'Magic', league: 'NBA' },
  { label: 'Bulls', match: 'Bulls', league: 'NBA' },
  { label: 'Lakers', match: 'Lakers', league: 'NBA' },
];

/** Rivalitäten als Teamnamen-Paare, egal wer Heimteam ist. */
export const RIVALRIES: Record<League, [string, string][]> = {
  MLB: [
    ['Padres', 'Dodgers'], ['Athletics', 'Giants'], ['Yankees', 'Red Sox'], ['Dodgers', 'Giants'],
    ['Cubs', 'Cardinals'], ['Astros', 'Rangers'], ['Mets', 'Phillies'], ['Cubs', 'White Sox'],
    ['Braves', 'Mets'], ['Red Sox', 'Rays'], ['Mets', 'Yankees'], ['Dodgers', 'Yankees'],
  ],
  NBA: [
    ['Lakers', 'Celtics'], ['Lakers', 'Clippers'], ['Bulls', 'Pistons'], ['Mavericks', 'Rockets'],
    ['Mavericks', 'Spurs'], ['Magic', 'Heat'], ['Knicks', 'Celtics'], ['Celtics', '76ers'],
    ['Knicks', 'Pacers'], ['Celtics', 'Heat'], ['Warriors', 'Cavaliers'], ['Bulls', 'Knicks'],
    ['Lakers', 'Warriors'],
  ],
  NFL: [],
};

/** Ab dieser Siegquote gilt ein Team als stark (für „Heute Abend“). */
export const CONTENDER_WIN_PCT = 0.55;
/** Mindestanzahl Spiele, bevor die Siegquote zählt. */
export const CONTENDER_MIN_GAMES = 4;
