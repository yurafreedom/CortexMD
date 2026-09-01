#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const locales = ['en', 'ru', 'uk'];

function flatten(value, prefix = '', output = new Map()) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    output.set(prefix, value);
    return output;
  }

  for (const key of Object.keys(value).sort()) {
    flatten(value[key], prefix ? `${prefix}.${key}` : key, output);
  }
  return output;
}

function placeholders(value) {
  if (typeof value !== 'string') return [];
  return [...value.matchAll(/\{\s*([A-Za-z][A-Za-z0-9_]*)\s*(?=[,}])/g)]
    .map((match) => match[1])
    .filter((name, index, all) => all.indexOf(name) === index)
    .sort();
}

const messages = Object.fromEntries(await Promise.all(locales.map(async (locale) => {
  const file = path.join(root, 'src', 'messages', `${locale}.json`);
  return [locale, flatten(JSON.parse(await readFile(file, 'utf8')))];
})));

const referenceLocale = locales[0];
const reference = messages[referenceLocale];
const referenceKeys = [...reference.keys()].sort();
const failures = [];

for (const locale of locales.slice(1)) {
  const candidate = messages[locale];
  const candidateKeys = [...candidate.keys()].sort();
  const missing = referenceKeys.filter((key) => !candidate.has(key));
  const extra = candidateKeys.filter((key) => !reference.has(key));

  if (missing.length) failures.push(`${locale}: missing keys: ${missing.join(', ')}`);
  if (extra.length) failures.push(`${locale}: extra keys: ${extra.join(', ')}`);

  for (const key of referenceKeys.filter((item) => candidate.has(item))) {
    const expected = placeholders(reference.get(key));
    const actual = placeholders(candidate.get(key));
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      failures.push(`${locale}: placeholder mismatch at ${key}: expected [${expected}], got [${actual}]`);
    }
  }
}

if (failures.length) {
  console.error('Localization validation failed.');
  for (const failure of failures.sort()) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Localization validation passed: ${locales.join(', ')}; ${referenceKeys.length} leaf keys; exact key and placeholder parity.`);
