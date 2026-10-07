import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium, webkit } from 'playwright';

const base = (process.env.CSA_TEST_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const name = process.env.CSA_TEST_BROWSER || 'chromium';
assert.ok(['chromium', 'webkit'].includes(name));
const browser = await ({chromium, webkit}[name]).launch();
const sizes = [[320,568],[390,844],[430,932],[844,390],[1024,768],[1440,900]];
const destinations = ['/company/', '/ecosystem/', '/contact/'];
const results = [];
await mkdir('artifacts', {recursive:true});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function imagesReady(page) {
  for (const image of await page.locator('img:visible').all()) {
    assert.equal(await image.evaluate(async image => {
      try { await image.decode(); return image.complete && image.naturalWidth > 0; }
      catch { return false; }
    }), true, 'visible image must decode, including the SVG header');
  }
}
async function open(page) {
  await page.locator('.enter').click();
  await page.waitForFunction(() => document.querySelector('.entrance').dataset.state === 'open');
}
try {
  const request = await browser.newContext();
  const root = await request.request.get(`${base}/`);
  assert.equal(root.status(), 200);
  assert.equal(hash(await root.body()), hash(await readFile(new URL('../index.html', import.meta.url))), 'deployed root must be exact reviewed entrance source, not the old corporate index');
  const art = await request.request.get(`${base}/assets/brand/csa-two-eagle-arms.avif`);
  assert.equal(art.status(), 200);
  assert.equal(hash(await art.body()), '93193c1c74013496284d55f2b339ec6cc6d03bcb92b45d722e2b55be46052d87');
  await request.close();
  for (const [width,height] of sizes) {
    const context = await browser.newContext({viewport:{width,height}});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/`, {waitUntil:'load'});
    await page.waitForFunction(() => document.querySelector('.entrance')?.dataset.state === 'closed');
    assert.equal(await page.locator('.enter').isVisible(), true);
    assert.equal(await page.locator('#welcome').isVisible(), false);
    assert.equal(await page.locator('.door:visible').count(), 2);
    await imagesReady(page);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1, `closed entrance must fit ${width}px`);
    await page.screenshot({path:`artifacts/csa-entrance-${name}-${width}-closed.png`,fullPage:true});
    await page.locator('.enter').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.entrance').dataset.state === 'open');
    assert.equal(await page.locator('#welcome').isVisible(), true);
    assert.equal(await page.locator('#welcome').evaluate(e => e === document.activeElement), true);
    assert.equal(await page.locator('.enter').getAttribute('aria-expanded'), 'true');
    await imagesReady(page);
    assert.deepEqual(await page.locator('.entrance-routes a').evaluateAll(a => a.map(a => a.getAttribute('href'))), destinations);
    for (const link of await page.locator('.entrance-routes a').all()) {
      await link.scrollIntoViewIfNeeded();
      const box = await link.boundingBox();
      assert.ok(box.width >= 44 && box.height >= 44);
      assert.equal(await link.evaluate(e => {
        const b = e.getBoundingClientRect();
        return document.elementFromPoint(b.x + b.width/2, b.y + b.height/2)?.closest('a') === e;
      }), true, 'open door must not cover navigation');
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1, `open entrance must fit ${width}px`);
    await page.screenshot({path:`artifacts/csa-entrance-${name}-${width}-open.png`,fullPage:true});
    await page.locator('.close-entrance').click();
    assert.equal(await page.locator('.entrance').getAttribute('data-state'), 'closed');
    assert.equal(await page.locator('.enter').evaluate(e => e === document.activeElement), true);
    // Follow real anchors rather than merely asserting their strings.
    for (const destination of destinations) {
      await open(page);
      const response = await Promise.all([
        page.waitForNavigation({waitUntil:'load'}),
        page.locator(`.entrance-routes a[href="${destination}"]`).click(),
      ]);
      assert.equal(response[0]?.status(), 200);
      assert.equal(new URL(page.url()).pathname, destination);
      assert.equal(await page.locator('main').count(), 1);
      await page.goto(`${base}/`, {waitUntil:'load'});
      await page.waitForFunction(() => document.querySelector('.entrance').dataset.state === 'closed');
    }
    await open(page);
    await page.locator('.overview').click();
    await page.waitForURL(`${base}/institution/`);
    assert.equal(await page.locator('.institution-hero h1').textContent(), 'Governance infrastructure for consequential technology.');
    assert.equal(await page.locator('.group-navigation a').count(), 5);
    assert.deepEqual(errors, []);
    results.push({browser:name,width,height,status:'passed',scope:'exact root and artwork bytes, closed/open state, decoded images, keyboard, layout, real destinations and preserved corporate content'});
    await context.close();
  }
  for (const javaScriptEnabled of [false,true]) {
    const context = await browser.newContext({viewport:{width:390,height:844},javaScriptEnabled,reducedMotion:'reduce'});
    const page = await context.newPage();
    await page.goto(`${base}/`, {waitUntil:'load'});
    if (javaScriptEnabled) {
      await page.locator('.enter').click();
      assert.equal(await page.locator('.entrance').getAttribute('data-state'),'open');
      assert.equal(await page.locator('.door-left').evaluate(e => getComputedStyle(e).transitionDuration), '0s');
    } else {
      assert.equal(await page.locator('#welcome').isVisible(),true);
      assert.equal(await page.locator('.enter').isVisible(),false);
      for (const destination of destinations) {
        await page.locator(`.entrance-routes a[href="${destination}"]`).click();
        await page.waitForURL(`${base}${destination}`);
        assert.equal(await page.locator('main').count(),1);
        await page.goto(`${base}/`,{waitUntil:'load'});
      }
    }
    await imagesReady(page);
    results.push({browser:name,javaScriptEnabled,reducedMotion:true,status:'passed'});
    await context.close();
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base}/`,{waitUntil:'load'});
  await page.locator('.skip-link').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.entrance').dataset.state === 'open');
  assert.equal(await page.locator('#welcome').evaluate(e => e === document.activeElement),true);
  await context.close();
  await writeFile(`artifacts/csa-entrance-${name}-results.json`, JSON.stringify({base,browser:name,realIPhone:false,results},null,2));
  console.log(`CSA entrance ${name}: ${results.length} cases passed; exact root, artwork and linked destinations verified. WebKit is browser-engine testing, not a physical iPhone certification.`);
} finally { await browser.close(); }
