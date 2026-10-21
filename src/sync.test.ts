import { describe, expect, it } from 'vitest';
import { diffFavorites, merge } from './sync';
import type { Favorite } from './favorites';

const padres: Favorite = { league: 'MLB', match: 'Padres', label: 'Padres' };
const lakers: Favorite = { league: 'NBA', match: 'Lakers', label: 'Lakers' };
const bulls: Favorite = { league: 'NBA', match: 'Bulls', label: 'Bulls' };

describe('merge', () => {
  it('übernimmt beim ersten Anmelden die lokalen Teams, wenn das Konto noch keine hat', () => {
    const next = merge({ favorites: [padres], revealed: ['a'] }, { favorites: [], revealed: [] }, 'first');
    expect(next).toEqual({ favorites: [padres], revealed: ['a'] });
  });

  it('behält beim ersten Anmelden die Teams des Kontos und vereinigt aufgedeckte Spiele', () => {
    const next = merge({ favorites: [padres], revealed: ['a', 'b'] }, { favorites: [lakers], revealed: ['b', 'c'] }, 'first');
    expect(next).toEqual({ favorites: [lakers], revealed: ['b', 'c', 'a'] });
  });

  it('lässt nach Offline-Änderungen die lokalen Teams gewinnen', () => {
    const next = merge({ favorites: [bulls], revealed: ['a'] }, { favorites: [lakers], revealed: ['c'] }, 'dirty');
    expect(next).toEqual({ favorites: [bulls], revealed: ['c', 'a'] });
  });

  it('übernimmt sonst den Stand des Kontos, damit Entfernen überall wirkt', () => {
    const remote = { favorites: [lakers], revealed: ['c'] };
    expect(merge({ favorites: [padres, lakers], revealed: ['a', 'c'] }, remote, 'normal')).toEqual(remote);
  });
});

describe('diffFavorites', () => {
  it('findet hinzugefügte und entfernte Teams', () => {
    expect(diffFavorites([padres, lakers], [lakers, bulls])).toEqual({ added: [bulls], removed: [padres] });
  });
});
