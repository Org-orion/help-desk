export const EQUIPMENT_QR_LABELS_UNAVAILABLE_MESSAGE =
  'Não foi possível concluir a operação QR com segurança.'

export const MAX_QR_LABEL_BATCH_SIZE = 500
export const MIN_QR_LABEL_DIGITS = 1
export const MAX_QR_LABEL_DIGITS = 8
export const MAX_QR_LABEL_PREFIX_LENGTH = 12
export const DISPLAY_CODE_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)?$/

export type EquipmentQrLabelStatus = 'UNUSED' | 'BOUND' | 'REVOKED' | 'VOID'
export type EquipmentQrLabelSize = '50x30' | '60x40' | '80x50' | '100x40'

export function getServerCompatibleLabelSize(size: EquipmentQrLabelSize): Exclude<EquipmentQrLabelSize, '100x40'> {
  return size === '100x40' ? '60x40' : size
}

export type EquipmentQrLabel = {
  id: string
  displayCode: string
  status: EquipmentQrLabelStatus
  equipmentId: string | null
  createdAt: string
  updatedAt: string
  boundAt: string | null
  revokedAt: string | null
  publicUrl?: string
}

export type EquipmentQrLookupDTO = Pick<EquipmentQrLabel, 'id' | 'displayCode' | 'status' | 'equipmentId'>

export type EquipmentQrBatchInput = {
  quantity: number
  startNumber: number
  prefix: string
  digits: number
  labelSize: EquipmentQrLabelSize
  columns: number
}

export function sanitizeLabelPrefix(value: string): string {
  return value.trim().toUpperCase()
}

export function validateLabelPrefix(value: string): string | null {
  const prefix = sanitizeLabelPrefix(value)
  if (!prefix) return null
  if (prefix.length > MAX_QR_LABEL_PREFIX_LENGTH || !/^[A-Z0-9]+$/.test(prefix)) {
    return `Use até ${MAX_QR_LABEL_PREFIX_LENGTH} letras ou números, sem espaços ou símbolos.`
  }
  return null
}

export function formatEquipmentQrDisplayCode(number: number, digits: number, prefix = ''): string {
  const numeric = String(number).padStart(digits, '0')
  const cleanPrefix = sanitizeLabelPrefix(prefix)
  return cleanPrefix ? `${cleanPrefix}-${numeric}` : numeric
}

export function validateBatchInput(input: EquipmentQrBatchInput): string[] {
  const errors: string[] = []
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > MAX_QR_LABEL_BATCH_SIZE) errors.push(`A quantidade deve estar entre 1 e ${MAX_QR_LABEL_BATCH_SIZE}.`)
  if (!Number.isSafeInteger(input.startNumber) || input.startNumber < 1) errors.push('O número inicial deve ser um inteiro maior ou igual a um.')
  if (!Number.isInteger(input.digits) || input.digits < MIN_QR_LABEL_DIGITS || input.digits > MAX_QR_LABEL_DIGITS) errors.push(`A quantidade de dígitos deve estar entre ${MIN_QR_LABEL_DIGITS} e ${MAX_QR_LABEL_DIGITS}.`)
  const prefixError = validateLabelPrefix(input.prefix)
  if (prefixError) errors.push(prefixError)
  if (!Number.isInteger(input.columns) || input.columns < 1 || input.columns > 5) errors.push('O número de colunas deve estar entre 1 e 5.')
  const last = input.startNumber + input.quantity - 1
  if (Number.isSafeInteger(last) && String(last).length > input.digits) errors.push('A faixa numérica não cabe na quantidade de dígitos escolhida.')
  return errors
}

export function parseEquipmentQrUrl(value: string, origin: string): string | null {
  try {
    const url = new URL(value)
    const expected = new URL(origin)
    if (url.origin !== expected.origin) return null
    const match = url.pathname.match(/^\/consulta\/equipamento\/([A-Za-z0-9_-]{43,128})\/?$/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}
