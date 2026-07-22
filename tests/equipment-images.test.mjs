import assert from 'node:assert/strict'
import test from 'node:test'

import { EQUIPMENT_IMAGE_MAX_SIZE, validateEquipmentImage } from '../src/lib/equipment-images.ts'

test('aceita JPEG válido dentro do limite', async () => {
  const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xdb])], 'pato.jpg', { type: 'image/jpeg' })
  await assert.doesNotReject(() => validateEquipmentImage(file))
})

test('rejeita formato não permitido', async () => {
  const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'arquivo.pdf', { type: 'application/pdf' })
  await assert.rejects(() => validateEquipmentImage(file), /formato inválido/)
})

test('rejeita imagem acima de 10 MB', async () => {
  const file = new File([new Uint8Array(EQUIPMENT_IMAGE_MAX_SIZE + 1)], 'grande.jpg', { type: 'image/jpeg' })
  await assert.rejects(() => validateEquipmentImage(file), /excede 10 MB/)
})

test('rejeita conteúdo incompatível com o MIME type', async () => {
  const file = new File([new Uint8Array([0x00, 0x01, 0x02, 0x03])], 'falsa.jpg', { type: 'image/jpeg' })
  await assert.rejects(() => validateEquipmentImage(file), /conteúdo do arquivo/)
})
