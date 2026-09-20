import { afterEach, expect, it, vi } from 'vitest';

import getCanonicalUrl from './getCanonicalUrl';

const { app } = vi.hoisted(() => ({ app: { baseUrl: 'https://eth.tx.taxi:443' } }));
vi.mock('configs/app', () => ({ 'default': { app } }));
const HASH = '0x' + 'A'.repeat(64);
const ADDRESS = '0x' + 'B'.repeat(40);

afterEach(() => {
  app.baseUrl = 'https://eth.tx.taxi:443';
});

it('normalizes the configured origin and omits unrelated query parameters', () => {
  expect(getCanonicalUrl('/blocks', { tab: 'pending', utm_source: 'test' })).toBe('https://eth.tx.taxi/blocks');
  expect(getCanonicalUrl('/tx/[hash]', { hash: HASH, tab: 'logs', utm_source: 'test' })).toBe(`https://eth.tx.taxi/tx/${ HASH.toLowerCase() }`);
  expect(getCanonicalUrl('/block/[height_or_hash]', { height_or_hash: '0', tab: 'txs' })).toBe('https://eth.tx.taxi/block/0');
  expect(getCanonicalUrl('/block/[height_or_hash]', { height_or_hash: HASH })).toBe(`https://eth.tx.taxi/block/${ HASH.toLowerCase() }`);
});

it.each([ '/address/[hash]', '/token/[hash]' ] as const)('canonicalizes %s hashes', (pathname) => {
  expect(getCanonicalUrl(pathname, { hash: ADDRESS })).toBe(`https://eth.tx.taxi/${ pathname.split('/')[1] }/${ ADDRESS.toLowerCase() }`);
});

it('preserves exact uint256 NFT identifiers', () => {
  const id = String(BigInt(2) ** BigInt(256) - BigInt(1));
  expect(getCanonicalUrl('/token/[hash]/instance/[id]', { hash: ADDRESS, id })).toBe(`https://eth.tx.taxi/token/${ ADDRESS.toLowerCase() }/instance/${ id }`);
  expect(getCanonicalUrl('/token/[hash]/instance/[id]', { hash: ADDRESS, id: String(BigInt(2) ** BigInt(256)) })).toBeUndefined();
});

it('rejects malformed, missing and repeated identifiers rather than indexing guessed paths', () => {
  for (const hash of [ undefined, '', '0x123', '../secret', [ HASH ], HASH + '?tab=logs' ]) {
    expect(getCanonicalUrl('/tx/[hash]', { hash })).toBeUndefined();
  }
  for (const heightOrHash of [ '01', '-1', 'latest', '9007199254740992', [ '1' ] ]) {
    expect(getCanonicalUrl('/block/[height_or_hash]', { height_or_hash: heightOrHash })).toBeUndefined();
  }
  expect(getCanonicalUrl('/token/[hash]/instance/[id]', { hash: ADDRESS, id: '01' })).toBeUndefined();
});

it('does not emit canonicals for private or error pages', () => {
  expect(getCanonicalUrl('/account/api-key')).toBeUndefined();
  expect(getCanonicalUrl('/404')).toBeUndefined();
});

it('omits broken or credential-bearing origins and preserves development ports', () => {
  for (const origin of [ 'https://', 'file:///tmp/app', 'https://user:pass@eth.tx.taxi' ]) {
    app.baseUrl = origin;
    expect(getCanonicalUrl('/blocks')).toBeUndefined();
  }
  app.baseUrl = 'http://127.0.0.1:14002';
  expect(getCanonicalUrl('/blocks')).toBe('http://127.0.0.1:14002/blocks');
});
