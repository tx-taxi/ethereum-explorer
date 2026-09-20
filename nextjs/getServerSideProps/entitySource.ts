const HASH = /^0x[0-9a-fA-F]{64}$/;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_CACHE_BYTES = 16 * 1024 * 1024;
const MAX_ENTRIES = 32;
const MAX_REQUESTS = 4;
const TIMEOUT_MS = 5000;
const TTL_MS = 10000;

export type EntityKind = 'block' | 'tx';
export type EntityResult = { readonly status: 200; readonly data: Record<string, unknown> } | { readonly status: 404 | 503 };

export function validEntityId(kind: EntityKind, id: unknown): id is string {
  return typeof id === 'string' && (HASH.test(id) || (kind === 'block' && /^(?:0|[1-9]\d{0,15})$/.test(id) && Number.isSafeInteger(Number(id))));
}

export class EntitySource {
  private readonly cache = new Map<string, { readonly result: EntityResult; readonly expires: number; readonly size: number }>();
  private readonly pending = new Map<string, Promise<EntityResult>>();
  private cacheBytes = 0;

  constructor(private readonly baseUrl: string, private readonly fetcher: typeof fetch = fetch) {}

  async get(kind: EntityKind, id: unknown): Promise<EntityResult> {
    if (!validEntityId(kind, id)) return { status: 404 };
    const key = `${ kind }:${ id }`;
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.result;
    if (cached) {
      this.cache.delete(key); this.cacheBytes -= cached.size;
    }
    const current = this.pending.get(key);
    if (current) return current;
    if (this.pending.size >= MAX_REQUESTS) return { status: 503 };
    const request = this.load(kind, id).then(({ result, size }) => {
      if (result.status === 200) {
        this.cache.set(key, { result, size, expires: Date.now() + TTL_MS });
        this.cacheBytes += size;
        while (this.cache.size > MAX_ENTRIES || this.cacheBytes > MAX_CACHE_BYTES) {
          const oldest = this.cache.entries().next().value;
          if (!oldest) break;
          this.cache.delete(oldest[0]); this.cacheBytes -= oldest[1].size;
        }
      }
      return result;
    }).finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }

  private async load(kind: EntityKind, id: string): Promise<{ result: EntityResult; size: number }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const url = new URL(`${ this.baseUrl.replace(/\/$/, '') }/api/v2/${ kind === 'block' ? 'blocks' : 'transactions' }/${ id }`);
      if (![ 'https:', 'http:' ].includes(url.protocol) || url.username || url.password) return { result: { status: 503 }, size: 0 };
      const response = await this.fetcher(url, { signal: controller.signal, redirect: 'manual', headers: { Accept: 'application/json' } });
      if (response.status !== 200) {
        await response.body?.cancel();
        return { result: { status: response.status === 404 ? 404 : 503 }, size: 0 };
      }
      if (!response.body || Number(response.headers.get('content-length')) > MAX_BYTES) {
        await response.body?.cancel();
        return { result: { status: 503 }, size: 0 };
      }
      const reader = response.body.getReader();
      const chunks: Array<Uint8Array> = [];
      let size = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > MAX_BYTES) {
            await reader.cancel(); return { result: { status: 503 }, size: 0 };
          }
          chunks.push(chunk.value);
        }
      } finally {
        reader.releaseLock();
      }
      const data: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!data || typeof data !== 'object' || Array.isArray(data)) return { result: { status: 503 }, size: 0 };
      const record = data as Record<string, unknown>;
      if (typeof record.hash !== 'string' || !HASH.test(record.hash) ||
        (id.startsWith('0x') && record.hash.toLowerCase() !== id.toLowerCase()) ||
        (kind === 'block' && (!Number.isSafeInteger(record.height) || Number(record.height) < 0 ||
          (!id.startsWith('0x') && record.height !== Number(id))))) return { result: { status: 503 }, size: 0 };
      return { result: { status: 200, data: record }, size };
    } catch {
      return { result: { status: 503 }, size: 0 };
    } finally {
      clearTimeout(timer);
    }
  }
}
