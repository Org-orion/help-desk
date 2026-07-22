export const PUBLIC_EQUIPMENT_QR_UNAVAILABLE_MESSAGE =
  'A consulta não pôde ser concluída. Tente novamente em instantes.'

export const PUBLIC_EQUIPMENT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,128}$/

export type PublicEquipmentDTO = {
  nome: string
  patrimonio: string
  tipo: string
  marca: string | null
  modelo: string | null
  statusOperacional: string
  setor: string | null
  ram: string | null
  armazenamento: string | null
  cpu: string | null
  imagemPrincipalUrl: string | null
  atualizadoEm: string | null
}

export type PublicEquipmentSource = {
  nome: string
  patrimonio: string
  tipo: string
  marca?: string | null
  modelo?: string | null
  status: string
  setor?: string | null
  ram?: string | null
  armazenamento?: string | null
  processador?: string | null
  imagem_principal_url?: string | null
  updated_at?: string | null
}

export type PublicEquipmentLookupResult =
  | { kind: 'ready'; equipment: PublicEquipmentDTO }
  | { kind: 'unlinked' }
  | { kind: 'not-found' }
  | { kind: 'unavailable' }

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null

const textOrNull = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null
const textOrFallback = (value: unknown) => textOrNull(value) ?? 'Não informado'
const safeImageUrl = (value: unknown) => {
  const url = textOrNull(value)
  if (!url) return null
  try { return new URL(url).protocol === 'https:' ? url : null } catch { return null }
}

const looksLikeEquipment = (value: Record<string, unknown>) =>
  ['nome', 'patrimonio', 'tipo', 'statusOperacional', 'status'].some((key) => key in value)

const normalizeEquipment = (value: Record<string, unknown>): PublicEquipmentDTO => ({
  nome: textOrFallback(value.nome),
  patrimonio: textOrFallback(value.patrimonio ?? value.codigo),
  tipo: textOrFallback(value.tipo),
  marca: textOrNull(value.marca),
  modelo: textOrNull(value.modelo),
  statusOperacional: textOrFallback(value.statusOperacional ?? value.status),
  setor: textOrNull(value.setor),
  ram: textOrNull(value.ram),
  armazenamento: textOrNull(value.armazenamento),
  cpu: textOrNull(value.cpu ?? value.processador),
  imagemPrincipalUrl: safeImageUrl(value.imagemPrincipalUrl ?? value.imagem_principal_url),
  atualizadoEm: textOrNull(value.atualizadoEm ?? value.updated_at),
})

/** Accepts the direct Edge Function response and supported state/data envelopes. */
export function normalizePublicEquipmentResponse(payload: unknown): PublicEquipmentLookupResult {
  const outer = asRecord(payload)
  if (!outer) return { kind: 'unavailable' }
  const body = asRecord(outer.data) ?? outer
  const state = textOrNull(body.state ?? outer.state)?.toUpperCase()

  if (state === 'UNBOUND' || body.unlinked === true) return { kind: 'unlinked' }
  if (state === 'REVOKED' || state === 'VOID' || state === 'NOT_FOUND') return { kind: 'not-found' }

  const wrappedEquipment = asRecord(body.equipment) ?? asRecord(outer.equipment)
  if (state === 'BOUND') {
    return wrappedEquipment ? { kind: 'ready', equipment: normalizeEquipment(wrappedEquipment) } : { kind: 'unavailable' }
  }
  if (wrappedEquipment) return { kind: 'ready', equipment: normalizeEquipment(wrappedEquipment) }
  if (looksLikeEquipment(body)) return { kind: 'ready', equipment: normalizeEquipment(body) }
  return { kind: 'unavailable' }
}

export function resolvePublicEquipmentInvocation(payload: unknown, errorStatus?: number): PublicEquipmentLookupResult {
  if (errorStatus !== undefined) return { kind: errorStatus === 404 ? 'not-found' : 'unavailable' }
  return normalizePublicEquipmentResponse(payload)
}

/** Converts a server-selected record into the only shape allowed in public responses. */
export function toPublicEquipmentDTO(source: PublicEquipmentSource): PublicEquipmentDTO {
  return {
    nome: source.nome,
    patrimonio: source.patrimonio,
    tipo: source.tipo,
    marca: source.marca ?? null,
    modelo: source.modelo ?? null,
    statusOperacional: source.status,
    setor: source.setor ?? null,
    ram: source.ram ?? null,
    armazenamento: source.armazenamento ?? null,
    cpu: source.processador ?? null,
    imagemPrincipalUrl: source.imagem_principal_url ?? null,
    atualizadoEm: source.updated_at ?? null,
  }
}
