import { createClient } from 'npm:@supabase/supabase-js@2'
const OFFICIAL_ORIGIN='https://helpdeskapp-six.vercel.app'
const ALLOWED_ORIGINS=new Set(['http://localhost:8082',OFFICIAL_ORIGIN])
const TOKEN=/^[A-Za-z0-9_-]{43}$/
const sha256=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('')
const json=(status:number,body:unknown,origin:string|null)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow',...(origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})}})
Deno.serve(async req=>{
 const origin=req.headers.get('origin'),allowed=origin&&ALLOWED_ORIGINS.has(origin)?origin:null;if(origin&&!allowed)return json(403,{error:'Equipamento não encontrado.'},null)
 if(req.method==='OPTIONS')return allowed?new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-retry-count','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}}):json(403,{error:'Equipamento não encontrado.'},null)
 if(req.method!=='POST')return json(405,{error:'Método não permitido.'},allowed)
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),salt=Deno.env.get('AUTH_RATE_LIMIT_SALT'),enabled=Deno.env.get('ENABLE_PUBLIC_EQUIPMENT_QR'),publicAppUrl=Deno.env.get('PUBLIC_APP_URL');if(!url||!key||!salt||enabled!=='true'||publicAppUrl!==OFFICIAL_ORIGIN)return json(503,{error:'Serviço temporariamente indisponível.'},allowed)
 let token:string;try{token=String((await req.json()).token??'')}catch{return json(404,{error:'Equipamento não encontrado.'},allowed)}if(!TOKEN.test(token))return json(404,{error:'Equipamento não encontrado.'},allowed)
 const admin=createClient(url,key,{auth:{persistSession:false}}),ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown',h=await sha256(`${salt}:public:${ip}`)
 const rl=await admin.rpc('consume_equipment_qr_rate_limit',{p_key_hash:h,p_max_attempts:30,p_window_seconds:60,p_block_seconds:60});if(rl.error)return json(503,{error:'Serviço temporariamente indisponível.'},allowed);if(!rl.data?.[0]?.allowed)return json(429,{error:'Muitas consultas.'},allowed)
 const {data:label}=await admin.from('equipment_qr_labels').select('status,equipment_id').eq('token_hash',await sha256(token)).maybeSingle();if(!label||['REVOKED','VOID'].includes(label.status))return json(404,{error:'Equipamento não encontrado.'},allowed)
 if(label.status==='UNUSED')return json(200,{code:'ok',state:'UNBOUND',equipment:null},allowed)
 if(label.status!=='BOUND'||!label.equipment_id)return json(404,{error:'Equipamento não encontrado.'},allowed)
 const {data:eq}=await admin.from('equipamentos').select('nome,patrimonio,tipo,marca,modelo,status,setor,ram,armazenamento,processador').eq('id',label.equipment_id).maybeSingle();if(!eq)return json(404,{error:'Equipamento não encontrado.'},allowed)
 let images:{url:string;principal:boolean}[]=[]
 try{
  const {data:rows,error:imagesError}=await admin.from('equipamento_imagens').select('storage_path,principal,created_at').eq('equipamento_id',label.equipment_id).order('principal',{ascending:false}).order('created_at',{ascending:true})
  if(!imagesError&&rows?.length){
   const unique=Array.from(new Map(rows.map(row=>[row.storage_path,row])).values())
   const {data:signed,error:signedError}=await admin.storage.from('equipamento-imagens').createSignedUrls(unique.map(row=>row.storage_path),300)
   if(!signedError){
    const urls=new Map((signed??[]).filter(item=>item.signedUrl).map(item=>[item.path,item.signedUrl]))
    images=unique.flatMap(row=>{const signedUrl=urls.get(row.storage_path);return signedUrl?[{url:signedUrl,principal:Boolean(row.principal)}]:[]})
   }
  }
 }catch{/* Imagens nunca impedem a resposta dos dados do equipamento. */}
 return json(200,{code:'ok',state:'BOUND',equipment:{name:eq.nome,assetCode:eq.patrimonio,type:eq.tipo,brand:eq.marca??null,model:eq.modelo??null,status:eq.status,sector:eq.setor??null,ram:eq.ram??null,storage:eq.armazenamento??null,cpu:eq.processador??null,images}},allowed)
})
