import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import MainLayout from "./components/Layout/MainLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AnaliseEquipamentos from "./pages/AnaliseEquipamentos";
import AnaliseServicos from "./pages/AnaliseServicos";
import Equipamentos from "./pages/Equipamentos";
import Chamados from "./pages/Chamados";
import Usuarios from "./pages/Usuarios";
import Produtos from "./pages/Produtos";
import Setores from "./pages/Setores";
import Relatorios from "./pages/Relatorios";
import NotFound from "./pages/NotFound";
import PublicEquipment from "./pages/PublicEquipment";
import { supabase } from "./lib/supabase";
import { useEffect } from "react";
import { toast } from "sonner";
import { listUsuarios, createUsuario } from "@/lib/api/usuarios";
import { ThemeProvider } from "next-themes";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
 

const queryClient = new QueryClient();
const isPublicEquipmentPath = /^\/consulta\/equipamento(?:\/[^/]+)?\/?$/.test(window.location.pathname);

const LoginRoute = () => {
  const { isAuthenticated, user } = useAuth();
  if (isAuthenticated) {
    const destination = user?.role === 'admin' || user?.tier === 'vip' ? '/dashboard' : '/chamados';
    return <Navigate to={destination} replace />;
  }
  return <Login />;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user, loading } = useAuth();
  const { pathname } = useLocation();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/" />
  const isAdmin = user?.role === 'admin'
  const isVip = user?.tier === 'vip' && !isAdmin
  if (!isAdmin) {
    const allowed = isVip ? ['/dashboard', '/chamados', '/dashboard/equipamentos', '/dashboard/servicos'] : ['/chamados']
    if (!allowed.includes(pathname)) {
      return <Navigate to="/chamados" />
    }
  }
  return (
    <ResponsiveLayout>
      <MainLayout>{children}</MainLayout>
    </ResponsiveLayout>
  );
};

const router = createBrowserRouter([
  { path: "/", element: <LoginRoute /> },
  { path: "/consulta/equipamento", element: <PublicEquipment /> },
  { path: "/consulta/equipamento/:token", element: <PublicEquipment /> },
  { path: "/dashboard", element: <ProtectedRoute><Dashboard /></ProtectedRoute> },
  { path: "/dashboard/equipamentos", element: <ProtectedRoute><AnaliseEquipamentos /></ProtectedRoute> },
  { path: "/dashboard/servicos", element: <ProtectedRoute><AnaliseServicos /></ProtectedRoute> },
  { path: "/equipamentos", element: <ProtectedRoute><Equipamentos /></ProtectedRoute> },
  { path: "/chamados", element: <ProtectedRoute><Chamados /></ProtectedRoute> },
  { path: "/usuarios", element: <ProtectedRoute><Usuarios /></ProtectedRoute> },
  { path: "/produtos", element: <ProtectedRoute><Produtos /></ProtectedRoute> },
  { path: "/setores", element: <ProtectedRoute><Setores /></ProtectedRoute> },
  { path: "/relatorios", element: <ProtectedRoute><Relatorios /></ProtectedRoute> },
  { path: "*", element: <NotFound /> },
], {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
  },
});

const App = () => {
  useEffect(() => {
    if (isPublicEquipmentPath) return;
    (async () => {
      try {
        const verifyOnStart = (import.meta.env.VITE_SUPABASE_VERIFY_ON_START ?? '0') === '1'
        if (!verifyOnStart) return
        const supabaseEnabled = (import.meta.env.VITE_ENABLE_SUPABASE ?? '1') !== '0'
        if (!supabaseEnabled) {
          toast.info("Supabase desativado em desenvolvimento");
          return
        }
        const urlOk = Boolean(import.meta.env.VITE_SUPABASE_URL)
        const keyOk = Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY)
        if (!urlOk || !keyOk) {
          toast.error("Env Supabase ausente: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env");
          return
        }
        if (!supabase) {
          toast.error("Cliente Supabase não inicializado");
          return
        }
        const { error } = await supabase.from("produtos").select("id").limit(1)
        if (error) {
          toast.error("Conectado, mas schema não visível na API. Aplique supabase/schema.sql e resete o API cache.");
        }
      } catch {
        toast.error("Conexão Supabase indisponível");
      }
    })();
  }, []);

  useEffect(() => {
    if (isPublicEquipmentPath) return;
    (async () => {
      try {
        const bootstrap = (import.meta.env.VITE_BOOTSTRAP_ADMIN ?? '0') === '1'
        if (!bootstrap) return
        const rows = await listUsuarios()
        const hasAdmin = (rows ?? []).some(u => u.tier === 'admin' || !!u.is_admin)
        if (hasAdmin) return
        await createUsuario({ nome: 'ADMIN KMZ', username: 'admin', password: 'admin', tipo: 'admin' })
        toast.success('Usuário admin criado: admin/admin')
      } catch {
        toast.info('Criação automática do admin indisponível')
      }
    })();
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Sonner />
          {isPublicEquipmentPath ? (
            <RouterProvider router={router} />
          ) : (
            <AuthProvider>
              <RouterProvider router={router} future={{ v7_startTransition: true, v7_relativeSplatPath: true }} />
            </AuthProvider>
          )}
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
