import { createHash, randomBytes } from 'node:crypto'

/** Future server-only primitives. Generation is not called until persistence is implemented. */
export function generatePublicEquipmentToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashPublicEquipmentToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function buildPublicEquipmentUrl(baseUrl: string, token: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  const parsed = new URL(base)
  if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') throw new Error('HTTPS is required')
  return `${base}/consulta/equipamento/${encodeURIComponent(token)}`
}
