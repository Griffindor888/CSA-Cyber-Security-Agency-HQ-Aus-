import { createRemoteJWKSet, jwtVerify } from 'npm:jose@6.2.12';

const AGENT_ID="agent:csa.master-mind";
const AGENT_NAME="Master Mind";
const PRODUCT="csa";
const PROJECT_REF="vphbnwzjcfxgmtyggwxl";
const AUDIENCE='wardale-product-lead-proof';
const ISSUER='https://token.actions.githubusercontent.com';
const REPOSITORY='Griffindor888/WARDALE-os';
const REPOSITORY_ID='1292250480';
const OWNER_ID='68334959';
const WORKFLOW='Griffindor888/WARDALE-os/.github/workflows/product-lead-proof.yml@refs/heads/main';
const JWKS=createRemoteJWKSet(new URL('https://token.actions.githubusercontent.com/.well-known/jwks'),{timeoutDuration:5000});
const BASE=Deno.env.get('SUPABASE_URL');
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if(BASE!==`https://${PROJECT_REF}.supabase.co`||!SERVICE)throw new Error('AGENT_RUNTIME_CONFIGURATION_REQUIRED');
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
async function authenticate(req:Request){
 const h=req.headers.get('authorization')??'';
 if(!h.startsWith('Bearer ')||h.length>16000)return null;
 try{
  const {payload}=await jwtVerify(h.slice(7),JWKS,{issuer:ISSUER,audience:AUDIENCE,algorithms:['RS256'],requiredClaims:['exp','iat','jti','repository','repository_id','repository_owner_id','ref','workflow_ref','workflow_sha','run_id','event_name'],maxTokenAge:'10m'});
  if(payload.repository!==REPOSITORY||payload.repository_id!==REPOSITORY_ID||payload.repository_owner_id!==OWNER_ID||
     payload.ref!=='refs/heads/main'||payload.workflow_ref!==WORKFLOW||!['push','workflow_dispatch'].includes(String(payload.event_name))||
     typeof payload.workflow_sha!=='string'||!/^[0-9a-f]{40}$/.test(payload.workflow_sha)||typeof payload.run_id!=='string'||!/^[0-9]{1,30}$/.test(payload.run_id))return null;
  return {revision:payload.workflow_sha,runId:payload.run_id,jti:String(payload.jti)};
 }catch{return null;}
}
async function count(table:string,profile?:string){
 const headers:Record<string,string>={apikey:SERVICE!,authorization:`Bearer ${SERVICE}`,prefer:'count=exact',range:'0-0'};
 if(profile)headers['accept-profile']=profile;
 const r=await fetch(`${BASE}/rest/v1/${table}?select=*`,{method:'HEAD',headers,redirect:'error',signal:AbortSignal.timeout(5000)});
 if(!r.ok)throw new Error('SOURCE_UNAVAILABLE');
 const cr=r.headers.get('content-range')??'';const m=cr.match(/\/(\d+)$/);if(!m)throw new Error('COUNT_UNAVAILABLE');return Number(m[1]);
}
async function persist(auth:{revision:string,runId:string},evidence:Record<string,unknown>){
 const body={agent_id:AGENT_ID,agent_name:AGENT_NAME,product:PRODUCT,operation:'founder.status.report',source_repository:REPOSITORY,source_revision:auth.revision,workflow_run_id:auth.runId,evidence};
 const post=await fetch(`${BASE}/rest/v1/wardale_agent_operating_reports?on_conflict=agent_id,workflow_run_id`,{method:'POST',headers:{apikey:SERVICE!,authorization:`Bearer ${SERVICE}`,'content-type':'application/json',prefer:'resolution=ignore-duplicates'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(5000)});
 if(!post.ok)throw new Error('REPORT_PERSIST_FAILED');
 const q=new URL(`${BASE}/rest/v1/wardale_agent_operating_reports`);q.searchParams.set('agent_id',`eq.${AGENT_ID}`);q.searchParams.set('workflow_run_id',`eq.${auth.runId}`);q.searchParams.set('select','event_id,agent_id,agent_name,product,operation,source_revision,workflow_run_id,evidence,occurred_at');
 const get=await fetch(q,{headers:{apikey:SERVICE!,authorization:`Bearer ${SERVICE}`},redirect:'error',signal:AbortSignal.timeout(5000)});
 if(!get.ok)throw new Error('REPORT_READBACK_FAILED');const rows=await get.json();if(!Array.isArray(rows)||rows.length!==1)throw new Error('REPORT_READBACK_INVALID');return rows[0];
}
Deno.serve(async(req:Request)=>{
 if(req.method==='GET')return json({status:'ready',agentId:AGENT_ID,agentName:AGENT_NAME,product:PRODUCT,operation:'founder.status.report',executionAuthority:false});
 if(req.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
 const auth=await authenticate(req);if(!auth)return json({error:'UNAUTHORISED'},401);
 try{
  const checks=await Promise.all([count("csa_commercial_enquiries",undefined),count("csa_commercial_enquiry_events",undefined),count("wardale_market_events",undefined)]);
  const evidence={projectRef:PROJECT_REF,checks:{"commercialEnquiries":checks[0],"commercialEnquiryEvents":checks[1],"marketEvents":checks[2]},authority:'report-only',externalActions:false};
  const report=await persist(auth,evidence);
  return json({status:'completed',report});
 }catch{return json({error:'AGENT_REPORT_UNAVAILABLE'},503);}
});