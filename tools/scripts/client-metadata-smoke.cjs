const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');

const origin = process.env.ETH_ORIGIN || 'http://127.0.0.1:14002';
const output = process.env.REPORT_PATH || '/tmp/tx-taxi-eth-client-metadata.json';
const hash = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

(async () => {
  const report = { origin, checks: [], errors: [] };
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true });
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
      });
      const response = await page.goto(`${origin}/token/${hash}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      assert.equal(response.status(), 200);
      await page.waitForFunction(() => document.title.includes('USDC'), undefined, { timeout: 60000 });
      const result = await page.evaluate(() => {
        const meta = key => document.querySelector(`meta[property="${key}"], meta[name="${key}"]`)?.content;
        return {
          title: document.title,
          description: meta('description'),
          ogTitle: meta('og:title'),
          twitterTitle: meta('twitter:title'),
          ogDescription: meta('og:description'),
          twitterDescription: meta('twitter:description'),
          canonical: document.querySelector('link[rel="canonical"]')?.href,
          ogUrl: meta('og:url'),
          image: meta('og:image'),
          twitterImage: meta('twitter:image'),
          titleTags: document.querySelectorAll('meta[property="og:title"]').length,
          schemaCount: document.querySelectorAll('#blockscout-product-schema').length,
          overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
        };
      });
      report.checks.push({ width, ...result, errors });
      assert.equal(result.ogTitle, result.title);
      assert.equal(result.twitterTitle, result.title);
      assert.ok(result.description);
      assert.equal(result.ogDescription, result.description);
      assert.equal(result.twitterDescription, result.description);
      assert.equal(result.canonical, `https://eth.tx.taxi/token/${hash}`);
      assert.equal(result.ogUrl, result.canonical);
      assert.equal(result.image, 'https://eth.tx.taxi/static/og_image.png');
      assert.equal(result.twitterImage, result.image);
      assert.equal(result.titleTags, 1);
      assert.equal(result.schemaCount, 1);
      assert.equal(result.overflow, 0);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: output.replace(/\.json$/, `-${width}.png`) });
      await page.close();
    }
  } catch (error) {
    report.errors.push(error.stack);
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(output, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await browser?.close();
  }
})();
