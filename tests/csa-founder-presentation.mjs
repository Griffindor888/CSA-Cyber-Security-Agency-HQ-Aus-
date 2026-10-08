import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
const base=(process.env.CSA_TEST_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/,'');
const results=[];
await mkdir('artifacts/presentation',{recursive:true});
for(const [engine,type] of Object.entries({chromium,webkit})){
 const browser=await type.launch();
 try{
  for(const width of [390,1440]){
   const page=await browser.newPage({viewport:{width,height:900}});
   const response=await page.goto(`${base}/company/`);
   assert.equal(response.status(),200);
   assert.doesNotMatch(await page.locator('body').innerText(),/\b(?:Fuad|Fred(?:dy)?|Aydinbayzada|Bayzada)\b/i);
   assert.equal(await page.locator('main').getByRole('heading',{name:'Founder’s Review',exact:true}).count(),0);
   await page.locator('footer a[href="/knowledge/#founder-review"]').click();
   await page.waitForURL(`${base}/knowledge/#founder-review`);
   const section=page.locator('#founder-review');
   await section.scrollIntoViewIfNeeded();
   assert.equal(await section.getByRole('heading',{name:'Founder’s Review',exact:true}).isVisible(),true);
   assert.doesNotMatch(await page.locator('body').innerText(),/\b(?:Fuad|Fred(?:dy)?|Aydinbayzada|Bayzada)\b/i);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await section.screenshot({path:`artifacts/presentation/founder-review-${engine}-${width}.png`});
   results.push({engine,width,base,status:'passed'});
   await page.close();
  }
 }finally{await browser.close();}
}
await writeFile('artifacts/presentation/founder-review-results.json',JSON.stringify({base,results},null,2));
console.log('Unnamed Founder review: four browser/viewport cases passed.');
