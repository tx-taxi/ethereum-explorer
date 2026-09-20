import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type config from 'configs/app';
import { expect, it, vi } from 'vitest';

import PageMetadata from './PageMetadata';

vi.mock('next/head', () => ({ 'default': ({ children }: { children: React.ReactNode }) => children }));
vi.mock('configs/app', async(importOriginal) => {
  const actual = await importOriginal<{ 'default': typeof config }>();
  return { 'default': {
    ...actual.default,
    app: { ...actual.default.app, host: undefined, baseUrl: 'https://' },
  } };
});

it('does not emit broken image or canonical URLs when the standalone build has no public host', () => {
  const html = renderToStaticMarkup(<PageMetadata pathname="/404"/>);
  expect(html).not.toContain('og:image');
  expect(html).not.toContain('twitter:image');
  expect(html).not.toContain('rel="canonical"');
});
