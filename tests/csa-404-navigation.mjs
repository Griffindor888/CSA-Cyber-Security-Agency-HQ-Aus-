import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseURL = (process.env.CSA_TEST_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const local = ['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname);
const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const policy = config.headers.find(rule => rule.source === '/(.*)').headers.find(header => header.key === 'Content-Security-Policy').value;
const missingPath = '/__csa_navigation_acceptance__/nested/not-found';
const missingHTML = await readFile(new URL('../404.html', import.meta.url), 'utf8');
const products = ['/platforms/wardale/', '/platforms/solurius/', '/platforms/autto-connect/', '/platforms/csia/'];
const expectedNavigation = ['/company/', '/ecosystem/', '/technology/', '/governance/', '/industries/', '/trust/', '/research/'];
const browser = await chromium.launch();
const results = [];
await mkdir('artifacts', { recursive: true });
try {
  for (const javaScriptEnabled of [true, false]) {
    const context = await browser.newContext({ javaScriptEnabled });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(baseURL).origin) {
        throw new Error('404 navigation must not make third-party requests');
      }
      // Python's local static server has no custom error document. This fixture
      // verifies nested-path rendering only; real provider routing is checked
      // separately by running with CSA_TEST_BASE_URL on a deployed site.
      if (local && url.pathname === missingPath) {
        return route.fulfill({ status:404, contentType:'text/html', headers:{'content-security-policy':policy}, body:missingHTML });
      }
      const response = await route.fetch();
      const body = await response.body();
      await route.fulfill({ status:response.status(), headers:{...response.headers(), 'content-security-policy':policy}, body });
    });
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height:900 });
      const response = await page.goto(`${baseURL}${missingPath}`, { waitUntil:'networkidle' });
      assert.equal(response.status(), 404, 'missing paths must keep HTTP 404');
      assert.equal(await page.locator('main').count(), 1);
      assert.equal(await page.locator('.nav').count(), 1, '404 needs one standard corporate header');
      assert.equal(await page.locator('.nav').isVisible(), true);
      assert.equal(await page.locator('.nav .brand[href="/"]').isVisible(), true);
      assert.equal(await page.locator('.group-bar:visible').count(), 0, 'duplicate header must not return');
      const navigation = await page.locator('.navlinks a').evaluateAll(links => links.map(a => a.getAttribute('href')).filter(href => href !== '/engagement/'));
      assert.deepEqual(navigation, expectedNavigation, '404 keeps the primary destinations');
      assert.equal(await page.locator('.skiplink').count(), 1);
      assert.equal(await page.locator('.skiplink').getAttribute('href'), '#main-content');
      assert.equal(await page.locator('#main-content').count(), 1);
      for (const href of products) {
        const link = page.locator(`main a[href="${href}"]`);
        assert.equal(await link.count(), 1);
        assert.equal(await link.isVisible(), true, 'product recovery cannot depend on JavaScript or opening a menu');
        const destination = await context.request.get(`${baseURL}${href}`);
        assert.equal(destination.status(), 200, `${href} must resolve`);
      }
      const fallback = page.locator('nav[aria-label="Primary navigation without JavaScript"]');
      if (javaScriptEnabled) {
        assert.equal(await fallback.count(), 0, 'scripted pages must not render duplicate fallback navigation');
        assert.equal(await page.locator('.menu').getAttribute('hidden'), null, 'script reveals the menu only after initialization');
      } else {
        assert.equal(await page.locator('.menu').isVisible(), false, 'no inert menu control may be advertised without JavaScript');
        assert.equal(await page.getByRole('button', {name:'Open primary navigation'}).count(), 0, 'hidden menu must be absent from the accessible controls');
        assert.equal(await fallback.isVisible(), true, 'no-script primary navigation must be visible, not merely in the DOM');
        assert.deepEqual(await fallback.locator('a').evaluateAll(links => links.map(a => a.getAttribute('href'))), [...expectedNavigation, '/engagement/']);
        for (const href of [...expectedNavigation, '/engagement/']) {
          const link = fallback.locator(`a[href="${href}"]`);
          assert.equal(await link.isVisible(), true, `${href} needs a visible no-script fallback`);
          const destination = await context.request.get(`${baseURL}${href}`);
          assert.equal(destination.status(), 200, `${href} must resolve without JavaScript`);
        }
        const ecosystem = fallback.locator('a[href="/ecosystem/"]');
        await ecosystem.focus();
        assert.equal(await ecosystem.evaluate(element => element === document.activeElement), true);
        await Promise.all([page.waitForURL(`${baseURL}/ecosystem/`), ecosystem.press('Enter')]);
        assert.equal(new URL(page.url()).pathname, '/ecosystem/', 'keyboard activation must leave the 404 without JavaScript');
        const returned = await page.goto(`${baseURL}${missingPath}`, {waitUntil:'networkidle'});
        assert.equal(returned.status(), 404);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 1, `404 overflows ${width}px by ${overflow}px`);
      if (javaScriptEnabled && width <= 980) {
        const menu = page.locator('.menu');
        assert.equal(await menu.getAttribute('aria-expanded'), 'false');
        await menu.click();
        assert.equal(await menu.getAttribute('aria-expanded'), 'true');
        assert.equal(await page.locator('.navlinks').isVisible(), true);
        assert.equal(await page.locator('.navlinks a[href="/engagement/"]').isVisible(), true);
        await page.keyboard.press('Escape');
        assert.equal(await menu.getAttribute('aria-expanded'), 'false');
        assert.equal(await menu.evaluate(element => element === document.activeElement), true);
      }
      await page.screenshot({path:`artifacts/csa-404-${width}-js-${javaScriptEnabled}.png`,fullPage:true});
      await page.locator('main a[href="/"]').click();
      assert.equal(new URL(page.url()).pathname, '/');
      assert.equal(await page.locator('.nav:visible').count(), 1, 'home keeps one corporate header');
      assert.equal(await page.locator('.group-bar:visible').count(), 1, 'home restores the standard product group navigation');
      results.push({width, javaScriptEnabled, status:'passed', localErrorRoutingFixture:local});
    }
    assert.deepEqual(errors, [], 'no browser exceptions');
    await context.close();
  }
  await writeFile('artifacts/csa-404-navigation-results.json', JSON.stringify({results}, null, 2));
  console.log(`404 navigation acceptance: ${results.length} viewport/JavaScript combinations passed.`);
} finally {
  await browser.close();
}
