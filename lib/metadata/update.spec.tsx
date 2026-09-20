// @vitest-environment jsdom

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import PageMetadata from 'nextjs/PageMetadata';

import { tokenInfo } from 'mocks/tokens/tokenInfo';
import { afterEach, expect, it, vi } from 'vitest';

import generate from './generate';
import update from './update';

vi.mock('next/head', () => ({ 'default': ({ children }: { children: React.ReactNode }) => children }));

const route = {
  pathname: '/token/[hash]/instance/[id]',
  query: { hash: `0x${ 'a'.repeat(40) }`, id: '1' },
} as const;

afterEach(() => {
  document.head.innerHTML = '';
});

it('enriches document and social tags together without duplicating Next.js head elements', () => {
  document.head.innerHTML = renderToStaticMarkup(<PageMetadata { ...route }/>);
  const tagCount = document.head.children.length;
  const data = { symbol_or_name: 'Example NFT' };
  const expected = generate(route, data);

  update(route, data);
  update(route, data);

  expect(document.title).toBe(expected.title);
  expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(expected.description);
  [ 'meta[property="og:title"]', 'meta[name="twitter:title"]' ].forEach((selector) => {
    expect(document.querySelector(selector)?.getAttribute('content')).toBe(expected.opengraph.title);
  });
  [ 'meta[property="og:description"]', 'meta[name="twitter:description"]' ].forEach((selector) => {
    expect(document.querySelector(selector)?.getAttribute('content')).toBe(expected.opengraph.description);
  });
  [ 'meta[property="og:image"]', 'meta[name="twitter:image"]' ].forEach((selector) => {
    expect(document.querySelector(selector)?.getAttribute('content')).toBe(expected.opengraph.imageUrl);
  });
  expect(document.head.children.length).toBe(tagCount);
});

it('leaves route-owned canonical aliases and social URLs unchanged', () => {
  document.head.innerHTML = renderToStaticMarkup(<PageMetadata pathname="/block/[height_or_hash]" query={{ height_or_hash: '46147' }}/>);
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
  update({ pathname: '/block/[height_or_hash]', query: { height_or_hash: `0x${ 'b'.repeat(64) }` } }, null);
  expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(canonical);
  expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(canonical);
});

it('does not create unmanaged social tags when the rendered head omits them', () => {
  document.head.innerHTML = '<title>Before</title><meta name="description" content="Before">';
  update(route, { symbol_or_name: 'Example NFT' });
  expect(document.head.children.length).toBe(2);
  expect(document.title).toBe(generate(route, { symbol_or_name: 'Example NFT' }).title);
});

it('refreshes enriched token data and removes obsolete Product schema on a different page', () => {
  const tokenRoute = { pathname: '/token/[hash]', query: { hash: tokenInfo.address_hash } } as const;
  document.head.innerHTML = renderToStaticMarkup(<PageMetadata { ...tokenRoute }/>);
  update(tokenRoute, { ...tokenInfo, symbol_or_name: 'Initial', description: 'Initial description' });

  const revised = { ...tokenInfo, symbol_or_name: 'Updated', description: 'Updated description' };
  update(tokenRoute, revised);
  const expected = generate(tokenRoute, revised);
  expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(expected.title);
  expect(document.querySelector('meta[name="twitter:description"]')?.getAttribute('content')).toBe(expected.opengraph.description);
  expect(document.querySelectorAll('#blockscout-product-schema')).toHaveLength(1);
  expect(JSON.parse(document.getElementById('blockscout-product-schema')?.textContent || '{}')).toMatchObject({ description: 'Updated description' });

  update(route, { symbol_or_name: 'Example NFT' });
  expect(document.getElementById('blockscout-product-schema')).toBeNull();
});
