import { supabase } from './supabase'

export type PublicEquipmentQrPreparation = { available:true;url:string }|{ available:false;message:string }
export async function preparePublicEquipmentQr(equipmentId:string):Promise<PublicEquipmentQrPreparation>{
  const {data,error}=await supabase.functions.invoke('equipment-qr-admin',{body:{action:'issue-equipment-label',equipmentId}})
  if(error||typeof data?.publicUrl!=='string')return{available:false,message:data?.error??'Não foi possível emitir a etiqueta QR.'}
  return{available:true,url:data.publicUrl}
}
