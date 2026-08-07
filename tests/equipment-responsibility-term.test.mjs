import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  appendEquipmentPhotoPages,
  buildEquipmentDeliveryDescription,
  createEquipmentResponsibilityTermPdf,
  fitResponsibilityTermPhoto,
  formatResponsibilityTermDate,
  formatResponsibilityTermSector,
  orderEquipmentPhotosPrincipalFirst,
} from '../src/lib/equipment-responsibility-term.ts'

const PHOTO_DATA_URL = `data:image/png;base64,${readFileSync(new URL('../public/responsibility-term/logo.png', import.meta.url)).toString('base64')}`
const createPhoto = (index, width = 1600, height = 900) => ({
  dataUrl: PHOTO_DATA_URL,
  width,
  height,
  name: `foto-${index}.png`,
})

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

test('não cria página fotográfica quando o equipamento não possui imagens', () => {
  const doc = createEquipmentResponsibilityTermPdf({ tipo: 'Notebook' }, new Date(2026, 7, 7))
  const firstPageBefore = doc.internal.pages[1].join('\n')

  appendEquipmentPhotoPages(doc, { tipo: 'Notebook' }, [])

  assert.equal(doc.getNumberOfPages(), 1)
  assert.equal(doc.internal.pages[1].join('\n'), firstPageBefore)
})

test('adiciona 1, 2 e 4 imagens somente na segunda página', () => {
  for (const count of [1, 2, 4]) {
    const doc = createEquipmentResponsibilityTermPdf({ tipo: 'Tablet', patrimonio: 'TAB-001' })
    const firstPageBefore = doc.internal.pages[1].join('\n')

    appendEquipmentPhotoPages(doc, { tipo: 'Tablet', patrimonio: 'TAB-001' }, Array.from({ length: count }, (_, index) => createPhoto(index)))

    assert.equal(doc.getNumberOfPages(), 2)
    assert.equal(doc.internal.pages[1].join('\n'), firstPageBefore)
  }
})

test('cria páginas fotográficas adicionais a cada quatro imagens', () => {
  for (const [count, expectedPages] of [[5, 3], [8, 3], [9, 4]]) {
    const doc = createEquipmentResponsibilityTermPdf({ tipo: 'Celular' })
    appendEquipmentPhotoPages(doc, { tipo: 'Celular' }, Array.from({ length: count }, (_, index) => createPhoto(index)))
    assert.equal(doc.getNumberOfPages(), expectedPages)
  }
})

test('preserva a proporção de imagens verticais e horizontais', () => {
  assert.deepEqual(fitResponsibilityTermPhoto(1000, 2000, 80, 80), { width: 40, height: 80 })
  assert.deepEqual(fitResponsibilityTermPhoto(2000, 1000, 80, 80), { width: 80, height: 40 })
})

test('mantém a imagem principal antes das demais', () => {
  const ordered = orderEquipmentPhotosPrincipalFirst([
    { id: 'segunda', principal: false },
    { id: 'principal', principal: true },
    { id: 'terceira', principal: false },
  ])
  assert.deepEqual(ordered.map((image) => image.id), ['principal', 'segunda', 'terceira'])
})

test('busca fotos somente pelo id do equipamento selecionado no gerador', () => {
  const source = readFileSync(new URL('../src/pages/Equipamentos.tsx', import.meta.url), 'utf8')
  const handler = source.slice(source.indexOf('const handleDownloadPDF'), source.indexOf('const downloadQrCode'))
  assert.match(handler, /listEquipamentoImagens\(eq\.id\)/)
  assert.doesNotMatch(handler, /equipamento_pai_id|listEquipamentosVinculados/)
})
