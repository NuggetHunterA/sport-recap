// Schickt die Push-Benachrichtigung (läuft im GitHub-Workflow „Notify“).
// PUSH_CONFIG ist der Code aus „Meine Teams“ → „Benachrichtigungen“.
import webpush from 'web-push';
import { afternoonMessage, morningMessage } from '../src/notify';
import type { Message } from '../src/notify';
import { berlinToday, loadNight, loadUpcoming } from '../src/nights';

const config = JSON.parse(Buffer.from(process.env.PUSH_CONFIG ?? '', 'base64').toString());
const url = process.env.APP_URL!;
const hour = Number(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin', hour: 'numeric', hourCycle: 'h23' }));
// Zeitpläne laufen für Sommer- und Winterzeit doppelt; nur der zur Berliner Uhrzeit passende sendet
const mode = process.env.MODE === 'auto' ? (hour === 8 ? 'morning' : hour === 15 ? 'afternoon' : null) : process.env.MODE;

let message: Message | null = null;
if (mode === 'morning') {
  const night = await loadNight(berlinToday());
  message = morningMessage(night.games, config.favorites, url);
  if (night.failed.length) message.body += `\nKeine Daten für: ${night.failed.join(', ')}`;
} else if (mode === 'afternoon') {
  const { games } = await loadUpcoming();
  message = afternoonMessage(games, config.favorites, `${url}?tab=tonight`);
}

console.log(mode ?? `Nichts zu tun (${hour} Uhr in Berlin)`, message);
if (message) {
  webpush.setVapidDetails(url, config.publicKey, config.privateKey);
  try {
    await webpush.sendNotification(config.subscription, JSON.stringify(message), { TTL: 6 * 3600 });
  } catch (e) {
    // 404/410: Das Gerät ist beim Push-Dienst abgemeldet (z. B. App neu installiert oder Benachrichtigungen aus)
    if (!(e instanceof webpush.WebPushError) || (e.statusCode !== 404 && e.statusCode !== 410)) throw e;
    console.error(`::error title=Gerät abgemeldet::Der Push-Dienst kennt dieses Gerät nicht mehr (${e.statusCode}). `
      + 'In der App unter „Meine Teams“ → „Benachrichtigungen“ neu einrichten und den Code als Secret PUSH_CONFIG ersetzen.');
    process.exit(1);
  }
}
