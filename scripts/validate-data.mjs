import { readFile } from 'node:fs/promises';
import path from 'node:path';

const dataDirectory = path.resolve(process.cwd(), 'public', 'data');
const READ_FAILURE = Symbol('read failure');
const SUPPORTED_SCHEMA_VERSIONS = new Set([1]);
const CATEGORY_USAGE = new Map([
  ['Liquor', 'single'],
  ['Cider', 'single'],
  ['Beer', 'triple'],
  ['Wine', 'triple'],
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireTrimmedString(value, label, errors) {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`${label} must be a non-empty string`);
    return false;
  }
  if (value !== value.trim()) errors.push(`${label} must not have leading or trailing whitespace`);
  return true;
}

function validateDate(value, label, errors) {
  if (!requireTrimmedString(value, label, errors)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    errors.push(`${label} must use YYYY-MM-DD format`);
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const valid =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
  if (!valid) errors.push(`${label} must be a real calendar date`);
  return valid;
}

function validateKnownKeys(object, expectedKeys, label, errors) {
  if (!isPlainObject(object)) {
    errors.push(`${label} must be an object`);
    return;
  }
  const unexpected = Object.keys(object).filter((key) => !expectedKeys.includes(key));
  for (const key of unexpected) errors.push(`${label} contains unexpected key: ${key}`);
}

function validateStringArray(value, label, errors, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    errors.push(`${label} must be ${allowEmpty ? 'an' : 'a non-empty'} array`);
    return;
  }

  const normalized = new Set();
  for (const [index, item] of value.entries()) {
    if (!requireTrimmedString(item, `${label}[${index}]`, errors)) continue;
    const key = item.trim().toLocaleLowerCase('en-US');
    if (normalized.has(key)) errors.push(`${label} contains duplicate value: ${item}`);
    normalized.add(key);
  }
}

async function readJson(filePath, errors) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    errors.push(`${path.relative(process.cwd(), filePath)} could not be read: ${error.message}`);
    return READ_FAILURE;
  }
}

