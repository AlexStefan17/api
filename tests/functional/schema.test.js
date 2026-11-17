import { appendFileSync } from 'node:fs';
import { afterAll, describe, expect, test } from 'vitest';
import { solrGet } from './solr-helpers.js';

// Types from the Job and Company model tables, which are the source of truth.
// "date" maps to pdate because Solr has no plain date type.
const JOB_FIELDS = [
  ['url', 'string', false],
  ['title', 'string', false],
  ['company', 'string', false],
  ['cif', 'string', false],
  ['location', 'string', true],
  ['tags', 'string', true],
  ['workmode', 'string', false],
  ['date', 'pdate', false],
  ['status', 'string', false],
  ['vdate', 'pdate', false],
  ['expirationdate', 'pdate', false],
  ['salary', 'string', false],
];

const COMPANY_FIELDS = [
  ['id', 'string', false],
  ['company', 'string', false],
  ['brand', 'string', false],
  ['group', 'string', false],
  ['status', 'string', false],
  ['location', 'string', true],
  ['website', 'string', true],
  ['career', 'string', true],
  ['lastScraped', 'string', false],
  ['scraperFile', 'string', false],
];

// Known mismatches. Their tests run with test.fails, so they stay green until
// the schema is fixed; once a schema matches, Vitest reports the test as failed
// and the entry here should be removed.
const KNOWN_MISMATCHES = {
  'job.title': 'schema is text_general, table says string',
  'job.location': 'schema is text_general and single-valued, table says string[]',
  'job.tags': 'schema is text_general, table says string[]',
  'job.salary': 'schema is text_general, table says string',
  'company.location': 'schema is text_general, table says string[]',
};

const results = [];

function describeType(type, multi) {
  return multi ? `${type}[]` : type;
}

async function checkField(core, [name, type, multi]) {
  const key = `${core}.${name}`;
  const { field } = await solrGet(`/${core}/schema/fields/${name}?wt=json`);
  const actual = describeType(field.type, field.multiValued ?? false);
  const expected = describeType(type, multi);
  const known = KNOWN_MISMATCHES[key];
  results.push({ key, expected, actual, known });
  expect(actual, `${key}: expected ${expected}, got ${actual}`).toBe(expected);
}

function defineFieldTests(core, fields) {
  for (const field of fields) {
    const key = `${core}.${field[0]}`;
    const label = `${key} has type ${describeType(field[1], field[2])}`;
    if (KNOWN_MISMATCHES[key]) {
      test.fails(`${label} [known: ${KNOWN_MISMATCHES[key]}]`, () => checkField(core, field));
    } else {
      test(label, () => checkField(core, field));
    }
  }
}

afterAll(() => {
  const lines = results.map((r) => {
    if (r.actual === r.expected) return `OK    ${r.key}: ${r.expected}`;
    const status = r.known ? 'KNOWN' : 'FAIL ';
    return `${status} ${r.key}: expected ${r.expected}, actual ${r.actual}`;
  });
  console.log(`\nSchema check summary\n${lines.join('\n')}\n`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    const rows = results.map((r) => {
      const status = r.actual === r.expected ? 'OK' : r.known ? 'Known' : '**FAIL**';
      return `| ${r.key} | ${r.expected} | ${r.actual} | ${status} |`;
    });
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
      '## Schema check',
      '',
      '| Field | Expected (table) | Actual (Solr) | Status |',
      '| --- | --- | --- | --- |',
      ...rows,
      '',
    ].join('\n'));
  }
});

describe('job schema', () => defineFieldTests('job', JOB_FIELDS));
describe('company schema', () => defineFieldTests('company', COMPANY_FIELDS));
