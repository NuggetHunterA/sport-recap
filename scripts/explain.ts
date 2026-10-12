// Holt ein Spiel mit der App-Pipeline und legt Rohdaten, Kurve und Bewertung ab (läuft im Workflow „Explain“).
// Aufruf: DATES=2026-10-10,2026-10-11 TEAMS=Dodgers,Brewers npx vite-node scripts/explain.ts
import { writeFileSync } from 'node:fs';
import { withFeats } from '../src/boxscore';
import { curve, openness, states } from '../src/curve';
import { scoreboards, withHalves, withPlays } from '../src/espn';
import { rate } from '../src/rating';

const dates = (process.env.DATES ?? '').split(',');
const teams = (process.env.TEAMS ?? '').split(',');
const { games } = await scoreboards(dates);
const found = games.filter((g) => g.state === 'post' && teams.every((t) => [g.away.name, g.home.name].some((n) => n.includes(t))));
const out = await Promise.all(found.map(async (g0) => {
  const g = await withPlays(g0).then(withFeats).then(withHalves);
  return {
    game: g,
    curve: curve(g),
    rating: rate(g),
    states: states(g).map((s) => ({ ...s, open: openness(g.league, s.effective, s.r) })),
  };
}));
writeFileSync('explain/out.json', JSON.stringify(out, null, 1));
console.log(found.length, 'Spiele');
