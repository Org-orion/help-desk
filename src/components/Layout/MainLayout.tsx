import { createContext, useContext, useMemo, useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import { useResponsiveContext } from '@/components/ResponsiveLayout'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useLocation } from 'react-router-dom'

interface SidebarContextValue {
  isCollapsed: boolean
  toggle: () => void
}

const SidebarContext = createContext<SidebarContextValue>({ isCollapsed: false, toggle: () => {} })

export const useSidebar = () => useContext(SidebarContext)

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const { isMobile } = useResponsiveContext();
  const { pathname } = useLocation()
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
    })
  }), [isCollapsed])

  return (
    <SidebarContext.Provider value={value}>
      <TooltipProvider>
        <div className="relative isolate flex min-h-screen w-full app-container overflow-hidden">
          {/* Mobile Overlay */}
          {isMobile && !isCollapsed && (
            <div
              className="fixed inset-0 bg-slate-950/45 backdrop-blur-[2px] z-40 animate-in fade-in duration-200"
              onClick={value.toggle}
              aria-hidden="true"
            />
          )}

          <Sidebar />

          <main className={cn(
            "relative flex-1 min-w-0 w-full h-screen overflow-y-auto transition-all duration-300 ease-in-out",
            isMobile ? "w-full" : ""
          )}>
            <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6 xl:px-8 xl:py-8">
              <div className="internal-page">{children}</div>
            </div>
          </main>
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  )
}

export default MainLayout
