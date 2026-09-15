const HEX_ONLY = /[^0-9a-fA-F]/g

/** Remove separadores e deixa apenas os dígitos hexadecimais (máx. 12). */
export const stripMac = (value?: string | null): string =>
  (value ?? '').replace(HEX_ONLY, '').toUpperCase().slice(0, 12)

/**
 * Formata progressivamente enquanto o usuário digita: AA:BB:CC:DD:EE:FF.
 * Aceita entrada com ou sem separadores (`:`, `-`, `.`).
 */
export const formatMacInput = (value?: string | null): string => {
  const hex = stripMac(value)
  return hex.match(/.{1,2}/g)?.join(':') ?? ''
}

/** MAC válido = 12 dígitos hexadecimais (separadores são ignorados). */
export const isValidMac = (value?: string | null): boolean =>
  stripMac(value).length === 12

/** Valor canônico gravado no banco: AA:BB:CC:DD:EE:FF. */
export const normalizeMac = (value?: string | null): string =>
  isValidMac(value) ? formatMacInput(value) : ''

/** Cadastro antigo sem MAC preenchido — pendente de regularização. */
export const isMacPendente = (value?: string | null): boolean =>
  !isValidMac(value)

/** Rótulo para exibição em listas, detalhes e documentos. */
export const displayMac = (value?: string | null): string =>
  isValidMac(value) ? formatMacInput(value) : 'Pendente'
