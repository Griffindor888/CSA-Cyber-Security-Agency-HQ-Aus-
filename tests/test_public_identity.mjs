import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PUBLIC_FILES } from '../scripts/build_static.mjs';
const read = p => readFileSync(new URL(`../${p}`, import.meta.url),'utf8');
const personal = /\b(?:Fuad|Fred(?:dy)?|Aydinbayzada|Bayzada)\b/i;
const visible = html => html.replace(/<!--[^]*?-->/g,'').replace(/<[^>]*>/g,' ');
test('all published HTML is free of the personal name in text, titles and accessible labels', () => {
 for (const path of PUBLIC_FILES.filter(p=>p.endsWith('.html'))) {
  const html=read(path);
  assert.doesNotMatch(visible(html),personal,`Personal identity in published text: ${path}`);
  for(const tag of html.matchAll(/<(?:meta|img|a|section)\b[^>]*>/gi)) {
   for(const m of tag[0].matchAll(/(?:content|alt|aria-label|title)="([^"]*)"/g)) assert.doesNotMatch(m[1],personal,`Personal identity in metadata/label: ${path}`);
  }
 }
});
test('Founder review lives in Knowledge, reached by an unnamed company-footer link',()=>{
 const company=read('company/index.html'), knowledge=read('knowledge/index.html');
 assert.doesNotMatch(company.match(/<main>([^]*?)<\/main>/)?.[1] || '', /Founder|founder-review/);
 assert.match(company,/<footer[^]*?href="\/knowledge\/#founder-review">Founder’s Review<\/a>/);
 assert.match(knowledge,/<section class="section" id="founder-review" aria-labelledby="founder-review-title">/);
 assert.match(knowledge,/<h2 id="founder-review-title">Founder’s Review<\/h2>/);
 assert.match(knowledge,/Selected founder insights and public review material/);
 assert.match(knowledge,/rel="noopener noreferrer">Public Founder Review/);
});
