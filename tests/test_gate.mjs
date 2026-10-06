import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PUBLIC_FILES } from '../scripts/build_static.mjs';

const html=readFileSync(new URL('../gate.html',import.meta.url),'utf8');
const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
test('the legacy crest is unchanged and the reviewed gate source is published',()=>{
 // The legacy raster is not the Founder-approved two-eagle master. See the brand manifest.
 const art=readFileSync(new URL('../csa-crest.avif',import.meta.url));
 assert.equal(createHash('sha1').update(`blob ${art.length}\0`).update(art).digest('hex'),'d8d4b3f80e09bef36778798a5f1127facfdc6eb5');
 assert.equal(createHash('sha256').update(html).digest('hex'),'2a165226a54ab8aacaebadfeebf28967ff56ab3c73ee089709a184a268998bd9');
 for(const p of ['gate.html','gate.css','brand.css','csa-header-logo.svg','csa-header-logo-reversed.svg','csa-crest.avif','index.html'])assert.ok(PUBLIC_FILES.includes(p));
 assert.equal(art.length,6711);
});
test('root-only entrance rewrite preserves all existing corporate and intake routes',()=>{
 assert.deepEqual(config.rewrites,[{source:'/',destination:'/gate.html'}]);
 for(const match of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)){
  const path=match[1];const file=path==='/'?'index.html':path.endsWith('/')?path.slice(1)+'index.html':path.slice(1);
  assert.ok(PUBLIC_FILES.includes(file),`Gate destination is not published: ${path}`);
 }
 for(const file of ['start/index.html','engagement/index.html','privacy/index.html','terms/index.html','security/index.html','platforms/wardale/index.html'])assert.ok(PUBLIC_FILES.includes(file));
});
test('the gate retains an explicit independent company identity and real accessible navigation',()=>{
 assert.match(html,/Cyber Security Agency Australia Pty Limited/);assert.match(html,/Independent Australian technology business/);
 assert.match(html,/class="enter" href="\/start\/"/);assert.match(html,/No obligation/);assert.match(html,/Skip to main content/);
 assert.match(html,/<details class="mobile-nav">/);assert.match(html,/<h1 id="gate-title">/);assert.match(html,/fetchpriority="high"/);
 assert.doesNotMatch(html,/<script|<style|style=|onclick=|Copyright.*2022/);
});
test('security restrictions and the reviewed publication allowlist remain intact',()=>{
 const headers=Object.fromEntries(config.headers.find(h=>h.source==='/(.*)').headers.map(h=>[h.key,h.value]));
 assert.equal(headers['X-Frame-Options'],'DENY');assert.equal(headers['X-Content-Type-Options'],'nosniff');
 assert.match(headers['Content-Security-Policy'],/script-src 'self'; style-src 'self'/);assert.doesNotMatch(headers['Content-Security-Policy'],/unsafe-inline|unsafe-eval/);
 assert.match(config.buildCommand,/tests\/test_static_build.mjs/);assert.match(config.buildCommand,/tests\/test_gate.mjs/);
 assert.ok(PUBLIC_FILES.every(p=>!p.startsWith('docs/')&&!p.startsWith('supabase/')&&!p.includes('*')));
});
