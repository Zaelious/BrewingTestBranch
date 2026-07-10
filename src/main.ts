import './styles.css';
import { countRecipeOptions, groupRecipesByEffect } from './group-results';
import { hasSearchIntent, searchRecipes } from './search';
import type {
  BrewerData,
  BrewerSummary,
  EffectGroup,
  RecipeOption,
  RecipeRecord,
  SearchState,
  UsageType,
} from './types';
import {
  EMPTY_SEARCH_STATE,
  readSearchState,
  sanitizeSearchState,
  searchStateToParams,
} from './url-state';
import { usageForCategory, usageLabel } from './usage';

const EFFECT_GROUPS_PER_PAGE = 12;
const THEME_STORAGE_KEY = 'brewing-ledger-theme';
const numberFormatter = new Intl.NumberFormat('en-US');

const appElement = document.querySelector<HTMLDivElement>('#app');
if (!appElement) throw new Error('App root was not found.');
const app: HTMLDivElement = appElement;

let state: SearchState = readSearchState(new URL(window.location.href));
let brewers: BrewerSummary[] = [];
let records: RecipeRecord[] = [];
let visibleEffectGroups = EFFECT_GROUPS_PER_PAGE;
let isLoading = true;
let loadError = '';

function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function dataUrl(fileName: string): string {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}data/${encodeURIComponent(fileName)}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return (await response.json()) as T;
}

function preferredTheme(): 'light' | 'dark' {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Storage can be blocked without affecting the site.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: 'light' | 'dark', persist = true): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  if (persist) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Storage can be blocked without affecting the theme for this visit.
    }
  }

  const button = document.querySelector<HTMLButtonElement>('#theme-toggle');
  if (button) {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    button.setAttribute('aria-label', `Switch to ${nextTheme} ledger`);
    button.title = `Switch to ${nextTheme} ledger`;
    button.innerHTML = `<span aria-hidden="true">${theme === 'dark' ? '☀' : '☾'}</span>`;
  }
}

applyTheme(preferredTheme(), false);

function renderShell(): void {
  app.innerHTML = `
    <header class="hero">
      <nav class="masthead" aria-label="Site identity">
        <a class="brand" href="${escapeHtml(import.meta.env.BASE_URL)}" aria-label="Brewing Ledger home">
          <span class="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 48 48" role="img">
              <path d="M10 14h24v22c0 4-3 7-7 7H17c-4 0-7-3-7-7V14Z" />
              <path d="M34 19h5c4 0 6 3 6 7v2c0 5-3 8-8 8h-3" />
              <path d="M8 14h28M14 10c0-3 3-5 6-3 2-4 8-3 8 2 4-1 7 1 7 5H10c-1-2 0-4 4-4Z" />
              <path d="M17 20v14M24 20v14" />
            </svg>
          </span>
          <span>
            <strong>Brewing Ledger</strong>
            <small>Project Gorgon guild tool</small>
          </span>
        </a>

        <button class="theme-toggle" id="theme-toggle" type="button"></button>
      </nav>

      <div class="hero-content">
        <form class="search-form" role="search">
          <span class="search-symbol" aria-hidden="true"></span>
          <label class="sr-only" for="global-search">Search brewing effects, ingredients, or drinks</label>
          <input
            id="global-search"
            name="q"
            type="search"
            placeholder="Search buff, ingredient, or drink…"
            autocomplete="off"
            spellcheck="false"
          />
          <button class="clear-search" type="button" aria-label="Clear search">×</button>
        </form>

        <div class="brewer-picker" aria-labelledby="brewer-picker-label">
          <span id="brewer-picker-label">Brewer</span>
          <div class="brewer-buttons" id="brewer-buttons">
            <span class="control-skeleton"></span>
          </div>
        </div>
      </div>
    </header>

    <main>
      <section class="filter-bar" aria-label="Recipe filters">
        <div class="primary-filters">
          <label class="select-field">
            <span>Max level</span>
            <select id="max-level-filter" name="maxLevel">
              <option value="">Any level</option>
            </select>
          </label>

          <fieldset class="usage-field">
            <legend>Uses</legend>
            <div class="segmented-control" id="usage-filter">
              <button type="button" data-usage="" aria-pressed="true">All</button>
              <button type="button" data-usage="single" aria-pressed="false">1-use</button>
              <button type="button" data-usage="triple" aria-pressed="false">3-use</button>
            </div>
          </fieldset>

          <details class="more-filters" id="more-filters">
            <summary>Drink / type <span aria-hidden="true">▾</span></summary>
            <div class="advanced-filter-grid">
              <label class="select-field">
                <span>Specific drink</span>
                <select id="drink-filter" name="drink">
                  <option value="">All drinks</option>
                </select>
              </label>
              <label class="select-field">
                <span>Data category</span>
                <select id="category-filter" name="category">
                  <option value="">All categories</option>
                </select>
              </label>
            </div>
          </details>

          <button class="reset-button" id="reset-all" type="button">Reset</button>
        </div>

        <div class="active-filters" id="active-filters" aria-live="polite"></div>
      </section>

      <section class="results-panel" aria-labelledby="results-title">
        <div class="results-heading" id="results-heading" aria-live="polite" aria-atomic="true"></div>
        <div id="results" aria-busy="true"></div>
      </section>
    </main>

    <footer>
      <p>
        If you'd like to upload your brewing data, send any files or questions to
        <a href="mailto:admin@laeth.fyi">admin@laeth.fyi</a>
      </p>
    </footer>
  `;
  applyTheme((document.documentElement.dataset.theme as 'light' | 'dark') || preferredTheme(), false);
}

