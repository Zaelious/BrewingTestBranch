import type { EffectGroup, RecipeOption, RecipeRecord } from './types';
import { usageForCategory } from './usage';

function optionKey(record: RecipeRecord): string {
  return [
    record.effect,
    record.category,
    record.level,
    record.drink,
    record.ingredients.map((ingredient) => ingredient.trim().toLowerCase()).join('\u001f'),
    record.tentative ? 'tentative' : 'confirmed',
  ].join('\u001e');
}

export function groupRecipesByEffect(records: RecipeRecord[]): EffectGroup[] {
  const groups = new Map<string, { effect: string; options: Map<string, RecipeOption> }>();

  for (const record of records) {
    let group = groups.get(record.effect);
    if (!group) {
      group = { effect: record.effect, options: new Map() };
      groups.set(record.effect, group);
    }

    const key = optionKey(record);
    const existing = group.options.get(key);
    if (existing) {
      if (!existing.brewers.some((brewer) => brewer.id === record.brewerId)) {
        existing.brewers.push({ id: record.brewerId, name: record.brewerName });
        existing.brewers.sort((a, b) => a.name.localeCompare(b.name));
      }
      continue;
    }

    group.options.set(key, {
      effect: record.effect,
      drink: record.drink,
      category: record.category,
      level: record.level,
      ingredients: [...record.ingredients],
      tentative: Boolean(record.tentative),
      brewers: [{ id: record.brewerId, name: record.brewerName }],
    });
  }

  return [...groups.values()].map((group) => ({
    effect: group.effect,
    options: [...group.options.values()].sort(
      (a, b) =>
        (usageForCategory(a.category) === usageForCategory(b.category)
          ? 0
          : usageForCategory(a.category) === 'single'
            ? -1
            : 1) ||
        a.level - b.level ||
        a.drink.localeCompare(b.drink) ||
        a.ingredients.join('\u001f').localeCompare(b.ingredients.join('\u001f')),
    ),
  }));
}

export function countRecipeOptions(groups: EffectGroup[]): number {
  return groups.reduce((total, group) => total + group.options.length, 0);
}
