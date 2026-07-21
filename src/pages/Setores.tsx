import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Plus,
  Search,
  Building2,
  MoreHorizontal,
  Eye,
  PencilLine,
  Trash2,
  Users,
  Laptop,
  MapPin,
  Phone,
} from 'lucide-react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listSetores, createSetor, updateSetor, deleteSetor, type Setor as SetorType } from '@/lib/api/setores'
import { listUsuarios } from '@/lib/api/usuarios'
import { listEquipamentos } from '@/lib/api/equipamentos'
import { supabase } from '@/lib/supabase'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { MetricCard } from '@/components/shared'

type Sector = SetorType

const Setores = () => {
  const queryClient = useQueryClient()
  const supabaseEnabled = (import.meta.env.VITE_ENABLE_SUPABASE ?? '1') !== '0' && !!supabase
  const { data: setoresData, isLoading } = useQuery({
    queryKey: ['setores'],
    queryFn: async () => {
      return await listSetores()
    },
    staleTime: 1000 * 30,
  })
  const setores = (setoresData ?? []) as Sector[]
  const { data: usuariosData } = useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => await listUsuarios(),
    staleTime: 1000 * 30,
  })
  const { data: equipamentosData } = useQuery({
    queryKey: ['equipamentos'],
    queryFn: async () => await listEquipamentos(),
    staleTime: 1000 * 30,
  })

  const [searchTerm, setSearchTerm] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [selectedSector, setSelectedSector] = useState<Sector | null>(null)
  const [formData, setFormData] = useState<{ nome: string; responsavel?: string; ramal?: string; localizacao?: string }>({ nome: '' })

  const createMut = useMutation({
    mutationFn: async () => {
      return await createSetor({ ...formData })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['setores'] })
      setFormData({ nome: '', responsavel: '', ramal: '', localizacao: '' })
      setDialogOpen(false)
      toast.success('Setor cadastrado com sucesso!')
    },
    onError: () => toast.error('Falha ao cadastrar setor')
  })
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMut.mutate()
  }

  const sectorStats = useMemo(() => {
    const userCounts = new Map<string, number>()
    const assetCounts = new Map<string, number>()

    for (const user of usuariosData ?? []) {
      const key = (user.setor || '').toUpperCase()
      if (!key) continue
      userCounts.set(key, (userCounts.get(key) ?? 0) + 1)
    }

    for (const asset of equipamentosData ?? []) {
      const key = (asset.setor || '').toUpperCase()
      if (!key) continue
      assetCounts.set(key, (assetCounts.get(key) ?? 0) + 1)
    }

    return { userCounts, assetCounts }
  }, [usuariosData, equipamentosData])

  const filteredSectors = useMemo(
    () =>
      setores
        .filter(sector => sector.nome.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => a.nome.toUpperCase().localeCompare(b.nome.toUpperCase(), 'pt', { sensitivity: 'base' })),
    [setores, searchTerm]
  )

  const stats = useMemo(() => {
    const total = filteredSectors.length
    const comUsuarios = filteredSectors.filter((sector) => (sectorStats.userCounts.get(sector.nome.toUpperCase()) ?? 0) > 0).length
    const comAtivos = filteredSectors.filter((sector) => (sectorStats.assetCounts.get(sector.nome.toUpperCase()) ?? 0) > 0).length
    return { total, comUsuarios, comAtivos }
  }, [filteredSectors, sectorStats])

  const handleView = (sector: Sector) => {
    setSelectedSector(sector)
    setViewOpen(true)
  }

  const handleEdit = (sector: Sector) => {
    setSelectedSector(sector)
    setFormData({ nome: sector.nome, responsavel: sector.responsavel ?? '', ramal: sector.ramal ?? '', localizacao: sector.localizacao ?? '' })
    setEditOpen(true)
  }

  const updateMut = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<Sector> }) => {
      return await updateSetor(id, input)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['setores'] })
      setEditOpen(false)
      toast.success('Setor atualizado')
    },
    onError: () => toast.error('Falha ao atualizar setor')
  })
  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      return await deleteSetor(id)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['setores'] })
      toast.success('Setor excluído')
    },
    onError: () => toast.error('Falha ao excluir setor')
  })
  const handleDelete = (id: string) => {
    deleteMut.mutate(id)
  }

  const openCreateSheet = () => {
    setSelectedSector(null)
    setFormData({ nome: '', responsavel: '', ramal: '', localizacao: '' })
    setDialogOpen(true)
  }

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Setores</h1>
          </div>
          <p className="text-slate-500 font-medium text-lg">Lista elegante dos setores com contexto operacional e organização visual.</p>
        </div>
        <Button className="h-11 px-5 rounded-xl font-semibold" onClick={openCreateSheet}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Setor
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard label="Setores" value={stats.total} accent="bg-slate-50 text-slate-700" icon={Building2} />
        <MetricCard label="Com usuários" value={stats.comUsuarios} accent="bg-blue-50 text-blue-700" icon={Users} />
        <MetricCard label="Com ativos" value={stats.comAtivos} accent="bg-emerald-50 text-emerald-700" icon={Laptop} />
      </div>

      <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Search className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Buscar setores</h2>
            <p className="text-sm text-slate-500">Pesquise pelo nome do setor para filtrar a lista.</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar setores..."
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
              <CardTitle className="text-xl font-bold text-slate-900">Lista de setores</CardTitle>
              <CardDescription className="mt-2 text-slate-500">
                Visão mais leve com contagem de pessoas e ativos vinculados a cada setor.
              </CardDescription>
            </div>
            <Badge variant="outline" className="rounded-full px-4 py-1.5 text-sm font-bold border-slate-200 text-slate-600 bg-white">
              {filteredSectors.length} registros
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
          ) : filteredSectors.length === 0 ? (
            <div className="py-24 text-center px-6">
              <div className="h-20 w-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Building2 className="w-9 h-9 text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Nenhum setor encontrado</h3>
              <p className="text-slate-500 mt-2 font-medium">Ajuste a busca para localizar outro setor.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredSectors.map((sector) => (
                <SectorRow
                  key={sector.id}
                  sector={sector}
                  userCount={sectorStats.userCounts.get(sector.nome.toUpperCase()) ?? 0}
                  assetCount={sectorStats.assetCounts.get(sector.nome.toUpperCase()) ?? 0}
                  onView={handleView}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── View Sector — Side Sheet ────────────────────────────────────────── */}
      <Sheet open={viewOpen} onOpenChange={setViewOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[480px] p-0 flex flex-col bg-white dark:bg-[#061C14] border-l border-slate-200 dark:border-emerald-900/40">
          <SheetHeader className="px-6 py-5 border-b border-slate-200 dark:border-emerald-900/40 shrink-0 text-left sm:text-left">
            <SheetTitle className="text-lg font-bold text-slate-950 dark:text-white">Detalhes do Setor</SheetTitle>
            <SheetDescription className="text-sm text-slate-500 dark:text-slate-400">Informações do setor selecionado.</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            {selectedSector && (
              <div className="px-6 py-6 space-y-6">
                <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-emerald-900/20">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-950 dark:text-white">{selectedSector.nome.toUpperCase()}</h3>
                    <Badge variant="outline" className="mt-1">Setor</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {[
                    { label: 'Responsável', value: selectedSector.responsavel || 'Não informado', icon: Users },
                    { label: 'Ramal', value: selectedSector.ramal || 'Não informado', icon: Phone },
                    { label: 'Localização', value: selectedSector.localizacao || 'Não informado', icon: MapPin },
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

                <div className="pt-4 border-t border-slate-100 dark:border-emerald-900/20">
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider mb-3">Resumo de Ativos</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-blue-50/50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                      <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{sectorStats.userCounts.get(selectedSector.nome.toUpperCase()) ?? 0}</p>
                      <p className="text-xs text-blue-600 dark:text-blue-500 font-medium">Usuários</p>
                    </div>
                    <div className="p-3 bg-emerald-50/50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                      <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{sectorStats.assetCounts.get(selectedSector.nome.toUpperCase()) ?? 0}</p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-500 font-medium">Equipamentos</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
          <SheetFooter className="px-6 py-4 border-t border-slate-200 dark:border-emerald-900/40 shrink-0">
            <Button variant="outline" className="w-full" onClick={() => setViewOpen(false)}>Fechar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Create Sector — Side Sheet ────────────────────────────────────────── */}
      <Sheet open={dialogOpen} onOpenChange={setDialogOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[480px] p-0 flex flex-col bg-white dark:bg-[#061C14] border-l border-slate-200 dark:border-emerald-900/40">
          <SheetHeader className="px-6 py-5 border-b border-slate-200 dark:border-emerald-900/40 shrink-0 text-left sm:text-left">
            <SheetTitle className="text-lg font-bold text-slate-950 dark:text-white">Cadastrar Setor</SheetTitle>
            <SheetDescription className="text-sm text-slate-500 dark:text-slate-400">Adicione um novo setor com nome claro e dados complementares.</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <form id="create-sector-form" onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Setor</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                  className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11"
                  placeholder="Ex: FINANCEIRO"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="responsavel">Responsável</Label>
                <Input
                  id="responsavel"
                  value={formData.responsavel ?? ''}
                  onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11"
                  placeholder="Nome do gestor ou responsável"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ramal">Ramal</Label>
                  <Input
                    id="ramal"
                    value={formData.ramal ?? ''}
                    onChange={(e) => setFormData({ ...formData, ramal: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11"
                    placeholder="Ex: 2045"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="localizacao">Localização</Label>
                  <Input
                    id="localizacao"
                    value={formData.localizacao ?? ''}
                    onChange={(e) => setFormData({ ...formData, localizacao: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11"
                    placeholder="Ex: Bloco A"
                  />
                </div>
              </div>
            </form>
          </ScrollArea>
          <SheetFooter className="px-6 py-4 border-t border-slate-200 dark:border-emerald-900/40 shrink-0 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button type="submit" form="create-sector-form" className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white">Cadastrar Setor</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Edit Sector — Side Sheet ────────────────────────────────────────── */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[480px] p-0 flex flex-col bg-white dark:bg-[#061C14] border-l border-slate-200 dark:border-emerald-900/40">
          <SheetHeader className="px-6 py-5 border-b border-slate-200 dark:border-emerald-900/40 shrink-0 text-left sm:text-left">
            <SheetTitle className="text-lg font-bold text-slate-950 dark:text-white">Editar Setor</SheetTitle>
            <SheetDescription className="text-sm text-slate-500 dark:text-slate-400">Atualize os dados do setor e salve as alterações.</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <form
              id="edit-sector-form"
              onSubmit={(e) => {
                e.preventDefault()
                if (!selectedSector) return
                updateMut.mutate({
                  id: selectedSector.id,
                  input: {
                    nome: formData.nome,
                    responsavel: formData.responsavel,
                    ramal: formData.ramal,
                    localizacao: formData.localizacao,
                  }
                })
              }}
              className="px-6 py-6 space-y-6"
            >
              <div className="space-y-2">
                <Label htmlFor="edit-nome">Nome</Label>
                <Input id="edit-nome" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-responsavel">Responsável</Label>
                <Input id="edit-responsavel" value={formData.responsavel ?? ''} onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })} className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-ramal">Ramal</Label>
                  <Input id="edit-ramal" value={formData.ramal ?? ''} onChange={(e) => setFormData({ ...formData, ramal: e.target.value })} className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-localizacao">Localização</Label>
                  <Input id="edit-localizacao" value={formData.localizacao ?? ''} onChange={(e) => setFormData({ ...formData, localizacao: e.target.value })} className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11" />
                </div>
              </div>
            </form>
          </ScrollArea>
          <SheetFooter className="px-6 py-4 border-t border-slate-200 dark:border-emerald-900/40 shrink-0 flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 text-red-600 hover:bg-red-50 border-red-100"
              onClick={() => {
                if (!selectedSector) return
                if (confirm('Deseja realmente excluir este setor?')) {
                  deleteMut.mutate(selectedSector.id, {
                    onSuccess: async () => {
                      await queryClient.invalidateQueries({ queryKey: ['setores'] })
                      setEditOpen(false)
                      setSelectedSector(null)
                    }
                  })
                }
              }}
            >
              Excluir
            </Button>
            <Button type="submit" form="edit-sector-form" className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white">Salvar Alterações</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}

const SectorRow = ({
  sector,
  userCount,
  assetCount,
  onView,
  onEdit,
  onDelete,
}: {
  sector: Sector
  userCount: number
  assetCount: number
  onView: (sector: Sector) => void
  onEdit: (sector: Sector) => void
  onDelete: (id: string) => void
}) => (
  <div className="group flex flex-col lg:flex-row lg:items-center justify-between gap-5 p-6 hover:bg-slate-50/70 transition-all border-l-4 border-transparent hover:border-primary">
    <div className="flex items-start gap-4 min-w-0 flex-1">
      <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
        <Building2 className="w-5 h-5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h3 className="text-lg font-bold text-slate-900 truncate">{sector.nome.toUpperCase()}</h3>
          <Badge variant="outline" className="rounded-full border-slate-200 bg-white text-slate-600 font-semibold px-3 py-1">
            Setor
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-500">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="font-medium">{userCount} usu{userCount === 1 ? 'ário' : 'ários'}</span>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <Laptop className="w-4 h-4 text-slate-400" />
            <span className="font-medium">{assetCount} ativo{assetCount === 1 ? '' : 's'}</span>
          </div>
          {sector.responsavel && (
            <div className="flex items-center gap-2 min-w-0">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="font-medium truncate">{sector.responsavel}</span>
            </div>
          )}
          {sector.ramal && (
            <div className="flex items-center gap-2 min-w-0">
              <Phone className="w-4 h-4 text-slate-400" />
              <span className="font-medium">{sector.ramal}</span>
            </div>
          )}
          {sector.localizacao && (
            <div className="flex items-center gap-2 min-w-0">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span className="font-medium truncate">{sector.localizacao}</span>
            </div>
          )}
        </div>
      </div>
    </div>

    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-white"
          aria-label={`Abrir ações de ${sector.nome}`}
        >
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={() => onView(sector)}>
          <Eye className="w-4 h-4 mr-2" />
          Visualizar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onEdit(sector)}>
          <PencilLine className="w-4 h-4 mr-2" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onDelete(sector.id)} className="text-red-600 focus:text-red-700">
          <Trash2 className="w-4 h-4 mr-2" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
)

export default Setores
