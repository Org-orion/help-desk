import { Package, AlertTriangle, CircleAlert } from 'lucide-react'

export const getProductStockConfig = (stock: number) => {
  if (stock <= 3) return {
    label: 'Crítico',
    className: 'bg-rose-50 text-rose-700 border-rose-200',
    accent: 'bg-rose-50 text-rose-700',
    icon: CircleAlert,
  }
  if (stock <= 10) return {
    label: 'Baixo',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    accent: 'bg-amber-50 text-amber-700',
    icon: AlertTriangle,
  }
  return {
    label: 'OK',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    accent: 'bg-emerald-50 text-emerald-700',
    icon: Package,
  }
}
