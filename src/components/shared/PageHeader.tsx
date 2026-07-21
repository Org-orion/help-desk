import { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'

interface PageHeaderProps {
  title: string
  description: string
  icon: LucideIcon
  action?: ReactNode
}

export const PageHeader = ({ title, description, icon: Icon, action }: PageHeaderProps) => (
  <header className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
    <div className="min-w-0">
      <div className="mb-2 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 shadow-sm">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
      </div>
      <p className="max-w-3xl text-sm font-medium leading-6 text-slate-500 sm:text-base">{description}</p>
    </div>
    {action && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-shrink-0 sm:justify-end">{action}</div>}
  </header>
)
