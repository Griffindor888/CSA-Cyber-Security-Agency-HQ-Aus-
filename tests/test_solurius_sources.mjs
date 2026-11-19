import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PUBLIC_FILES } from '../scripts/build_static.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('published content does not direct Australian customers to unrelated Solurius sources', () => {
  for (const path of PUBLIC_FILES.filter(path => /\.(html|txt|xml|js|json|webmanifest)$/.test(path))) {
    assert.doesNotMatch(read(path), /https?:\/\/(?:www\.)?solurius\.com\b/i, path);
  }
});

test('shared product directories identify the Australian Solurius overview accurately', () => {
  for (const path of PUBLIC_FILES.filter(path => path.endsWith('.html'))) {
    const html = read(path);
    if (!html.includes('class="product-websites"')) continue;
    assert.match(html, /<a href="\/platforms\/solurius\/">Solurius overview →<\/a>/, path);
    assert.doesNotMatch(html, /Solurius website/, path);
  }
});

test('Solurius retains a working enquiry next step rather than a circular website CTA', () => {
  const html = read('platforms/solurius/index.html');
  const hero = html.match(/<section class="product-hero">([\s\S]*?)<\/section>/)?.[1];
  assert.ok(hero, 'Solurius hero exists');
  assert.match(hero, /href="\/start\/\?pathway=solurius#enquiry">Ask to see it in action<\/a>/);
  assert.doesNotMatch(hero, /Visit Solurius website|Solurius overview →/);
  assert.match(read('start/index.html'), /id="enquiry"/);
});
