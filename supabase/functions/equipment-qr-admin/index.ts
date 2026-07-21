import { createClient } from 'npm:@supabase/supabase-js@2'

const ORIGIN = 'http://localhost:8082'
const CODE = /^[A-Z0-9]+(?:-[A-Z0-9]+)?$/
const TOKEN = /^[A-Za-z0-9_-]{43}$/
const json = (status: number, body: unknown, origin: string | null) => new Response(JSON.stringify(body), { status, headers: {
  'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
  ...(origin ? {'Access-Control-Allow-Origin':origin,'Vary':'Origin'} : {}),
} })
const sha256 = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('')
const token = () => { const b=new Uint8Array(32); crypto.getRandomValues(b); return btoa(String.fromCharCode(...b)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','') }

Deno.serve(async req => {
  const origin=req.headers.get('origin'); const allowed=origin===ORIGIN?origin:null
  if(origin&&!allowed)return json(403,{error:'Acesso não autorizado.'},null)
  if(req.method==='OPTIONS')return allowed?new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-retry-count','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}}):json(403,{error:'Acesso não autorizado.'},null)
  if(req.method!=='POST')return json(405,{error:'Método não permitido.'},allowed)
  const url=Deno.env.get('SUPABASE_URL'), key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), salt=Deno.env.get('AUTH_RATE_LIMIT_SALT'), base=Deno.env.get('PUBLIC_APP_URL')
  if(!url||!key||!salt||base!==ORIGIN)return json(503,{error:'Serviço temporariamente indisponível.'},allowed)
  const admin=createClient(url,key,{auth:{persistSession:false}})
  const bearer=req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1]
  if(!bearer)return json(401,{error:'Acesso não autorizado.'},allowed)
  const {data:auth,error:authError}=await admin.auth.getUser(bearer)
  if(authError||!auth.user)return json(401,{error:'Acesso não autorizado.'},allowed)
  const {data:actor}=await admin.from('app_users').select('id,tier').eq('auth_user_id',auth.user.id).maybeSingle()
  if(!actor||actor.tier!=='admin')return json(403,{error:'Acesso não autorizado.'},allowed)
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown'
  const keyHash=await sha256(`${salt}:admin:${actor.id}:${ip}`); const rl=await admin.rpc('consume_equipment_qr_rate_limit',{p_key_hash:keyHash,p_max_attempts:120,p_window_seconds:60,p_block_seconds:60})
  if(rl.error)return json(503,{error:'Serviço temporariamente indisponível.'},allowed)
  if(!rl.data?.[0]?.allowed)return json(429,{error:'Muitas solicitações.'},allowed)
  let body:Record<string,unknown>; try{body=await req.json()}catch{return json(400,{error:'Dados inválidos.'},allowed)}
  const action=body.action
  try {
    if(action==='generate-batch'){
      const quantity=Number(body.quantity),start=Number(body.startNumber),digits=Number(body.digits),columns=Number(body.columns),labelSize=String(body.labelSize??''),prefix=String(body.prefix??'').trim().toUpperCase(),last=start+quantity-1
      if(!Number.isInteger(quantity)||quantity<1||quantity>500||!Number.isSafeInteger(start)||start<1||!Number.isSafeInteger(last)||!Number.isInteger(digits)||digits<1||digits>8||String(last).length>digits||!Number.isInteger(columns)||columns<1||columns>5||!['50x30','60x40','80x50'].includes(labelSize)||prefix.length>12||(prefix&&!/^[A-Z0-9]+$/.test(prefix)))return json(400,{error:'Dados inválidos.'},allowed)
      const prepared=[] as {display_code:string;token_hash:string;raw:string}[]
      for(let i=0;i<quantity;i++){
        const displayCode=prefix?`${prefix}-${String(start+i).padStart(digits,'0')}`:String(start+i).padStart(digits,'0'); if(!CODE.test(displayCode))throw new Error()
        const raw=token(), tokenHash=await sha256(raw)
        prepared.push({display_code:displayCode,token_hash:tokenHash,raw})
      }
      const {data,error}=await admin.rpc('create_equipment_qr_batch',{p_items:prepared.map(({display_code,token_hash})=>({display_code,token_hash})),p_actor_user_id:actor.id});if(error){if(error.code==='23505')return json(409,{error:'Já existem etiquetas dentro da numeração informada. Ajuste o número inicial ou o prefixo.'},allowed);throw error}
      const labels=data.map((row:Record<string,unknown>,i:number)=>({id:row.id,displayCode:row.display_code,status:row.status,equipmentId:row.equipment_id,createdAt:row.created_at,updatedAt:row.updated_at,boundAt:row.bound_at,revokedAt:row.revoked_at,publicUrl:`${base}/consulta/equipamento/${prepared[i].raw}`}))
      return json(200,{labels},allowed)
    }
    if(action==='lookup'){
      const raw=String(body.token??''); if(!TOKEN.test(raw))return json(404,{error:'Etiqueta não encontrada.'},allowed)
      const {data}=await admin.from('equipment_qr_labels').select('id,display_code,status,equipment_id').eq('token_hash',await sha256(raw)).maybeSingle()
      return data?json(200,{id:data.id,displayCode:data.display_code,status:data.status,equipmentId:data.equipment_id},allowed):json(404,{error:'Etiqueta não encontrada.'},allowed)
    }
    if(action==='bind-existing'){
      const labelId=String(body.labelId??''), equipmentId=String(body.equipmentId??''); const decision=String(body.patrimonyDecision??'KEEP')
      const [{data:label},{data:eq}]=await Promise.all([admin.from('equipment_qr_labels').select('id,status').eq('id',labelId).maybeSingle(),admin.from('equipamentos').select('id').eq('id',equipmentId).maybeSingle()])
      if(!label||label.status!=='UNUSED'||!eq)return json(409,{error:'Não foi possível concluir a operação.'},allowed)
      const bound=await admin.rpc('bind_equipment_qr_label',{p_label_id:labelId,p_equipment_id:equipmentId,p_decision:decision,p_actor_user_id:actor.id});if(bound.error)throw bound.error
      return json(200,{ok:true},allowed)
    }
    if(action==='equipment-label'){
      const equipmentId=String(body.equipmentId??'')
      const {data,error}=await admin.from('equipment_qr_labels').select('id,display_code,status,equipment_id,created_at,updated_at,bound_at,revoked_at').eq('equipment_id',equipmentId).eq('status','BOUND').maybeSingle()
      if(error)throw error
      return data?json(200,{id:data.id,displayCode:data.display_code,status:data.status,equipmentId:data.equipment_id,createdAt:data.created_at,updatedAt:data.updated_at,boundAt:data.bound_at,revokedAt:data.revoked_at},allowed):json(404,{error:'Etiqueta não encontrada.'},allowed)
    }
    if(action==='issue-equipment-label'){
      const equipmentId=String(body.equipmentId??'')
      const {data:eq}=await admin.from('equipamentos').select('id,patrimonio').eq('id',equipmentId).maybeSingle()
      if(!eq)return json(404,{error:'Equipamento não encontrado.'},allowed)
      const displayCode=String(eq.patrimonio??'').trim().toUpperCase()
      if(!CODE.test(displayCode)||displayCode.length>24)return json(400,{error:'Patrimônio incompatível com etiqueta QR.'},allowed)
      const raw=token(),hash=await sha256(raw)
      const issued=await admin.rpc('issue_equipment_qr_label',{p_equipment_id:equipmentId,p_display_code:displayCode,p_token_hash:hash,p_actor_user_id:actor.id,p_replace:false})
      if(issued.error)return json(409,{error:'O equipamento já possui etiqueta ativa.'},allowed)
      const row=issued.data?.[0];return json(200,{id:row.id,displayCode:row.display_code,status:row.status,equipmentId:row.equipment_id,createdAt:row.created_at,updatedAt:row.updated_at,boundAt:row.bound_at,revokedAt:row.revoked_at,publicUrl:`${base}/consulta/equipamento/${raw}`},allowed)
    }
    if(action==='bind-new'){
      const labelId=String(body.labelId??''),equipment=body.equipment
      if(!equipment||typeof equipment!=='object'||Array.isArray(equipment))return json(400,{error:'Dados inválidos.'},allowed)
      const value=equipment as Record<string,unknown>,required=['nome','tipo','patrimonio','status']
      if(required.some(k=>typeof value[k]!=='string'||!String(value[k]).trim()))return json(400,{error:'Dados inválidos.'},allowed)
      const result=await admin.rpc('create_equipment_and_bind_qr',{p_label_id:labelId,p_equipment:value,p_actor_user_id:actor.id});if(result.error)throw result.error
      return json(200,{equipmentId:result.data},allowed)
    }
    if(action==='revoke'){
      const result=await admin.rpc('revoke_equipment_qr_label',{p_label_id:String(body.labelId??''),p_actor_user_id:actor.id});if(result.error)throw result.error
      return json(200,{ok:true},allowed)
    }
    if(action==='reissue'){
      const labelId=String(body.labelId??''),raw=token(),hash=await sha256(raw)
      const result=await admin.rpc('rotate_equipment_qr_token',{p_label_id:labelId,p_token_hash:hash,p_actor_user_id:actor.id});if(result.error)throw result.error
      return json(200,{ok:true,publicUrl:`${base}/consulta/equipamento/${raw}`},allowed)
    }
    return json(404,{error:'Operação não encontrada.'},allowed)
  } catch { return json(500,{error:'Não foi possível concluir a operação.'},allowed) }
})
