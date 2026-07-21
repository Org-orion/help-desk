import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: string | number
  accent: string
  icon: LucideIcon
  description?: string
}

export const MetricCard = ({ label, value, accent, icon: Icon, description }: MetricCardProps) => (
  <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_10px_30px_rgba(15,23,42,0.07)]">
    <div className={cn('flex gap-3', description ? 'items-start' : 'items-center')}>
      <div className={cn('p-2.5 rounded-xl shrink-0 ring-1 ring-inset ring-black/[0.04]', accent)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-extrabold tabular-nums text-slate-950 leading-none">{value}</div>
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.14em] mt-2">{label}</div>
        {description && <p className="text-xs text-slate-400 mt-2 line-clamp-2">{description}</p>}
      </div>
    </div>
  </div>
)
