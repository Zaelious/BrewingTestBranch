import { describe, expect, it } from 'vitest';
import { countRecipeOptions, groupRecipesByEffect } from './group-results';
import type { RecipeRecord } from './types';

const records: RecipeRecord[] = [
  {
    id: 'a',
    brewerId: 'zuzus',
    brewerName: 'Zuzus',
    drink: 'Bourbon',
    category: 'Liquor',
    level: 70,
    effect: 'Direct Fire Damage+',
    ingredients: ['Pear', 'Mint'],
  },
  {
    id: 'b',
    brewerId: 'rik',
    brewerName: 'Rik',
    drink: 'Bourbon',
    category: 'Liquor',
    level: 70,
    effect: 'Direct Fire Damage+',
    ingredients: ['Pear', 'Mint'],
  },
  {
    id: 'c',
    brewerId: 'zuzus',
    brewerName: 'Zuzus',
    drink: 'Rice Wine',
    category: 'Wine',
    level: 65,
    effect: 'Direct Fire Damage+',
    ingredients: ['Dill', 'Peach'],
  },
  {
    id: 'd',
    brewerId: 'zuzus',
    brewerName: 'Zuzus',
    drink: 'Cider',
    category: 'Cider',
    level: 80,
    effect: 'Max Health +',
    ingredients: ['Apple'],
  },
];

describe('groupRecipesByEffect', () => {
  it('groups records under exact effects and collapses duplicate recipes across brewers', () => {
    const groups = groupRecipesByEffect(records);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.effect).toBe('Direct Fire Damage+');
    expect(groups[0]?.options).toHaveLength(2);
    expect(groups[0]?.options[0]?.brewers.map((brewer) => brewer.name)).toEqual(['Rik', 'Zuzus']);
    expect(countRecipeOptions(groups)).toBe(3);
  });

  it('sorts single-use recipes before three-use recipes', () => {
    const options = groupRecipesByEffect(records)[0]?.options ?? [];
    expect(options.map((option) => option.category)).toEqual(['Liquor', 'Wine']);
  });
});
