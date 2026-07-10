import { describe, expect, it } from 'vitest';
import type { BrewerSummary, RecipeRecord } from './types';
import { readSearchState, sanitizeSearchState, searchStateToParams } from './url-state';

const brewers: BrewerSummary[] = [
  { id: 'zuzus', name: 'Zuzus', file: 'zuzus.json', recipeCount: 1, updated: '2026-07-10' },
];
const records: RecipeRecord[] = [
  {
    id: 'one',
    brewerId: 'zuzus',
    brewerName: 'Zuzus',
    drink: 'Porter',
    category: 'Beer',
    level: 90,
    effect: 'Taunt +%',
    ingredients: ['Barley'],
  },
];

describe('URL search state', () => {
  it('restores every search and filter value', () => {
    const state = readSearchState(
      '?q=Taunt+%2B%25&brewer=zuzus&maxLevel=90&usage=triple&drink=Porter&category=Beer',
    );

    expect(state).toEqual({
      query: 'Taunt +%',
      brewer: 'zuzus',
      maxLevel: '90',
      usage: 'triple',
      drink: 'Porter',
      category: 'Beer',
    });
    expect(readSearchState(searchStateToParams(state))).toEqual(state);
  });

  it('reads the old exact level parameter as a maximum level', () => {
    expect(readSearchState('?level=90').maxLevel).toBe('90');
  });

  it('clears invalid values after data is loaded', () => {
    const invalid = readSearchState(
      '?q=test&brewer=missing&maxLevel=999&usage=invalid&drink=Nope&category=Magic',
    );
    expect(sanitizeSearchState(invalid, brewers, records)).toEqual({
      query: 'test',
      brewer: '',
      maxLevel: '',
      usage: '',
      drink: '',
      category: '',
    });
  });
});