function setSelectOptions(
  selector: string,
  defaultLabel: string,
  values: Array<{ value: string; label: string }>,
): void {
  const select = document.querySelector<HTMLSelectElement>(selector);
  if (!select) return;
  select.innerHTML = [
    `<option value="">${escapeHtml(defaultLabel)}</option>`,
    ...values.map(
      ({ value, label }) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`,
    ),
  ].join('');
}

function populateFilters(): void {
  const drinks = [...new Set(records.map((record) => record.drink))].sort((a, b) =>
    a.localeCompare(b),
  );
  const categories = [...new Set(records.map((record) => record.category))].sort((a, b) =>
    a.localeCompare(b),
  );
  const levels = [...new Set(records.map((record) => record.level))].sort((a, b) => a - b);

  setSelectOptions(
    '#max-level-filter',
    'Any level',
    levels.map((level) => ({ value: String(level), label: `≤ Lv ${level}` })),
  );
  setSelectOptions(
    '#drink-filter',
    'All drinks',
    drinks.map((drink) => ({ value: drink, label: drink })),
  );
  setSelectOptions(
    '#category-filter',
    'All categories',
    categories.map((category) => ({ value: category, label: category })),
  );
}

function renderBrewerControls(): void {
  const container = document.querySelector<HTMLDivElement>('#brewer-buttons');
  if (!container) return;

  if (loadError) {
    container.innerHTML = '<span class="inline-error">Brewers unavailable</span>';
    return;
  }
  if (isLoading) {
    container.innerHTML = '<span class="control-skeleton"></span>';
    return;
  }

  const buttons = [
    { id: '', name: 'All brewers', recipeCount: records.length },
    ...brewers.map((brewer) => ({
      id: brewer.id,
      name: brewer.name,
      recipeCount: brewer.recipeCount,
    })),
  ];

  container.innerHTML = buttons
    .map(({ id, name, recipeCount }) => {
      const active = state.brewer === id;
      return `
        <button
          type="button"
          data-brewer="${escapeHtml(id)}"
          aria-pressed="${active}"
          class="${active ? 'active' : ''}"
        >
          <span>${escapeHtml(name)}</span>
          <small>${numberFormatter.format(recipeCount)}</small>
        </button>
      `;
    })
    .join('');

  container.querySelectorAll<HTMLButtonElement>('[data-brewer]').forEach((button) => {
    button.addEventListener('click', () => updateState({ brewer: button.dataset.brewer ?? '' }));
  });
}

function renderStats(): void {
  const recipeStat = document.querySelector<HTMLElement>('#recipe-stat');
  const effectStat = document.querySelector<HTMLElement>('#effect-stat');
  const brewerStat = document.querySelector<HTMLElement>('#brewer-stat');
  const dataDate = document.querySelector<HTMLElement>('#data-date');
  const uniqueEffects = new Set(records.map((record) => record.effect)).size;

  if (recipeStat) recipeStat.textContent = numberFormatter.format(records.length);
  if (effectStat) effectStat.textContent = numberFormatter.format(uniqueEffects);
  if (brewerStat) brewerStat.textContent = numberFormatter.format(brewers.length);

  if (dataDate && brewers.length > 0) {
    const newestDate = [...brewers].sort((a, b) => b.updated.localeCompare(a.updated))[0]?.updated;
    if (newestDate) {
      const formatted = new Date(`${newestDate}T00:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      dataDate.textContent = `Data updated ${formatted}.`;
    }
  }
}

