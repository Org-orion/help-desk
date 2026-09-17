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
