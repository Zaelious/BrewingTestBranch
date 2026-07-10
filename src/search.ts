import type { RecipeRecord, SearchState } from './types';
import { usageForCategory } from './usage';

export function normalizeSearchText(value: string | number): string {
  return String(value).toLowerCase().replace(/\s+/gu, ' ').trim();
}

function normalizeSymbolSpacing(value: string | number): string {
  return normalizeSearchText(value).replace(/\s*([+\-/%?,])\s*/gu, '$1');
}

function searchVariants(value: string | number): string[] {
  const normalized = normalizeSearchText(value);
  const symbolNormalized = normalizeSymbolSpacing(value);
  return normalized === symbolNormalized ? [normalized] : [normalized, symbolNormalized];
}

export function hasSearchIntent(state: SearchState): boolean {
  return Object.values(state).some((value) => normalizeSearchText(value) !== '');
}

function matchesFilters(record: RecipeRecord, state: SearchState): boolean {
  const maxLevel = state.maxLevel ? Number(state.maxLevel) : null;
  return (
    (!state.brewer || record.brewerId === state.brewer) &&
    (!state.drink || record.drink === state.drink) &&
    (!state.category || record.category === state.category) &&
    (!state.usage || usageForCategory(record.category) === state.usage) &&
    (maxLevel === null || record.level <= maxLevel)
  );
}

function searchableFields(record: RecipeRecord): string[] {
  return [
    record.effect,
    ...(record.keywords ?? []),
    record.drink,
    record.category,
    usageForCategory(record.category) === 'single' ? 'single use liquor cider' : 'three use 3 use beer wine',
    record.level,
    ...record.ingredients,
    record.brewerName,
  ].flatMap(searchVariants);
}

function rankRecord(record: RecipeRecord, query: string, words: string[]): number {
  const effectVariants = searchVariants(record.effect);
  const queryVariants = searchVariants(query);
  const keywordVariants = (record.keywords ?? []).flatMap(searchVariants);
  const drinkVariants = searchVariants(record.drink);
  const categoryVariants = searchVariants(record.category);
  const brewerVariants = searchVariants(record.brewerName);
  const ingredientVariants = record.ingredients.flatMap(searchVariants);

  if (normalizeSymbolSpacing(record.effect) === normalizeSymbolSpacing(query)) return 0;
  if (effectVariants.some((field) => queryVariants.some((term) => field.startsWith(term)))) return 1;
  if (effectVariants.some((field) => queryVariants.some((term) => field.includes(term)))) return 2;
  if (words.every((word) => effectVariants.some((field) => field.includes(word)))) return 3;
  if (keywordVariants.some((field) => queryVariants.some((term) => field.includes(term)))) return 4;
  if (words.every((word) => [...effectVariants, ...keywordVariants].some((field) => field.includes(word)))) {
    return 5;
  }
  if (words.every((word) => drinkVariants.some((field) => field.includes(word)))) return 6;
  if (words.every((word) => categoryVariants.some((field) => field.includes(word)))) return 7;
  if (words.every((word) => brewerVariants.some((field) => field.includes(word)))) return 8;
  if (words.every((word) => ingredientVariants.some((ingredient) => ingredient.includes(word)))) return 9;
  return 10;
}

export function searchRecipes(records: RecipeRecord[], state: SearchState): RecipeRecord[] {
  if (!hasSearchIntent(state)) return [];

  const query = normalizeSearchText(state.query);
  const words = query ? query.split(' ') : [];

  return records
    .filter((record) => matchesFilters(record, state))
    .filter((record) => {
      if (words.length === 0) return true;
      const fields = searchableFields(record);
      return words.every((word) => fields.some((field) => field.includes(word)));
    })
    .map((record, index) => ({
      record,
      index,
      rank: words.length === 0 ? 0 : rankRecord(record, query, words),
    }))
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        a.record.effect.localeCompare(b.record.effect) ||
        a.record.level - b.record.level ||
        a.record.drink.localeCompare(b.record.drink) ||
        a.record.brewerName.localeCompare(b.record.brewerName) ||
        a.index - b.index,
    )
    .map(({ record }) => record);
}
