import { isMacPendente } from './utils/mac.ts'
import { isUuidPendente } from './utils/uuid.ts'

export type EquipmentIdentifiers = {
  mac_wifi?: string | null
  mac_ethernet?: string | null
  uuid_dispositivo?: string | null
}

export const IDENTIFIER_LABELS = {
  mac_wifi: 'MAC Wi-Fi',
  mac_ethernet: 'MAC Ethernet',
  uuid_dispositivo: 'UUID',
} as const

/**
 * Identificadores que o ativo ainda não tem. Nenhum deles é obrigatório no
 * cadastro: a ausência vira pendência visível, não um bloqueio.
 */
export const listarIdentificadoresPendentes = (equipment: EquipmentIdentifiers): string[] => {
  const pendentes: string[] = []
  if (isMacPendente(equipment.mac_wifi)) pendentes.push(IDENTIFIER_LABELS.mac_wifi)
  if (isMacPendente(equipment.mac_ethernet)) pendentes.push(IDENTIFIER_LABELS.mac_ethernet)
  if (isUuidPendente(equipment.uuid_dispositivo)) pendentes.push(IDENTIFIER_LABELS.uuid_dispositivo)
  return pendentes
}

export const temIdentificadorPendente = (equipment: EquipmentIdentifiers): boolean =>
  listarIdentificadoresPendentes(equipment).length > 0

/** Tipo de ativo que, por não costumar ter plaqueta, dispensa o patrimônio. */
export const TIPO_SEM_PATRIMONIO_OBRIGATORIO = 'Periféricos'

/** Fonte única da regra de obrigatoriedade do patrimônio. */
export const exigePatrimonio = (tipo?: string | null): boolean =>
  tipo !== TIPO_SEM_PATRIMONIO_OBRIGATORIO

export const PATRIMONIO_AUSENTE = 'Sem patrimônio'

/** Rótulo para listas, fichas e documentos, já que o campo pode vir vazio. */
export const displayPatrimonio = (value?: string | null): string =>
  (value ?? '').trim() || PATRIMONIO_AUSENTE
