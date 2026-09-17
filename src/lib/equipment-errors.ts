/**
 * Traduz o erro cru do Postgres/PostgREST para uma frase que diga ao usuário o
 * que fazer. Sem isso a tela mostra coisas como
 * `duplicate key value violates unique constraint "equipamentos_patrimonio_key"`.
 */
export function equipamentoError(
  error: { message?: string; code?: string; details?: string },
  fallback = 'Não foi possível concluir a operação.',
): Error {
  const message = String(error?.message ?? '')
  const haystack = `${message} ${String(error?.details ?? '')}`

  if (message.includes('EQUIPMENT_LINK_SELF')) return new Error('Um equipamento não pode ser vinculado a ele mesmo.')
  if (message.includes('EQUIPMENT_LINK_PARENT_NOT_FOUND')) return new Error('O equipamento principal selecionado não foi encontrado.')
  if (message.includes('EQUIPMENT_LINK_PARENT_IS_LINKED')) return new Error('Um equipamento vinculado não pode ser selecionado como equipamento principal.')
  if (message.includes('EQUIPMENT_LINK_CHILD_HAS_LINKS')) return new Error('Um equipamento que possui vinculados não pode ser vinculado a outro equipamento.')

  if (message.includes('EQUIPMENT_DELETE_FORBIDDEN')) {
    return new Error('Seu usuário não tem permissão para excluir ativos.')
  }
  if (message.includes('EQUIPMENT_DELETE_NOT_FOUND')) {
    return new Error('Este ativo não foi encontrado. Ele pode já ter sido excluído.')
  }
  if (haystack.includes('equipamentos_patrimonio_key')) {
    return new Error('Já existe um ativo com esse patrimônio. Verifique o código informado.')
  }
  if (haystack.includes('idx_equipamentos_mac_wifi')) {
    return new Error('Esse MAC de Wi-Fi já está cadastrado em outro ativo.')
  }
  if (haystack.includes('idx_equipamentos_mac_ethernet')) {
    return new Error('Esse MAC de Ethernet já está cadastrado em outro ativo.')
  }
  if (haystack.includes('idx_equipamentos_uuid_dispositivo')) {
    return new Error('Esse UUID já está cadastrado em outro ativo.')
  }
  if (haystack.includes('equipment_qr_label')) {
    return new Error('Este ativo possui histórico de etiqueta QR e, por isso, não pode ser excluído. Marque-o como Inativo.')
  }
  if (haystack.includes('equipamento_pai_id')) {
    return new Error('Este ativo possui equipamentos vinculados. Remova os vínculos antes de excluí-lo.')
  }

  return error instanceof Error ? error : new Error(message || fallback)
}
