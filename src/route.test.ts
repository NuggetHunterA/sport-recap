import { describe, expect, it } from 'vitest';
import { parseRoute, routeSearch } from './route';

const today = '2026-10-21';

describe('parseRoute', () => {
  it('startet ohne Parameter mit der aktuellen Nacht', () => {
    expect(parseRoute('', today)).toEqual({ tab: 'night', date: null });
  });

  it('liest Tab und Datum', () => {
    expect(parseRoute('?tab=tonight', today)).toEqual({ tab: 'tonight', date: null });
    expect(parseRoute('?date=2026-10-18', today)).toEqual({ tab: 'night', date: '2026-10-18' });
  });

  it('öffnet bei alten Links auf „Meine Teams“ die Einstellungen', () => {
    expect(parseRoute('?tab=teams', today).tab).toBe('settings');
  });

  it('ignoriert unbekannte Tabs, kaputte und heutige oder spätere Daten', () => {
    expect(parseRoute('?tab=foo', today).tab).toBe('night');
    expect(parseRoute('?date=gestern', today).date).toBeNull();
    expect(parseRoute('?date=2026-10-21', today).date).toBeNull();
    expect(parseRoute('?date=2026-10-25', today).date).toBeNull();
  });

  it('beachtet das Datum nur bei „Letzte Nacht“', () => {
    expect(parseRoute('?tab=standings&date=2026-10-18', today)).toEqual({ tab: 'standings', date: null });
  });
});

describe('routeSearch', () => {
  it('schreibt nur, was vom Standard abweicht', () => {
    expect(routeSearch({ tab: 'night', date: null })).toBe('');
    expect(routeSearch({ tab: 'night', date: '2026-10-18' })).toBe('?date=2026-10-18');
    expect(routeSearch({ tab: 'tonight', date: null })).toBe('?tab=tonight');
  });

  it('behält fremde Parameter und ersetzt alte Werte', () => {
    expect(routeSearch({ tab: 'standings', date: null }, '?tab=tonight&date=2026-10-18&x=1')).toBe('?x=1&tab=standings');
  });

  it('ergibt beim Einlesen wieder dieselbe Route', () => {
    for (const r of [{ tab: 'night', date: '2026-10-01' }, { tab: 'settings', date: null }] as const) {
      expect(parseRoute(routeSearch(r), today)).toEqual(r);
    }
  });
});
