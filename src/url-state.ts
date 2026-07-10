import type { BrewerSummary, RecipeRecord, SearchState, UsageFilter } from './types';

export const EMPTY_SEARCH_STATE: SearchState = {
  query: '',
  brewer: '',
  maxLevel: '',
  usage: '',
  drink: '',
  category: '',
};

function getParams(source: string | URL | URLSearchParams): URLSearchParams {
  if (source instanceof URLSearchParams) return source;
  if (source instanceof URL) return source.searchParams;
  if (source.startsWith('?')) return new URLSearchParams(source);
  return new URL(source, 'https://brewing-ledger.local').searchParams;
}

function readUsage(value: string | null): UsageFilter {
  return value === 'single' || value === 'triple' ? value : '';
}

export function readSearchState(source: string | URL | URLSearchParams): SearchState {
  const params = getParams(source);
  return {
    query: params.get('q')?.trim() ?? '',
    brewer: params.get('brewer')?.trim() ?? '',
    maxLevel: (params.get('maxLevel') ?? params.get('level'))?.trim() ?? '',
    usage: readUsage(params.get('usage')),
    drink: params.get('drink')?.trim() ?? '',
    category: params.get('category')?.trim() ?? '',
  };
}

export function sanitizeSearchState(
  state: SearchState,
  brewers: BrewerSummary[],
  records: RecipeRecord[],
): SearchState {
  const brewerIds = new Set(brewers.map((brewer) => brewer.id));
  const drinks = new Set(records.map((record) => record.drink));
  const categories = new Set(records.map((record) => record.category));
  const levels = new Set(records.map((record) => String(record.level)));

  return {
    query: state.query.trim(),
    brewer: brewerIds.has(state.brewer) ? state.brewer : '',
    maxLevel: levels.has(state.maxLevel) ? state.maxLevel : '',
    usage: state.usage === 'single' || state.usage === 'triple' ? state.usage : '',
    drink: drinks.has(state.drink) ? state.drink : '',
    category: categories.has(state.category as never) ? state.category : '',
  };
}

export function searchStateToParams(state: SearchState): URLSearchParams {
  const params = new URLSearchParams();
  const entries: Array<[string, string]> = [
    ['q', state.query.trim()],
    ['brewer', state.brewer],
    ['maxLevel', state.maxLevel],
    ['usage', state.usage],
    ['drink', state.drink],
    ['category', state.category],
  ];

  for (const [key, value] of entries) {
    if (value) params.set(key, value);
  }

  return params;
}
