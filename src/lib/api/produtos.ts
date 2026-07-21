import { supabase } from '../supabase'

export type Produto = {
  id: string
  nome: string
  categoria: string
  descricao?: string
  estoque: number
  created_at?: string
}

export type ProdutoSaida = {
  id: string
  produto_id: string
  quantidade: number
  destinatario?: string
  data?: string
  created_at?: string
}

export async function listProdutos(): Promise<Produto[]> {
  const { data: rows, error } = await supabase
    .from('produtos')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (rows ?? []) as Produto[]
}

export async function createProduto(input: Omit<Produto, 'id' | 'created_at'>): Promise<Produto> {
  const { data: row, error } = await supabase
    .from('produtos')
    .insert(input)
    .select('*')
    .single()
  if (error) throw error
  return row as Produto
}

export async function updateProduto(id: string, input: Partial<Omit<Produto, 'id' | 'created_at'>>): Promise<Produto> {
  const { data: row, error } = await supabase
    .from('produtos')
    .update(input)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return row as Produto
}

export async function deleteProduto(id: string): Promise<void> {
  const { error } = await supabase
    .from('produtos')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function registrarSaida(produto_id: string, quantidade: number, destinatario?: string, data?: string): Promise<ProdutoSaida> {
  const payload: { produto_id: string; quantidade: number; destinatario?: string; data?: string } = {
    produto_id,
    quantidade,
    destinatario,
    data,
  }
  const { data: row, error } = await supabase
    .from('produto_saidas')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw error
  return row as ProdutoSaida
}

export async function listSaidas(): Promise<ProdutoSaida[]> {
  const { data: rows, error } = await supabase
    .from('produto_saidas')
    .select('*')
    .order('data', { ascending: false })
  if (error) throw error
  return (rows ?? []) as ProdutoSaida[]
}

export async function updateSaida(id: string, input: Partial<Omit<ProdutoSaida, 'id' | 'created_at' | 'produto_id'>>): Promise<ProdutoSaida> {
  const { data, error } = await supabase
    .from('produto_saidas')
    .update(input)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as ProdutoSaida
}

export async function deleteSaida(id: string): Promise<void> {
  const { error } = await supabase
    .from('produto_saidas')
    .delete()
    .eq('id', id)
  if (error) throw error
}
