// Einrichtung der Push-Benachrichtigungen. Gesendet wird vom GitHub-Workflow „Notify“,
// der dafür den hier erzeugten Code als Secret PUSH_CONFIG bekommt.
import type { Favorite } from './favorites';

const KEY = 'push:v1';
const b64url = (bytes: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

/** Schlüsselpaar (VAPID) einmal pro Gerät erzeugen und merken. */
async function keys(): Promise<{ publicKey: string; privateKey: string }> {
  const saved = localStorage.getItem(KEY);
  if (saved) return JSON.parse(saved);
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  const result = {
    publicKey: b64url(await crypto.subtle.exportKey('raw', pair.publicKey)),
    privateKey: (await crypto.subtle.exportKey('jwk', pair.privateKey)).d!,
  };
  localStorage.setItem(KEY, JSON.stringify(result));
  return result;
}

/** Fragt nach der Erlaubnis, meldet das Gerät an und liefert den Code für PUSH_CONFIG. */
export async function setupPush(favorites: Favorite[]): Promise<string> {
  if (await Notification.requestPermission() !== 'granted') throw new Error('Benachrichtigungen sind nicht erlaubt.');
  const { publicKey, privateKey } = await keys();
  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.getSubscription()
    ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64url(publicKey) });
  return btoa(JSON.stringify({ publicKey, privateKey, subscription: subscription.toJSON(), favorites }));
}
