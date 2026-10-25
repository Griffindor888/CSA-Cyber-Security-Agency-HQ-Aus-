import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {TextEncoder} from 'node:util';

const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const fields = () => ({
  pathway:'wardale', organisation:'Example Business', contact_name:'Test Operator',
  email:'test@example.invalid', timeframe:'exploring',
  requirement:'Review the proposed controlled test engagement.', consent:'on',
  website:''
});

function storage() {
  const rows = new Map();
  return {
    getItem(key) { return rows.get(key) ?? null; },
    setItem(key,value) { rows.set(key,String(value)); },
    removeItem(key) { rows.delete(key); },
    dump() { return [...rows.values()].join(' '); },
    count() { return rows.size; },
  };
}
function browserHarness(tabStorage, send = async () => { throw new Error('Timeout after dispatch'); }) {
  const state = fields();
  const calls = [];
  const submitButton = {disabled:false};
  const status = {textContent:'',dataset:{}};
  const fallback = {hidden:true,href:''};
  const pathwaySelect = {value:state.pathway};
  let submitHandler, resets = 0;
  const form = {
    reportValidity: () => true,
    querySelector(selector) {
      if (selector==='[name="pathway"]') return pathwaySelect;
      if (selector==='[type="submit"]') return submitButton;
      if (selector==='[data-form-status]') return status;
      if (selector==='[data-email-fallback]') return fallback;
      return null;
    },
    addEventListener(name, handler) { if (name==='submit') submitHandler=handler; },
    prepend() {},
    reset() { resets++; },
  };
  const document = {
    querySelector(selector) { return selector==='#csa-commercial-enquiry' ? form : null; },
    querySelectorAll() { return []; },
    createElement() { return {appendChild(){},classList:{remove(){},add(){}}}; },
    head: {appendChild(){}},
    body: {prepend(){}},
  };
  const browser = {
    location: {search:'', pathname:'/start/'},
    sessionStorage:tabStorage,
  };
  class FakeFormData {
    constructor() {}
    entries() { return Object.entries({...state, pathway:pathwaySelect.value}); }
  }
  const context=vm.createContext({
    document,window:browser,crypto:webcrypto,TextEncoder,FormData:FakeFormData,
    URLSearchParams,AbortController,setTimeout,clearTimeout,
    fetch: async (url,opts) => {
      assert.match(url,/submit_csa_commercial_enquiry$/);
      calls.push(JSON.parse(opts.body));
      return send(calls.at(-1),opts);
    },
  });
  vm.runInContext(appSource,context,{timeout:2000,filename:'app.js'});
  assert.equal(typeof submitHandler,'function','live client submit handler must attach');
  return {
    state,calls,status,fallback,submitButton,
    async submit() { await submitHandler({preventDefault(){}}); },
    resetCount:()=>resets
  };
}

test('unknown dispatched enquiry keeps same UUID after reload for identical details', async () => {
  const s=storage();
  const first=browserHarness(s);
  await first.submit();
  assert.equal(first.status.dataset.state,'error');
  const id=first.calls[0].p_correlation_id;
  assert.match(id,/^[0-9a-f-]{36}$/);
  const saved=JSON.parse(s.dump());
  assert.equal(saved.version,2);
  assert.equal(saved.entries.length,1);
  assert.equal(saved.entries[0].correlationId,id);
  assert.match(saved.entries[0].digest,/^[0-9a-f]{64}$/);
  assert.doesNotMatch(s.dump(),/Example Business|test@example|Review the proposed|contact_name|requirement/);
  const reloaded=browserHarness(s);
  await reloaded.submit();
  assert.equal(reloaded.calls[0].p_correlation_id,id);
  assert.match(reloaded.status.textContent,/may have been received/);
});

test('changed enquiry values never inherit an unrelated pending correlation', async () => {
  const s=storage();
  const first=browserHarness(s); await first.submit();
  const changed=browserHarness(s);
  changed.state.requirement='A different enquiry and distinct contractual purpose.';
  await changed.submit();
  assert.notEqual(changed.calls[0].p_correlation_id,first.calls[0].p_correlation_id);
});

test('confirmed receipt must be exact pathway and correlation, and clears pending retry', async () => {
  const s=storage();
  const first=browserHarness(s); await first.submit();
  const id=first.calls[0].p_correlation_id;
  const receipt='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const done=browserHarness(s, async input => ({ok:true,json:async()=>({
    receipt_id:receipt,correlation_id:input.p_correlation_id,pathway:input.p_pathway,status:'new'
  })}));
  await done.submit();
  assert.equal(done.calls[0].p_correlation_id,id);
  assert.equal(done.status.dataset.state,'success');
  assert.equal(done.resetCount(),1);
  assert.equal(s.count(),0);
});

test('a mismatched server pathway does not masquerade as confirmed capture', async () => {
  const s=storage();
  const result=browserHarness(s, async input => ({ok:true,json:async()=>({
    receipt_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    correlation_id:input.p_correlation_id,pathway:'csia',status:'new'
  })}));
  await result.submit();
  assert.equal(result.status.dataset.state,'error');
  assert.equal(s.count(),1);
  assert.equal(result.resetCount(),0);
});

