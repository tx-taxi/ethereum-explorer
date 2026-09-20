import { describe, expect, test } from 'vitest';

import { app } from './app';

describe('application script CSP', () => {
  test('allows only the known next-themes bootstrap variants', () => {
    const scriptSources = app()['script-src'];

    expect(scriptSources).toContain('\'sha256-yYJq8IP5/WhJj6zxyTmujEqBFs/MufRufp2QKJFU76M=\'');
    expect(scriptSources).toContain('\'sha256-Os32ny+s3zEaX+XxoAVngBThnQv/IOycQlrqgxXOgRI=\'');
    expect(scriptSources).not.toContain('\'unsafe-inline\'');
  });
});
