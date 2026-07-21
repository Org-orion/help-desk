import { applyPrivateJsonHeaders,type ApiRequest,type ApiResponse } from '../_lib/equipment-qr-security.js'
const allowed=new Set(['generate-batch','lookup','equipment-label','issue-equipment-label','bind-new','bind-existing','revoke','reissue'])
export default async function handler(request:ApiRequest,response:ApiResponse){
 applyPrivateJsonHeaders(response);const raw=request.query?.action,action=Array.isArray(raw)?raw[0]:raw
 if(!action||!allowed.has(action))return response.status(404).json({error:'Operação não encontrada.'})
 const url=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY,authorization=Array.isArray(request.headers?.authorization)?request.headers?.authorization[0]:request.headers?.authorization
 if(!url||!anon)return response.status(500).json({error:'Configuração segura indisponível.'})
 const input=request.method==='GET'?{...request.query,action}:({...((request.body&&typeof request.body==='object')?request.body:{}),action})
 const upstream=await fetch(`${url}/functions/v1/equipment-qr-admin`,{method:'POST',headers:{apikey:anon,'Content-Type':'application/json',...(authorization?{Authorization:authorization}:{})},body:JSON.stringify(input)})
 const body=await upstream.json().catch(()=>({error:'Não foi possível concluir a operação.'})) as Record<string,unknown>;return response.status(upstream.status).json(body)
}
