import { jsPDF } from 'jspdf'

export type ResponsibilityTermEquipment = {
  nome?: string
  tipo?: string
  patrimonio?: string
  marca?: string
  modelo?: string
  ram?: string
  armazenamento?: string
  processador?: string
  polegadas?: string
  ghz?: string
  setor?: string
}

export type ResponsibilityTermAssets = {
  logo?: string | HTMLImageElement
  watermark?: string | HTMLImageElement
}

export type ResponsibilityTermPhoto = {
  dataUrl: string
  width: number
  height: number
  name?: string
}

const MONTHS_PT_BR = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const clean = (value: string | undefined) => value?.trim() || ''

const appendLabel = (label: string, value: string | undefined) => {
  const normalized = clean(value)
  return normalized ? `${label} ${normalized}` : ''
}

const appendSuffix = (value: string | undefined, suffix: string) => {
  const normalized = clean(value)
  if (!normalized) return ''
  return normalized.toLocaleLowerCase('pt-BR').includes(suffix.toLocaleLowerCase('pt-BR'))
    ? normalized
    : `${normalized} ${suffix}`
}

export const formatResponsibilityTermDate = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0')
  return `Dom Eliseu / ${day} de ${MONTHS_PT_BR[date.getMonth()]} de ${date.getFullYear()}`
}

export const formatResponsibilityTermSector = (sector: string | undefined) =>
  clean(sector).toLocaleUpperCase('pt-BR')

export const buildEquipmentDeliveryDescription = (equipment: ResponsibilityTermEquipment) => {
  const type = clean(equipment.tipo).toLocaleLowerCase('pt-BR') || 'equipamento'
  const details = [
    appendLabel('marca', equipment.marca),
    appendLabel('modelo', equipment.modelo),
    appendSuffix(equipment.ram, 'RAM'),
    clean(equipment.armazenamento),
    appendLabel('processador', equipment.processador),
    appendLabel('tela de', equipment.polegadas),
    appendLabel('frequência de', appendSuffix(equipment.ghz, 'GHz')),
    appendLabel('patrimônio', equipment.patrimonio),
  ].filter(Boolean)

  if (!details.length && clean(equipment.nome)) {
    details.push(`identificado como ${clean(equipment.nome)}`)
  }

  return [type, ...details].join(', ')
}

type Clause = { title: string; text: string }

const CLAUSES: Clause[] = [
  {
    title: 'Uso Exclusivo',
    text: 'O equipamento deverá ser utilizado ÚNICA e EXCLUSIVAMENTE a serviço da empresa, tendo em vista a atividade a ser exercida pelo USUÁRIO.',
  },
  {
    title: 'Responsabilidade',
    text: 'O USUÁRIO será responsável pelo uso e conservação do equipamento.',
  },
  {
    title: 'Detenção e Propriedade',
    text: 'O USUÁRIO detém apenas a posse do equipamento para a prestação de serviços profissionais e não a propriedade do mesmo. É terminantemente proibido o empréstimo, aluguel ou cessão deste a terceiros.',
  },
  {
    title: 'Devolução',
    text: 'Ao término da prestação de serviço ou do contrato individual de trabalho, o USUÁRIO compromete-se a devolver o equipamento em perfeito estado, no mesmo dia em que for comunicado ou comunique seu desligamento, considerando o desgaste natural pelo uso normal do equipamento.',
  },
]

const drawClause = (
  doc: jsPDF,
  index: number,
  clause: Clause,
  x: number,
  y: number,
  width: number,
) => {
  const lineHeight = 6.1
  const numberWidth = 7
  const textX = x + numberWidth
  const tokens = [
    ...`${clause.title}:`.split(' ').map((word) => ({ word, bold: true })),
    ...clause.text.split(' ').map((word) => ({ word, bold: false })),
  ]

  doc.setFont('helvetica', 'normal')
  doc.text(`${index}.`, x, y)

  let currentX = textX
  let currentY = y
  tokens.forEach(({ word, bold }) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    const text = `${word} `
    const wordWidth = doc.getTextWidth(text)
    if (currentX + wordWidth > x + width && currentX > textX) {
      currentX = textX
      currentY += lineHeight
    }
    doc.text(text, currentX, currentY)
    currentX += wordWidth
  })

  return currentY + lineHeight + 1.5
}

