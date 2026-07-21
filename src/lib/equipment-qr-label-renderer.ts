import type { EquipmentQrLabelSize } from './equipment-qr-labels'

export const ZEBRA_LABEL_DPI = 300
export const ZEBRA_LABEL_HEIGHT_PX = 472
export const ZEBRA_LABEL_WIDTH_PX = 1181

export const getLabelRenderSpec = (size: EquipmentQrLabelSize) => {
  const [widthMm, heightMm] = size.split('x').map(Number)
  return {
    widthMm,
    heightMm,
    widthPx: Math.round(widthMm / 25.4 * ZEBRA_LABEL_DPI),
    heightPx: Math.round(heightMm / 25.4 * ZEBRA_LABEL_DPI),
  }
}

const loadImage = (source: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error('image-load'))
  image.src = source
})

const canvasToPng = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('png-render')), 'image/png')
})

export async function renderEquipmentQrLabelPng(qrDataUrl: string | null, code: string, logoSource: string, size: EquipmentQrLabelSize, calibration = false): Promise<Blob> {
  const logo = await loadImage(logoSource)
  const qr = qrDataUrl ? await loadImage(qrDataUrl) : null
  const spec = getLabelRenderSpec(size)
  const canvas = document.createElement('canvas')
  canvas.width = spec.widthPx
  canvas.height = spec.heightPx
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas-unavailable')
  context.fillStyle = '#FFFFFF'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.strokeStyle = '#9CA3AF'
  context.lineWidth = 2
  context.strokeRect(1, 1, canvas.width - 2, canvas.height - 2)

  const margin = Math.round(3 / 25.4 * ZEBRA_LABEL_DPI)
  const qrSize = Math.min(Math.round(31 / 25.4 * ZEBRA_LABEL_DPI), canvas.height - margin * 2)
  const qrX = margin
  const qrY = Math.round((canvas.height - qrSize) / 2)
  context.imageSmoothingEnabled = false
  if (qr && !calibration) {
    context.drawImage(qr, qrX, qrY, qrSize, qrSize)
  } else {
    context.strokeStyle = '#64748B'
    context.lineWidth = 5
    context.strokeRect(qrX, qrY, qrSize, qrSize)
    context.beginPath()
    context.moveTo(qrX, qrY); context.lineTo(qrX + qrSize, qrY + qrSize)
    context.moveTo(qrX + qrSize, qrY); context.lineTo(qrX, qrY + qrSize)
    context.stroke()
    context.fillStyle = '#334155'
    context.textAlign = 'center'
    context.font = '700 30px Arial, sans-serif'
    context.fillText('TESTE', qrX + qrSize / 2, qrY + qrSize / 2 + 10)
  }

  const rightX = qrX + qrSize + margin
  const rightWidth = canvas.width - rightX - margin
  const logoMaxHeight = size === '100x40' ? 145 : 130
  const logoMaxWidth = Math.min(rightWidth - 20, size === '100x40' ? 220 : 250)
  const logoScale = Math.min(logoMaxWidth / logo.naturalWidth, logoMaxHeight / logo.naturalHeight)
  const logoWidth = Math.round(logo.naturalWidth * logoScale), logoHeight = Math.round(logo.naturalHeight * logoScale)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(logo, rightX + Math.round((rightWidth - logoWidth) / 2), 48, logoWidth, logoHeight)
  context.fillStyle = '#0F172A'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = '700 25px Arial, sans-serif'
  context.fillText(calibration ? 'PRÉVIA DE CALIBRAÇÃO' : 'PATRIMÔNIO', rightX + rightWidth / 2, 260)
  let codeFontSize = size === '100x40' ? 62 : 48
  context.font = `700 ${codeFontSize}px "Courier New", monospace`
  while (codeFontSize > 22 && context.measureText(code).width > rightWidth - 24) {
    codeFontSize -= 2
    context.font = `700 ${codeFontSize}px "Courier New", monospace`
  }
  context.fillText(code, rightX + rightWidth / 2, 350)
  return canvasToPng(canvas)
}

export const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.onerror = () => reject(new Error('image-read'))
  reader.readAsDataURL(blob)
})
