import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizePublicEquipmentResponse,
  requestPublicEquipment,
  resolvePublicEquipmentInvocation,
} from '../src/lib/public-equipment.ts'

const equipment = {
  nome: 'Equipamento', patrimonio: '001', tipo: 'Notebook', marca: 'Marca', modelo: 'Modelo',
  statusOperacional: 'Disponível', setor: 'TI', ram: '16 GB', armazenamento: '512 GB', cpu: 'CPU',
  imagemPrincipalUrl: null, atualizadoEm: null,
}

test('normaliza o contrato real direto de HTTP 200 BOUND', () => {
  const result = normalizePublicEquipmentResponse(equipment)
  assert.equal(result.kind, 'ready')
  assert.equal(result.equipment.nome, 'Equipamento')
})

test('BOUND aceita campos opcionais nulos ou ausentes', () => {
  const result = normalizePublicEquipmentResponse({
    nome: 'Equipamento', patrimonio: '001', tipo: 'Notebook', statusOperacional: 'Ativo',
    marca: null, modelo: null, setor: null, ram: null, armazenamento: null, cpu: null,
    imagemPrincipalUrl: null, atualizadoEm: null,
  })
  assert.equal(result.kind, 'ready')
  assert.equal(result.equipment.marca, null)
})

test('normaliza UNBOUND sem exigir equipamento', () => {
  assert.equal(normalizePublicEquipmentResponse({ unlinked: true }).kind, 'unlinked')
})

test('nova resposta de sucesso substitui resultado de erro anterior', () => {
  const first = resolvePublicEquipmentInvocation(null, 503)
  const retry = resolvePublicEquipmentInvocation(equipment)
  assert.equal(first.kind, 'unavailable')
  assert.equal(retry.kind, 'ready')
})

test('diferencia token inválido de erro real do servidor', () => {
  assert.equal(resolvePublicEquipmentInvocation(null, 404).kind, 'not-found')
  assert.equal(resolvePublicEquipmentInvocation(null, 503).kind, 'unavailable')
})

test('rejeita envelopes e estruturas que não pertencem ao contrato real', () => {
  assert.equal(normalizePublicEquipmentResponse({ data: equipment }).kind, 'unavailable')
  assert.equal(normalizePublicEquipmentResponse([equipment]).kind, 'unavailable')
})

test('requisição pública usa no-store e normaliza a mesma resposta da página', async () => {
  let request
  const result = await requestPublicEquipment('token-ficticio', {
    supabaseUrl: 'https://projeto.supabase.co',
    anonKey: 'chave-publica-ficticia',
    fetcher: async (url, init) => {
      request = { url, init }
      return new Response(JSON.stringify(equipment), { status: 200 })
    },
  })

  assert.equal(result.kind, 'ready')
  assert.equal(request.init.cache, 'no-store')
  assert.deepEqual(JSON.parse(request.init.body), { token: 'token-ficticio' })
})
