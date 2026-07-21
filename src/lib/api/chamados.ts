import { supabase } from '../supabase'

export type Chamado = {
  id: string
  titulo: string
  descricao: string
  prioridade: 'baixa' | 'media' | 'alta'
  status: 'Aberto' | 'Em Andamento' | 'Concluído'
  usuario: string
  solicitante: string
  setor: string
  tipo_servico: string
  is_vip?: boolean
  data?: string
  started_at?: string
  completed_at?: string
  solution_duration_min?: number
  tempo_solucao_minutos?: number
  tempo_solucao_texto?: string
  created_at?: string
  avaliacao?: number
  comentario_avaliacao?: string
  data_avaliacao?: string
  avaliado?: boolean
}

export async function listChamados(): Promise<Chamado[]> {
  const { data, error } = await supabase
    .from('chamados')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createChamado(input: Omit<Chamado, 'id' | 'created_at' | 'prioridade' | 'status'> & { prioridade?: Chamado['prioridade']; status?: Chamado['status'] }): Promise<Chamado> {
  const { data, error } = await supabase
    .from('chamados')
    .insert({ ...input })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as Chamado
}

export async function updateChamado(id: string, input: Partial<Omit<Chamado, 'id' | 'created_at'>>): Promise<Chamado> {
  const nowIso = new Date().toISOString()
  const { data: current } = await supabase
    .from('chamados')
    .select('id,status,started_at,completed_at,created_at,data,tempo_solucao_minutos,tempo_solucao_texto,solution_duration_min')
    .eq('id', id)
    .single()
  let patch: Partial<Chamado> = { ...input }
  if (patch.status === 'Em Andamento') {
    const started = (current as Chamado | null)?.started_at
    patch = { ...patch, started_at: patch.started_at ?? started ?? nowIso }
  } else if (patch.status === 'Concluído') {
    const completed = (current as Chamado | null)?.completed_at
    const started = (current as Chamado | null)?.started_at
    const created = (current as Chamado | null)?.created_at || (current as Chamado | null)?.data
    patch = { ...patch, completed_at: patch.completed_at ?? completed ?? nowIso }
    patch = { ...patch, started_at: patch.started_at ?? started ?? created ?? nowIso }
    const hasFixed = (current as Chamado | null)?.tempo_solucao_minutos != null || (current as Chamado | null)?.tempo_solucao_texto != null || (current as Chamado | null)?.solution_duration_min != null
    if (!hasFixed && patch.tempo_solucao_minutos == null && patch.tempo_solucao_texto == null && patch.solution_duration_min == null) {
      const s = patch.started_at ? new Date(patch.started_at) : null
      const e = patch.completed_at ? new Date(patch.completed_at) : null
      if (s && e && !isNaN(s.getTime()) && !isNaN(e.getTime())) {
        const minutes = Math.max(0, Math.floor((e.getTime() - s.getTime()) / 60000))
        const h = Math.floor(minutes / 60)
        const m = minutes % 60
        let texto = ''
        if (minutes < 60) texto = `${m} min`
        else if (minutes < 1440) texto = `${h}h ${m}min`
        else {
          const d = Math.floor(h / 24)
          const rh = h % 24
          texto = `${d} dias ${rh}h ${m}min`
        }
        patch = { ...patch, solution_duration_min: minutes, tempo_solucao_minutos: minutes, tempo_solucao_texto: texto }
      }
    }
  }
  const { data, error } = await supabase
    .from('chamados')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) {
    const msg = String(error.message || '')
    const tsColMissing = msg.includes('started_at') || msg.includes('completed_at') || msg.includes('solution_duration_min')
    if (tsColMissing) {
      const minimal = { status: patch.status } as Partial<Chamado>
      const { data: data2, error: error2 } = await supabase
        .from('chamados')
        .update(minimal)
        .eq('id', id)
        .select('*')
        .single()
      if (error2) throw new Error(error2.message)
      return data2 as Chamado
    }
    throw new Error(error.message)
  }
  return data as Chamado
}

export async function rateChamado(id: string, rating: number, comment?: string): Promise<Chamado> {
  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from('chamados')
    .update({ avaliacao: rating, comentario_avaliacao: comment ?? null, data_avaliacao: nowIso, avaliado: true })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as Chamado
}

export async function deleteChamado(id: string): Promise<void> {
  const { error } = await supabase
    .from('chamados')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function resetAllEvaluations(): Promise<number> {
  const { error, data } = await supabase
    .from('chamados')
    .update({ avaliacao: null, comentario_avaliacao: null, data_avaliacao: null, avaliado: false })
    .select('id')
  if (error) throw new Error(error.message)
  return (data?.length ?? 0)
}