function ingredientsMarkup(ingredients: string[]): string {
  return ingredients
    .map((ingredient) => `<span>${escapeHtml(ingredient)}</span>`)
    .join('');
}

function brewerBadgesMarkup(option: RecipeOption): string {
  return option.brewers
    .map((brewer) => `<span class="brewer-badge">${escapeHtml(brewer.name)}</span>`)
    .join('');
}

function drinkIcon(category: string): string {
  switch (category) {
    case 'Beer': return '🍺';
    case 'Wine': return '🍷';
    case 'Cider': return '🍎';
    default: return '⚗';
  }
}

function recipeRow(option: RecipeOption, showBrewers: boolean): string {
  return `
    <li class="recipe-row${showBrewers ? ' with-brewer' : ''}">
      <div class="recipe-level"><span>Lv</span> ${escapeHtml(option.level)}</div>
      <div class="recipe-drink">
        <span class="drink-icon" aria-hidden="true">${drinkIcon(option.category)}</span>
        <span class="drink-copy">
          <strong>${escapeHtml(option.drink)}</strong>
          <small>${escapeHtml(option.category)}</small>
        </span>
      </div>
      <div class="recipe-ingredients">${ingredientsMarkup(option.ingredients)}</div>
      ${showBrewers ? `<div class="recipe-brewers">${brewerBadgesMarkup(option)}</div>` : ''}
      ${option.tentative ? '<span class="tentative" title="This recipe is not yet confirmed">Tentative</span>' : ''}
    </li>
  `;
}

function usageSection(
  usage: UsageType,
  options: RecipeOption[],
  showBrewers: boolean,
): string {
  if (options.length === 0) return '';
  const icon = usage === 'single' ? '⚗' : '🍺';
  const detail = usage === 'single' ? 'Liquor & cider · 1 use' : 'Beer & wine · 3 uses';
  return `
    <section class="usage-section usage-${usage}">
      <div class="usage-heading">
        <h4><span aria-hidden="true">${icon}</span> ${escapeHtml(detail)}</h4>
      </div>
      <div class="recipe-column-head${showBrewers ? ' with-brewer' : ''}" aria-hidden="true">
        <span>Level</span><span>Drink</span><span>Ingredients</span>${showBrewers ? '<span>Brewer</span>' : ''}
      </div>
      <ol class="recipe-rows">
        ${options.map((option) => recipeRow(option, showBrewers)).join('')}
      </ol>
    </section>
  `;
}

function effectGroupCard(group: EffectGroup): string {
  const showBrewers = !state.brewer && brewers.length > 1;
  const singleUse = group.options.filter((option) => usageForCategory(option.category) === 'single');
  const tripleUse = group.options.filter((option) => usageForCategory(option.category) === 'triple');
  const brewerCount = new Set(group.options.flatMap((option) => option.brewers.map((brewer) => brewer.id))).size;

  return `
    <li>
      <article class="effect-card">
        <header class="effect-heading">
          <h3><span aria-hidden="true">✦</span>${escapeHtml(group.effect)}</h3>
          <div class="effect-summary">
            <span>${numberFormatter.format(group.options.length)} ${group.options.length === 1 ? 'recipe' : 'recipes'}</span>
            ${showBrewers ? `<span>${numberFormatter.format(brewerCount)} ${brewerCount === 1 ? 'brewer' : 'brewers'}</span>` : ''}
          </div>
        </header>
        ${usageSection('single', singleUse, showBrewers)}
        ${usageSection('triple', tripleUse, showBrewers)}
      </article>
    </li>
  `;
}

function initialEmptyState(): string {
  return `
    <div class="empty-state start-state">
      <div class="empty-mark" aria-hidden="true">🍻</div>
      <h3>Search the guild brew book</h3>
      <p>Try a buff, ingredient, drink, or brewer.</p>
      <div class="empty-actions">
        <button type="button" data-empty-query="Direct Fire Damage">Fire damage</button>
        <button type="button" data-empty-query="Max Health +">Max health</button>
      </div>
    </div>
  `;
}

function noMatchesState(): string {
  return `
    <div class="empty-state no-matches">
      <span class="no-match-symbol" aria-hidden="true">?</span>
      <h3>No brews found</h3>
      <p>Try fewer filters or a different search.</p>
      <button class="primary-button" id="clear-from-empty" type="button">Clear all</button>
    </div>
  `;
}

