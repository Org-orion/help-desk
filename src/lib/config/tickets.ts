import { AlertCircle, CircleDashed, CheckCircle2, AlertTriangle, Minus, ArrowDown } from 'lucide-react'

export const ticketStatusConfig = {
  'Aberto': {
    icon: AlertCircle,
    className: 'bg-rose-50 text-rose-700 border-rose-200',
    label: 'Aberto',
  },
  'Em Andamento': {
    icon: CircleDashed,
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    label: 'Em Andamento',
  },
  'Concluído': {
    icon: CheckCircle2,
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    label: 'Concluído',
  },
} as const

export type TicketStatus = keyof typeof ticketStatusConfig

export const getTicketStatusConfig = (status: string) =>
  ticketStatusConfig[status as TicketStatus] ?? ticketStatusConfig['Aberto']

export const ticketPriorityConfig = {
  'alta': {
    icon: AlertTriangle,
    className: 'bg-rose-50 text-rose-700 border-rose-200',
    label: 'Alta',
  },
  'media': {
    icon: Minus,
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    label: 'Média',
  },
  'baixa': {
    icon: ArrowDown,
    className: 'bg-slate-50 text-slate-600 border-slate-200',
    label: 'Baixa',
  },
} as const

export type TicketPriority = keyof typeof ticketPriorityConfig

export const getTicketPriorityConfig = (priority: string) =>
  ticketPriorityConfig[priority as TicketPriority] ?? ticketPriorityConfig['media']
