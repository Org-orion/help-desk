import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export const SearchInput = ({
  value,
  onChange,
  placeholder = 'Buscar...',
  className,
}: SearchInputProps) => (
  <div className="relative">
    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
    <Input
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn('h-11 pl-11 rounded-xl border-slate-200 bg-slate-50/60 focus:bg-white', className)}
    />
  </div>
)
