import { describe, expect, it } from 'vitest';
import { activeCategory, categories, filterCatalog, parseCatalogSearch } from '@/lib/catalog-navigation';

describe('Shared category navigation', () => {
  const entries = [
    { type: 'MOVIE' as const, title: 'Hope' },
    { type: 'SERIES' as const, title: 'Lupin' },
    { type: 'ANIME' as const, title: 'Anime example' },
    { type: 'GAME' as const, title: 'Game example' },
    { type: 'BOOK' as const, title: 'Book example' },
  ];
  for (const category of categories) {
    it(`accepts ${category.type}, selects ${category.label}, and filters only that category`, () => {
      const search = parseCatalogSearch({ type: category.type });
      expect(search.type).toBe(category.type);
      expect(activeCategory('/search', search.type)).toBe(category.label);
      expect(filterCatalog(entries, search.type)).toEqual([entries.find(entry => entry.type === category.type)]);
    });
  }
  it('selects no category on the homepage', () => {
    expect(activeCategory('/')).toBeUndefined();
    expect(activeCategory('/login')).toBeUndefined();
    expect(activeCategory('/search')).toBeUndefined();
  });
  it('selects the category on media detail pages', () => {
    expect(activeCategory('/media/external/MOVIE/1058424')).toBe('Movies');
    expect(activeCategory('/media/external/SERIES/105248')).toBe('Series');
  });
  it('does not substitute movies for empty game or book catalogs', () => {
    expect(filterCatalog(entries.slice(0, 2), 'GAME')).toEqual([]);
    expect(filterCatalog(entries.slice(0, 2), 'BOOK')).toEqual([]);
  });
  it('filters a title query within the category', () => {
    expect(filterCatalog(entries, 'MOVIE', 'hope')).toEqual([entries[0]]);
    expect(filterCatalog(entries, 'SERIES', 'hope')).toEqual([]);
  });
});
