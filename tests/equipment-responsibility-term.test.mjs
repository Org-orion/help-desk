import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  buildEquipmentDeliveryDescription,
  createEquipmentResponsibilityTermPdf,
  formatResponsibilityTermDate,
  formatResponsibilityTermSector,
} from '../src/lib/equipment-responsibility-term.ts'

test('monta o texto dinâmico de notebook somente com os dados cadastrados', () => {
  const description = buildEquipmentDeliveryDescription({
    tipo: 'Notebook',
    marca: 'DELL',
    modelo: 'LATITUDE 3420',
    ram: '8GB',
    armazenamento: '256GB SSD',
    processador: 'Intel Core i5',
    patrimonio: 'PAT-001',
  })

  assert.equal(
    description,
    'notebook, marca DELL, modelo LATITUDE 3420, 8GB RAM, 256GB SSD, processador Intel Core i5, patrimônio PAT-001',
  )
})

test('acompanha os tipos Tablet e Celular sem manter tipo fixo', () => {
  assert.equal(
    buildEquipmentDeliveryDescription({ tipo: 'Tablet', marca: 'Samsung', modelo: 'Tab A9' }),
    'tablet, marca Samsung, modelo Tab A9',
  )
  assert.equal(
    buildEquipmentDeliveryDescription({ tipo: 'Celular', marca: 'Motorola', modelo: 'Moto G35' }),
    'celular, marca Motorola, modelo Moto G35',
  )
})

test('omite campos opcionais ausentes sem null, undefined ou vírgulas quebradas', () => {
  const description = buildEquipmentDeliveryDescription({
    tipo: 'Monitor',
    marca: 'LG',
    modelo: null,
    ram: undefined,
    armazenamento: '',
    processador: null,
    polegadas: '24 polegadas',
  })

  assert.equal(description, 'monitor, marca LG, tela de 24 polegadas')
  assert.doesNotMatch(description, /null|undefined|,\s*,/i)
})

test('formata a data real com mês por extenso e inicial maiúscula', () => {
  assert.equal(formatResponsibilityTermDate(new Date(2026, 7, 7)), 'Dom Eliseu / 07 de Agosto de 2026')
  assert.equal(formatResponsibilityTermDate(new Date(2026, 8, 15)), 'Dom Eliseu / 15 de Setembro de 2026')
})

test('obtém e normaliza o setor do próprio equipamento', () => {
  assert.equal(formatResponsibilityTermSector(' Fabrica 1 '), 'FABRICA 1')
  assert.equal(formatResponsibilityTermSector('financeiro'), 'FINANCEIRO')
  assert.equal(formatResponsibilityTermSector(undefined), '')
})

test('gera um PDF A4 íntegro, de uma página, com setor informado', () => {
  const assetDataUrl = (name) =>
    `data:image/png;base64,${readFileSync(new URL(`../public/responsibility-term/${name}`, import.meta.url)).toString('base64')}`
  const doc = createEquipmentResponsibilityTermPdf({
    tipo: 'Notebook',
    marca: 'DELL',
    modelo: 'LATITUDE 3420',
    ram: '8GB',
    armazenamento: '256GB SSD',
    processador: 'Intel Core i5',
    setor: 'Fabrica 1',
  }, new Date(2026, 7, 7), {
    logo: assetDataUrl('logo.png'),
    watermark: assetDataUrl('watermark.png'),
  })
  const bytes = new Uint8Array(doc.output('arraybuffer'))

  assert.equal(doc.getNumberOfPages(), 1)
  assert.equal(new TextDecoder().decode(bytes.subarray(0, 5)), '%PDF-')
  assert.ok(bytes.length > 5_000)
})
