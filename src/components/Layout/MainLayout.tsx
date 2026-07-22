import { createContext, useContext, useMemo, useState, useEffect, useRef } from 'react'
import Sidebar from './Sidebar'
import { useResponsiveContext } from '@/components/ResponsiveLayout'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SidebarContextValue {
  isCollapsed: boolean
  toggle: () => void
  closeMobile: () => void
}

const SidebarContext = createContext<SidebarContextValue>({ isCollapsed: false, toggle: () => {}, closeMobile: () => {} })

export const useSidebar = () => useContext(SidebarContext)

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const { isMobile } = useResponsiveContext();
  const { pathname } = useLocation()
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null)
  const mobileDrawerWasOpen = useRef(false)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('sidebar_collapsed') : null
      return saved ? saved === '1' : false // Start expanded by default
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (isMobile) setIsCollapsed(true)
  }, [isMobile, pathname])

  useEffect(() => {
    if (!isMobile || isCollapsed) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isMobile, isCollapsed])

  useEffect(() => {
    const drawerOpen = isMobile && !isCollapsed
    if (mobileDrawerWasOpen.current && !drawerOpen) {
      window.requestAnimationFrame(() => mobileMenuButtonRef.current?.focus())
    }
    mobileDrawerWasOpen.current = drawerOpen
  }, [isMobile, isCollapsed])

  const value = useMemo(() => ({
    isCollapsed,
    toggle: () => setIsCollapsed((v) => {
      const next = !v
      try {
        if (typeof window !== 'undefined') localStorage.setItem('sidebar_collapsed', next ? '1' : '0')
      } catch {
        // A preferência visual é opcional quando o armazenamento está indisponível.
      }
      return next
    }),
    closeMobile: () => setIsCollapsed(true),
  }), [isCollapsed])

  return (
    <SidebarContext.Provider value={value}>
      <TooltipProvider>
        <div className="relative isolate flex min-h-screen w-full app-container overflow-hidden">
          {/* Mobile Overlay */}
          {isMobile && !isCollapsed && (
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default bg-slate-950/55 backdrop-blur-[2px] animate-in fade-in duration-200"
              onClick={value.toggle}
              aria-label="Fechar menu"
              tabIndex={-1}
            />
          )}

          <Sidebar />

          <main className={cn(
            "relative flex-1 min-w-0 w-full h-screen transition-all duration-300 ease-in-out",
            isMobile ? "w-full" : "",
            isMobile && !isCollapsed ? "overflow-hidden" : "overflow-y-auto"
          )} aria-hidden={isMobile && !isCollapsed ? true : undefined}>
            <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6 xl:px-8 xl:py-8">
              {isMobile && (
                <div className="mb-4 flex h-11 items-center">
                  <Button
                    ref={mobileMenuButtonRef}
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={value.toggle}
                    aria-label={isCollapsed ? 'Abrir menu' : 'Fechar menu'}
                    aria-expanded={!isCollapsed}
                    aria-controls="mobile-navigation-drawer"
                    className="h-11 w-11 rounded-xl border-slate-200 bg-white text-slate-700 shadow-sm focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                  >
                    <Menu className="h-5 w-5" aria-hidden="true" />
                  </Button>
                </div>
              )}
              <div className="internal-page">{children}</div>
            </div>
          </main>
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  )
}

export default MainLayout
