import { supabase } from '../supabase'

export type Setor = {
  id: string
  nome: string
  responsavel?: string
  ramal?: string
  localizacao?: string
  created_at?: string
}

export async function listSetores(): Promise<Setor[]> {
  const { data, error } = await supabase
    .from('setores')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Setor[]
}

export async function createSetor(input: Omit<Setor, 'id' | 'created_at'>): Promise<Setor> {
  const { data, error } = await supabase
    .from('setores')
    .insert({ ...input, nome: (input.nome || '').toUpperCase() })
    .select('*')
    .single()
  if (error) throw error
  return data as Setor
}

export async function updateSetor(id: string, input: Partial<Omit<Setor, 'id' | 'created_at'>>): Promise<Setor> {
  const { data, error } = await supabase
    .from('setores')
    .update({ ...input, ...(input.nome ? { nome: input.nome.toUpperCase() } : {}) })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Setor
}

export async function deleteSetor(id: string): Promise<void> {
  const { error } = await supabase
    .from('setores')
    .delete()
    .eq('id', id)
  if (error) throw error
}
