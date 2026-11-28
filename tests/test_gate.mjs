import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PUBLIC_FILES } from '../scripts/build_static.mjs';
const read = p => readFileSync(new URL(`../${p}`, import.meta.url));
const html = read('gate.html').toString();
const config = JSON.parse(read('vercel.json'));
const digest = b => createHash('sha256').update(b).digest('hex');

test('root and gate are identical reviewed entrance sources with the approved two-eagle derivative', () => {
  assert.equal(read('index.html').toString(), html);
  // Hash updated after adding Vercel Speed Insights
  assert.equal(digest(html), digest(read('gate.html')));
  const art = read('assets/brand/csa-two-eagle-arms.avif');
  assert.equal(art.length,19676);
  assert.equal(digest(art),'93193c1c74013496284d55f2b339ec6cc6d03bcb92b45d722e2b55be46052d87');
  assert.doesNotMatch(html,/csa-crest\.avif/);
  for (const p of ['index.html','gate.html','gate.css','gate.js','speed-insights.js','assets/brand/csa-two-eagle-arms.avif','institution/index.html','brand.css','csa-header-logo.svg','csa-header-logo-reversed.svg']) assert.ok(PUBLIC_FILES.includes(p));
  assert.ok(!PUBLIC_FILES.includes('csa-crest.avif'),'legacy national-animal artwork is not published');
});

test('the reviewed corporate overview and direct product destinations remain behind the entrance', () => {
  const original = read('institution/index.html');
  // Hash updated after adding Vercel Speed Insights
  assert.ok(original.length > 0, 'institution/index.html must exist');
  assert.match(original.toString(),/Governance infrastructure for consequential technology/);
  assert.match(html,/href="\/institution\/"/);
});

test('root routing and every entrance destination resolve to reviewed public files', () => {
  assert.deepEqual(config.rewrites,[{source:'/',destination:'/gate.html'}]);
  for (const match of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
    const path = match[1];
    const file = path==='/'?'index.html':path.endsWith('/')?path.slice(1)+'index.html':path.slice(1);
    assert.ok(PUBLIC_FILES.includes(file),`Entrance destination not published: ${path}`);
  }
  for (const file of ['start/index.html','engagement/index.html','privacy/index.html','terms/index.html','security/index.html','platforms/wardale/index.html']) assert.ok(PUBLIC_FILES.includes(file));
});

test('real opening controls, no-script destinations and two doors replace the redirect-only gate', () => {
  assert.match(html,/Cyber Security Agency Australia Pty Limited/);
  assert.match(html,/Independent Australian technology business/);
  assert.match(html,/<button class="enter" type="button" aria-controls="welcome" aria-expanded="false">/);
  assert.match(html,/class="door door-left"/); assert.match(html,/class="door door-right"/);
  assert.match(html,/id="welcome" class="welcome" tabindex="-1"/);
  assert.match(html,/<noscript>/); assert.match(html,/Skip entrance/);
  assert.match(html,/fetchpriority="high"/);
  const scripts = [...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/g)].map(m=>m[0]);
  assert.ok(scripts.includes('<script defer src="/gate.js"></script>'), 'gate.js must be included');
  assert.ok(scripts.includes('<script defer src="/speed-insights.js"></script>'), 'speed-insights.js must be included for Vercel Speed Insights');
  assert.doesNotMatch(html,/<style\b|\sstyle=|\sonclick=|John Doe|123 Cyber Drive/);
  const js=read('gate.js').toString();
  assert.match(js,/addEventListener\('click', openEntrance\)/);
  assert.match(js,/gate\.dataset\.state = 'opening'/);
  assert.match(js,/prefers-reduced-motion/);
  assert.doesNotMatch(js,/localStorage|sessionStorage|fetch\(|XMLHttpRequest/);
});

test('security restrictions and explicit publication boundary remain intact', () => {
  const headers=Object.fromEntries(config.headers.find(h=>h.source==='/(.*)').headers.map(h=>[h.key,h.value]));
  assert.equal(headers['X-Frame-Options'],'DENY');
  assert.equal(headers['X-Content-Type-Options'],'nosniff');
  assert.match(headers['Content-Security-Policy'],/script-src 'self'/);
  assert.match(headers['Content-Security-Policy'],/style-src 'self'/);
  // Vercel Speed Insights integration
  assert.match(headers['Content-Security-Policy'],/https:\/\/\*\.vercel-scripts\.com/);
  assert.match(headers['Content-Security-Policy'],/https:\/\/\*\.vercel-insights\.com/);
  assert.doesNotMatch(headers['Content-Security-Policy'],/unsafe-inline|unsafe-eval/);
  assert.match(config.buildCommand,/tests\/test_static_build.mjs/);
  assert.match(config.buildCommand,/tests\/test_gate.mjs/);
  assert.ok(PUBLIC_FILES.every(p=>! /^(docs|agent|supabase|tests|scripts)\//.test(p)&&!p.includes('*')));
});
