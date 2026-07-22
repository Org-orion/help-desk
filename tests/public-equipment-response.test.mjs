import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizePublicEquipmentResponse, requestPublicEquipment, resolvePublicEquipmentInvocation } from '../src/lib/public-equipment.ts'

const equipment = { name: 'Equipamento', assetCode: '001', type: 'Notebook', brand: 'Marca', model: 'Modelo', status: 'Disponível', sector: 'TI', ram: '16 GB', storage: '512 GB', cpu: 'CPU' }
const bound = { code: 'ok', state: 'BOUND', equipment }

test('BOUND com todos os campos', () => {
  const result = normalizePublicEquipmentResponse(bound)
  assert.equal(result.kind, 'ready')
  assert.deepEqual(result.equipment, equipment)
})

test('adapta asset_code para assetCode sem aceitar envelopes alternativos', () => {
  const result = normalizePublicEquipmentResponse({ code: 'ok', state: 'BOUND', equipment: { ...equipment, assetCode: undefined, asset_code: 'PC-090' } })
  assert.equal(result.kind, 'ready')
  assert.equal(result.equipment.assetCode, 'PC-090')
})

test('BOUND aceita campos opcionais nulos ou ausentes', () => {
  const result = normalizePublicEquipmentResponse({ code: 'ok', state: 'BOUND', equipment: { name: 'Equipamento', assetCode: '001', type: 'Notebook', status: 'Ativo', brand: null, model: null, sector: null, ram: null, storage: null } })
  assert.equal(result.kind, 'ready')
  assert.equal(result.equipment.brand, 'Não informado')
  assert.equal(result.equipment.cpu, 'Não informado')
})

test('UNBOUND não exige equipamento', () => {
  assert.equal(normalizePublicEquipmentResponse({ code: 'ok', state: 'UNBOUND', equipment: null }).kind, 'unlinked')
})

test('token inválido e revogado continuam genéricos', () => {
  assert.equal(resolvePublicEquipmentInvocation({ error: 'genérico' }, 404).kind, 'not-found')
  assert.equal(resolvePublicEquipmentInvocation({ error: 'genérico' }, 403).kind, 'not-found')
})

test('repetição depois de erro aceita nova resposta BOUND', () => {
  assert.equal(resolvePublicEquipmentInvocation(null, 503).kind, 'unavailable')
  assert.equal(resolvePublicEquipmentInvocation(bound).kind, 'ready')
})

test('indisponibilidade fica restrita a HTTP 500/503', () => {
  assert.equal(resolvePublicEquipmentInvocation(null, 500).kind, 'unavailable')
  assert.equal(resolvePublicEquipmentInvocation(null, 503).kind, 'unavailable')
  assert.equal(resolvePublicEquipmentInvocation(null, 429).kind, 'not-found')
})

test('não adivinha contratos alternativos', () => {
  assert.equal(normalizePublicEquipmentResponse(equipment).kind, 'not-found')
  assert.equal(normalizePublicEquipmentResponse({ data: bound }).kind, 'not-found')
  assert.equal(normalizePublicEquipmentResponse([bound]).kind, 'not-found')
})

test('requisição usa no-store e o contrato exato', async () => {
  let request
  const result = await requestPublicEquipment('token-ficticio', { fetcher: async (url, init) => { request = { url, init }; return new Response(JSON.stringify(bound), { status: 200 }) } })
  assert.equal(result.kind, 'ready')
  assert.equal(request.init.cache, 'no-store')
  assert.equal(request.url, '/api/public/equipment/token-ficticio')
  assert.equal(request.init.method, 'GET')
  assert.equal(request.init.body, undefined)
})

test('HTTP 500 retorna indisponibilidade temporária', async () => {
  const result = await requestPublicEquipment('token-ficticio', { fetcher: async () => new Response(null, { status: 500 }) })
  assert.equal(result.kind, 'unavailable')
})

test('falha real de rede é propagada para o estado de indisponibilidade da página', async () => {
  await assert.rejects(() => requestPublicEquipment('token-ficticio', { fetcher: async () => { throw new TypeError('Failed to fetch') } }), TypeError)
})

test('contrato público não contém dados pessoais ou internos', () => {
  const serialized = JSON.stringify(bound).toLowerCase()
  for (const forbidden of ['responsavel', 'usuario', 'email', 'cpf', 'telefone', 'id', 'token', 'hash', 'historico', 'chamados', 'comentarios']) assert.equal(serialized.includes(`"${forbidden}"`), false)
})
