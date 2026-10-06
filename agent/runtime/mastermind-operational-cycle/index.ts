import { createRemoteJWKSet, jwtVerify } from 'npm:jose@6.2.12';
const BASE=Deno.env.get('SUPABASE_URL'),SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const ISS='https://token.actions.githubusercontent.com',AUD='wardale-governed-operational-cycle';
const JWKS=createRemoteJWKSet(new URL(ISS+'/.well-known/jwks'),{timeoutDuration:5000});
const VISS='https://oidc.vercel.com/wardale-os',VAUD='https://vercel.com/wardale-os',VSUB='owner:wardale-os:project:wardale-app:environment:production';
const VJWKS=createRemoteJWKSet(new URL(VISS+'/.well-known/jwks'),{timeoutDuration:5000});
const REPO='Griffindor888/WARDALE-os',RID='1292250480',OID='68334959';
const WF='Griffindor888/WARDALE-os/.github/workflows/governed-operational-cycle.yml@refs/heads/main';
if(BASE!=='https://vphbnwzjcfxgmtyggwxl.supabase.co'||!SERVICE)throw new Error('CONTROL_CONFIGURATION_REQUIRED');
const j=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
const bearer=(r:Request)=>{const h=r.headers.get('authorization')??'';return h.startsWith('Bearer ')&&h.length<16000?h.slice(7):''};
async function vercel(req:Request){const t=bearer(req);if(!t)return false;try{const {payload}=await jwtVerify(t,VJWKS,{issuer:VISS,audience:VAUD,subject:VSUB,algorithms:['RS256'],requiredClaims:['exp','iat','sub','owner_id','project_id','environment'],maxTokenAge:'65m'});return payload.owner_id==='team_T3DA05xenMUbMVaiIwa6yj9g'&&payload.project_id==='prj_P96V6jrUqXx5ZtexX8s2ArOwcS9f'&&payload.environment==='production';}catch{return false;}}
async function auth(req:Request){const t=bearer(req);if(!t)return null;try{const {payload}=await jwtVerify(t,JWKS,{issuer:ISS,audience:AUD,algorithms:['RS256'],requiredClaims:['exp','iat','jti','repository','repository_id','repository_owner_id','ref','workflow_ref','workflow_sha','run_id','event_name'],maxTokenAge:'10m'});if(payload.repository!==REPO||payload.repository_id!==RID||payload.repository_owner_id!==OID||payload.ref!=='refs/heads/main'||payload.workflow_ref!==WF||!['push','workflow_dispatch'].includes(String(payload.event_name))||typeof payload.workflow_sha!=='string'||!/^[0-9a-f]{40}$/.test(payload.workflow_sha)||typeof payload.run_id!=='string'||!/^[0-9]{1,30}$/.test(payload.run_id))return null;return{token:t,revision:payload.workflow_sha,runId:payload.run_id};}catch{return null;}}
const headers=()=>({apikey:SERVICE!,authorization:`Bearer ${SERVICE}`,'content-type':'application/json'});
async function digest(s:string){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function rpc(name:string,body:unknown){const r=await fetch(`${BASE}/rest/v1/rpc/${name}`,{method:'POST',headers:headers(),body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(5000)});if(!r.ok)throw new Error('RPC_FAILED');return await r.json();}
async function create(a:{revision:string,runId:string},body:any){
 const target=String(body?.targetAgentId??''),instruction=String(body?.founderInstruction??''),purpose=String(body?.purpose??'');
 if(!['agent:solurius.atlas','agent:autto.freddo'].includes(target)||instruction.trim().length<10||instruction.length>2000||purpose.trim().length<5||purpose.length>500)return j({error:'PACKAGE_INVALID'},400);
 const nonce=crypto.randomUUID(),operation='product.snapshot.assess',expiresAt=new Date(Date.now()+8*60*1000).toISOString();
 const d=await digest([a.runId,a.revision,target,operation,instruction,purpose,nonce].join('|'));
 const row={workflow_run_id:a.runId,source_revision:a.revision,target_agent_id:target,operation,founder_instruction:instruction,purpose,delegation_nonce:nonce,delegation_digest:d,expires_at:expiresAt};
 const p=await fetch(`${BASE}/rest/v1/wardale_operational_cycles?select=*`,{method:'POST',headers:{...headers(),prefer:'return=representation'},body:JSON.stringify(row),redirect:'error',signal:AbortSignal.timeout(5000)});
 if(!p.ok)return j({error:'PACKAGE_CREATE_FAILED'},503);const rows=await p.json();const c=rows?.[0];if(!c)return j({error:'PACKAGE_CREATE_FAILED'},503);
 await fetch(`${BASE}/rest/v1/wardale_operational_cycle_events`,{method:'POST',headers:headers(),body:JSON.stringify({cycle_id:c.cycle_id,event_type:'delegated',actor_agent_id:'agent:csa.master-mind',workflow_run_id:a.runId,evidence:{delegationDigest:d,targetAgentId:target,operation}}),redirect:'error',signal:AbortSignal.timeout(5000)});
 return j({status:'delegated',cycle:c});
}
Deno.serve(async(req:Request)=>{
 if(req.method==='GET'){
  if(!req.headers.has('authorization'))return j({status:'ready',agentId:'agent:csa.master-mind',operation:'governed.operational.delegate',executionAuthority:false});
  if(!await vercel(req))return j({error:'UNAUTHORISED'},401);
  try{
    const q=new URL(BASE+'/rest/v1/wardale_operational_cycles');q.searchParams.set('select','cycle_id,workflow_run_id,source_revision,target_agent_id,operation,purpose,state,created_at,completed_at,revoked_at');q.searchParams.set('order','created_at.desc');q.searchParams.set('limit','12');
    const r=await fetch(q,{headers:{apikey:SERVICE!,authorization:'Bearer '+SERVICE},redirect:'error',signal:AbortSignal.timeout(5000)});if(!r.ok)throw new Error('READ_FAILED');
    return j({status:'connected',cycles:await r.json()});
  }catch{return j({error:'CYCLE_FEED_UNAVAILABLE'},503);}
}
 if(req.method!=='POST')return j({error:'METHOD_NOT_ALLOWED'},405);
 const a=await auth(req);if(!a)return j({error:'UNAUTHORISED'},401);
 let body:any={};try{body=await req.json();}catch{return j({error:'JSON_REQUIRED'},400);}
 try{
  if(body.action==='create')return await create(a,body);
  if(body.action==='verify'){const x=await rpc('wardale_operational_cycle_verify',{p_cycle:body.cycleId,p_run:a.runId,p_target:body.targetAgentId});return j(x,x.ok?200:409);}
  if(body.action==='complete'){const x=await rpc('wardale_operational_cycle_complete',{p_cycle:body.cycleId,p_run:a.runId,p_target:body.targetAgentId,p_evidence:body.evidence??{}});return j(x,x.ok?200:409);}
  if(body.action==='revoke'){const x=await rpc('wardale_operational_cycle_revoke',{p_cycle:body.cycleId,p_run:a.runId});return j(x,x.ok?200:409);}
  return j({error:'ACTION_INVALID'},400);
 }catch{return j({error:'CONTROL_UNAVAILABLE'},503);}
});