import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useSidebar } from './MainLayout'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Shield,
  HardHat,
  BarChart3,
  TrendingUp,
  Settings,
  ChevronDown,
  ChevronRight,
  Building2,
  Users,
  Tag,
  LogOut,
  User,
  Menu,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { LOGO_MINI_SRC } from '@/config/branding'
import { useResponsiveContext } from '@/components/ResponsiveLayout'

const navigationGroups = [
  {
    label: 'Operação',
    adminOnly: false,
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { title: 'Chamados', href: '/chamados', icon: Shield },
    ]
  },
  {
    label: 'Gestão',
    adminOnly: true,
    items: [
      { title: 'Gestão de Ativos', href: '/equipamentos', icon: HardHat },
    ]
  },
  {
    label: 'Análises',
    adminOnly: true,
    items: [
      { title: 'Relatórios', href: '/relatorios', icon: BarChart3 },
      { title: 'Análise de Equipamentos', href: '/dashboard/equipamentos', icon: HardHat },
      { title: 'Análise de Serviços', href: '/dashboard/servicos', icon: TrendingUp },
    ]
  }
]

const cadastrosItems = [
  { title: 'Usuários', href: '/usuarios', icon: Users },
  { title: 'Produtos', href: '/produtos', icon: Tag },
  { title: 'Setores', href: '/setores', icon: Building2 },
]

