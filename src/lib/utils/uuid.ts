const HEX_ONLY = /[^0-9a-fA-F]/g
const GROUPS = [8, 4, 4, 4, 12]
const TOTAL_HEX = 32

/** Remove separadores e deixa apenas os dígitos hexadecimais (máx. 32). */
export const stripUuid = (value?: string | null): string =>
  (value ?? '').replace(HEX_ONLY, '').toUpperCase().slice(0, TOTAL_HEX)

/**
 * Formata progressivamente enquanto o usuário digita, no formato canônico
 * 8-4-4-4-12 — o mesmo que `wmic csproduct get uuid` devolve no Windows.
 */
export const formatUuidInput = (value?: string | null): string => {
  const hex = stripUuid(value)
  const parts: string[] = []
  let offset = 0
  for (const size of GROUPS) {
    if (offset >= hex.length) break
    parts.push(hex.slice(offset, offset + size))
    offset += size
  }
  return parts.join('-')
}

/** UUID válido = 32 dígitos hexadecimais (separadores são ignorados). */
export const isValidUuid = (value?: string | null): boolean =>
  stripUuid(value).length === TOTAL_HEX

/** Valor canônico gravado no banco. */
export const normalizeUuid = (value?: string | null): string =>
  isValidUuid(value) ? formatUuidInput(value) : ''

/** Dispositivo sem UUID informado — pendente de levantamento. */
export const isUuidPendente = (value?: string | null): boolean =>
  !isValidUuid(value)

/** Rótulo para listas, detalhes e documentos. */
export const displayUuid = (value?: string | null): string =>
  isValidUuid(value) ? formatUuidInput(value) : 'Pendente'
