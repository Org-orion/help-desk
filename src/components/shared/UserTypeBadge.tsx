import { Badge } from '@/components/ui/badge'
import { Shield, Sparkles, UserRound } from 'lucide-react'

interface UserTypeInfo {
  tipo: 'vip' | 'padrao' | 'admin' | string
  isAdmin?: boolean
}

export const getUserTypeLabel = (user: UserTypeInfo): string => {
  if (user.isAdmin || user.tipo === 'admin') return 'Administrador'
  if (user.tipo === 'vip') return 'VIP'
  return 'Padrão'
}

interface UserTypeBadgeProps {
  user: UserTypeInfo
}

export const UserTypeBadge = ({ user }: UserTypeBadgeProps) => {
  if (user.isAdmin || user.tipo === 'admin') {
    return (
      <Badge className="rounded-full px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-50">
        <Shield className="w-3.5 h-3.5 mr-1" />
        ADMIN
      </Badge>
    )
  }

  if (user.tipo === 'vip') {
    return (
      <Badge className="rounded-full px-3 py-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white border-0 shadow-sm hover:from-violet-500 hover:to-fuchsia-500">
        <Sparkles className="w-3.5 h-3.5 mr-1" />
        VIP
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="rounded-full px-3 py-1 border-slate-200 bg-slate-50 text-slate-600">
      <UserRound className="w-3.5 h-3.5 mr-1" />
      PADRÃO
    </Badge>
  )
}
