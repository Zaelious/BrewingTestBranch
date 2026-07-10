export const SUPPORTED_CATEGORIES = ['Liquor', 'Cider', 'Beer', 'Wine'] as const;

export type RecipeCategory = (typeof SUPPORTED_CATEGORIES)[number];
export type UsageType = 'single' | 'triple';
export type UsageFilter = '' | UsageType;

export interface BrewerSummary {
  id: string;
  name: string;
  file: string;
  recipeCount: number;
  updated: string;
}

export interface Brewer {
  id: string;
  name: string;
  updated: string;
}

export interface Recipe {
  id: string;
  drink: string;
  category: RecipeCategory;
  level: number;
  effect: string;
  ingredients: string[];
  keywords?: string[];
  tentative?: boolean;
}

export interface BrewerData {
  schemaVersion: number;
  brewer: Brewer;
  recipes: Recipe[];
}

export interface RecipeRecord extends Recipe {
  brewerId: string;
  brewerName: string;
}

export interface SearchState {
  query: string;
  brewer: string;
  maxLevel: string;
  usage: UsageFilter;
  /** Legacy/advanced URL filter. */
  drink: string;
  /** Legacy/advanced URL filter. */
  category: string;
}

export interface RecipeOption {
  effect: string;
  drink: string;
  category: RecipeCategory;
  level: number;
  ingredients: string[];
  tentative: boolean;
  brewers: Array<{ id: string; name: string }>;
}

export interface EffectGroup {
  effect: string;
  options: RecipeOption[];
}
