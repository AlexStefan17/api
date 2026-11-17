import { describe, expect, test } from 'vitest';
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

async function checkField(core, [name, type, multi]) {
  const { field } = await solrGet(`/${core}/schema/fields/${name}?wt=json`);
  expect(field.type, `${core}.${name} type`).toBe(type);
  expect(field.multiValued ?? false, `${core}.${name} multiValued`).toBe(multi);
}

function defineFieldTests(core, fields) {
  for (const field of fields) {
    const key = `${core}.${field[0]}`;
    const label = `${key} has type ${field[1]}${field[2] ? ' (multiValued)' : ''}`;
    if (KNOWN_MISMATCHES[key]) {
      test.fails(`${label} [known: ${KNOWN_MISMATCHES[key]}]`, () => checkField(core, field));
    } else {
      test(label, () => checkField(core, field));
    }
  }
}

describe('job schema', () => defineFieldTests('job', JOB_FIELDS));
describe('company schema', () => defineFieldTests('company', COMPANY_FIELDS));
