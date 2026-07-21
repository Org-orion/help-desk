import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatEquipmentQrDisplayCode,
  getServerCompatibleLabelSize,
  parseEquipmentQrUrl,
  validateBatchInput,
  validateLabelPrefix,
} from '../src/lib/equipment-qr-labels.ts'
import { createLabelImages, createZebraDataSheet, createZebraWorkbookSheets, excelSafe, isLocalLabelUrl, ZEBRA_HEADERS } from '../src/lib/equipment-qr-xlsx.ts'
import { getLabelRenderSpec, ZEBRA_LABEL_DPI, ZEBRA_LABEL_HEIGHT_PX, ZEBRA_LABEL_WIDTH_PX } from '../src/lib/equipment-qr-label-renderer.ts'
import writeXlsxFile from 'write-excel-file/node'
import { strFromU8, unzipSync } from 'fflate'
import QRCode from 'qrcode'

test('preserva zeros à esquerda e aplica prefixo sanitizado', () => {
  assert.equal(formatEquipmentQrDisplayCode(1, 3), '001')
  assert.equal(formatEquipmentQrDisplayCode(2, 4, ' con '), 'CON-0002')
})

test('valida limites do lote e caracteres do prefixo', () => {
  assert.match(validateLabelPrefix('CON<script>') ?? '', /letras ou números/)
  assert.equal(validateBatchInput({ quantity: 100, startNumber: 1, prefix: 'CON', digits: 3, labelSize: '60x40', columns: 3 }).length, 0)
  assert.equal(validateBatchInput({ quantity: 100, startNumber: 1, prefix: 'CON', digits: 3, labelSize: '100x40', columns: 1 }).length, 0)
  assert.ok(validateBatchInput({ quantity: 501, startNumber: 1, prefix: '', digits: 3, labelSize: '60x40', columns: 3 }).length > 0)
  assert.ok(validateBatchInput({ quantity: 1, startNumber: 0, prefix: '', digits: 3, labelSize: '60x40', columns: 3 }).length > 0)
  assert.ok(validateBatchInput({ quantity: 1.5, startNumber: 1, prefix: '', digits: 3, labelSize: '60x40', columns: 3 }).length > 0)
})

test('monta Dados Zebra com colunas exatas, textos e valores neutralizados', () => {
  const data = createZebraDataSheet([{ id: 'internal', displayCode: 'CON-001', status: 'UNUSED', equipmentId: null, createdAt: '2026-07-21T12:34:00.000Z', updatedAt: '2026-07-21T12:34:00.000Z', boundAt: null, revokedAt: null, publicUrl: '=HYPERLINK("unsafe")' }])
  assert.deepEqual(data[0].map(cell => cell.value), ZEBRA_HEADERS)
  assert.equal(data[1][0].value, 'CON-001')
  assert.equal(data[1][2].value, '001')
  assert.equal(data[1][4].value, `'=HYPERLINK("unsafe")`)
  assert.equal(data[1][0].format, '@')
  assert.equal(data[1][6].value, '21/07/2026 09:34')
  assert.ok(!JSON.stringify(data).includes('internal'))
  assert.equal(excelSafe('+SUM(A1:A2)'), "'+SUM(A1:A2)")
})

test('detecta URLs locais sem bloquear URLs públicas', () => {
  assert.equal(isLocalLabelUrl('http://localhost:8082/consulta/equipamento/token'), true)
  assert.equal(isLocalLabelUrl('http://127.0.0.1:8082/consulta/equipamento/token'), true)
  assert.equal(isLocalLabelUrl('https://helpdesk.example/consulta/equipamento/token'), false)
})

test('gera XLSX íntegro com Etiquetas primeiro e PNG completo em xl/media', async () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xw5nAAAAAElFTkSuQmCC'
  const labelPng = await (await fetch(png)).blob()
  const labels = [{ id: 'internal', displayCode: '001', status: 'UNUSED', equipmentId: null, createdAt: '2026-07-21T12:34:00.000Z', updatedAt: '2026-07-21T12:34:00.000Z', boundAt: null, revokedAt: null, publicUrl: 'http://localhost:8082/consulta/equipamento/token', qrDataUrl: png, labelPng, labelPngDataUrl: png }]
  const sheets = createZebraWorkbookSheets(labels, 1)
  const bytes = await writeXlsxFile(sheets).toBuffer()
  assert.equal(bytes.subarray(0, 2).toString(), 'PK')
  const files = unzipSync(bytes)
  const workbook = strFromU8(files['xl/workbook.xml'])
  assert.ok(workbook.indexOf('Etiquetas') < workbook.indexOf('Dados Zebra'))
  assert.equal(Object.keys(files).filter(name => name.startsWith('xl/media/')).length, 1)
  assert.match(strFromU8(files['xl/sharedStrings.xml']), /001/)
})

