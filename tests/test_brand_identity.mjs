import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PUBLIC_FILES } from '../scripts/build_static.mjs';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('docs/brand/brand-book-manifest.json'));
const book = read(manifest.repositoryText);
const gate = read('gate.html');
const css = read('brand.css');
const config = JSON.parse(read('vercel.json'));

test('Founder-approved book retains all 19 sections and exact source provenance', () => {
  assert.equal(manifest.status, 'founder-approved-brand-standard');
  assert.equal(manifest.brandBookVersion, '1.0');
  assert.equal(manifest.relatedPullRequest, 22);
  assert.equal((book.match(/^## \d+\. /gm) || []).length, 19);
  assert.equal(manifest.sourceDocuments.length, 3);
  assert.equal(manifest.illustrations.length, 19);
  for (const source of manifest.sourceDocuments) {
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
    assert.ok(source.bytes > 0);
    assert.equal(source.committedBinary, false);
    assert.equal(source.location, 'delivered-conversation-package');
  }
  assert.match(book, /placeholders unless separately verified/);
  assert.match(book, /not the illustrated PDF/);
});

test('two-eagle rules are adopted without falsely certifying the legacy crest', () => {
  assert.equal(manifest.crest.supporters, 'two eagles');
  assert.equal(manifest.crest.supporterCount, 2);
  assert.equal(manifest.crest.centralDevice, 'W / WOS');
  assert.equal(manifest.crest.starPoints, 8);
  assert.equal(manifest.crest.productionMasterStatus, 'pending-exact-approved-master-replacement');
  assert.equal(manifest.statutoryConstitutionAmendment, false);
  assert.equal(manifest.governmentEndorsementClaim, false);
  assert.match(book, /private-company identity/);
  assert.match(book, /not reclassified as the approved two-eagle master/);
});

test('both header SVGs and the six-colour stylesheet are published, not just committed', () => {
  for (const path of manifest.publishedIdentityAssets) assert.ok(PUBLIC_FILES.includes(path), `Missing public asset: ${path}`);
  const expected = {navy:'#0A2540', royalBlue:'#0E4C91', steel:'#8AA5C5', silver:'#D0D8E6', goldAccent:'#C6A966', white:'#FFFFFF'};
  assert.deepEqual(manifest.palette, expected);
  for (const colour of Object.values(expected)) assert.ok(css.includes(colour));
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /min-width:\s*140px/);
});

test('SVG geometry is preserved and the reversed wordmark is readable on navy', () => {
  const light = read('csa-header-logo.svg');
  const dark = read('csa-header-logo-reversed.svg');
  assert.equal(createHash('sha256').update(light).digest('hex'), 'b19cd26b230db279b94c1ad9317ee55af754b5e81ddd2fded0c6439551caae3a');
  assert.equal(dark.trim(), light.replaceAll('fill="#0A2540"','fill="#FFFFFF"').replace('fill="#0E4C91">PROTECT','fill="#D0D8E6">PROTECT'));
  for (const svg of [light, dark]) {
    assert.match(svg, /viewBox="0 0 960 180"/);
    assert.match(svg, /<title[^>]*>Cyber Security Agency Australia/);
    assert.doesNotMatch(svg, /<script\b|<foreignObject\b|\son\w+=|(?:href|src)="https?:/i);
  }
});

test('entrance uses the SVG header, correct company identity and three exact destinations', () => {
  assert.match(gate, /<header class="gate-header">[\s\S]*?<img src="\/csa-header-logo-reversed.svg"/);
  assert.match(gate, /href="\/brand.css"/);
  assert.match(gate, /Cyber Security Agency Australia Pty Limited/);
  assert.match(gate, /Independent Australian technology business/);
  const routes = gate.match(/<nav class="entrance-routes"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(routes);
  assert.deepEqual([...routes.matchAll(/href="([^"]+)"/g)].map(m => m[1]), Object.values(manifest.routes));
  for (const [label, path] of Object.entries(manifest.routes)) {
    assert.ok(routes.includes(`<strong>${label}</strong>`));
    assert.ok(PUBLIC_FILES.includes(path.slice(1)+'index.html'));
  }
  assert.doesNotMatch(gate, /John Doe|123 Cyber Drive|john\.doe|@CSA_Australia/);
});

test('canonical navigation and security boundaries are preserved', () => {
  assert.equal(manifest.canonicalDomain, 'https://cs-agency.com.au/');
  assert.equal(manifest.sitemap, 'https://cs-agency.com.au/sitemap.xml');
  assert.equal(manifest.corporateEmail, 'info@cs-agency.com.au');
  assert.deepEqual(config.rewrites, [{source:'/', destination:'/gate.html'}]);
  assert.match(config.buildCommand, /tests\/test_brand_identity.mjs/);
  assert.match(config.buildCommand, /tests\/test_gate.mjs/);
  assert.match(config.buildCommand, /tests\/test_static_build.mjs/);
  assert.ok(PUBLIC_FILES.every(p => !/^(?:docs|agent|supabase|tests|scripts)\//.test(p) && !p.includes('*')));
  const csp = config.headers.find(h => h.source === '/(.*)').headers.find(h => h.key === 'Content-Security-Policy').value;
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.match(csp, /script-src 'self'; style-src 'self'/);
});
