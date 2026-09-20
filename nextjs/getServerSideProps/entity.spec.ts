import type { GetServerSidePropsContext } from 'next';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { baseline } = vi.hoisted(() => ({ baseline: vi.fn() }));
vi.mock('configs/app', () => ({ 'default': { apis: { general: { endpoint: 'https://provider.example', basePath: '' } } } }));
vi.mock('./guards', () => ({ notMultichain: vi.fn() }));
vi.mock('./utils', () => ({ factory: () => baseline }));

const HASH = '0x' + 'a'.repeat(64);
const props = { query: {}, cookies: '', referrer: '', adBannerProvider: null, apiData: null, uuid: 'test' };

beforeEach(() => {
  vi.resetModules();
  baseline.mockReset().mockResolvedValue({ props });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function context(params: Record<string, string>): GetServerSidePropsContext {
  return { params, res: { statusCode: 200, setHeader: vi.fn() } } as unknown as GetServerSidePropsContext;
}

it('retains validated provider data in page props', async() => {
  const data = { hash: HASH, height: 1 };
  vi.stubGlobal('fetch', vi.fn(async() => new Response(JSON.stringify(data))));
  const { blockEntity } = await import('./entity');
  expect(await blockEntity(context({ height_or_hash: '1' }))).toEqual({ props: { ...props, entityData: data } });
});

it('preserves feature-guard results without entity fetching', async() => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  baseline.mockResolvedValue({ notFound: true });
  const { transactionEntity } = await import('./entity');
  expect(await transactionEntity(context({ hash: HASH }))).toEqual({ notFound: true });
  expect(fetcher).not.toHaveBeenCalled();
});

it.each([ 'missing', 'invalid' ])('returns a noindex 404 for %s entities', async(kind) => {
  const fetcher = vi.fn(async() => new Response('{}', { status: 404 }));
  vi.stubGlobal('fetch', fetcher);
  const { transactionEntity } = await import('./entity');
  const ctx = context({ hash: kind === 'invalid' ? 'bad' : HASH });
  expect(await transactionEntity(ctx)).toEqual({ notFound: true });
  expect(ctx.res.setHeader).toHaveBeenCalledWith('X-Robots-Tag', 'noindex');
  expect(ctx.res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  expect(fetcher).toHaveBeenCalledTimes(kind === 'invalid' ? 0 : 1);
});

it('returns retryable unavailable props and HTTP 503 rather than a soft 404', async() => {
  vi.stubGlobal('fetch', vi.fn(async() => new Response('{}', { status: 502 })));
  const { transactionEntity } = await import('./entity');
  const ctx = context({ hash: HASH });
  expect(await transactionEntity(ctx)).toEqual({ props: { ...props, entityUnavailable: true } });
  expect(ctx.res.statusCode).toBe(503);
  expect(ctx.res.setHeader).toHaveBeenCalledWith('Retry-After', '30');
  expect(ctx.res.setHeader).toHaveBeenCalledWith('X-Robots-Tag', 'noindex');
});
