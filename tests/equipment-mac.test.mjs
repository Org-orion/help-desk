import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { displayMac, formatMacInput, isMacPendente, isValidMac, normalizeMac, stripMac } from '../src/lib/utils/mac.ts'
import { displayUuid, formatUuidInput, isUuidPendente, isValidUuid, normalizeUuid, stripUuid } from '../src/lib/utils/uuid.ts'
import { listarIdentificadoresPendentes, temIdentificadorPendente } from '../src/lib/equipment-identifiers.ts'
import { buildEquipmentDeliveryDescription } from '../src/lib/equipment-responsibility-term.ts'

const MAC = 'A1:B2:C3:D4:E5:F6'
const UUID = '4C4C4544-0031-3010-8031-B7C04F485831'

test('MAC formata progressivamente e aceita qualquer separador', () => {
  assert.equal(formatMacInput('a1b'), 'A1:B')
  assert.equal(formatMacInput('a1-b2-c3-d4-e5-f6'), MAC)
  assert.equal(formatMacInput('a1b2.c3d4.e5f6'), MAC)
  assert.equal(stripMac('a1b2c3d4e5f6aa'), 'A1B2C3D4E5F6')
})

test('MAC só é válido completo, e só o completo é gravado', () => {
  assert.equal(isValidMac(MAC), true)
  assert.equal(isValidMac('A1:B2:C3'), false)
  assert.equal(normalizeMac('a1-b2-c3-d4-e5-f6'), MAC)
  assert.equal(normalizeMac('A1:B2:C3'), '')
})

test('UUID formata no padrão 8-4-4-4-12', () => {
  assert.equal(formatUuidInput('4c4c4544003130108031b7c04f485831'), UUID)
  assert.equal(formatUuidInput('4c4c4544'), '4C4C4544')
  assert.equal(formatUuidInput('4c4c45440031'), '4C4C4544-0031')
  assert.equal(stripUuid('4c4c4544-0031-3010-8031-b7c04f485831-ff'), '4C4C4544003130108031B7C04F485831')
})

test('UUID só é válido com 32 dígitos hexadecimais', () => {
  assert.equal(isValidUuid(UUID), true)
  assert.equal(isValidUuid('4C4C4544-0031'), false)
  assert.equal(normalizeUuid('4c4c4544003130108031b7c04f485831'), UUID)
  assert.equal(normalizeUuid('4C4C4544'), '')
})

test('campo vazio é pendente, nunca erro', () => {
  for (const vazio of [null, undefined, '', '   ']) {
    assert.equal(isMacPendente(vazio), true)
    assert.equal(displayMac(vazio), 'Pendente')
    assert.equal(isUuidPendente(vazio), true)
    assert.equal(displayUuid(vazio), 'Pendente')
  }
})

test('lista as pendências por nome, separando Wi-Fi de Ethernet', () => {
  assert.deepEqual(
    listarIdentificadoresPendentes({}),
    ['MAC Wi-Fi', 'MAC Ethernet', 'UUID'],
  )
  assert.deepEqual(
    listarIdentificadoresPendentes({ mac_wifi: MAC, uuid_dispositivo: UUID }),
    ['MAC Ethernet'],
  )
  assert.deepEqual(
    listarIdentificadoresPendentes({ mac_wifi: MAC, mac_ethernet: '00:11:22:33:44:55', uuid_dispositivo: UUID }),
    [],
  )
})

test('um ativo completo não tem pendência', () => {
  assert.equal(temIdentificadorPendente({ mac_wifi: MAC, mac_ethernet: '00:11:22:33:44:55', uuid_dispositivo: UUID }), false)
  assert.equal(temIdentificadorPendente({ mac_wifi: MAC }), true)
})

test('o termo cita cada adaptador pelo nome e omite o que falta', () => {
  assert.equal(
    buildEquipmentDeliveryDescription({ tipo: 'Notebook', patrimonio: 'PAT-001', mac_wifi: MAC, mac_ethernet: '00:11:22:33:44:55', uuid_dispositivo: UUID }),
    `notebook, patrimônio PAT-001, MAC Wi-Fi ${MAC}, MAC Ethernet 00:11:22:33:44:55, UUID ${UUID}`,
  )
  assert.equal(
    buildEquipmentDeliveryDescription({ tipo: 'Notebook', patrimonio: 'PAT-001', mac_wifi: null, mac_ethernet: null, uuid_dispositivo: null }),
    'notebook, patrimônio PAT-001',
  )
})

test('o cadastro via etiqueta QR grava os três identificadores', () => {
  const source = readFileSync(new URL('../supabase/sql/qr_release_functions.sql', import.meta.url), 'utf8')
  const insert = source.slice(source.indexOf('insert into public.equipamentos('), source.indexOf('returning id into equipment_id'))
  const colunas = insert.slice(insert.indexOf('(') + 1, insert.indexOf(')')).split(',').map((item) => item.trim())
  for (const coluna of ['mac_wifi', 'mac_ethernet', 'uuid_dispositivo']) {
    assert.ok(colunas.includes(coluna), `${coluna} fora da lista de colunas do insert`)
    assert.ok(insert.includes(`nullif(p_equipment->>'${coluna}','')`), `${coluna} sem nullif nos valores`)
  }
})

test('o formulário grava NULL, não string vazia, para não colidir no índice único', () => {
  const source = readFileSync(new URL('../src/pages/Equipamentos.tsx', import.meta.url), 'utf8')
  for (const campo of ['mac_wifi', 'mac_ethernet']) {
    assert.match(source, new RegExp(`${campo}: normalizeMac\(formData\.${campo}\) \|\| null`))
  }
  assert.match(source, /uuid_dispositivo: normalizeUuid\(formData\.uuid_dispositivo\) \|\| null/)
})

test('nenhum identificador é obrigatório no formulário', () => {
  const source = readFileSync(new URL('../src/pages/Equipamentos.tsx', import.meta.url), 'utf8')
  const submit = source.slice(source.indexOf('const submitEquipmentForm'), source.indexOf('const openEquipmentDetails'))
  // só recusa valor pela metade; vazio passa e vira pendência
  assert.match(submit, /formData\.mac_wifi\.trim\(\) && !isValidMac/)
  assert.match(submit, /formData\.uuid_dispositivo\.trim\(\) && !isValidUuid/)
  assert.doesNotMatch(submit, /obrigatório/i)
})
