import type { EquipmentQrBatchInput, EquipmentQrLabel, EquipmentQrLookupDTO } from '../../src/lib/equipment-qr-labels.js'
import type { PublicEquipmentDTO } from '../../src/lib/public-equipment.js'

/**
 * Server-only persistence contract. Every mutation named `Atomically` must run in one DB transaction
 * and append its audit record before commit. No implementation is installed while the DB is offline.
 */
export interface EquipmentQrPersistence {
  generateBatchAtomically(input: EquipmentQrBatchInput, actorUserId: string): Promise<EquipmentQrLabel[]>
  lookupByTokenHash(tokenHash: string): Promise<EquipmentQrLookupDTO | null>
  findActiveByEquipmentId(equipmentId: string): Promise<EquipmentQrLabel | null>
  createEquipmentAndBindAtomically(input: { labelId: string; equipment: Record<string, unknown>; actorUserId: string }): Promise<{ equipmentId: string }>
  bindExistingAtomically(input: { labelId: string; equipmentId: string; patrimonyDecision: 'KEEP' | 'REPLACE' | 'FILL'; revokePrevious: boolean; actorUserId: string }): Promise<void>
  revokeAtomically(labelId: string, actorUserId: string): Promise<void>
  reissueAtomically(labelId: string, actorUserId: string): Promise<EquipmentQrLabel>
  selectPublicEquipmentByTokenHash(tokenHash: string): Promise<PublicEquipmentDTO | null>
}
