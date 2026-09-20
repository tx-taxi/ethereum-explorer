import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { afterEach, expect, it, vi } from 'vitest';

import { useSsrTime } from './useSsrTime';

const { app, mounted } = vi.hoisted(() => ({ app: vi.fn(), mounted: vi.fn() }));
vi.mock('lib/contexts/app', () => ({ useAppContext: app }));
vi.mock('./useIsMounted', () => ({ 'default': mounted }));

function TimeProbe() {
  const { isHydrating, now } = useSsrTime();
  return <span data-hydrating={ isHydrating } data-now={ now }/>;
}

afterEach(() => {
  vi.useRealTimers();
});

it('anchors hydration time to the serialized request timestamp despite elapsed wall time', () => {
  vi.useFakeTimers();
  app.mockReturnValue({ entityQuery: {}, entityRenderedAt: 1000 });
  mounted.mockReturnValue(false);
  vi.setSystemTime(2000);
  const server = renderToStaticMarkup(<TimeProbe/>);
  vi.setSystemTime(9000);
  expect(renderToStaticMarkup(<TimeProbe/>)).toBe(server);
  expect(server).toContain('data-now="1000"');
  expect(server).toContain('data-hydrating="true"');
});

it('uses the live browser clock after hydration', () => {
  vi.useFakeTimers();
  vi.setSystemTime(9000);
  app.mockReturnValue({ entityQuery: {}, entityRenderedAt: 1000 });
  mounted.mockReturnValue(true);
  const html = renderToStaticMarkup(<TimeProbe/>);
  expect(html).toContain('data-now="9000"');
  expect(html).toContain('data-hydrating="false"');
});

it('preserves live-clock behavior on client-only pages', () => {
  vi.useFakeTimers();
  vi.setSystemTime(9000);
  app.mockReturnValue({});
  mounted.mockReturnValue(false);
  expect(renderToStaticMarkup(<TimeProbe/>)).toContain('data-hydrating="false" data-now="9000"');
});