function renderActiveFilters(): void {
  const container = document.querySelector<HTMLDivElement>('#active-filters');
  if (!container) return;

  const chips: Array<{ key: keyof SearchState; label: string }> = [];
  if (state.brewer) {
    chips.push({
      key: 'brewer',
      label: brewers.find((brewer) => brewer.id === state.brewer)?.name ?? state.brewer,
    });
  }
  if (state.maxLevel) chips.push({ key: 'maxLevel', label: `Up to level ${state.maxLevel}` });
  if (state.usage) {
    chips.push({
      key: 'usage',
      label: state.usage === 'single' ? 'Single-use drinks' : '3-use drinks',
    });
  }
  if (state.drink) chips.push({ key: 'drink', label: state.drink });
  if (state.category) chips.push({ key: 'category', label: state.category });

  if (chips.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <span>Active</span>
    ${chips
      .map(
        (chip) => `
          <button type="button" data-clear-filter="${escapeHtml(chip.key)}">
            ${escapeHtml(chip.label)} <span aria-hidden="true">×</span>
          </button>
        `,
      )
      .join('')}
  `;

  container.querySelectorAll<HTMLButtonElement>('[data-clear-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.clearFilter as keyof SearchState | undefined;
      if (key) updateState({ [key]: '' });
    });
  });
}

function attachResultActions(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-empty-query]').forEach((button) => {
    button.addEventListener('click', () => {
      updateState({ query: button.dataset.emptyQuery ?? '' });
      document.querySelector<HTMLInputElement>('#global-search')?.focus();
    });
  });
  document.querySelector<HTMLButtonElement>('#clear-from-empty')?.addEventListener('click', clearAll);
  document.querySelector<HTMLButtonElement>('#load-more')?.addEventListener('click', () => {
    visibleEffectGroups += EFFECT_GROUPS_PER_PAGE;
    renderResults();
  });
  document.querySelector<HTMLButtonElement>('#retry-data')?.addEventListener('click', () => {
    void loadData();
  });
}

function renderResults(): void {
  const container = document.querySelector<HTMLDivElement>('#results');
  const heading = document.querySelector<HTMLDivElement>('#results-heading');
  if (!container || !heading) return;

  container.setAttribute('aria-busy', String(isLoading));

  if (isLoading) {
    heading.innerHTML = '<h2 id="results-title">Loading brews…</h2>';
    container.innerHTML = `
      <div class="loading-list" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>
    `;
    return;
  }

  if (loadError) {
    heading.innerHTML = '<h2 id="results-title">Could not load brewing data</h2>';
    container.innerHTML = `
      <div class="empty-state no-matches">
        <span class="no-match-symbol" aria-hidden="true">!</span>
        <h3>The cellar door is stuck.</h3>
        <p>${escapeHtml(loadError)}</p>
        <button class="primary-button" id="retry-data" type="button">Try again</button>
      </div>
    `;
    attachResultActions();
    return;
  }

  if (!hasSearchIntent(state)) {
    heading.innerHTML = '<h2 id="results-title">Brew book</h2>';
    container.innerHTML = initialEmptyState();
    attachResultActions();
    return;
  }

  const matches = searchRecipes(records, state);
  const groups = groupRecipesByEffect(matches);
  const optionCount = countRecipeOptions(groups);
  heading.innerHTML = `
    <h2 id="results-title">
      ${numberFormatter.format(groups.length)} ${groups.length === 1 ? 'effect' : 'effects'}
      <span>· ${numberFormatter.format(optionCount)} ${optionCount === 1 ? 'recipe' : 'recipes'}</span>
    </h2>
    ${state.query ? `<p>“${escapeHtml(state.query.trim())}”</p>` : ''}
  `;

  if (groups.length === 0) {
    container.innerHTML = noMatchesState();
    attachResultActions();
    return;
  }

  const visible = groups.slice(0, visibleEffectGroups);
  container.innerHTML = `
    <ol class="effect-list">
      ${visible.map(effectGroupCard).join('')}
    </ol>
    ${
      visible.length < groups.length
        ? `<div class="load-more-wrap">
            <p>Showing ${numberFormatter.format(visible.length)} of ${numberFormatter.format(groups.length)} effects</p>
            <button class="primary-button" id="load-more" type="button">Show ${numberFormatter.format(Math.min(EFFECT_GROUPS_PER_PAGE, groups.length - visible.length))} more effects</button>
          </div>`
        : ''
    }
  `;
  attachResultActions();
}

function syncControls(): void {
  const controls: Array<[string, keyof SearchState]> = [
    ['#global-search', 'query'],
    ['#max-level-filter', 'maxLevel'],
    ['#drink-filter', 'drink'],
    ['#category-filter', 'category'],
  ];
  for (const [selector, key] of controls) {
    const control = document.querySelector<HTMLInputElement | HTMLSelectElement>(selector);
    if (control) control.value = state[key];
  }

  document.querySelectorAll<HTMLButtonElement>('[data-usage]').forEach((button) => {
    const active = (button.dataset.usage ?? '') === state.usage;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll<HTMLButtonElement>('[data-brewer]').forEach((button) => {
    const active = (button.dataset.brewer ?? '') === state.brewer;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  const clearSearch = document.querySelector<HTMLButtonElement>('.clear-search');
  if (clearSearch) clearSearch.hidden = state.query === '';
  const reset = document.querySelector<HTMLButtonElement>('#reset-all');
  if (reset) reset.disabled = Object.values(state).every((value) => value === '');

  const moreFilters = document.querySelector<HTMLDetailsElement>('#more-filters');
  if (moreFilters && (state.drink || state.category)) moreFilters.open = true;

  renderActiveFilters();
}

function syncUrl(): void {
  const params = searchStateToParams(state);
  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
  window.history.replaceState(null, '', nextUrl);
}

function updateState(patch: Partial<SearchState>): void {
  state = { ...state, ...patch };
  visibleEffectGroups = EFFECT_GROUPS_PER_PAGE;
  syncControls();
  syncUrl();
  renderResults();
}

function clearAll(): void {
  state = { ...EMPTY_SEARCH_STATE };
  visibleEffectGroups = EFFECT_GROUPS_PER_PAGE;
  syncControls();
  syncUrl();
  renderResults();
  document.querySelector<HTMLInputElement>('#global-search')?.focus();
}

function bindControls(): void {
  document.querySelector<HTMLFormElement>('.search-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
  });
  document.querySelector<HTMLInputElement>('#global-search')?.addEventListener('input', (event) => {
    updateState({ query: (event.currentTarget as HTMLInputElement).value });
  });
  document.querySelector<HTMLButtonElement>('.clear-search')?.addEventListener('click', () => {
    updateState({ query: '' });
    document.querySelector<HTMLInputElement>('#global-search')?.focus();
  });
  document.querySelector<HTMLButtonElement>('#reset-all')?.addEventListener('click', clearAll);
  document.querySelector<HTMLButtonElement>('#theme-toggle')?.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });

  const filterBindings: Array<[string, keyof SearchState]> = [
    ['#max-level-filter', 'maxLevel'],
    ['#drink-filter', 'drink'],
    ['#category-filter', 'category'],
  ];
  for (const [selector, key] of filterBindings) {
    document.querySelector<HTMLSelectElement>(selector)?.addEventListener('change', (event) => {
      updateState({ [key]: (event.currentTarget as HTMLSelectElement).value });
    });
  }

  document.querySelectorAll<HTMLButtonElement>('[data-usage]').forEach((button) => {
    button.addEventListener('click', () => {
      updateState({ usage: (button.dataset.usage ?? '') as SearchState['usage'] });
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-example]').forEach((button) => {
    button.addEventListener('click', () => {
      updateState({ query: button.dataset.example ?? '' });
      document.querySelector<HTMLInputElement>('#global-search')?.focus();
    });
  });

  window.addEventListener('popstate', () => {
    const restored = readSearchState(new URL(window.location.href));
    state = records.length > 0 ? sanitizeSearchState(restored, brewers, records) : restored;
    visibleEffectGroups = EFFECT_GROUPS_PER_PAGE;
    syncControls();
    syncUrl();
    renderResults();
  });
}

async function loadData(): Promise<void> {
  isLoading = true;
  loadError = '';
  renderBrewerControls();
  renderResults();

  try {
    const manifest = await fetchJson<BrewerSummary[]>(dataUrl('brewers.json'));
    const brewerFiles = await Promise.all(
      manifest.map((brewer) => fetchJson<BrewerData>(dataUrl(brewer.file))),
    );

    brewers = manifest;
    records = brewerFiles.flatMap((data) =>
      data.recipes.map((recipe) => ({
        ...recipe,
        brewerId: data.brewer.id,
        brewerName: data.brewer.name,
      })),
    );

    state = sanitizeSearchState(state, brewers, records);
    populateFilters();
    renderStats();
    syncUrl();
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'An unknown error occurred.';
  } finally {
    isLoading = false;
    renderBrewerControls();
    syncControls();
    renderResults();
  }
}

renderShell();
bindControls();
syncControls();
renderResults();
void loadData();
