const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const { chromium } = require('playwright');

const origin = process.env.ETH_ORIGIN || 'http://127.0.0.1:14003';
const publicOrigin = process.env.PUBLIC_ORIGIN || 'https://eth.tx.taxi';
const output = process.env.REPORT_PATH || '/tmp/tx-taxi-eth-entity-metadata.json';
const transaction = '0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060';

(async () => {
  const report = { origin, publicOrigin, checks: [], errors: [] };
  let browser;
  try {
    const response = await fetch('https://eth.blockscout.com/api/v2/blocks/46147', { signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, 200);
    const block = await response.json();
    assert.match(block.hash, /^0x[0-9a-f]{64}$/i);
    for (const [path, expectedPath, titleFragment] of [
      ['/block/46147?tab=txs&utm_source=test', '/block/46147', '46147'],
      [`/block/${block.hash}`, '/block/46147', '46147'],
      [`/tx/${transaction}?tab=logs`, `/tx/${transaction}`, transaction],
    ]) {
      const page = await fetch(origin + path, { signal: AbortSignal.timeout(15000) });
      assert.equal(page.status, 200);
      const dom = new JSDOM(await page.text());
      const document = dom.window.document;
      const meta = key => document.querySelector(`meta[property="${key}"], meta[name="${key}"]`)?.content;
      const canonical = document.querySelector('link[rel="canonical"]')?.href;
      const result = { path, status: page.status, canonical, title: document.title, ogUrl: meta('og:url'), image: meta('og:image'), twitterImage: meta('twitter:image') };
      report.checks.push(result);
      assert.equal(canonical, publicOrigin + expectedPath);
      assert.equal(result.ogUrl, canonical);
      assert.ok(document.title.includes(titleFragment));
      assert.equal(meta('og:title'), document.title);
      assert.equal(meta('twitter:title'), document.title);
      assert.equal(meta('og:description'), meta('description'));
      assert.equal(meta('twitter:description'), meta('description'));
      assert.ok(meta('description'));
      assert.equal(result.image, publicOrigin + '/static/og_image.png');
      assert.equal(result.twitterImage, result.image);
      dom.window.close();
    }
    const imageResponse = await fetch(origin + '/static/og_image.png', { signal: AbortSignal.timeout(10000) });
    assert.equal(imageResponse.status, 200);
    const image = Buffer.from(await imageResponse.arrayBuffer());
    assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    report.imageBytes = image.length;
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Phoenix' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + `/block/${block.hash}`, { waitUntil: 'domcontentloaded' });
    // This probe checks client navigation; pre-hydration button behavior is a separate UX gate.
    await page.waitForFunction(() => window.next?.router?.isReady, undefined, { timeout: 30000 });
    await page.getByRole('link', { name: 'next', exact: true }).waitFor({ timeout: 30000 });
    await page.getByRole('link', { name: 'next', exact: true }).click();
    await page.waitForFunction(() => document.title.includes('46148'), undefined, { timeout: 15000 });
    const navigation = await page.evaluate(() => ({
      title: document.title,
      canonical: document.querySelector('link[rel="canonical"]')?.href,
      ogUrl: document.querySelector('meta[property="og:url"]')?.content,
      ogTitle: document.querySelector('meta[property="og:title"]')?.content,
      twitterTitle: document.querySelector('meta[name="twitter:title"]')?.content,
    }));
    assert.equal(navigation.canonical, publicOrigin + '/block/46148');
    assert.equal(navigation.ogUrl, navigation.canonical);
    assert.equal(navigation.ogTitle, navigation.title);
    assert.equal(navigation.twitterTitle, navigation.title);
    assert.deepEqual(errors, []);
    report.navigation = navigation;
  } catch (error) {
    report.errors.push(error.stack);
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(output, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await browser?.close();
  }
})();