export const createEquipmentResponsibilityTermPdf = (
  equipment: ResponsibilityTermEquipment,
  issuedAt = new Date(),
  assets: ResponsibilityTermAssets = {},
) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 25
  const contentWidth = pageWidth - marginX - 22.5
  const green = '#00B050'

  doc.setDrawColor(green)
  doc.setLineWidth(0.55)
  doc.rect(8.5, 8.5, pageWidth - 17, pageHeight - 17)

  if (assets.watermark) {
    doc.setGState(new doc.GState({ opacity: 0.1 }))
    doc.addImage(assets.watermark, 'PNG', -14, 91, 139, 139, undefined, 'FAST')
    doc.setGState(new doc.GState({ opacity: 1 }))
  }

  if (assets.logo) {
    doc.addImage(assets.logo, 'PNG', (pageWidth - 80.7) / 2, 13.2, 80.7, 17.8, undefined, 'FAST')
  }

  doc.setTextColor(0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13.5)
  doc.text('TERMO DE RESPONSABILIDADE DE EQUIPAMENTO', pageWidth / 2, 38, { align: 'center' })

  const equipmentDescription = buildEquipmentDeliveryDescription(equipment)
  const intro =
    'CONCREM INDUSTRIAL LTDA, com matriz no endereço Rodovia BR 010, s/n° / KM 31, ' +
    `inscrita no CNPJ sob o nº 18.543.638/0001-34, neste ato, entrega de ${equipmentDescription} ` +
    'ao funcionário, doravante denominado simplesmente "USUÁRIO", sob as seguintes condições:'

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  const introLines = doc.splitTextToSize(intro, contentWidth)
  doc.text(introLines, pageWidth / 2, 49, { align: 'center' })

  let y = 49 + introLines.length * 5.2 + 7
  CLAUSES.forEach((clause, index) => {
    y = drawClause(doc, index + 1, clause, marginX, y, contentWidth)
  })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.text(formatResponsibilityTermDate(issuedAt), pageWidth - marginX, 190, { align: 'right' })

  const sector = formatResponsibilityTermSector(equipment.setor)
  if (sector) {
    doc.setFont('helvetica', 'bold')
    doc.text(`SETOR: ${sector}`, pageWidth - marginX, 202, { align: 'right' })
  }

  const leftCenter = 67
  const rightCenter = 143
  const signatureWidth = 57
  doc.setDrawColor(0)
  doc.setLineWidth(0.25)
  doc.line(leftCenter - signatureWidth / 2, 231, leftCenter + signatureWidth / 2, 231)
  doc.line(rightCenter - signatureWidth / 2, 231, rightCenter + signatureWidth / 2, 231)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.text('Assinatura do Colaborador', leftCenter, 237, { align: 'center' })
  doc.text('CPF do Colaborador', rightCenter, 237, { align: 'center' })

  doc.line(pageWidth / 2 - signatureWidth / 2, 257, pageWidth / 2 + signatureWidth / 2, 257)
  doc.text('Técnico de TI', pageWidth / 2, 263, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Rod. BR-010, Km 31, Interior - Cep 68633-000 Dom Eliseu-PA - Tel: (94) 98114-2020', pageWidth / 2, 280.5, { align: 'center' })
  doc.text('CNPJ: 18.543.638/0001-34 - IE: 15.417.865-9', pageWidth / 2, 285, { align: 'center' })

  return doc
}

export const orderEquipmentPhotosPrincipalFirst = <T extends { principal: boolean }>(photos: T[]) =>
  [...photos].sort((first, second) => Number(second.principal) - Number(first.principal))

export const fitResponsibilityTermPhoto = (
  imageWidth: number,
  imageHeight: number,
  maxWidth: number,
  maxHeight: number,
) => {
  if (imageWidth <= 0 || imageHeight <= 0) return { width: 0, height: 0 }
  const scale = Math.min(maxWidth / imageWidth, maxHeight / imageHeight)
  return { width: imageWidth * scale, height: imageHeight * scale }
}

const getPhotoFormat = (dataUrl: string) => {
  if (dataUrl.startsWith('data:image/png')) return 'PNG'
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP'
  return 'JPEG'
}

export const appendEquipmentPhotoPages = (
  doc: jsPDF,
  equipment: ResponsibilityTermEquipment,
  photos: ResponsibilityTermPhoto[],
) => {
  if (!photos.length) return doc

  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 18
  const columnGap = 8
  const rowGap = 10
  const frameWidth = (pageWidth - marginX * 2 - columnGap) / 2
  const frameHeight = 96
  const photosTop = 58
  const imagePadding = 4
  const captionHeight = 8
  const photosPerPage = 4

  for (let pageStart = 0; pageStart < photos.length; pageStart += photosPerPage) {
    doc.addPage()
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.text('REGISTRO FOTOGRÁFICO DO EQUIPAMENTO', pageWidth / 2, 22, { align: 'center' })

    const identification: string[] = []
    const patrimonio = clean(equipment.patrimonio)
    const nome = clean(equipment.nome)
    const tipo = clean(equipment.tipo)
    const marca = clean(equipment.marca)
    const modelo = clean(equipment.modelo)
    const equipmentBaseName = nome || tipo
    const equipmentName = [
      equipmentBaseName,
      marca && !equipmentBaseName.toLocaleLowerCase('pt-BR').includes(marca.toLocaleLowerCase('pt-BR')) ? marca : '',
    ].filter(Boolean).join(' ')
    if (patrimonio) identification.push(`Patrimônio: ${patrimonio}`)
    if (equipmentName) identification.push(`Equipamento: ${equipmentName}`)
    if (modelo) identification.push(`Modelo: ${modelo}`)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    identification.forEach((line, index) => doc.text(line, marginX, 32 + index * 5))
    doc.setDrawColor(210)
    doc.setLineWidth(0.3)
    doc.line(marginX, 51, pageWidth - marginX, 51)

    photos.slice(pageStart, pageStart + photosPerPage).forEach((photo, pageIndex) => {
      const column = pageIndex % 2
      const row = Math.floor(pageIndex / 2)
      const frameX = marginX + column * (frameWidth + columnGap)
      const frameY = photosTop + row * (frameHeight + rowGap)
      const maxImageWidth = frameWidth - imagePadding * 2
      const maxImageHeight = frameHeight - imagePadding * 2 - captionHeight
      const fitted = fitResponsibilityTermPhoto(photo.width, photo.height, maxImageWidth, maxImageHeight)
      const imageX = frameX + (frameWidth - fitted.width) / 2
      const imageY = frameY + imagePadding + (maxImageHeight - fitted.height) / 2

      doc.setDrawColor(190)
      doc.setLineWidth(0.3)
      doc.roundedRect(frameX, frameY, frameWidth, frameHeight, 1.5, 1.5)
      doc.addImage(photo.dataUrl, getPhotoFormat(photo.dataUrl), imageX, imageY, fitted.width, fitted.height, undefined, 'MEDIUM')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(90)
      doc.text(`Foto ${pageStart + pageIndex + 1}`, frameX + frameWidth / 2, frameY + frameHeight - 3, { align: 'center' })
    })
  }

  doc.setTextColor(0)
  return doc
}