const Sidebar = () => {
  const { isCollapsed, toggle } = useSidebar()
  const { isMobile } = useResponsiveContext()
  const { pathname } = useLocation()
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const [cadastrosOpen, setCadastrosOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  const anyCadastrosActive = cadastrosItems.some((c) => isActive(c.href))

  const inactiveIconClass = 'text-emerald-50/55 group-hover:text-emerald-50/90'
  const activeIconClass = 'text-emerald-50'

  return (
    <aside className={cn(
      'h-screen basis-[248px] bg-[#012611] text-white transition-[width,basis,transform] duration-300 ease-in-out flex flex-col z-50 border-r border-emerald-950/40 shadow-2xl shrink-0',
      isMobile ? 'fixed inset-y-0 left-0' : 'relative',
      isCollapsed ? 'w-[76px] basis-[76px]' : 'w-[244px] basis-[244px]',
      isMobile && isCollapsed && '-translate-x-full'
    )}>
      {/* Mobile Toggle Button */}
      {isMobile && isCollapsed && (
        <button 
          onClick={toggle}
          className="fixed top-4 left-4 z-[60] p-2 bg-[#075924] text-white rounded-lg shadow-lg lg:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>
      )}

      {/* Header */}
      <button
        type="button"
        onClick={toggle}
        aria-label={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
        title={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
        className={cn(
          'flex w-full cursor-pointer items-center border-0 border-b border-emerald-900/40 bg-transparent bg-gradient-to-b from-emerald-400/5 to-transparent px-4 py-4 text-left outline-none transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-300/70',
          isCollapsed ? 'justify-center' : 'gap-3'
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 ring-1 ring-inset ring-emerald-300/10">
          <img src={LOGO_MINI_SRC} alt="CONCREM" className="h-5 w-auto object-contain" />
        </span>
        {!isCollapsed && (
          <span className="min-w-0">
            <span className="block text-sm font-semibold leading-none tracking-tight text-white">CONCREM</span>
            <span className="mt-1 block text-[11px] font-medium leading-none text-emerald-100/55">Help Desk</span>
          </span>
        )}
      </button>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-3 custom-scrollbar scrollbar-hidden" key={isCollapsed ? 'collapsed' : 'expanded'}>
        {navigationGroups.filter(g => !g.adminOnly || user?.role === 'admin').map((group) => (
          <div key={group.label} className="space-y-1">
            {!isCollapsed && (
              <h3 className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100/28 animate-in fade-in duration-500">
                {group.label}
              </h3>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <div key={item.href}>
                  <Tooltip delayDuration={0} disableHoverableContent>
                    <TooltipTrigger asChild>
                      <Link to={item.href}>
                        <Button 
                          variant="ghost" 
                          className={cn(
                            'group relative h-8 transition-all duration-300 px-3 py-1.5 w-full justify-start rounded-lg text-[13px] border border-transparent shadow-none before:absolute before:left-0 before:top-1/2 before:h-4 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:transition-all', 
                            isActive(item.href) 
                              ? 'bg-emerald-400/10 text-white border-emerald-300/10 before:bg-emerald-400' 
                              : 'text-emerald-50/62 hover:text-emerald-50 hover:bg-white/[0.045] before:bg-transparent',
                            isCollapsed && 'justify-center px-0'
                          )}
                        >
                          <item.icon className={cn(
                            "h-4 w-4 shrink-0 transition-colors",
                            isActive(item.href) ? activeIconClass : inactiveIconClass
                          )} />
                          {!isCollapsed && (
                            <span className="ml-3 truncate font-medium tracking-tight animate-in fade-in slide-in-from-left-2 duration-300">
                              {item.title}
                            </span>
                          )}
                        </Button>
                      </Link>
                    </TooltipTrigger>
                    {isCollapsed && (
                      <TooltipContent side="right" className="font-bold bg-[#075924] border-white/10 text-white animate-in zoom-in-95 duration-150">
                        {item.title}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Submenu Cadastros - Admin only */}
        {user?.role === 'admin' && <div className="space-y-1">
          {!isCollapsed && (
            <h3 className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100/28">
              Sistema
            </h3>
          )}
          <div className="space-y-0.5">
            <Tooltip delayDuration={0} disabled={!isCollapsed} disableHoverableContent>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  onClick={() => setCadastrosOpen(!cadastrosOpen)}
                  className={cn(
                    'group relative h-8 transition-all duration-300 px-3 py-1.5 w-full justify-start rounded-lg text-[13px] border border-transparent shadow-none before:absolute before:left-0 before:top-1/2 before:h-4 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:transition-all',
                    (anyCadastrosActive || cadastrosOpen) ? 'bg-emerald-400/10 text-white border-emerald-300/10 before:bg-emerald-400' : 'text-emerald-50/62 hover:text-emerald-50 hover:bg-white/[0.045] before:bg-transparent',
                    isCollapsed && 'justify-center px-0'
                  )}
                >
                  <Settings className={cn("h-4 w-4 shrink-0", anyCadastrosActive ? activeIconClass : inactiveIconClass)} />
                  {!isCollapsed && (
                    <>
                      <span className="ml-3 truncate font-medium tracking-tight">Cadastros</span>
                      {cadastrosOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 ml-auto opacity-40" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-40" />
                      )}
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              {isCollapsed && <TooltipContent side="right" className="text-white animate-in zoom-in-95 duration-150">Cadastros</TooltipContent>}
            </Tooltip>
            
            {!isCollapsed && cadastrosOpen && (
              <div className="ml-7 mt-1 space-y-0.5 border-l border-emerald-100/10 animate-in fade-in slide-in-from-top-1 duration-300">
                {cadastrosItems.map((item) => (
                  <Link to={item.href} key={item.href}>
                    <Button 
                      variant="ghost" 
                      className={cn(
                        'w-full justify-start h-7 px-4 text-[12px] font-medium transition-colors rounded-md', 
                        isActive(item.href) ? 'text-white bg-white/[0.03]' : 'text-emerald-50/45 hover:text-emerald-50 hover:bg-transparent'
                      )}
                    >
                      <item.icon className="h-3.5 w-3.5 mr-3 shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </Button>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>}
      </nav>

      {/* Footer */}
      <div className="p-3 mt-auto border-t border-emerald-950/40 bg-black/20">
        <div className="space-y-2">
          <Tooltip delayDuration={0} disabled={!isCollapsed}>
            <TooltipTrigger asChild>
              <div className={cn(
                'flex items-center rounded-lg transition-all duration-300', 
                isCollapsed ? 'justify-center p-0' : 'gap-2.5 px-2 py-2 bg-white/[0.03]'
              )}>
                <div className="h-7 w-7 rounded-lg bg-emerald-400/10 ring-1 ring-inset ring-emerald-300/10 flex items-center justify-center shrink-0 overflow-hidden">
                  <User className="h-3.5 w-3.5 text-emerald-50" />
                </div>
                {!isCollapsed && (
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-[12px] font-semibold tracking-tight text-white leading-tight">{user?.name || 'KMZ'}</span>
                    <span className="truncate text-[10px] font-medium text-emerald-100/38 leading-none mt-0.5">
                      {user?.role === 'admin' ? 'Administrador' : user?.tier === 'vip' ? 'Acesso VIP' : 'Usuário padrão'}
                    </span>
                  </div>
                )}
              </div>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right" className="text-white">{user?.name || 'Usuário'}</TooltipContent>}
          </Tooltip>

          <div className="flex flex-col gap-0.5">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  onClick={() => { logout(); navigate('/') }}
                  className={cn('h-8 text-rose-300/62 hover:text-rose-200 hover:bg-rose-500/10 w-full justify-start px-3 text-[11px] border-none shadow-none', isCollapsed && 'justify-center px-0')}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {!isCollapsed && <span className="ml-3 font-medium tracking-tight">Sair do sistema</span>}
                </Button>
              </TooltipTrigger>
              {isCollapsed && <TooltipContent side="right" className="text-white">Sair</TooltipContent>}
            </Tooltip>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
