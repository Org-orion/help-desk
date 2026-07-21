import { CheckCircle2, Activity, Settings2, XCircle } from 'lucide-react'
import {
  Laptop, Cpu, Monitor, Tablet, Smartphone, Printer, Package,
} from 'lucide-react'

export const equipmentStatusConfig = {
  'Disponível': {
    label: 'Disponível',
    color: 'text-blue-600 bg-blue-50 border-blue-100',
    icon: CheckCircle2,
  },
  'Em Uso': {
    label: 'Em Uso',
    color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    icon: Activity,
  },
  'Manutenção': {
    label: 'Manutenção',
    color: 'text-amber-600 bg-amber-50 border-amber-100',
    icon: Settings2,
  },
  'Inativo': {
    label: 'Inativo',
    color: 'text-slate-500 bg-slate-50 border-slate-100',
    icon: XCircle,
  },
} as const

export type EquipmentStatus = keyof typeof equipmentStatusConfig

export const getEquipmentStatusConfig = (status: string) =>
  equipmentStatusConfig[status as EquipmentStatus] ?? equipmentStatusConfig['Disponível']

const equipmentTypeIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'Notebook': Laptop,
  'Desktop': Cpu,
  'Monitor': Monitor,
  'Tablet': Tablet,
  'Smartphone': Smartphone,
  'Impressora': Printer,
}

export const getEquipmentTypeIcon = (tipo: string) =>
  equipmentTypeIconMap[tipo] ?? Package
