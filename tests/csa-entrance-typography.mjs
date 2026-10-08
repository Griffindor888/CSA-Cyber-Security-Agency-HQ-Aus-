import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
const base=(process.env.CSA_TEST_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/,'');
const sizes=[[320,568],[390,844],[430,932],[844,390],[1024,768],[1440,900]];
const results=[];
await mkdir('artifacts/presentation',{recursive:true});
for(const [engine,type] of Object.entries({chromium,webkit})){
 const browser=await type.launch();
 try{
  for(const [width,height] of sizes){
   const page=await browser.newPage({viewport:{width,height}});
   const response=await page.goto(`${base}/`);
   assert.equal(response.status(),200);
   await page.locator('.entrance[data-state="closed"]').waitFor();
   await page.evaluate(()=>document.fonts.ready);
   const metrics=await page.evaluate(()=>{
    const centre=e=>{const r=e.getBoundingClientRect();return r.x+r.width/2;};
    const button=document.querySelector('.enter');
    const range=document.createRange();
    range.selectNodeContents(button.firstChild);
    const text=range.getBoundingClientRect();
    const phrases=[...document.querySelectorAll('.closed-content .discipline span')];
    const lines=phrases.map(e=>{const r=document.createRange();r.selectNodeContents(e);return r.getClientRects().length;});
    return {axis:centre(document.querySelector('.entrance')),button:centre(button),label:text.x+text.width/2,crest:centre(document.querySelector('.closed-arms')),name:centre(document.querySelector('.closed-name')),lines,text:phrases.map(e=>e.textContent),whiteSpace:phrases.map(e=>getComputedStyle(e).whiteSpace),overflow:document.documentElement.scrollWidth-innerWidth};
   });
   for(const key of ['button','crest','name'])assert.ok(Math.abs(metrics[key]-metrics.axis)<=1,`${engine} ${width}: ${key} off centre`);
   assert.ok(Math.abs(metrics.label-metrics.axis)<=3,`${engine} ${width}: entry label off centre`);
   assert.deepEqual(metrics.text,['Technology','Governance','Intelligent Systems']);
   assert.deepEqual(metrics.whiteSpace,['nowrap','nowrap','nowrap']);
   assert.ok(metrics.lines.every(n=>n===1),'Each discipline phrase must stay on one line');
   assert.ok(metrics.overflow<=1);
   const broken=await page.locator('.brand img,.closed-arms').evaluateAll(images=>images.some(i=>!i.complete||i.naturalWidth===0));
   assert.equal(broken,false,'Header and approved crest must decode');
   await page.screenshot({path:`artifacts/presentation/csa-gate-${engine}-${width}-closed.png`,fullPage:true});
   await page.locator('.enter').click();
   await page.locator('.entrance[data-state="open"]').waitFor();
   for(const label of ['Company','Ecosystem','Contact'])assert.equal(await page.locator('.entrance-routes').getByRole('link',{name:new RegExp(label)}).isVisible(),true);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:`artifacts/presentation/csa-gate-${engine}-${width}-open.png`,fullPage:true});
   results.push({engine,width,height,base,status:'passed',metrics});
   await page.close();
  }
 }finally{await browser.close();}
}
await writeFile('artifacts/presentation/gate-typography-results.json',JSON.stringify({base,results},null,2));
console.log('CSA gate typography: 12 browser/viewport cases passed.');
