export const PUBLIC_EQUIPMENT_QR_UNAVAILABLE_MESSAGE =
  'A consulta não pôde ser concluída. Tente novamente em instantes.'

export const PUBLIC_EQUIPMENT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,128}$/

export type PublicEquipmentDTO = {
  nome: string
  patrimonio: string
  tipo: string
  marca: string | null
  modelo: string | null
  statusOperacional: string
  setor: string | null
  ram: string | null
  armazenamento: string | null
  cpu: string | null
  imagemPrincipalUrl: string | null
  atualizadoEm: string | null
}

export type PublicEquipmentSource = {
  nome: string
  patrimonio: string
  tipo: string
  marca?: string | null
  modelo?: string | null
  status: string
  setor?: string | null
  ram?: string | null
  armazenamento?: string | null
  processador?: string | null
  imagem_principal_url?: string | null
  updated_at?: string | null
}

/** Converts a server-selected record into the only shape allowed in public responses. */
export function toPublicEquipmentDTO(source: PublicEquipmentSource): PublicEquipmentDTO {
  return {
    nome: source.nome,
    patrimonio: source.patrimonio,
    tipo: source.tipo,
    marca: source.marca ?? null,
    modelo: source.modelo ?? null,
    statusOperacional: source.status,
    setor: source.setor ?? null,
    ram: source.ram ?? null,
    armazenamento: source.armazenamento ?? null,
    cpu: source.processador ?? null,
    imagemPrincipalUrl: source.imagem_principal_url ?? null,
    atualizadoEm: source.updated_at ?? null,
  }
}
