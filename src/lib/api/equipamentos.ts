import { supabase } from '../supabase'

export type Equipamento = {
  id: string
  nome: string
  tipo: string
  patrimonio: string
  marca?: string
  modelo?: string
  status: 'Disponível' | 'Em Uso' | 'Manutenção' | 'Inativo'
  usuario?: string
  setor?: string
  ram?: string
  armazenamento?: string
  processador?: string
  polegadas?: string
  ghz?: string
  created_at?: string
}

export type EquipamentoImagem = {
  id: string
  equipamento_id: string
  storage_path: string
  nome_arquivo: string
  mime_type: 'image/jpeg' | 'image/png' | 'image/webp'
  tamanho: number
  principal: boolean
  url: string
  created_at?: string
}

const EQUIPMENT_IMAGES_BUCKET = 'equipamento-imagens'
export const EQUIPMENT_IMAGE_MAX_SIZE = 10 * 1024 * 1024
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const allowedExtensions = new Set(['jpg', 'jpeg', 'png', 'webp'])

async function validateEquipmentImage(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!allowedExtensions.has(extension) || !allowedImageTypes.has(file.type)) throw new Error(`${file.name}: formato inválido. Use JPG, PNG ou WebP.`)
  if (file.size > EQUIPMENT_IMAGE_MAX_SIZE) throw new Error(`${file.name}: o arquivo excede 10 MB.`)
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  if ((file.type === 'image/jpeg' && !jpeg) || (file.type === 'image/png' && !png) || (file.type === 'image/webp' && !webp)) {
    throw new Error(`${file.name}: o conteúdo do arquivo não corresponde a uma imagem válida.`)
  }
}

export async function listEquipamentoImagens(equipamentoId: string): Promise<EquipamentoImagem[]> {
  const { data, error } = await supabase.from('equipamento_imagens').select('*').eq('equipamento_id', equipamentoId).order('principal', { ascending: false }).order('created_at')
  if (error) throw error
  return (data ?? []).map((image) => ({ ...image, url: supabase.storage.from(EQUIPMENT_IMAGES_BUCKET).getPublicUrl(image.storage_path).data.publicUrl })) as EquipamentoImagem[]
}

export async function uploadEquipamentoImagem(equipamentoId: string, file: File, principal: boolean): Promise<void> {
  await validateEquipmentImage(file)
  const extension = file.name.split('.').pop()!.toLowerCase()
  const path = `${equipamentoId}/${crypto.randomUUID()}.${extension}`
  const { error: uploadError } = await supabase.storage.from(EQUIPMENT_IMAGES_BUCKET).upload(path, file, { contentType: file.type, upsert: false })
  if (uploadError) throw new Error(`${file.name}: ${uploadError.message}`)
  if (principal) await supabase.from('equipamento_imagens').update({ principal: false }).eq('equipamento_id', equipamentoId)
  const { error } = await supabase.from('equipamento_imagens').insert({ equipamento_id: equipamentoId, storage_path: path, nome_arquivo: file.name, mime_type: file.type, tamanho: file.size, principal })
  if (error) {
    await supabase.storage.from(EQUIPMENT_IMAGES_BUCKET).remove([path])
    throw new Error(`${file.name}: ${error.message}`)
  }
}

export async function setEquipamentoImagemPrincipal(equipamentoId: string, imageId: string): Promise<void> {
  const { error: clearError } = await supabase.from('equipamento_imagens').update({ principal: false }).eq('equipamento_id', equipamentoId)
  if (clearError) throw clearError
  const { error } = await supabase.from('equipamento_imagens').update({ principal: true }).eq('id', imageId).eq('equipamento_id', equipamentoId)
  if (error) throw error
}

export async function deleteEquipamentoImagem(image: EquipamentoImagem): Promise<void> {
  const { error } = await supabase.from('equipamento_imagens').delete().eq('id', image.id).eq('equipamento_id', image.equipamento_id)
  if (error) throw error
  if (image.principal) {
    const remaining = await listEquipamentoImagens(image.equipamento_id)
    if (remaining[0]) await setEquipamentoImagemPrincipal(image.equipamento_id, remaining[0].id)
  }
  const { error: storageError } = await supabase.storage.from(EQUIPMENT_IMAGES_BUCKET).remove([image.storage_path])
  if (storageError) throw storageError
}

export async function listEquipamentos(): Promise<Equipamento[]> {
  const { data, error } = await supabase
    .from('equipamentos')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Equipamento[]
}

export async function createEquipamento(input: Omit<Equipamento, 'id' | 'created_at'>): Promise<Equipamento> {
  const { data, error } = await supabase
    .from('equipamentos')
    .insert(input)
    .select('*')
    .single()
  if (error) throw error
  return data as Equipamento
}

export async function updateEquipamento(id: string, input: Partial<Omit<Equipamento, 'id' | 'created_at'>>): Promise<Equipamento> {
  const { data, error } = await supabase
    .from('equipamentos')
    .update(input)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Equipamento
}

export async function deleteEquipamento(id: string): Promise<void> {
  const { error } = await supabase
    .from('equipamentos')
    .delete()
    .eq('id', id)
  if (error) throw error
}
