import { readFileSync } from 'node:fs';

const API_ENV = new URL('../../api.env', import.meta.url);

export function loadApiEnv(file = API_ENV) {
  const env = {};
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const index = line.indexOf('=');
    env[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return env;
}

export function solrConfig() {
  const env = loadApiEnv();
  return {
    base: `${env.PROTOCOL || 'http'}://${env.SOLR_SERVER}/solr`,
    user: env.SOLR_USER || '',
    password: env.SOLR_PASS || '',
  };
}

export async function solrGet(path) {
  const config = solrConfig();
  const headers = { Accept: 'application/json' };
  if (config.user && config.password) {
    const token = Buffer.from(`${config.user}:${config.password}`).toString('base64');
    headers.Authorization = `Basic ${token}`;
  }
  const response = await fetch(config.base + path, { headers });
  if (!response.ok) {
    throw new Error(`Solr GET ${path} returned ${response.status}`);
  }
  return response.json();
}
