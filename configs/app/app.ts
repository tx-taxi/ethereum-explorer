import * as cookies from 'lib/cookies';

import { getEnvValue } from './utils';

const appPort = getEnvValue('NEXT_PUBLIC_APP_PORT');
const appSchema = getEnvValue('NEXT_PUBLIC_APP_PROTOCOL');
const appHost = getEnvValue('NEXT_PUBLIC_APP_HOST');
const configuredBaseUrl = [
  appSchema || 'https',
  '://',
  appHost,
  appPort && ':' + appPort,
].filter(Boolean).join('');
const baseUrl = (() => {
  try {
    return new URL(configuredBaseUrl).origin;
  } catch {
    // The public host is supplied at runtime, after the standalone build.
    return configuredBaseUrl;
  }
})();
const isDev = getEnvValue('NEXT_PUBLIC_APP_ENV') === 'development';
const isReview = getEnvValue('NEXT_PUBLIC_APP_ENV') === 'review';
const isPw = getEnvValue('NEXT_PUBLIC_APP_INSTANCE') === 'pw';
const spriteHash = getEnvValue('NEXT_PUBLIC_ICON_SPRITE_HASH');
const isPrivateMode = cookies.get(cookies.NAMES.APP_PROFILE) === 'private';

const app = Object.freeze({
  isDev,
  isReview,
  isPw,
  protocol: appSchema || 'https',
  host: appHost,
  port: appPort,
  baseUrl,
  useProxy: getEnvValue('NEXT_PUBLIC_USE_NEXT_JS_PROXY') === 'true',
  spriteHash,
  isPrivateMode,
});

export default app;
