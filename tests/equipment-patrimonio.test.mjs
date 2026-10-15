import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { displayPatrimonio, exigePatrimonio } from '../src/lib/equipment-identifiers.ts'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const equipamentos = read('../src/pages/Equipamentos.tsx')
const analise = read('../src/pages/AnaliseEquipamentos.tsx')
const bindDialog = read('../src/components/equipment-qr/EquipmentQrBindExistingDialog.tsx')
const migration = read('../supabase/migrations/202610150001_patrimonio_opcional_perifericos.sql')

test('só Periféricos dispensa o patrimônio', () => {
  assert.equal(exigePatrimonio('Periféricos'), false)
  for (const tipo of ['Notebook', 'Desktop', 'Monitor', 'Impressora', 'Smartphone', 'Tablet']) {
    assert.equal(exigePatrimonio(tipo), true, `${tipo} deveria exigir patrimônio`)
  }
})

test('ausência de patrimônio tem rótulo próprio, nunca vazio', () => {
  assert.equal(displayPatrimonio(null), 'Sem patrimônio')
  assert.equal(displayPatrimonio('   '), 'Sem patrimônio')
  assert.equal(displayPatrimonio('PER-001'), 'PER-001')
})

test('o formulário exige conforme o tipo, na tela e na gravação', () => {
  assert.match(equipamentos, /required=\{exigePatrimonio\(formData\.tipo\)\}/)
  assert.match(equipamentos, /exigePatrimonio\(formData\.tipo\) && !formData\.patrimonio\.trim\(\)/)
})

test('grava NULL, não string vazia, para não colidir na restrição UNIQUE', () => {
  assert.match(equipamentos, /patrimonio: formData\.patrimonio\.trim\(\) \|\| null/)
  assert.match(migration, /alter column patrimonio drop not null/)
})

test('nenhuma busca chama toLowerCase direto no patrimônio', () => {
  for (const [nome, source] of [['Equipamentos', equipamentos], ['AnaliseEquipamentos', analise]]) {
    assert.doesNotMatch(source, /\bpatrimonio\.toLowerCase\(\)/, `${nome} quebraria com patrimônio nulo`)
  }
  assert.doesNotMatch(bindDialog, /\bpatrimonio\.toLocaleLowerCase\(/)
})

test('a etiqueta QR não é oferecida sem patrimônio', () => {
  assert.match(equipamentos, /disabled=\{!equipment\.patrimonio\}/)
})
