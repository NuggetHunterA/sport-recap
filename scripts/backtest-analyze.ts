// Wertet backtest/games.json.gz aus: alte Bewertung (rate) gegen Spannungskurve (curve).
// Aufruf: npx vite-node scripts/backtest-analyze.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { curve } from '../src/curve';
import { rate } from '../src/rating';
import type { Game } from '../src/types';

type G = Game & { date: string };
const games: G[] = JSON.parse(gunzipSync(readFileSync('backtest/games.json.gz')).toString());

const rows = games.map((g) => {
  const old = rate(g);
  const c = curve(g);
  return { g, old, c };
}).filter((x) => x.c);

writeFileSync('backtest/rows.json', JSON.stringify(rows.map(({ g, old, c }) => ({
  id: g.id, date: g.date, league: g.league, season: g.season,
  away: g.away.short, home: g.home.short, as: g.away.score, hs: g.home.score,
  old: old.level, oldScore: old.score, rivalry: old.rivalry, strong: old.strong, historic: old.historic,
  final: c!.final, course: c!.course, turns: c!.turns, raw: c!.score,
}))));
console.log(rows.length, 'Spiele mit Kurve von', games.length);