export async function validateData() {
  const errors = [];
  const manifestPath = path.join(dataDirectory, 'brewers.json');
  const manifest = await readJson(manifestPath, errors);

  if (manifest === READ_FAILURE) return errors;
  if (!Array.isArray(manifest)) {
    errors.push('public/data/brewers.json must contain an array');
    return errors;
  }
  if (manifest.length === 0) errors.push('public/data/brewers.json must list at least one brewer');

  const brewerIds = new Set();
  const brewerNames = new Set();
  const fileNames = new Set();
  const recipeIds = new Set();

  for (const [brewerIndex, entry] of manifest.entries()) {
    const prefix = `brewers[${brewerIndex}]`;
    if (!isPlainObject(entry)) {
      errors.push(`${prefix} must be an object`);
      continue;
    }
    validateKnownKeys(entry, ['id', 'name', 'file', 'recipeCount', 'updated'], prefix, errors);

    const hasId = requireTrimmedString(entry.id, `${prefix}.id`, errors);
    const hasName = requireTrimmedString(entry.name, `${prefix}.name`, errors);
    const hasFile = requireTrimmedString(entry.file, `${prefix}.file`, errors);
    validateDate(entry.updated, `${prefix}.updated`, errors);

    if (!Number.isInteger(entry.recipeCount) || entry.recipeCount < 1) {
      errors.push(`${prefix}.recipeCount must be a positive integer`);
    }

    if (hasId) {
      if (!/^[a-z0-9][a-z0-9-]*$/u.test(entry.id)) {
        errors.push(`${prefix}.id must use lowercase letters, numbers, and hyphens`);
      }
      if (brewerIds.has(entry.id)) errors.push(`duplicate brewer id: ${entry.id}`);
      brewerIds.add(entry.id);
    }

    if (hasName) {
      const normalizedName = entry.name.toLocaleLowerCase('en-US');
      if (brewerNames.has(normalizedName)) errors.push(`duplicate brewer name: ${entry.name}`);
      brewerNames.add(normalizedName);
    }

    if (!hasFile) continue;
    if (fileNames.has(entry.file)) errors.push(`duplicate brewer file: ${entry.file}`);
    fileNames.add(entry.file);

    const resolvedFile = path.resolve(dataDirectory, entry.file);
    const insideDataDirectory =
      resolvedFile.startsWith(`${dataDirectory}${path.sep}`) && path.basename(entry.file) === entry.file;
    if (!insideDataDirectory || path.extname(entry.file).toLocaleLowerCase() !== '.json') {
      errors.push(`${prefix}.file must name a JSON file directly inside public/data`);
      continue;
    }

    const brewerFile = await readJson(resolvedFile, errors);
    if (brewerFile === READ_FAILURE) continue;
    if (!isPlainObject(brewerFile)) {
      errors.push(`${entry.file} must contain a brewer data object`);
      continue;
    }

    validateKnownKeys(brewerFile, ['schemaVersion', 'brewer', 'recipes'], entry.file, errors);
    if (!Number.isInteger(brewerFile.schemaVersion) || !SUPPORTED_SCHEMA_VERSIONS.has(brewerFile.schemaVersion)) {
      errors.push(`${entry.file}.schemaVersion must be one of: ${[...SUPPORTED_SCHEMA_VERSIONS].join(', ')}`);
    }

    if (!isPlainObject(brewerFile.brewer)) {
      errors.push(`${entry.file}.brewer must be an object`);
    } else {
      validateKnownKeys(brewerFile.brewer, ['id', 'name', 'updated'], `${entry.file}.brewer`, errors);
      requireTrimmedString(brewerFile.brewer.id, `${entry.file}.brewer.id`, errors);
      requireTrimmedString(brewerFile.brewer.name, `${entry.file}.brewer.name`, errors);
      validateDate(brewerFile.brewer.updated, `${entry.file}.brewer.updated`, errors);

      if (brewerFile.brewer.id !== entry.id) {
        errors.push(`${entry.file} brewer id does not match ${prefix}.id`);
      }
      if (brewerFile.brewer.name !== entry.name) {
        errors.push(`${entry.file} brewer name does not match ${prefix}.name`);
      }
      if (brewerFile.brewer.updated !== entry.updated) {
        errors.push(`${entry.file} updated date does not match ${prefix}.updated`);
      }
    }

    if (!Array.isArray(brewerFile.recipes)) {
      errors.push(`${entry.file}.recipes must contain an array`);
      continue;
    }
    if (entry.recipeCount !== brewerFile.recipes.length) {
      errors.push(
        `${entry.file} has ${brewerFile.recipes.length} recipes; manifest says ${entry.recipeCount}`,
      );
    }

    for (const [recipeIndex, recipe] of brewerFile.recipes.entries()) {
      const recipePrefix = `${entry.file}.recipes[${recipeIndex}]`;
      if (!isPlainObject(recipe)) {
        errors.push(`${recipePrefix} must be an object`);
        continue;
      }

      const hasRecipeId = requireTrimmedString(recipe.id, `${recipePrefix}.id`, errors);
      if (hasRecipeId) {
        if (recipeIds.has(recipe.id)) errors.push(`duplicate recipe id: ${recipe.id}`);
        recipeIds.add(recipe.id);
      }

      requireTrimmedString(recipe.drink, `${recipePrefix}.drink`, errors);
      requireTrimmedString(recipe.effect, `${recipePrefix}.effect`, errors);
      const hasCategory = requireTrimmedString(recipe.category, `${recipePrefix}.category`, errors);
      if (hasCategory && !CATEGORY_USAGE.has(recipe.category)) {
        errors.push(
          `${recipePrefix}.category must be one of: ${[...CATEGORY_USAGE.keys()].join(', ')}`,
        );
      }
      if (hasCategory && !CATEGORY_USAGE.get(recipe.category)) {
        errors.push(`${recipePrefix}.category must map to a supported usage type`);
      }

      if (!Number.isInteger(recipe.level) || recipe.level < 1) {
        errors.push(`${recipePrefix}.level must be a positive integer`);
      }

      validateStringArray(recipe.ingredients, `${recipePrefix}.ingredients`, errors);
      if (recipe.keywords !== undefined) {
        validateStringArray(recipe.keywords, `${recipePrefix}.keywords`, errors, { allowEmpty: true });
      }
      if (recipe.tentative !== undefined && typeof recipe.tentative !== 'boolean') {
        errors.push(`${recipePrefix}.tentative must be a boolean when present`);
      }
    }
  }

  return errors;
}

const errors = await validateData();
if (errors.length > 0) {
  console.error(`Data validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('Data validation passed.');
}
