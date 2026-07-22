export const PUBLIC_EQUIPMENT_QR_UNAVAILABLE_MESSAGE =
  'A consulta não pôde ser concluída. Tente novamente em instantes.'

export const PUBLIC_EQUIPMENT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,128}$/

export type PublicEquipmentDTO = {
  name: string
  assetCode: string
  type: string
  brand: string | null
  model: string | null
  status: string
  sector: string | null
  ram: string | null
  storage: string | null
  cpu: string | null
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

const normalizeEquipment = (value: Record<string, unknown>): PublicEquipmentDTO | null => {
  const name = requiredText(value.name)
  const assetCode = requiredText(value.assetCode)
  const type = requiredText(value.type)
  const status = requiredText(value.status)
  if (name === null || assetCode === null || type === null || status === null) return null

  return {
    name: name.trim() || 'Não informado',
    assetCode: assetCode.trim() || 'Não informado',
    type: type.trim() || 'Não informado',
    brand: optionalText(value.brand),
    model: optionalText(value.model),
    status: status.trim() || 'Não informado',
    sector: optionalText(value.sector),
    ram: optionalText(value.ram),
    storage: optionalText(value.storage),
    cpu: optionalText(value.cpu),
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
    supabaseUrl: string
    anonKey: string
    signal?: AbortSignal
    fetcher?: typeof fetch
  },
): Promise<PublicEquipmentLookupResult> {
  const fetcher = options.fetcher ?? fetch
  const response = await fetcher(`${options.supabaseUrl.replace(/\/$/, '')}/functions/v1/public-equipment`, {
    method: 'POST',
    cache: 'no-store',
    signal: options.signal,
    headers: {
      apikey: options.anonKey,
      authorization: `Bearer ${options.anonKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ token }),
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
