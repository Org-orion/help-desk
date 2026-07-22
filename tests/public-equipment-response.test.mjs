import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizePublicEquipmentResponse,
  resolvePublicEquipmentInvocation,
} from '../src/lib/public-equipment.ts'

const equipment = {
  nome: 'Equipamento', patrimonio: '001', tipo: 'Notebook', marca: 'Marca', modelo: 'Modelo',
  statusOperacional: 'Disponível', setor: 'TI', ram: '16 GB', armazenamento: '512 GB', cpu: 'CPU',
  imagemPrincipalUrl: null, atualizadoEm: null,
}

test('normaliza HTTP 200 BOUND com equipamento envelopado', () => {
  const result = normalizePublicEquipmentResponse({ state: 'BOUND', equipment })
  assert.equal(result.kind, 'ready')
  assert.equal(result.equipment.nome, 'Equipamento')
})

test('aceita resposta direta atualmente retornada pela Edge Function', () => {
  assert.equal(normalizePublicEquipmentResponse(equipment).kind, 'ready')
  assert.equal(normalizePublicEquipmentResponse({ ok: true, data: equipment }).kind, 'ready')
})

test('BOUND aceita campos opcionais nulos ou ausentes', () => {
  const result = normalizePublicEquipmentResponse({ state: 'BOUND', equipment: { nome: 'Equipamento' } })
  assert.equal(result.kind, 'ready')
  assert.equal(result.equipment.tipo, 'Não informado')
  assert.equal(result.equipment.marca, null)
})

test('normaliza UNBOUND sem exigir equipamento', () => {
  assert.equal(normalizePublicEquipmentResponse({ state: 'UNBOUND' }).kind, 'unlinked')
  assert.equal(normalizePublicEquipmentResponse({ unlinked: true }).kind, 'unlinked')
})

test('nova resposta de sucesso substitui resultado de erro anterior', () => {
  const first = resolvePublicEquipmentInvocation(null, 503)
  const retry = resolvePublicEquipmentInvocation({ data: { state: 'BOUND', equipment } })
  assert.equal(first.kind, 'unavailable')
  assert.equal(retry.kind, 'ready')
})

test('diferencia token inválido de erro real do servidor', () => {
  assert.equal(resolvePublicEquipmentInvocation(null, 404).kind, 'not-found')
  assert.equal(resolvePublicEquipmentInvocation(null, 503).kind, 'unavailable')
})

test('não aceita envelope BOUND sem equipamento', () => {
  assert.equal(normalizePublicEquipmentResponse({ state: 'BOUND' }).kind, 'unavailable')
})
