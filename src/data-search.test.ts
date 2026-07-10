import { describe, expect, it } from 'vitest';
import zuzusJson from '../public/data/zuzus.json';
import { searchRecipes } from './search';
import type { BrewerData, RecipeRecord, SearchState } from './types';

const zuzus = zuzusJson as BrewerData;
const records: RecipeRecord[] = zuzus.recipes.map((recipe) => ({
  ...recipe,
  brewerId: zuzus.brewer.id,
  brewerName: zuzus.brewer.name,
}));
const defaults: SearchState = {
  query: '',
  brewer: '',
  maxLevel: '',
  usage: '',
  drink: '',
  category: '',
};

function search(query: string) {
  return searchRecipes(records, { ...defaults, query });
}

describe('published brewing data search', () => {
  it('maps reduce threat only to the negative Taunt effect', () => {
    const results = search('reduce threat');
    expect(results).toHaveLength(23);
    expect(new Set(results.map((recipe) => recipe.effect))).toEqual(new Set(['Taunt -%']));
  });

  it('keeps compact positive and negative Taunt searches separate', () => {
    expect(search('Taunt+%')).toHaveLength(11);
    expect(search('Taunt+%').every((recipe) => recipe.effect === 'Taunt +%')).toBe(true);
    expect(search('Taunt-%')).toHaveLength(23);
    expect(search('Taunt-%').every((recipe) => recipe.effect === 'Taunt -%')).toBe(true);
  });

  it('places cider with liquor in the single-use filter', () => {
    const singleUse = searchRecipes(records, { ...defaults, usage: 'single' });
    expect(singleUse.some((recipe) => recipe.category === 'Cider')).toBe(true);
    expect(singleUse.every((recipe) => recipe.category === 'Cider' || recipe.category === 'Liquor')).toBe(true);
  });
});
