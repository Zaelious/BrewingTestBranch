import { describe, expect, it } from 'vitest';
import { hasSearchIntent, searchRecipes } from './search';
import type { RecipeRecord, SearchState } from './types';

const defaults: SearchState = {
  query: '',
  brewer: '',
  maxLevel: '',
  usage: '',
  drink: '',
  category: '',
};

const recipes: RecipeRecord[] = [
  {
    id: 'negative-taunt',
    brewerId: 'zuzus',
    brewerName: 'Zuzus',
    drink: 'Pilsner',
    category: 'Beer',
    level: 80,
    effect: 'Taunt -%',
    keywords: ['reduce threat', 'threat reduction'],
    ingredients: ['Rye', 'Vanilla'],
  },
  {
    id: 'positive-taunt',
    brewerId: 'zuzus',
    brewerName: 'Zuzus',
    drink: 'Porter',
    category: 'Beer',
    level: 90,
    effect: 'Taunt +%',
    keywords: ['increase threat'],
    ingredients: ['Barley', 'Taunt -% Extract'],
  },
  {
    id: 'ingredient-hit',
    brewerId: 'rik',
    brewerName: 'Rik',
    drink: 'Cider',
    category: 'Cider',
    level: 20,
    effect: 'Max Health +',
    ingredients: ['Wild Apple', 'Vanilla Bean'],
  },
];

function find(overrides: Partial<SearchState>) {
  return searchRecipes(recipes, { ...defaults, ...overrides });
}

describe('searchRecipes', () => {
  it('ranks an exact effect ahead of an ingredient-only match', () => {
    expect(find({ query: '  TAUNT   - % ' }).map((recipe) => recipe.id)).toEqual([
      'negative-taunt',
      'positive-taunt',
    ]);
  });

  it('requires every word to match somewhere in the record', () => {
    expect(find({ query: 'vanilla pilsner' }).map((recipe) => recipe.id)).toEqual([
      'negative-taunt',
    ]);
  });

  it('searches ingredients case-insensitively', () => {
    expect(find({ query: 'wild apple' }).map((recipe) => recipe.id)).toEqual(['ingredient-hit']);
  });

  it('applies the brewer filter independently', () => {
    expect(find({ brewer: 'rik' }).map((recipe) => recipe.id)).toEqual(['ingredient-hit']);
  });

  it('treats the selected level as a maximum', () => {
    expect(find({ maxLevel: '80' }).map((recipe) => recipe.id)).toEqual([
      'ingredient-hit',
      'negative-taunt',
    ]);
  });

  it('filters by mechanically meaningful usage groups', () => {
    expect(find({ usage: 'single' }).map((recipe) => recipe.id)).toEqual(['ingredient-hit']);
    expect(find({ usage: 'triple' }).map((recipe) => recipe.id)).toEqual([
      'negative-taunt',
      'positive-taunt',
    ]);
  });

  it('uses semantic keywords so reduce threat finds Taunt -%', () => {
    expect(find({ query: 'reduce threat' }).map((recipe) => recipe.effect)).toEqual(['Taunt -%']);
  });

  it('keeps positive and negative Taunt effects distinct', () => {
    expect(find({ query: 'Taunt +%' }).map((recipe) => recipe.effect)).toEqual(['Taunt +%']);
    expect(find({ query: 'Taunt+%' }).map((recipe) => recipe.effect)).toEqual(['Taunt +%']);
    expect(find({ query: 'Taunt -%' })[0]?.effect).toBe('Taunt -%');
    expect(find({ query: 'Taunt-%' })[0]?.effect).toBe('Taunt -%');
  });

  it('lets any filter start a result set', () => {
    expect(hasSearchIntent({ ...defaults, maxLevel: '20' })).toBe(true);
    expect(hasSearchIntent({ ...defaults, usage: 'single' })).toBe(true);
    expect(hasSearchIntent(defaults)).toBe(false);
  });

  it('ignores harmless whitespace around effect signs without removing them', () => {
    const spacedEffect: RecipeRecord[] = [
      { ...recipes[1]!, effect: 'Taunt +', ingredients: ['Barley'] },
    ];
    expect(searchRecipes(spacedEffect, { ...defaults, query: 'taunt+' })[0]?.effect).toBe('Taunt +');
    expect(searchRecipes(spacedEffect, { ...defaults, query: 'taunt-' })).toEqual([]);
  });
});