test('organiza uma, duas e várias etiquetas em grades de 1, 2 e 3 colunas', async () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xw5nAAAAAElFTkSuQmCC'
  const blob = await (await fetch(png)).blob()
  const labels = Array.from({ length: 7 }, (_, index) => ({ displayCode: String(index + 1).padStart(3, '0'), labelPng: blob }))
  for (const columns of [1, 2, 3]) {
    const images = createLabelImages(labels, columns, '60x40')
    images.forEach((image, index) => {
      assert.deepEqual(image.anchor, { row: Math.floor(index / columns) + 1, column: index % columns + 1 })
      assert.equal(image.width, 709)
      assert.equal(image.height, 472)
      assert.equal(image.dpi, 300)
    })
    assert.equal(new Set(images.map(image => `${image.anchor.row}:${image.anchor.column}`)).size, labels.length)
  }
  for (const [count, columns] of [[1, 1], [2, 2], [7, 3]]) {
    const complete = labels.slice(0, count).map((label, index) => ({ ...label, id: `test-${index}`, status: 'UNUSED', equipmentId: null, createdAt: '2026-07-21T12:34:00.000Z', updatedAt: '2026-07-21T12:34:00.000Z', boundAt: null, revokedAt: null, publicUrl: `http://localhost:8082/consulta/equipamento/token-${index}`, qrDataUrl: png, labelPngDataUrl: png }))
    const bytes = await writeXlsxFile(createZebraWorkbookSheets(complete, columns, '60x40')).toBuffer()
    const files = unzipSync(bytes)
    assert.equal(Object.keys(files).filter(name => name.startsWith('xl/media/')).length, count)
  }
  assert.deepEqual([ZEBRA_LABEL_WIDTH_PX, ZEBRA_LABEL_HEIGHT_PX, ZEBRA_LABEL_DPI], [1181, 472, 300])
  assert.deepEqual(getLabelRenderSpec('60x40'), { widthMm: 60, heightMm: 40, widthPx: 709, heightPx: 472 })
})

test('formato 100 x 40 mantém uma imagem por linha e proporção 2,5:1', () => {
  const blob = new Blob(['png'], { type: 'image/png' })
  const labels = Array.from({ length: 4 }, (_, index) => ({ displayCode: String(index + 1).padStart(3, '0'), labelPng: blob }))
  const images = createLabelImages(labels, 1, '100x40')
  assert.deepEqual(images.map(image => image.anchor), [{ row: 1, column: 1 }, { row: 2, column: 1 }, { row: 3, column: 1 }, { row: 4, column: 1 }])
  assert.ok(images.every(image => image.width === 1181 && image.height === 472 && image.dpi === 300))
  assert.equal(getLabelRenderSpec('100x40').widthMm / getLabelRenderSpec('100x40').heightMm, 2.5)
  assert.equal(getServerCompatibleLabelSize('100x40'), '60x40')
  assert.equal(getServerCompatibleLabelSize('60x40'), '60x40')
})

test('o QR recebe exatamente a URL retornada pelo servidor', () => {
  const url = 'http://localhost:8082/consulta/equipamento/token-existente'
  const qr = QRCode.create(url, { errorCorrectionLevel: 'M' })
  assert.equal(qr.segments.map(segment => typeof segment.data === 'string' ? segment.data : new TextDecoder().decode(segment.data)).join(''), url)
})

test('aceita somente URL pública da própria aplicação com token seguro', () => {
  const token = 'a'.repeat(43)
  assert.equal(parseEquipmentQrUrl(`https://helpdesk.example/consulta/equipamento/${token}`, 'https://helpdesk.example'), token)
  assert.equal(parseEquipmentQrUrl(`https://evil.example/consulta/equipamento/${token}`, 'https://helpdesk.example'), null)
  assert.equal(parseEquipmentQrUrl('https://helpdesk.example/q/001', 'https://helpdesk.example'), null)
})
