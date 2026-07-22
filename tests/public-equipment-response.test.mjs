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

test('BOUND aceita campos opcionais nulos ou ausentes', () => {
  const result = normalizePublicEquipmentResponse({ code: 'ok', state: 'BOUND', equipment: { name: 'Equipamento', assetCode: '001', type: 'Notebook', status: 'Ativo', brand: null, model: null, sector: null, ram: null, storage: null } })
  assert.equal(result.kind, 'ready')
  assert.equal(result.equipment.brand, null)
  assert.equal(result.equipment.cpu, null)
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
  const result = await requestPublicEquipment('token-ficticio', { supabaseUrl: 'https://projeto.supabase.co', anonKey: 'chave-publica-ficticia', fetcher: async (url, init) => { request = { url, init }; return new Response(JSON.stringify(bound), { status: 200 }) } })
  assert.equal(result.kind, 'ready')
  assert.equal(request.init.cache, 'no-store')
  assert.deepEqual(JSON.parse(request.init.body), { token: 'token-ficticio' })
})

test('contrato público não contém dados pessoais ou internos', () => {
  const serialized = JSON.stringify(bound).toLowerCase()
  for (const forbidden of ['responsavel', 'usuario', 'email', 'cpf', 'telefone', 'id', 'token', 'hash', 'historico', 'chamados', 'comentarios']) assert.equal(serialized.includes(`"${forbidden}"`), false)
})
