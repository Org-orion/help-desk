import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  displayMac,
  formatMacInput,
  isMacPendente,
  isValidMac,
  normalizeMac,
  stripMac,
} from '../src/lib/utils/mac.ts'
import { buildEquipmentDeliveryDescription } from '../src/lib/equipment-responsibility-term.ts'

test('formata progressivamente enquanto o técnico digita', () => {
  assert.equal(formatMacInput('a'), 'A')
  assert.equal(formatMacInput('a1b'), 'A1:B')
  assert.equal(formatMacInput('a1b2c3d4e5f6'), 'A1:B2:C3:D4:E5:F6')
})

test('aceita a digitação com qualquer separador usual', () => {
  const esperado = 'A1:B2:C3:D4:E5:F6'
  assert.equal(formatMacInput('a1-b2-c3-d4-e5-f6'), esperado)
  assert.equal(formatMacInput('a1b2.c3d4.e5f6'), esperado)
  assert.equal(formatMacInput('A1:B2:C3:D4:E5:F6'), esperado)
})

test('descarta o excedente além dos doze dígitos', () => {
  assert.equal(stripMac('a1b2c3d4e5f6aa'), 'A1B2C3D4E5F6')
  assert.equal(formatMacInput('a1b2c3d4e5f6aa'), 'A1:B2:C3:D4:E5:F6')
})

test('só considera válido o MAC completo', () => {
  assert.equal(isValidMac('A1:B2:C3:D4:E5:F6'), true)
  assert.equal(isValidMac('a1b2c3d4e5f6'), true)
  assert.equal(isValidMac('A1:B2:C3:D4:E5'), false)
  assert.equal(isValidMac('ZZ:ZZ:ZZ:ZZ:ZZ:ZZ'), false)
  assert.equal(isValidMac(''), false)
})

test('grava sempre no formato canônico e nunca um valor parcial', () => {
  assert.equal(normalizeMac('a1-b2-c3-d4-e5-f6'), 'A1:B2:C3:D4:E5:F6')
  assert.equal(normalizeMac('A1:B2:C3'), '')
})

test('trata cadastro antigo sem MAC como pendente', () => {
  for (const legado of [null, undefined, '', '   ', 'A1:B2:C3']) {
    assert.equal(isMacPendente(legado), true)
    assert.equal(displayMac(legado), 'Pendente')
  }
  assert.equal(isMacPendente('A1:B2:C3:D4:E5:F6'), false)
  assert.equal(displayMac('a1b2c3d4e5f6'), 'A1:B2:C3:D4:E5:F6')
})

test('leva o MAC para o termo de responsabilidade sem quebrar o texto sem MAC', () => {
  assert.equal(
    buildEquipmentDeliveryDescription({ tipo: 'Notebook', marca: 'DELL', patrimonio: 'PAT-001', mac: 'A1:B2:C3:D4:E5:F6' }),
    'notebook, marca DELL, patrimônio PAT-001, MAC A1:B2:C3:D4:E5:F6',
  )
  assert.equal(
    buildEquipmentDeliveryDescription({ tipo: 'Notebook', marca: 'DELL', patrimonio: 'PAT-001', mac: null }),
    'notebook, marca DELL, patrimônio PAT-001',
  )
})

test('o cadastro via etiqueta QR grava o mac junto com as demais colunas', () => {
  const source = readFileSync(new URL('../supabase/sql/qr_release_functions.sql', import.meta.url), 'utf8')
  const insert = source.slice(source.indexOf('insert into public.equipamentos('), source.indexOf('returning id into equipment_id'))
  assert.match(insert, /insert into public\.equipamentos\([^)]*\bmac\b/)
  assert.match(insert, /nullif\(p_equipment->>'mac',''\)/)
})
