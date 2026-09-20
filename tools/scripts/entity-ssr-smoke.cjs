const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');

const origin = process.env.ETH_ORIGIN || 'http://127.0.0.1:14003';
const prefix = process.env.REPORT_PREFIX || '/tmp/tx-taxi-eth-entity-ssr';
const hash = '0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060';
const cases = [
  { name: 'block', path: '/block/46147', text: 'Block #46147', detail: 'Gas limit' },
  { name: 'tx', path: `/tx/${hash}`, text: hash, detail: 'Transaction fee' },
];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true });
  const report = { origin, checks: [], errors: [] };
  try {
    const blocksResponse = await fetch('https://eth.blockscout.com/api/v2/blocks', { signal: AbortSignal.timeout(10000) });
    assert.equal(blocksResponse.status, 200);
    const latest = (await blocksResponse.json()).items?.[0]?.height;
    assert.ok(Number.isSafeInteger(latest));
    cases.push({ name: 'recent-block', path: `/block/${latest}`, text: `Block #${latest}`, detail: 'Gas limit' });
    for (const item of cases) {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      const response = await page.goto(origin + item.path, { waitUntil: 'domcontentloaded' });
      const text = await page.locator('body').innerText();
      const result = { name: item.name, mode: 'no-js', status: response.status(), entity: text.includes(item.text), detail: text.includes(item.detail) };
      report.checks.push(result);
      await page.screenshot({ path: `${prefix}-${item.name}-no-js.png` });
      assert.equal(result.status, 200);
      assert.ok(result.entity && result.detail, `Missing server-rendered ${item.name} details: ${text.slice(0, 400)}`);
      await context.close();
    }
    for (const width of [1440, 390]) {
      for (const item of cases) {
        const timezoneId = width === 1440 ? 'America/Phoenix' : 'Asia/Tokyo';
        const page = await browser.newPage({ viewport: { width, height: 1000 }, timezoneId, permissions: ['clipboard-read', 'clipboard-write'] });
        const errors = [];
        const failedResources = [];
        page.on('response', response => {
          if (response.status() >= 400) failedResources.push({ url: response.url(), status: response.status() });
        });
        page.on('requestfailed', request => {
          const error = request.failure()?.errorText;
          if (error !== 'net::ERR_ABORTED') failedResources.push({ url: request.url(), error });
        });
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => {
          if (message.type() === 'error') errors.push(message.text());
        });
        const response = await page.goto(origin + item.path, { waitUntil: 'domcontentloaded' });
        await page.getByRole('tab', { name: 'Details', exact: true }).waitFor({ timeout: 30000 });
        await page.waitForTimeout(2500);
        const text = await page.locator('body').innerText();
        const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
        await page.screenshot({ path: `${prefix}-${item.name}-${width}.png` });
        let entity = text.includes(item.text);
        if (item.name === 'tx') {
          await page.getByRole('button', { name: 'copy', exact: true }).first().click();
          const copied = await page.evaluate(() => navigator.clipboard.readText());
          entity = copied === hash && text.includes(hash.slice(0, 12));
        }
        const result = { name: item.name, mode: 'browser', width, timezoneId, status: response.status(), entity, detail: text.includes(item.detail), overflow, errors, failedResources };
        report.checks.push(result);
        assert.equal(result.status, 200);
        assert.ok(result.entity && result.detail, `Missing hydrated ${item.name} details`);
        assert.equal(overflow, 0);
        assert.deepEqual(errors, []);
        assert.deepEqual(failedResources, []);
        if (item.name === 'block') {
          await page.getByRole('button', { name: 'next', exact: true }).click();
          await page.getByRole('heading', { name: 'Block #46148', exact: true }).waitFor({ timeout: 15000 });
          await page.getByRole('button', { name: 'prev', exact: true }).click();
          await page.getByRole('heading', { name: 'Block #46147', exact: true }).waitFor({ timeout: 15000 });
          result.navigation = true;
          assert.deepEqual(errors, []);
          assert.deepEqual(failedResources, []);
        }
        await page.close();
      }
    }
    for (const path of ['/block/not-a-block', '/tx/bad', `/tx/0x${'0'.repeat(64)}`]) {
      const response = await fetch(origin + path, { signal: AbortSignal.timeout(15000) });
      const result = { path, mode: 'http', status: response.status, robots: response.headers.get('x-robots-tag') };
      report.checks.push(result);
      await response.body?.cancel();
      assert.equal(result.status, 404);
      assert.equal(result.robots, 'noindex');
    }
  } catch (error) {
    report.errors.push(error.stack);
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(`${prefix}.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
  }
})();
