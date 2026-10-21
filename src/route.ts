// Tab und Datum stehen in der Adresse, damit „Zurück“ zum vorigen Tab bzw. zur vorigen Nacht führt.

export type Tab = 'night' | 'tonight' | 'standings' | 'settings';
/** `date` nur bei „Letzte Nacht“ und nur für frühere Nächte; `null` heißt immer die aktuelle Nacht. */
export type Route = { tab: Tab; date: string | null };

const TABS: Tab[] = ['night', 'tonight', 'standings', 'settings'];

export function parseRoute(search: string, today: string): Route {
  const params = new URLSearchParams(search);
  const raw = params.get('tab');
  // Alte Links auf „Meine Teams“ öffnen die Einstellungen
  const tab: Tab = raw === 'teams' ? 'settings' : TABS.includes(raw as Tab) ? raw as Tab : 'night';
  const date = params.get('date');
  const valid = tab === 'night' && date !== null && /^\d{4}-\d{2}-\d{2}$/.test(date) && date < today;
  return { tab, date: valid ? date : null };
}

/** Neue Adresse für `route`; andere Parameter bleiben erhalten. „Letzte Nacht“ braucht kein `tab`. */
export function routeSearch(route: Route, search = ''): string {
  const params = new URLSearchParams(search);
  params.delete('tab');
  params.delete('date');
  if (route.tab !== 'night') params.set('tab', route.tab);
  if (route.tab === 'night' && route.date) params.set('date', route.date);
  const s = params.toString();
  return s ? `?${s}` : '';
}

export function sameRoute(a: Route, b: Route): boolean {
  return a.tab === b.tab && a.date === b.date;
}
