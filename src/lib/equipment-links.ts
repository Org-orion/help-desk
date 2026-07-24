export type EquipamentoVinculoResumo = {
  id: string
  nome: string
  tipo: string
  patrimonio: string
  status: string
  marca?: string | null
  modelo?: string | null
  equipamento_pai_id?: string | null
}

export function getEquipamentoPrincipal<T extends EquipamentoVinculoResumo>(
  equipamento: T,
  equipamentos: T[],
): T | null {
  if (!equipamento.equipamento_pai_id) return null
  return equipamentos.find((item) => item.id === equipamento.equipamento_pai_id) ?? null
}

export function listEquipamentosVinculados<T extends EquipamentoVinculoResumo>(
  equipamentoId: string,
  equipamentos: T[],
): T[] {
  return equipamentos.filter((item) => item.equipamento_pai_id === equipamentoId)
}

export function listEquipamentosPrincipaisDisponiveis<T extends EquipamentoVinculoResumo>(
  equipamentos: T[],
  equipamentoId?: string,
): T[] {
  const currentHasChildren = equipamentoId
    ? equipamentos.some((item) => item.equipamento_pai_id === equipamentoId)
    : false

  if (currentHasChildren) return []

  return equipamentos.filter((item) =>
    item.id !== equipamentoId && !item.equipamento_pai_id
  )
}

export function validateEquipamentoVinculoLocal<T extends EquipamentoVinculoResumo>(
  equipamentoId: string | undefined,
  equipamentoPaiId: string | null | undefined,
  equipamentos: T[],
): string | null {
  if (!equipamentoPaiId) return null
  if (equipamentoId && equipamentoId === equipamentoPaiId) {
    return 'Um equipamento não pode ser vinculado a ele mesmo.'
  }

  const parent = equipamentos.find((item) => item.id === equipamentoPaiId)
  if (!parent) return 'O equipamento principal selecionado não foi encontrado.'
  if (parent.equipamento_pai_id) {
    return 'Um equipamento vinculado não pode ser selecionado como equipamento principal.'
  }
  if (equipamentoId && equipamentos.some((item) => item.equipamento_pai_id === equipamentoId)) {
    return 'Um equipamento que possui vinculados não pode ser vinculado a outro equipamento.'
  }
  return null
}
