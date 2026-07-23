import { readFileSync } from 'node:fs';

const bool = (value, fallback) => value == null ? fallback : /^(1|true|yes)$/i.test(value);
const integer = (value, fallback, min, max) => Math.min(max, Math.max(min, Number.parseInt(value ?? fallback, 10) || fallback));
const secret = (env, name) => {
  if (env[`${name}_FILE`]) return readFileSync(env[`${name}_FILE`], 'utf8').trim();
  return env[name] || '';
};

function domainConfig(env, prefix, displayName, fixtureFallback) {
  const https = bool(env[`${prefix}_HTTPS`], false);
  const host = env[`${prefix}_HOST`] || '127.0.0.1';
  const port = integer(env[`${prefix}_PORT`], https ? 443 : 8989, 1, 65535);
  const urlBase = String(env[`${prefix}_URL_BASE`] || '').replace(/^\/+|\/+$/g, '');
  return Object.freeze({
    enabled: bool(env[`${prefix}_ENABLED`], true),
    host,
    port,
    https,
    urlBase,
    apiCredential: secret(env, `${prefix}_API_CREDENTIAL`),
    timeoutMs: integer(env[`${prefix}_TIMEOUT_MS`], 8000, 250, 60000),
    retries: integer(env[`${prefix}_RETRIES`], 1, 0, 4),
    tlsVerify: bool(env[`${prefix}_TLS_VERIFY`], true),
    displayName,
    fixtureFallback: bool(env[`${prefix}_FIXTURE_FALLBACK`], fixtureFallback)
  });
}

export function loadEngineConfiguration(env = process.env) {
  const fixtureMode = String(env.VYNODENEW_DATA_MODE || 'fixture').toLowerCase() === 'fixture';
  return Object.freeze({
    movie: domainConfig(env, 'MOVIE_ENGINE', 'Movies', fixtureMode),
    tv: domainConfig(env, 'TV_ENGINE', 'TV', fixtureMode),
    pollIntervalMs: integer(env.VYNODENEW_SYNC_INTERVAL_MS, 300000, 15000, 86400000),
    cacheMaxItems: integer(env.VYNODENEW_CACHE_MAX_ITEMS, 5000, 10, 100000),
    dataMode: fixtureMode ? 'fixture' : 'engine'
  });
}

export function publicEngineConfiguration(config) {
  return {
    enabled: config.enabled,
    displayName: config.displayName,
    https: config.https,
    timeoutMs: config.timeoutMs,
    retries: config.retries,
    tlsVerify: config.tlsVerify,
    credentialConfigured: Boolean(config.apiCredential)
  };
}
