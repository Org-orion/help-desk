import type { ApiRequest,ApiResponse } from '../../_lib/equipment-qr-security.js'
export default async function handler(request:ApiRequest,response:ApiResponse){
 response.setHeader('Cache-Control','private, no-store');response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Referrer-Policy','no-referrer');response.setHeader('X-Robots-Tag','noindex, nofollow')
 if(request.method!=='GET')return response.status(405).json({error:'Método não permitido.'})
 const raw=request.query?.token,token=Array.isArray(raw)?raw[0]:raw,url=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY
 if(!url||!anon||typeof token!=='string')return response.status(404).json({error:'Equipamento não encontrado.'})
 const upstream=await fetch(`${url}/functions/v1/public-equipment`,{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({token})})
 const body=await upstream.json().catch(()=>({error:'Equipamento não encontrado.'})) as Record<string,unknown>;return response.status(upstream.status).json(body)
}
