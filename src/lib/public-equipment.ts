export const PUBLIC_EQUIPMENT_QR_UNAVAILABLE_MESSAGE =
  'A consulta não pôde ser concluída. Tente novamente em instantes.'

export const PUBLIC_EQUIPMENT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,128}$/

export type PublicEquipmentDTO = {
  name: string
  assetCode: string
  type: string
  brand: string
  model: string
  status: string
  sector: string
  ram: string
  storage: string
  cpu: string
}

export type PublicEquipmentLookupResult =
  | { kind: 'ready'; equipment: PublicEquipmentDTO }
  | { kind: 'unlinked' }
  | { kind: 'not-found' }
  | { kind: 'unavailable' }

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null

const requiredText = (value: unknown) => typeof value === 'string' ? value : null
const optionalText = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null
const displayText = (value: unknown) => optionalText(value) ?? 'Não informado'

const normalizeEquipment = (value: Record<string, unknown>): PublicEquipmentDTO | null => {
  const name = requiredText(value.name)
  const assetCode = requiredText(value.assetCode ?? value.asset_code)
  const type = requiredText(value.type)
  const status = requiredText(value.status)
  if (name === null || assetCode === null || type === null || status === null) return null

  return {
    name: name.trim() || 'Não informado',
    assetCode: assetCode.trim() || 'Não informado',
    type: type.trim() || 'Não informado',
    brand: displayText(value.brand),
    model: displayText(value.model),
    status: status.trim() || 'Não informado',
    sector: displayText(value.sector),
    ram: displayText(value.ram),
    storage: displayText(value.storage),
    cpu: displayText(value.cpu),
  }
}

/** Consome exclusivamente o contrato publicado pela Edge Function public-equipment. */
export function normalizePublicEquipmentResponse(payload: unknown): PublicEquipmentLookupResult {
  const body = asRecord(payload)
  if (!body || body.code !== 'ok') return { kind: 'not-found' }
  if (body.state === 'UNBOUND' && body.equipment === null) return { kind: 'unlinked' }
  if (body.state !== 'BOUND') return { kind: 'not-found' }

  const equipment = asRecord(body.equipment)
  if (!equipment) return { kind: 'not-found' }
  const normalized = normalizeEquipment(equipment)
  return normalized ? { kind: 'ready', equipment: normalized } : { kind: 'not-found' }
}

export async function requestPublicEquipment(
  token: string,
  options: {
    signal?: AbortSignal
    fetcher?: typeof fetch
  },
): Promise<PublicEquipmentLookupResult> {
  const fetcher = options.fetcher ?? fetch
  const response = await fetcher(`/api/public/equipment/${encodeURIComponent(token)}`, {
    method: 'GET',
    cache: 'no-store',
    signal: options.signal,
  })

  if (!response.ok) return resolvePublicEquipmentInvocation(null, response.status)
  return resolvePublicEquipmentInvocation(await response.json())
}

export function resolvePublicEquipmentInvocation(payload: unknown, errorStatus?: number): PublicEquipmentLookupResult {
  if (errorStatus !== undefined) {
    return errorStatus === 500 || errorStatus === 503 ? { kind: 'unavailable' } : { kind: 'not-found' }
  }
  return normalizePublicEquipmentResponse(payload)
}
