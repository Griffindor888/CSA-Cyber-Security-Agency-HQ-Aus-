import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.CSA_TEST_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch();
// Poll from the runner: requestAnimationFrame inside the page is disabled in the no-script case.
async function waitForScroll(page, edge) {
  let metrics;
  for (let attempt = 0; attempt < 100; attempt++) {
    metrics = await page.evaluate(() => ({top:scrollY,bottom:document.documentElement.scrollHeight-innerHeight-scrollY}));
    if (metrics[edge] < 4) return;
    await new Promise(resolve => setTimeout(resolve,50));
  }
  await page.screenshot({path:`artifacts/csa-scroll-failure-${edge}.png`});
  assert.fail(`${edge} scroll did not settle: ${JSON.stringify(metrics)}`);
}
async function openJourney(page) {
  const menu = page.locator('.journey-menu');
  if (!await menu.evaluate(element => element.open)) await menu.locator('summary').click();
}
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
      const compact = await toolbar.boundingBox();
      assert.ok(compact.width < 160 && compact.height <= 48, 'closed menu stays discreet');
      assert.equal(await toolbar.locator('.journey-panel').isVisible(), false);
      await openJourney(page);
      for (const control of await toolbar.locator('.journey-actions a, summary').all()) {
        const box = await control.boundingBox();
        assert.ok(box.width >= 44 && box.height >= 44, 'journey control must be a comfortable touch target');
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(overflow <= 1, `journey toolbar must fit ${width}px`);
      await toolbar.getByRole('link', {name:'Go to bottom of page', exact:true}).click();
      await waitForScroll(page, 'bottom');
      const distance = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight - scrollY);
      assert.ok(distance < 4, 'Bottom must reach the end without hiding content');
      await page.screenshot({path:`artifacts/csa-journey-${width}-js-${javaScriptEnabled}.png`});
      await openJourney(page);
      await toolbar.getByRole('link', {name:'Go to top of page', exact:true}).click();
      await waitForScroll(page, 'top');
      assert.ok(await page.evaluate(() => scrollY < 4), 'Top returns to the beginning');
      await openJourney(page);
      await toolbar.locator('.journey-page-list a[href="/start/"]').click();
      await page.waitForURL(`${base}/start/`);
      assert.equal(await page.locator('.journey-orientation').isVisible(), true);
      await openJourney(page);
      await toolbar.getByRole('link', {name:'Next: Tell us your goal',exact:true}).click();
      assert.equal(new URL(page.url()).hash, '#enquiry');
      await openJourney(page);
      await toolbar.getByRole('link',{name:'Back to Our products',exact:true}).click();
      await page.waitForURL(`${base}/technology/`);
    }
    // Model a 400%-zoom visual viewport: the open picker must remain above the sticky header.
    await page.setViewportSize({width:320,height:256});
    await page.goto(`${base}/`);
    await openJourney(page);
    const firstLink = page.locator('.journey-actions a').first();
    assert.equal(await firstLink.evaluate(element => {
      const r = element.getBoundingClientRect();
      return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('a') === element;
    }), true, 'short viewport must leave the first page-picker row clickable');
    await page.locator('.journey-page-list a[href="/start/"]').click();
    await page.waitForURL(`${base}/start/`);
    if (javaScriptEnabled) {
      await openJourney(page);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.journey-menu').evaluate(element => element.open), false);
      assert.equal(await page.locator('.journey-menu summary').evaluate(element => element === document.activeElement), true);
    }
    await context.close();
  }
  const context = await browser.newContext();
  const response = await context.request.get(`${base}/favicon.svg`);
  assert.equal(response.status(),200);
  const faviconSource = await response.text();
  const iconPage = await context.newPage();
  const faviconIsRenderable = await iconPage.evaluate(source => {
    const document = new DOMParser().parseFromString(source, 'image/svg+xml');
    return !document.querySelector('parsererror')
      && document.documentElement.localName === 'svg'
      && document.documentElement.namespaceURI === 'http://www.w3.org/2000/svg'
      && document.querySelector('path, circle, rect, polygon, ellipse, polyline, line') !== null;
  }, faviconSource);
  assert.equal(faviconIsRenderable, true, 'favicon must be a valid SVG with visible artwork');
  // Old cached URL must serve the approved source, not the superseded cyan logo.
  assert.equal(faviconSource, await readFile(new URL('../favicon.svg', import.meta.url), 'utf8'));
  assert.match(faviconSource, /<title[^>]*>CSA navigation star<\/title>/);
  assert.match(faviconSource, /eight-point institutional navigation star/);
  for (const colour of ['#0A2540', '#0E4C91', '#D0D8E6']) assert.ok(faviconSource.includes(colour));
  assert.doesNotMatch(faviconSource, /<script\b|<foreignObject\b|\son\w+=/i);
  await iconPage.close();
  const icon = await context.request.get(`${base}/apple-touch-icon.png`);
  assert.equal(icon.status(),200);
  await context.close();
  console.log('CSA page journey: six viewport/JavaScript combinations passed.');
} finally { await browser.close(); }
