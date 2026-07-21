import { cn } from '@/lib/utils'
import { getProductStockConfig } from '@/lib/config/products'

interface StockBadgeProps {
  estoque: number
  showLabel?: boolean
  className?: string
}

export const StockBadge = ({ estoque, showLabel = false, className }: StockBadgeProps) => {
  const config = getProductStockConfig(estoque)
  const Icon = config.icon
  return (
    <div className={cn(
      'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold',
      config.className,
      className,
    )}>
      <Icon className="w-4 h-4" />
      {showLabel ? config.label : `${estoque} un.`}
    </div>
  )
}
