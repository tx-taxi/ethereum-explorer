import { beforeEach, expect, it, vi } from 'vitest';

const { env } = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));
vi.mock('./utils', () => ({ getEnvValue: (key: string) => env[key] }));
vi.mock('lib/cookies', () => ({ get: vi.fn(), NAMES: { APP_PROFILE: 'profile' } }));

beforeEach(() => {
  vi.resetModules();
  for (const key of Object.keys(env)) delete env[key];
});

it.each([
  [ 'https', 'eth.tx.taxi', '443', 'https://eth.tx.taxi' ],
  [ 'http', 'localhost', '80', 'http://localhost' ],
  [ 'http', '127.0.0.1', '14002', 'http://127.0.0.1:14002' ],
  [ undefined, 'eth.tx.taxi', undefined, 'https://eth.tx.taxi' ],
  [ undefined, undefined, undefined, 'https://' ],
])('normalizes the public origin %s %s %s', async(protocol, host, port, expected) => {
  env.NEXT_PUBLIC_APP_PROTOCOL = protocol;
  env.NEXT_PUBLIC_APP_HOST = host;
  env.NEXT_PUBLIC_APP_PORT = port;
  const { 'default': app } = await import('./app');
  expect(app.baseUrl).toBe(expected);
});
