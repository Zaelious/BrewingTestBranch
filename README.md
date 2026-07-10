# Brewing Ledger

A compact, community-maintained Project Gorgon brewing recipe search site.

## Features

- Groups recipes by exact buff/effect instead of repeating one large card per drink.
- Separates **Single-use — Liquor & Cider** from **3-use — Beer & Wine**.
- Compares recipe level, drink, ingredients, and brewer in a condensed ledger.
- Collapses identical recipes shared by multiple brewers.
- Searches effects, semantic keywords, drinks, ingredients, categories, levels, and brewer names.
- Supports brewer, maximum-level, usage, drink, and category filters.
- Preserves shareable URL state and removes invalid URL filters after data loads.
- Includes persistent day and night ledger themes.
- Includes data validation, unit tests, and automatic GitHub Pages deployment.

## Local development

```bash
npm ci
npm run dev
```

Validation, tests, and production build:

```bash
npm test
npm run build
```

## GitHub Pages deployment

The repository includes `.github/workflows/deploy.yml`.

1. Push the contents of this folder to the repository's `main` branch.
2. Open **Settings → Pages**.
3. Set **Source** to **GitHub Actions**.
4. Open the **Actions** tab and wait for **Deploy to GitHub Pages** to finish.

Do not choose the Jekyll or Static HTML starter workflow. The included workflow builds the Vite project and deploys `dist` automatically.

The `.github` folder must remain at the root of the repository. GitHub only detects workflows stored under `.github/workflows/`.

## Adding brewers

Add a brewer JSON file in `public/data/`, then add its manifest entry to `public/data/brewers.json`. The validator checks IDs, file paths, dates, recipe counts, schema versions, categories, levels, ingredients, keywords, tentative flags, and duplicate IDs.
