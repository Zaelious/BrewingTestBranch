import type { RecipeCategory, UsageType } from './types';

const CATEGORY_USAGE: Record<RecipeCategory, UsageType> = {
  Liquor: 'single',
  Cider: 'single',
  Beer: 'triple',
  Wine: 'triple',
};

export function usageForCategory(category: RecipeCategory): UsageType {
  return CATEGORY_USAGE[category];
}

export function usageLabel(usage: UsageType): string {
  return usage === 'single' ? 'Single-use — Liquor & Cider' : '3-use — Beer & Wine';
}