test('storage restrictions fail soft, and same-page retry still reuses the key', async () => {
  const denied={getItem(){throw Error('Denied');},setItem(){throw Error('Denied');},removeItem(){throw Error('Denied');}};
  const page=browserHarness(denied);
  await page.submit(); await page.submit();
  assert.equal(page.calls.length,2);
  assert.equal(page.calls[0].p_correlation_id,page.calls[1].p_correlation_id);
  assert.equal(page.status.dataset.state,'error');
});

test('two near-simultaneous submits cannot mint two IDs during digest resolution', async () => {
  const page=browserHarness(storage());
  const first=page.submit();
  const second=page.submit();
  await Promise.all([first,second]);
  assert.equal(page.calls.length,1);
  assert.equal(page.submitButton.disabled,false);
});

test('email fallback retains a reply address when the receiver differs from the sender', async () => {
  const page=browserHarness(storage()); await page.submit();
  assert.match(decodeURIComponent(page.fallback.href),/Email: test@example\.invalid/);
});


test('A unknown, B unknown, reload, exact A retry preserves original reference', async () => {
  const s = storage();
  const first = browserHarness(s); await first.submit();
  const a = first.calls[0];
  first.state.requirement = 'A second unconfirmed business question.';
  await first.submit();
  const b = first.calls[1];
  assert.notEqual(a.p_correlation_id,b.p_correlation_id);
  const saved = JSON.parse(s.getItem('csa.enquiry.pending.v1'));
  assert.equal(saved.entries.length,2);
  const restored = browserHarness(s); await restored.submit();
  const retryA = restored.calls[0];
  const sansId = row => { const copy={...row}; delete copy.p_correlation_id; return copy; };
  assert.deepEqual(sansId(a),sansId(retryA));
  assert.equal(retryA.p_correlation_id,a.p_correlation_id);
});

test('confirming A retains unconfirmed B and its distinct recovery identity', async () => {
  const s = storage();
  const first=browserHarness(s); await first.submit(); 
  first.state.requirement='Unconfirmed second enquiry B'; await first.submit();
  const b=first.calls[1];
  const confirmed=browserHarness(s,async input=>({ok:true,json:async()=>({
    receipt_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    correlation_id:input.p_correlation_id,pathway:input.p_pathway
  })}));
  await confirmed.submit();
  assert.equal(confirmed.status.dataset.state,'success');
  const remaining=JSON.parse(s.getItem('csa.enquiry.pending.v1'));
  assert.equal(remaining.entries.length,1);
  assert.equal(remaining.entries[0].correlationId,b.p_correlation_id);
  const returning=browserHarness(s);
  returning.state.requirement='Unconfirmed second enquiry B';
  await returning.submit();
  assert.equal(returning.calls[0].p_correlation_id,b.p_correlation_id);
});

test('aged uncertain submissions fail closed without creating a new correlation', async () => {
  const s = storage();
  const first=browserHarness(s); await first.submit();
  const entry=JSON.parse(s.getItem('csa.enquiry.pending.v1'));
  entry.entries[0].createdAt = Date.now()-25*60*60*1000;
  s.setItem('csa.enquiry.pending.v1',JSON.stringify(entry));
  const returning=browserHarness(s); await returning.submit();
  assert.equal(returning.calls.length,0);
  assert.equal(returning.status.dataset.state,'error');
  assert.match(returning.status.textContent,/24-hour automatic recovery window/);
  assert.equal(JSON.parse(s.getItem('csa.enquiry.pending.v1')).entries.length,1);
});

test('capacity never evicts an unconfirmed record to dispatch a ninth request', async () => {
  const s=storage(); const page=browserHarness(s);
  for (let i=0;i<8;i++) {
    page.state.requirement='Unconfirmed opportunity '+i;
    await page.submit();
  }
  assert.equal(page.calls.length,8);
  const firstId=page.calls[0].p_correlation_id;
  page.state.requirement='Ninth request would displace UNKNOWN evidence';
  await page.submit();
  assert.equal(page.calls.length,8);
  assert.match(page.status.textContent,/Eight enquiries/);
  assert.equal(JSON.parse(s.getItem('csa.enquiry.pending.v1')).entries[0].correlationId,firstId);
});

test('corrupt stored recovery state blocks new dispatch rather than losing uncertainty', async () => {
  const s=storage(); s.setItem('csa.enquiry.pending.v1','{broken');
  const page=browserHarness(s); await page.submit();
  assert.equal(page.calls.length,0);
  assert.equal(page.status.dataset.state,'error');
  assert.match(page.status.textContent,/cannot be verified/);
});

test('legacy single pending record upgrades without discarding its reference', async () => {
  const s=storage(); const first=browserHarness(s); await first.submit();
  const record=JSON.parse(s.getItem('csa.enquiry.pending.v1')).entries[0];
  s.setItem('csa.enquiry.pending.v1',JSON.stringify({version:1,...record}));
  const restored=browserHarness(s); await restored.submit();
  assert.equal(restored.calls[0].p_correlation_id,record.correlationId);
  restored.state.requirement='New enquiry alongside legacy one';
  await restored.submit();
  const upgraded=JSON.parse(s.getItem('csa.enquiry.pending.v1'));
  assert.equal(upgraded.version,2);
  assert.equal(upgraded.entries.length,2);
  assert.equal(upgraded.entries[0].correlationId,record.correlationId);
});
