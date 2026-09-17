import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { equipamentoError } from '../src/lib/equipment-errors.ts'

test('explica patrimônio duplicado em vez do erro cru do Postgres', () => {
  const error = equipamentoError({
    code: '23505',
    message: 'duplicate key value violates unique constraint "equipamentos_patrimonio_key"',
  })
  assert.match(error.message, /Já existe um ativo com esse patrimônio/)
  assert.doesNotMatch(error.message, /duplicate key|constraint/i)
})

test('distingue qual identificador duplicou', () => {
  const duplicado = (indice) => equipamentoError({
    code: '23505',
    message: `duplicate key value violates unique constraint "${indice}"`,
  }).message
  assert.match(duplicado('idx_equipamentos_mac_wifi'), /MAC de Wi-Fi já está cadastrado/)
  assert.match(duplicado('idx_equipamentos_mac_ethernet'), /MAC de Ethernet já está cadastrado/)
  assert.match(duplicado('idx_equipamentos_uuid_dispositivo'), /UUID já está cadastrado/)
})

test('explica que ativo com etiqueta QR não pode ser excluído, sem mandar tentar de novo', () => {
  const error = equipamentoError({
    code: '23503',
    message: 'update or delete on table "equipamentos" violates foreign key constraint',
    details: 'Key is still referenced from table "equipment_qr_label_audit".',
  })
  assert.match(error.message, /etiqueta QR/)
  assert.doesNotMatch(error.message, /tente novamente/i)
})

test('preserva as mensagens de vínculo já existentes', () => {
  assert.match(equipamentoError({ message: 'EQUIPMENT_LINK_SELF' }).message, /não pode ser vinculado a ele mesmo/)
  assert.match(equipamentoError({ message: 'EQUIPMENT_LINK_PARENT_IS_LINKED' }).message, /equipamento principal/)
})

test('usa o fallback quando o erro não é reconhecido', () => {
  assert.equal(equipamentoError({}, 'Não foi possível excluir este ativo.').message, 'Não foi possível excluir este ativo.')
})

test('o botão Registrar Ativo abre a ficha em branco', () => {
  const source = readFileSync(new URL('../src/pages/Equipamentos.tsx', import.meta.url), 'utf8')
  const handler = source.slice(source.indexOf('const handleCreateAsset'), source.indexOf('const registerAnother'))
  assert.match(handler, /setFormData\(emptyEquipmentForm\(\)\)/)
  assert.match(handler, /setSelectedEquipment\(null\)/)
  // o botão não pode voltar a espalhar o formData do ativo editado
  assert.doesNotMatch(source, /setFormData\(\{ \.\.\.formData, equipamento_pai_id: null \}\)/)
})
