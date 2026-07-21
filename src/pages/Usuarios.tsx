import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Plus,
  Search,
  Eye,
  PencilLine,
  Trash2,
  MoreHorizontal,
  Crown,
  Shield,
  UserRound,
  Building2,
  AtSign,
  Users,
} from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createUsuario, updateUsuario, deleteUsuario } from '@/lib/api/usuarios'
import { listUsuarios, type Usuario } from '@/lib/api/usuarios'
import { listSetores, createSetor, type Setor as SetorType } from '@/lib/api/setores'
import { supabase } from '@/lib/supabase'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { MetricCard, UserTypeBadge, getUserTypeLabel } from '@/components/shared'

interface User {
  id: string
  nome: string
  username: string
  setor: string
  password: string
  tipo: 'vip' | 'padrao' | 'admin'
  isAdmin?: boolean
}

const Usuarios = () => {
  const queryClient = useQueryClient()
  const supabaseEnabled = (import.meta.env.VITE_ENABLE_SUPABASE ?? '1') !== '0' && !!supabase
  const { data: usuariosData, isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => {
      const rows = await listUsuarios()
      return rows.map(r => ({
        id: r.id,
        nome: (r.name || '').toUpperCase(),
        username: r.username || '',
        setor: (r.setor || '').toUpperCase(),
        password: '',
        tipo: r.tier || 'padrao',
        isAdmin: !!r.is_admin || r.tier === 'admin'
      })) as User[]
    },
    staleTime: 1000 * 30,
  })
  const usuarios = (usuariosData ?? []) as User[]
  const { data: setoresData } = useQuery({
    queryKey: ['setores'],
    queryFn: async () => await listSetores(),
    staleTime: 1000 * 60,
  })
  const setoresOptions = (setoresData ?? [])
    .map((s: SetorType) => (s.nome || '').toUpperCase())
    .sort((a, b) => a.localeCompare(b, 'pt', { sensitivity: 'base' }))

  const [searchTerm, setSearchTerm] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [addSectorOpen, setAddSectorOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    nome: '',
    username: '',
    setor: '',
    password: '',
    tipo: 'padrao' as User['tipo'],
  })
  const [newSector, setNewSector] = useState({ nome: '' })

  const createMut = useMutation({
    mutationFn: async () => {
      return await createUsuario({ ...formData })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      setFormData({ nome: '', username: '', setor: '', password: '', tipo: 'padrao' })
      setDialogOpen(false)
      toast.success('Usuário cadastrado com sucesso!')
    },
    onError: () => toast.error('Falha ao cadastrar usuário')
  })
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMut.mutate()
  }

  const filteredUsers = useMemo(() => {
    const st = (searchTerm || '').toLowerCase()
    return (usuarios ?? []).filter((user) => {
      return (
        (user.nome || '').toLowerCase().includes(st) ||
        (user.username || '').toLowerCase().includes(st) ||
        (user.setor || '').toLowerCase().includes(st)
      )
    })
  }, [usuarios, searchTerm])

  const sortedUsers = useMemo(
    () => [...filteredUsers].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt', { sensitivity: 'base' })),
    [filteredUsers]
  )

  const stats = useMemo(() => {
    const total = sortedUsers.length
    const admins = sortedUsers.filter((user) => user.isAdmin || user.tipo === 'admin').length
    const vips = sortedUsers.filter((user) => user.tipo === 'vip').length
    const padrao = sortedUsers.filter((user) => !user.isAdmin && user.tipo === 'padrao').length
    return { total, admins, vips, padrao }
  }, [sortedUsers])

  const handleView = (user: User) => {
    setSelectedUser(user)
    setViewOpen(true)
  }

  const handleEdit = (user: User) => {
    setSelectedUser(user)
    setFormData({ nome: user.nome, username: user.username, setor: user.setor, password: '', tipo: user.tipo })
    setEditOpen(true)
  }

  const updateMut = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<User> }) => {
      return await updateUsuario(id, {
        nome: input.nome,
        username: input.username,
        setor: input.setor,
        password: input.password,
        tipo: input.tipo,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      setEditOpen(false)
      toast.success('Usuário atualizado')
    },
    onError: () => toast.error('Falha ao atualizar usuário')
  })
  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      return await deleteUsuario(id)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      toast.success('Usuário excluído')
    },
    onError: () => toast.error('Falha ao excluir usuário')
  })
  const handleDelete = (id: string) => {
    deleteMut.mutate(id)
  }

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Usuários</h1>
          </div>
          <p className="text-slate-500 font-medium text-lg">Lista moderna para visualizar perfis, permissões e setor com mais clareza.</p>
        </div>
        <Button className="h-11 px-5 rounded-xl font-semibold" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      {/* ── Create User — Side Sheet ────────────────────────────────────────── */}
      <Sheet open={dialogOpen} onOpenChange={setDialogOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[480px] p-0 flex flex-col bg-white dark:bg-[#061C14] border-l border-slate-200 dark:border-emerald-900/40">
          <SheetHeader className="px-6 py-5 border-b border-slate-200 dark:border-emerald-900/40 shrink-0 text-left sm:text-left">
            <SheetTitle className="text-lg font-bold text-slate-950 dark:text-white">Cadastrar Usuário</SheetTitle>
            <SheetDescription className="text-sm text-slate-500 dark:text-slate-400">Informe nome, usuário, setor e senha.</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <form id="create-user-form" onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome Completo</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                  className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11"
                  placeholder="Ex: João Silva"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo de Usuário</Label>
                <Select value={formData.tipo} onValueChange={(value: User['tipo']) => setFormData({ ...formData, tipo: value })}>
                  <SelectTrigger className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="padrao">Padrão</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Usuário de Acesso</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                  className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11"
                  placeholder="Ex: joao.silva"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setor">Setor</Label>
                <div className="flex items-center gap-2">
                  <Select value={formData.setor} onValueChange={(value) => setFormData({ ...formData, setor: value })}>
                    <SelectTrigger id="setor" className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11">
                      <SelectValue placeholder="Selecione o setor" />
                    </SelectTrigger>
                    <SelectContent>
                      {setoresOptions.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" size="icon" variant="outline" className="h-11 w-11 shrink-0" aria-label="Adicionar setor" onClick={() => setAddSectorOpen(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11"
                />
              </div>
            </form>
          </ScrollArea>
          <SheetFooter className="px-6 py-4 border-t border-slate-200 dark:border-emerald-900/40 shrink-0 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button type="submit" form="create-user-form" className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white">Cadastrar Usuário</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Create Sector — Side Sheet ────────────────────────────────────────── */}
      <Sheet open={addSectorOpen} onOpenChange={setAddSectorOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[400px] p-0 flex flex-col bg-white dark:bg-[#061C14] border-l border-slate-200 dark:border-emerald-900/40">
          <SheetHeader className="px-6 py-5 border-b border-slate-200 dark:border-emerald-900/40 shrink-0 text-left sm:text-left">
            <SheetTitle className="text-lg font-bold text-slate-950 dark:text-white">Cadastrar Setor</SheetTitle>
            <SheetDescription className="text-sm text-slate-500 dark:text-slate-400">Adicione um setor para organização dos usuários.</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <form
              id="create-sector-form"
              onSubmit={(e) => {
                e.preventDefault()
                const mut = createSetor({
                  nome: newSector.nome,
                })
                Promise.resolve(mut)
                  .then(async () => {
                    await queryClient.invalidateQueries({ queryKey: ['setores'] })
                    setFormData({ ...formData, setor: (newSector.nome || formData.setor).toUpperCase() })
                    setNewSector({ nome: '' })
                    setAddSectorOpen(false)
                    toast.success('Setor cadastrado!')
                  })
                  .catch(() => toast.error('Falha ao cadastrar setor'))
              }}
              className="px-6 py-6 space-y-6"
            >
              <div className="space-y-2">
                <Label htmlFor="ns-nome">Nome do Setor</Label>
                <Input id="ns-nome" value={newSector.nome} onChange={(e) => setNewSector({ ...newSector, nome: e.target.value })} required className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11" placeholder="Ex: RH" />
              </div>
            </form>
          </ScrollArea>
          <SheetFooter className="px-6 py-4 border-t border-slate-200 dark:border-emerald-900/40 shrink-0 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setAddSectorOpen(false)}>Cancelar</Button>
            <Button type="submit" form="create-sector-form" className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white">Cadastrar Setor</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Usuários" value={stats.total} accent="bg-slate-50 text-slate-700" icon={Users} />
        <MetricCard label="Admins" value={stats.admins} accent="bg-rose-50 text-rose-700" icon={Shield} />
        <MetricCard label="VIPs" value={stats.vips} accent="bg-violet-50 text-violet-700" icon={Crown} />
        <MetricCard label="Padrão" value={stats.padrao} accent="bg-slate-100 text-slate-600" icon={UserRound} />
      </div>

      <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Search className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Buscar usuários</h2>
            <p className="text-sm text-slate-500">Pesquise por nome, login ou setor.</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar usuários..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-11 pl-11 rounded-xl border-slate-200 bg-slate-50/60 focus:bg-white"
          />
        </div>
      </div>

      <Card className="overflow-hidden rounded-3xl border shadow-md">
        <CardHeader className="p-8 border-b bg-slate-50/50">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold text-slate-900">Lista de usuários</CardTitle>
              <CardDescription className="mt-2 text-slate-500">
                Hierarquia visual por perfil, login e setor com ações agrupadas em menu.
              </CardDescription>
            </div>
            <Badge variant="outline" className="rounded-full px-4 py-1.5 text-sm font-bold border-slate-200 text-slate-600 bg-white">
              {sortedUsers.length} registros
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3, 4].map((item) => (
                <Skeleton key={item} className="h-28 w-full rounded-2xl" />
              ))}
            </div>
          ) : sortedUsers.length === 0 ? (
            <div className="py-24 text-center px-6">
              <div className="h-20 w-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Users className="w-9 h-9 text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Nenhum usuário encontrado</h3>
              <p className="text-slate-500 mt-2 font-medium">Tente ajustar a busca para localizar outro perfil.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sortedUsers.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  onView={handleView}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── View User — Side Sheet ────────────────────────────────────────── */}
      <Sheet open={viewOpen} onOpenChange={setViewOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[480px] p-0 flex flex-col bg-white dark:bg-[#061C14] border-l border-slate-200 dark:border-emerald-900/40">
          <SheetHeader className="px-6 py-5 border-b border-slate-200 dark:border-emerald-900/40 shrink-0 text-left sm:text-left">
            <SheetTitle className="text-lg font-bold text-slate-950 dark:text-white">Detalhes do Usuário</SheetTitle>
            <SheetDescription className="text-sm text-slate-500 dark:text-slate-400">Informações básicas do usuário selecionado.</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            {selectedUser && (
              <div className="px-6 py-6 space-y-6">
                <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-emerald-900/20">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <UserRound className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-950 dark:text-white">{selectedUser.nome}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={selectedUser.tipo === 'admin' ? 'default' : 'outline'}>
                        {getUserTypeLabel(selectedUser)}
                      </Badge>
                      {selectedUser.tipo === 'vip' && <Badge className="bg-amber-500 text-white border-none">VIP</Badge>}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {[
                    { label: 'Usuário / Login', value: selectedUser.username, icon: AtSign },
                    { label: 'Setor de Atuação', value: selectedUser.setor, icon: Building2 },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="flex items-start gap-3">
                      <div className="mt-0.5 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider">{label}</p>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
          <SheetFooter className="px-6 py-4 border-t border-slate-200 dark:border-emerald-900/40 shrink-0">
            <Button variant="outline" className="w-full" onClick={() => setViewOpen(false)}>Fechar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Edit User — Side Sheet ────────────────────────────────────────── */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[480px] p-0 flex flex-col bg-white dark:bg-[#061C14] border-l border-slate-200 dark:border-emerald-900/40">
          <SheetHeader className="px-6 py-5 border-b border-slate-200 dark:border-emerald-900/40 shrink-0 text-left sm:text-left">
            <SheetTitle className="text-lg font-bold text-slate-950 dark:text-white">Editar Usuário</SheetTitle>
            <SheetDescription className="text-sm text-slate-500 dark:text-slate-400">Atualize os dados e salve as alterações.</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <form
              id="edit-user-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!selectedUser) return;
                updateMut.mutate({
                  id: selectedUser.id,
                  input: {
                    nome: formData.nome,
                    username: formData.username,
                    setor: formData.setor,
                    password: formData.password,
                    tipo: formData.tipo,
                  }
                })
              }}
              className="px-6 py-6 space-y-6"
            >
              <div className="space-y-2">
                <Label htmlFor="edit-nome">Nome Completo</Label>
                <Input id="edit-nome" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-username">Usuário / Login</Label>
                <Input id="edit-username" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-tipo">Tipo de Usuário</Label>
                <Select value={formData.tipo} onValueChange={(value: User['tipo']) => setFormData({ ...formData, tipo: value })}>
                  <SelectTrigger id="edit-tipo" className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="padrao">Padrão</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-setor">Setor</Label>
                <Select value={formData.setor} onValueChange={(value) => setFormData({ ...formData, setor: value })}>
                  <SelectTrigger id="edit-setor" className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11">
                    <SelectValue placeholder="Selecione o setor" />
                  </SelectTrigger>
                  <SelectContent>
                    {setoresOptions.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-password">Nova Senha</Label>
                <Input
                  id="edit-password"
                  type="password"
                  placeholder="(deixe em branco para manter a atual)"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11"
                />
              </div>
            </form>
          </ScrollArea>
          <SheetFooter className="px-6 py-4 border-t border-slate-200 dark:border-emerald-900/40 shrink-0 flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 text-red-600 hover:bg-red-50 border-red-100"
              onClick={() => {
                if (!selectedUser) return
                if (confirm('Deseja realmente excluir este usuário?')) {
                  deleteMut.mutate(selectedUser.id, {
                    onSuccess: async () => {
                      await queryClient.invalidateQueries({ queryKey: ['usuarios'] })
                      setEditOpen(false)
                      setSelectedUser(null)
                    }
                  })
                }
              }}
            >
              Excluir
            </Button>
            <Button type="submit" form="edit-user-form" className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white">Salvar Alterações</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}

const UserRow = ({
  user,
  onView,
  onEdit,
  onDelete,
}: {
  user: User
  onView: (user: User) => void
  onEdit: (user: User) => void
  onDelete: (id: string) => void
}) => (
  <div className="group flex flex-col lg:flex-row lg:items-center justify-between gap-5 p-6 hover:bg-slate-50/70 transition-all border-l-4 border-transparent hover:border-primary">
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <h3 className="text-lg font-bold text-slate-900 truncate">{user.nome}</h3>
        <UserTypeBadge user={user} />
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-500">
        <div className="flex items-center gap-2 min-w-0">
          <AtSign className="w-4 h-4 text-slate-400" />
          <span className="font-medium truncate">{user.username || '-'}</span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="w-4 h-4 text-slate-400" />
          <span className="font-medium truncate">{user.setor || 'Sem setor'}</span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <UserRound className="w-4 h-4 text-slate-400" />
          <span className="font-medium">{getUserTypeLabel(user)}</span>
        </div>
      </div>
    </div>

    <div className="flex items-center justify-end lg:justify-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-white"
            aria-label={`Abrir ações de ${user.nome}`}
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={() => onView(user)}>
            <Eye className="w-4 h-4 mr-2" />
            Visualizar
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onEdit(user)}>
            <PencilLine className="w-4 h-4 mr-2" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onDelete(user.id)} className="text-red-600 focus:text-red-700">
            <Trash2 className="w-4 h-4 mr-2" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
)

export default Usuarios
