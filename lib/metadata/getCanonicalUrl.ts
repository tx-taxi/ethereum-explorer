import type { Route } from 'nextjs-routes';
import { route } from 'nextjs/routes';

import config from 'configs/app';
import { ADDRESS_REGEXP } from 'toolkit/utils/regexp';

const HASH = /^0x[\da-fA-F]{64}$/;
const HEIGHT = /^(?:0|[1-9]\d{0,15})$/;
const TOKEN_ID_LIMIT = BigInt(2) ** BigInt(256);

const CANONICAL_ROUTES: Array<Route['pathname']> = [
  '/',
  '/txs',
  '/blocks',
  '/accounts',
  '/internal-txs',
  '/token-transfers',
  '/ops',
  '/verified-contracts',
  '/name-services',
  '/withdrawals',
  '/tokens',
  '/stats',
  '/api-docs',
  '/gas-tracker',
  '/apps',
];

export default function getCanonicalUrl(pathname: Route['pathname'], query?: Route['query']): string | undefined {
  let path: string | undefined;
  if (CANONICAL_ROUTES.includes(pathname)) {
    path = pathname;
  } else if (pathname === '/block/[height_or_hash]') {
    const id = query?.height_or_hash;
    if (typeof id === 'string' && (HASH.test(id) || (HEIGHT.test(id) && Number.isSafeInteger(Number(id))))) {
      path = route({ pathname, query: { height_or_hash: id.toLowerCase() } });
    }
  } else if (pathname === '/tx/[hash]' || pathname === '/address/[hash]' || pathname === '/token/[hash]') {
    const hash = query?.hash;
    const pattern = pathname === '/tx/[hash]' ? HASH : ADDRESS_REGEXP;
    if (typeof hash === 'string' && pattern.test(hash)) {
      path = route({ pathname, query: { hash: hash.toLowerCase() } });
    }
  } else if (pathname === '/token/[hash]/instance/[id]') {
    const hash = query?.hash;
    const id = query?.id;
    if (typeof hash === 'string' && ADDRESS_REGEXP.test(hash) && typeof id === 'string' && /^(?:0|[1-9]\d{0,77})$/.test(id) &&
      BigInt(id) < TOKEN_ID_LIMIT) {
      path = route({ pathname, query: { hash: hash.toLowerCase(), id } });
    }
  }

  if (path) {
    try {
      const url = new URL(path, config.app.baseUrl);
      if ([ 'http:', 'https:' ].includes(url.protocol) && !url.username && !url.password) return url.href;
    } catch {
      // Build-time configuration can omit the public host; never emit a broken canonical.
      return undefined;
    }
  }
}
