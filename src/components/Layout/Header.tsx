import { useSidebar } from './MainLayout'
import { Button } from '@/components/ui/button'
import { Menu, LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

const Header = () => {
  const { toggle } = useSidebar()
  const { logout } = useAuth()
  const navigate = useNavigate()
  return (
    <header className="h-16 border-b border-primary-hover bg-card flex items-center px-4">
      <Button variant="ghost" size="icon" onClick={toggle}>
        <Menu className="h-5 w-5" />
      </Button>
      <div className="ml-4 font-semibold">Concrem Portas Premium</div>
      <div className="ml-auto">
        <Button variant="ghost" size="icon" aria-label="Sair" onClick={() => { logout(); navigate('/'); }}>
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  )
}

export default Header
