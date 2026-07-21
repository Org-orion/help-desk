import { cn } from '@/lib/utils'
import { getTicketStatusConfig } from '@/lib/config/tickets'

interface StatusBadgeProps {
  status: string
  className?: string
}

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const config = getTicketStatusConfig(status)
  const Icon = config.icon
  return (
    <div className={cn(
      'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold',
      config.className,
      className,
    )}>
      <Icon className="w-4 h-4" />
      {status}
    </div>
  )
}
