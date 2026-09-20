// @vitest-environment jsdom

import { ChakraProvider } from '@chakra-ui/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import theme from 'toolkit/theme/theme';
import { expect, it, vi } from 'vitest';

import PrevNext from './PrevNext';

vi.mock('lib/contexts/app', () => ({ useAppContext: () => ({ entityQuery: {} }) }));

function render(props: React.ComponentProps<typeof PrevNext>) {
  const root = document.createElement('div');
  root.innerHTML = renderToStaticMarkup(<ChakraProvider value={ theme }><PrevNext { ...props }/></ChakraProvider>);
  return root;
}

it('server-renders native previous and next links with accessible names', () => {
  const root = render({ prevHref: '/block/46146', nextHref: '/block/46148' });
  expect(root.querySelector('a[aria-label="prev"]')?.getAttribute('href')).toBe('/block/46146');
  expect(root.querySelector('a[aria-label="next"]')?.getAttribute('href')).toBe('/block/46148');
  expect(root.querySelectorAll('button')).toHaveLength(0);
});

it('keeps disabled directions as disabled buttons without a navigable destination', () => {
  const root = render({ prevHref: '/block/-1', nextHref: '/block/1', isPrevDisabled: true });
  expect(root.querySelector('button[aria-label="prev"]')?.hasAttribute('disabled')).toBe(true);
  expect(root.querySelector('a[aria-label="prev"]')).toBeNull();
  expect(root.querySelector('a[aria-label="next"]')?.getAttribute('href')).toBe('/block/1');
});

it('preserves buttons for existing action-only callers', () => {
  const root = render({ onClick: () => undefined });
  expect(root.querySelectorAll('button')).toHaveLength(2);
  expect(root.querySelectorAll('a')).toHaveLength(0);
});

it('does not render navigable links while data is a loading placeholder', () => {
  const root = render({ prevHref: '/block/1', nextHref: '/block/3', isLoading: true });
  expect(root.querySelectorAll('a, button')).toHaveLength(0);
});
