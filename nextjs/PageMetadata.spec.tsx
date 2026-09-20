import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { expect, it, vi } from 'vitest';

import PageMetadata from './PageMetadata';

vi.mock('next/head', () => ({ 'default': ({ children }: { children: React.ReactNode }) => children }));

it('renders matching canonical and social URLs with non-empty descriptions and image tags', () => {
  const hash = '0x' + 'a'.repeat(64);
  const canonical = `http://localhost:3000/tx/${ hash }`;
  const html = renderToStaticMarkup(<PageMetadata pathname="/tx/[hash]" query={{ hash, tab: 'logs' }}/>);
  expect(html).toContain(`rel="canonical" href="${ canonical }"`);
  expect(html).toContain(`property="og:url" content="${ canonical }"`);
  expect(html).toContain('property="og:description" content="View transaction');
  expect(html).toContain('name="twitter:description" content="View transaction');
  expect(html).toContain('property="og:image" content="http://localhost:3000/static/og_image.png"');
  expect(html).toContain('name="twitter:image" content="http://localhost:3000/static/og_image.png"');
  expect(html).not.toContain('?tab=');
});

it('does not render a canonical or social URL for invalid entity identifiers', () => {
  const html = renderToStaticMarkup(<PageMetadata pathname="/tx/[hash]" query={{ hash: '../bad' }}/>);
  expect(html).not.toContain('rel="canonical"');
  expect(html).not.toContain('property="og:url"');
});
