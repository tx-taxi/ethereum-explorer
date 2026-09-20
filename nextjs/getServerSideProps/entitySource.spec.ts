import { afterEach, describe, expect, it, vi } from 'vitest';

import { EntitySource } from './entitySource';

const HASH = '0x' + 'a'.repeat(64);
const block = { hash: HASH, height: 1 };

afterEach(() => {
  vi.useRealTimers();
});

describe('bounded entity source', () => {
  it('rejects invalid identifiers before provider access', async() => {
    const fetcher = vi.fn();
    const source = new EntitySource('https://provider.example', fetcher);
    for (const id of [ undefined, [ HASH ], '../secret', 'latest', '-1', '9007199254740992', '01' ]) {
      expect(await source.get('block', id)).toEqual({ status: 404 });
    }
    expect(await source.get('tx', '1')).toEqual({ status: 404 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('coalesces requests and expires successful data at the short TTL', async() => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>(async() => new Response(JSON.stringify(block)));
    const source = new EntitySource('https://provider.example', fetcher);
    const results = await Promise.all([ source.get('block', '1'), source.get('block', '1') ]);
    expect(results[0]).toEqual({ status: 200, data: block });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toBe('https://provider.example/api/v2/blocks/1');
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: 'manual', headers: { Accept: 'application/json' } });
    await source.get('block', '1');
    expect(fetcher).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10001);
    await source.get('block', '1');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([ 302, 429, 500, 503 ])('keeps provider %s failures uncached and retryable', async(status) => {
    const fetcher = vi.fn(async() => new Response('unavailable', { status }));
    const source = new EntitySource('https://provider.example', fetcher);
    expect(await source.get('tx', HASH)).toEqual({ status: 503 });
    expect(await source.get('tx', HASH)).toEqual({ status: 503 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('preserves missing entities without treating malformed successful data as absent', async() => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ hash: HASH, height: 2 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ hash: '0x' + 'b'.repeat(64) })));
    const source = new EntitySource('https://provider.example', fetcher);
    expect(await source.get('block', '1')).toEqual({ status: 404 });
    expect(await source.get('block', '1')).toEqual({ status: 503 });
    expect(await source.get('tx', HASH)).toEqual({ status: 503 });
  });

  it('bounds streamed bodies even without a content-length header', async() => {
    const fetcher = vi.fn(async() => new Response('x'.repeat(2 * 1024 * 1024 + 1)));
    expect(await new EntitySource('https://provider.example', fetcher).get('tx', HASH)).toEqual({ status: 503 });
  });

  it.each([ { count: 33, padding: 0 }, { count: 9, padding: 2 * 1024 * 1024 - 256 } ])(
    'evicts older entries at count or byte limits ($count entries)', async({ count, padding }) => {
      const fetcher = vi.fn<typeof fetch>(async(url) => {
        const height = Number(String(url).split('/').pop());
        return new Response(JSON.stringify({ hash: HASH, height, padding: 'x'.repeat(padding) }));
      });
      const source = new EntitySource('https://provider.example', fetcher);
      for (let height = 1; height <= count; height++) {
        expect((await source.get('block', String(height))).status).toBe(200);
      }
      expect(fetcher).toHaveBeenCalledTimes(count);
      await source.get('block', String(count));
      expect(fetcher).toHaveBeenCalledTimes(count);
      await source.get('block', '1');
      expect(fetcher).toHaveBeenCalledTimes(count + 1);
    },
  );

  it('limits distinct in-flight requests while preserving coalescing', async() => {
    const releases: Array<() => void> = [];
    const fetcher = vi.fn(() => new Promise<Response>(resolve => releases.push(() => resolve(new Response('{}', { status: 404 })))));
    const source = new EntitySource('https://provider.example', fetcher);
    const pending = [ 1, 2, 3, 4 ].map(id => source.get('block', String(id)));
    const shared = source.get('block', '1');
    expect(await source.get('block', '5')).toEqual({ status: 503 });
    expect(fetcher).toHaveBeenCalledTimes(4);
    releases.forEach(release => release());
    await Promise.all([ ...pending, shared ]);
  });

  it('aborts timed-out requests and releases capacity', async() => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const source = new EntitySource('https://provider.example', fetcher);
    const pending = source.get('tx', HASH);
    await vi.advanceTimersByTimeAsync(5001);
    expect(await pending).toEqual({ status: 503 });
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ hash: HASH })));
    expect((await source.get('tx', HASH)).status).toBe(200);
  });
});
