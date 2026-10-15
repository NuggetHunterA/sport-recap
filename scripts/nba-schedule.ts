// Holt beim Build den NBA-Spielplan und legt ihn verkleinert als public/nba-schedule.json ab.
// nba.com sperrt den Abruf direkt aus dem Browser, die App liest darum diese Kopie.
// Schlägt der Abruf fehl, bricht der Build nicht ab; die App zeigt dann keinen NBA-Link zum ganzen Spiel.
import { writeFileSync } from 'node:fs';
import { slimNbaSchedule } from '../src/watch';

const URL = 'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json';

try {
  const res = await fetch(URL, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.nba.com/' } });
  if (!res.ok) throw new Error(`nba.com ${res.status}`);
  const games = slimNbaSchedule(await res.json());
  if (!games.length) throw new Error('Spielplan leer');
  writeFileSync('public/nba-schedule.json', JSON.stringify(games));
  console.log(`NBA-Spielplan: ${games.length} Spiele`);
} catch (e) {
  console.warn(`::warning::NBA-Spielplan nicht geladen: ${(e as Error).message}`);
}
