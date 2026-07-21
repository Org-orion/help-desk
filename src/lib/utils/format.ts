export const formatMinutes = (minutes?: number | null): string => {
  if (minutes == null || isNaN(minutes)) return '-'
  const m = Math.max(0, Math.floor(minutes))
  if (m < 60) return `${m}m`
  const hours = Math.floor(m / 60)
  const remMin = m % 60
  if (hours < 24) return remMin > 0 ? `${hours}h ${remMin}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  const remH = hours % 24
  return remH > 0 ? `${days}d ${remH}h` : `${days}d`
}

const parseDateStr = (value: string): Date | null => {
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const dt = isDateOnly ? new Date(`${value}T00:00:00`) : new Date(value)
  return isNaN(dt.getTime()) ? null : dt
}

export const formatDate = (value?: string | null): string => {
  if (!value) return '-'
  const dt = parseDateStr(value)
  if (!dt) return value
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export const formatDateLong = (value?: string | null): string => {
  if (!value) return 'Sem data'
  const dt = parseDateStr(value)
  if (!dt) return value
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export const formatDateTime = (value?: string | null): string => {
  if (!value) return '-'
  const dt = parseDateStr(value)
  if (!dt) return '-'
  return dt.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
