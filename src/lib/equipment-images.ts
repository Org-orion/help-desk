export const EQUIPMENT_IMAGES_BUCKET = 'equipamento-imagens'
export const EQUIPMENT_IMAGE_MAX_SIZE = 10 * 1024 * 1024

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const allowedExtensions = new Set(['jpg', 'jpeg', 'png', 'webp'])

export async function validateEquipmentImage(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!allowedExtensions.has(extension) || !allowedImageTypes.has(file.type)) throw new Error(`${file.name}: formato inválido. Use JPG, PNG ou WebP.`)
  if (file.size > EQUIPMENT_IMAGE_MAX_SIZE) throw new Error(`${file.name}: o arquivo excede 10 MB.`)
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  if ((file.type === 'image/jpeg' && !jpeg) || (file.type === 'image/png' && !png) || (file.type === 'image/webp' && !webp)) {
    throw new Error(`${file.name}: o conteúdo do arquivo não corresponde a uma imagem válida.`)
  }
}
