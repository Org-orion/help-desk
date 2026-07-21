import { cn } from '@/lib/utils'
import { getTicketPriorityConfig } from '@/lib/config/tickets'

interface PriorityBadgeProps {
  priority: string
  className?: string
}

export const PriorityBadge = ({ priority, className }: PriorityBadgeProps) => {
  const config = getTicketPriorityConfig(priority)
  const Icon = config.icon
  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide',
      config.className,
      className,
    )}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </div>
  )
}
