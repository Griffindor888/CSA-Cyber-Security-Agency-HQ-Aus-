import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.CSA_TEST_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch();
await mkdir('artifacts', { recursive: true });
try {
  for (const javaScriptEnabled of [true, false]) {
    const context = await browser.newContext({javaScriptEnabled});
    const page = await context.newPage();
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({width, height:844});
      await page.goto(`${base}/platforms/csia/`);
      const toolbar = page.locator('.journey-tools');
      assert.equal(await toolbar.isVisible(), true);
      for (const control of await toolbar.locator(':scope > a, summary').all()) {
        const box = await control.boundingBox();
        assert.ok(box.width >= 44 && box.height >= 44, 'journey control must be a comfortable touch target');
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(overflow <= 1, `journey toolbar must fit ${width}px`);
      await toolbar.getByRole('link', {name:'Go to bottom of page', exact:true}).click();
      await page.waitForTimeout(600);
      const distance = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight - scrollY);
      assert.ok(distance < 4, 'Bottom must reach the end without hiding content');
      await page.screenshot({path:`artifacts/csa-journey-${width}-js-${javaScriptEnabled}.png`});
      await toolbar.getByRole('link', {name:'Go to top of page', exact:true}).click();
      await page.waitForTimeout(600);
      assert.ok(await page.evaluate(() => scrollY < 4), 'Top returns to the beginning');
      await toolbar.locator('summary').click();
      await toolbar.locator('.journey-page-list a[href="/start/"]').click();
      await page.waitForURL(`${base}/start/`);
      assert.equal(await page.locator('.journey-orientation').isVisible(), true);
      await toolbar.getByRole('link', {name:'Next: Tell us your goal',exact:true}).click();
      assert.equal(new URL(page.url()).hash, '#enquiry');
      await toolbar.getByRole('link',{name:'Back to Our products',exact:true}).click();
      await page.waitForURL(`${base}/technology/`);
    }
    await context.close();
  }
  const context = await browser.newContext();
  const response = await context.request.get(`${base}/favicon.svg?v=original-csa-20260928`);
  assert.equal(response.status(),200);
  assert.match(await response.text(), /#0098DA/);
  const icon = await context.request.get(`${base}/apple-touch-icon.png`);
  assert.equal(icon.status(),200);
  await context.close();
  console.log('CSA page journey: six viewport/JavaScript combinations passed.');
} finally { await browser.close(); }
