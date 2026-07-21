import { supabase } from '../supabase'

export type Usuario = {
  id: string
  name: string
  username: string
  setor?: string
  cargo?: string
  tier: 'padrao' | 'vip' | 'admin'
  is_admin?: boolean
  password_hash?: string
  created_at?: string
}

export async function listUsuarios(): Promise<Usuario[]> {
  const { data, error } = await supabase
    .from('app_users')
    .select('id,name,username,setor,cargo,tier,is_admin,created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Usuario[]
}

export async function createUsuario(input: { nome: string; username: string; setor?: string; cargo?: string; password: string; tipo: 'padrao' | 'vip' | 'admin' }): Promise<Usuario> {
  const payload = { name: (input.nome || '').toUpperCase(), username: input.username, setor: (input.setor || '').toUpperCase(), cargo: input.cargo, tier: input.tipo, password_hash: input.password }
  const { data, error } = await supabase
    .from('app_users')
    .insert(payload)
    .select('id,name,username,setor,cargo,tier,is_admin,created_at')
    .single()
  if (error) throw error
  return data as Usuario
}

export async function updateUsuario(id: string, input: Partial<{ nome: string; username: string; setor?: string; cargo?: string; password?: string; tipo?: 'padrao' | 'vip' | 'admin' }>): Promise<Usuario> {
  const payload: Partial<Usuario> = {}
  if (input.nome !== undefined) payload.name = (input.nome || '').toUpperCase()
  if (input.username !== undefined) payload.username = input.username
  if (input.setor !== undefined) payload.setor = (input.setor || '').toUpperCase()
  if (input.cargo !== undefined) payload.cargo = input.cargo
  if (input.password) payload.password_hash = input.password
  if (input.tipo !== undefined) payload.tier = input.tipo

  const { data: oldUser } = await supabase
    .from('app_users')
    .select('name, username')
    .eq('id', id)
    .single()

  const { data, error } = await supabase
    .from('app_users')
    .update(payload)
    .eq('id', id)
    .select('id,name,username,setor,cargo,tier,is_admin,created_at')
    .single()
  if (error) throw error
  
  // Sync references if name changed
  if (oldUser) {
    const newName = payload.name
    const newUsername = payload.username
    if (newName && newName !== oldUser.name) {
       // Update critical tables
       await supabase.from('equipamentos').update({ usuario: newName }).eq('usuario', oldUser.name)
       await supabase.from('chamados').update({ solicitante: newName }).eq('solicitante', oldUser.name)
       await supabase.from('chamados').update({ usuario: newName }).eq('usuario', oldUser.name)
       
       // Update other potential references (best effort)
       await supabase.from('termos_responsabilidade').update({ usuario: newName }).eq('usuario', oldUser.name).then(({ error }) => { if(error) console.log('Termos update skipped') })
       await supabase.from('produto_saidas').update({ responsavel: newName }).eq('responsavel', oldUser.name)
       await supabase.from('setores').update({ responsavel: newName }).eq('responsavel', oldUser.name)
    }
    if (newUsername && newUsername !== oldUser.username) {
       await supabase.from('chamados').update({ solicitante: newUsername }).eq('solicitante', oldUser.username)
       await supabase.from('chamados').update({ usuario: newUsername }).eq('usuario', oldUser.username)
    }
  }

  return data as Usuario
}

export async function deleteUsuario(id: string): Promise<void> {
  const { error } = await supabase
    .from('app_users')
    .delete()
    .eq('id', id)
  if (error) throw error
}
