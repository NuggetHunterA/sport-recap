import { describe, expect, it } from 'vitest';
import { pruneNights } from './nights';

function fakeStorage(keys: string[]): Storage {
  const data = new Map(keys.map((k) => [k, '{}']));
  return {
    get length() { return data.size; },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
    clear: () => data.clear(),
  };
}
const keysOf = (s: Storage) => Array.from({ length: s.length }, (_, i) => s.key(i)!).sort();

describe('pruneNights', () => {
  it('löscht Nächte älterer Versionen und lässt andere Einträge stehen', () => {
    const s = fakeStorage(['night:v7:2026-10-01', 'night:v8:2026-10-02', 'revealed:v1', 'favorites:v1']);
    pruneNights(s);
    expect(keysOf(s)).toEqual(['favorites:v1', 'night:v8:2026-10-02', 'revealed:v1']);
  });

  it('behält nur die neuesten Nächte', () => {
    const dates = Array.from({ length: 20 }, (_, i) => `night:v8:2026-09-${String(i + 1).padStart(2, '0')}`);
    const s = fakeStorage(dates);
    pruneNights(s, 14);
    expect(keysOf(s)).toEqual(dates.slice(6));
  });
});
