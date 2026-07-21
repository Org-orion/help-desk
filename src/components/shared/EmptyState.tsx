import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
}

export const EmptyState = ({ icon: Icon, title, description }: EmptyStateProps) => (
  <div className="px-6 py-16 text-center sm:py-20">
    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
      <Icon className="h-7 w-7 text-slate-400" />
    </div>
    <h3 className="text-xl font-bold text-slate-900">{title}</h3>
    <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-slate-500">{description}</p>
  </div>
)
