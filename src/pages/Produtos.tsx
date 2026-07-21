import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  Package,
  Eye,
  PencilLine,
  Trash2,
  MinusCircle,
  MoreHorizontal,
  Boxes,
  AlertTriangle,
  CircleAlert,
  CalendarDays,
  UserRound,
  History,
} from 'lucide-react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listProdutos, createProduto, updateProduto, deleteProduto, registrarSaida, listSaidas, updateSaida, deleteSaida, type Produto, type ProdutoSaida } from '@/lib/api/produtos'
import { cn } from '@/lib/utils'
import { MetricCard, StockBadge, PageHeader, EmptyState, SearchInput, ConfirmDialog } from '@/components/shared'
import { getProductStockConfig } from '@/lib/config/products'
import { formatDate, formatDateLong } from '@/lib/utils/format'

type Product = Produto

const getSaidaDateValue = (saida: ProdutoSaida) => saida.data || saida.created_at || ''

// ── Main Component ──────────────────────────────────────────────────────────

const Produtos = () => {
  const queryClient = useQueryClient()
  const { data: produtosData, isLoading } = useQuery({
    queryKey: ['produtos'],
    queryFn: async () => await listProdutos(),
    staleTime: 1000 * 30,
  })
  const produtos = useMemo<Product[]>(() => (produtosData ?? []), [produtosData])

  const [searchTerm, setSearchTerm] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [saidaOpen, setSaidaOpen] = useState(false)
  const [saidaEditOpen, setSaidaEditOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedSaida, setSelectedSaida] = useState<ProdutoSaida | null>(null)
  const [formData, setFormData] = useState({ nome: '', categoria: '', descricao: '', estoque: 0 })
  const [saidaQty, setSaidaQty] = useState(0)
  const [saidaDestinatario, setSaidaDestinatario] = useState('')
  const [saidaData, setSaidaData] = useState('')
  const [saidaEditForm, setSaidaEditForm] = useState({ quantidade: 1, destinatario: '', data: '' })

  // ── ConfirmDialog state ─────────────────────────────────────────────────
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; description: string; onConfirm: () => void
  }>({ open: false, title: '', description: '', onConfirm: () => {} })

  const openConfirm = (title: string, description: string, onConfirm: () => void) =>
    setConfirmDialog({ open: true, title, description, onConfirm })

  // ── Queries ─────────────────────────────────────────────────────────────
  const { data: saidasData } = useQuery({
    queryKey: ['produto_saidas'],
    queryFn: async () => await listSaidas(),
    staleTime: 1000 * 30,
  })

  // ── Computed ─────────────────────────────────────────────────────────────
  const filteredProducts = useMemo(
    () => produtos.filter(p =>
      p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.categoria.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [produtos, searchTerm]
  )

  const sortedProducts = useMemo(
    () => [...filteredProducts].sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' })),
    [filteredProducts]
  )

  const stats = useMemo(() => {
    const total = sortedProducts.length
    const criticos = sortedProducts.filter(p => p.estoque <= 3).length
    const baixos = sortedProducts.filter(p => p.estoque > 3 && p.estoque <= 10).length
    const ok = sortedProducts.filter(p => p.estoque > 10).length
    return { total, criticos, baixos, ok }
  }, [sortedProducts])

  const productNameById = useMemo(
    () => new Map(produtos.map(p => [p.id, p.nome])),
    [produtos]
  )

  const groupedSaidas = useMemo(() => {
    const rows = [...(saidasData ?? [])].sort((a, b) =>
      getSaidaDateValue(b).localeCompare(getSaidaDateValue(a))
    )
    return rows.reduce<Array<{ dateKey: string; label: string; items: ProdutoSaida[] }>>((groups, saida) => {
      const rawDate = getSaidaDateValue(saida)
      const key = rawDate || 'sem-data'
      const existing = groups.find(g => g.dateKey === key)
      if (existing) { existing.items.push(saida); return groups }
      groups.push({ dateKey: key, label: formatDateLong(rawDate), items: [saida] })
      return groups
    }, [])
  }, [saidasData])

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: async () => await createProduto({ ...formData }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['produtos'] })
      setFormData({ nome: '', categoria: '', descricao: '', estoque: 0 })
      setDialogOpen(false)
      toast.success('Produto cadastrado com sucesso!')
    },
    onError: (err: unknown) => {
      const msg = typeof (err as { message?: unknown })?.message === 'string'
        ? (err as { message: string }).message
        : 'Falha ao cadastrar produto'
      toast.error(msg)
    },
  })

  const updateMut = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<Product> }) => await updateProduto(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['produtos'] })
      setEditOpen(false)
      toast.success('Produto atualizado')
    },
    onError: () => toast.error('Falha ao atualizar produto'),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => await deleteProduto(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['produtos'] })
      toast.success('Produto excluído')
    },
    onError: () => toast.error('Falha ao excluir produto'),
  })

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleView = (product: Product) => { setSelectedProduct(product); setViewOpen(true) }

  const handleEdit = (product: Product) => {
    setSelectedProduct(product)
    setFormData({ nome: product.nome, categoria: product.categoria, descricao: product.descricao, estoque: product.estoque })
    setEditOpen(true)
  }

  const handleSaida = (product: Product) => {
    setSelectedProduct(product)
    setSaidaQty(0)
    setSaidaDestinatario('')
    setSaidaData('')
    setSaidaOpen(true)
  }

  const handleEditSaida = (saida: ProdutoSaida) => {
    setSelectedSaida(saida)
    setSaidaEditForm({ quantidade: saida.quantidade, destinatario: saida.destinatario || '', data: saida.data || '' })
    setSaidaEditOpen(true)
  }

  const handleDeleteSaida = async (saida: ProdutoSaida) => {
    await deleteSaida(saida.id)
    await queryClient.invalidateQueries({ queryKey: ['produto_saidas'] })
    await queryClient.invalidateQueries({ queryKey: ['produtos'] })
    setSaidaEditOpen(false)
    setSelectedSaida(null)
  }

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-8 animate-in fade-in duration-700">

      {/* ── HEADER ── */}
      <PageHeader
        title="Produtos"
        description="Visão clara do estoque com foco em quantidade, categoria e ações rápidas."
        icon={Boxes}
        action={
          <Button className="h-11 px-5 rounded-xl font-semibold" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Produto
          </Button>
        }
      />

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Produtos" value={stats.total} accent="bg-slate-50 text-slate-700" icon={Boxes} />
        <MetricCard label="Estoque OK" value={stats.ok} accent="bg-emerald-50 text-emerald-700" icon={Package} />
        <MetricCard label="Baixo" value={stats.baixos} accent="bg-amber-50 text-amber-700" icon={AlertTriangle} />
        <MetricCard label="Crítico" value={stats.criticos} accent="bg-rose-50 text-rose-700" icon={CircleAlert} />
      </div>

      {/* ── BUSCA ── */}
      <SearchInput
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Buscar por nome ou categoria..."
      />

      {/* ── LISTA DE PRODUTOS ── */}
      <Card className="overflow-hidden rounded-3xl border shadow-md">
        <CardHeader className="p-8 border-b bg-slate-50/50">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold text-slate-900">Estoque de produtos</CardTitle>
              <CardDescription className="mt-2 text-slate-500">
                Leitura rápida por nome, categoria e nível de quantidade com ações agrupadas.
              </CardDescription>
            </div>
            <Badge variant="outline" className="rounded-full px-4 py-1.5 text-sm font-bold border-slate-200 text-slate-600 bg-white w-fit">
              {sortedProducts.length} itens
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
            </div>
          ) : sortedProducts.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="Nenhum produto encontrado"
              description={searchTerm ? 'Nenhum resultado para esta busca. Tente outro nome ou categoria.' : 'Cadastre o primeiro produto usando o botão "Novo Produto".'}
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {sortedProducts.map(product => (
                <ProductRow
                  key={product.id}
                  product={product}
                  onView={handleView}
                  onEdit={handleEdit}
                  onSaida={handleSaida}
                  onDelete={(p) => openConfirm(
                    'Excluir produto',
                    `"${p.nome}" será removido permanentemente do estoque.`,
                    () => deleteMut.mutate(p.id)
                  )}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── HISTÓRICO DE SAÍDAS ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 px-1">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <History className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Histórico de Saídas</h2>
            <p className="text-sm text-slate-500 mt-0.5">Movimentações de estoque registradas por data.</p>
          </div>
        </div>

        {groupedSaidas.length === 0 ? (
          <div className="bg-white rounded-3xl border shadow-md">
            <EmptyState
              icon={History}
              title="Nenhuma saída registrada"
              description='Use "Registrar saída" em um produto para iniciar o controle de movimentações.'
            />
          </div>
        ) : (
          <div className="space-y-8">
            {groupedSaidas.map(group => (
              <div key={group.dateKey}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">{group.label}</span>
                  <div className="flex-1 h-px bg-slate-100" />
                  <span className="text-xs font-bold text-slate-400 whitespace-nowrap">
                    {group.items.length} {group.items.length === 1 ? 'registro' : 'registros'}
                  </span>
                </div>
                <div className="space-y-3">
                  {group.items.map(saida => (
                    <SaidaRow
                      key={saida.id}
                      saida={saida}
                      productName={productNameById.get(saida.produto_id) ?? 'Produto removido'}
                      onEdit={handleEditSaida}
                      onDelete={(s) => openConfirm(
                        'Excluir saída',
                        'Esta movimentação será removida permanentemente do histórico.',
                        () => handleDeleteSaida(s)
                      )}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── SHEET: Cadastrar Produto ── */}
      <Sheet open={dialogOpen} onOpenChange={setDialogOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[480px] p-0 flex flex-col bg-white dark:bg-[#061C14] border-l border-slate-200 dark:border-emerald-900/40">
          <SheetHeader className="px-6 py-5 border-b border-slate-200 dark:border-emerald-900/40 shrink-0 text-left">
            <SheetTitle className="text-lg font-bold text-slate-950 dark:text-white">Cadastrar Produto</SheetTitle>
            <SheetDescription className="text-sm text-slate-500 dark:text-slate-400">Informe os dados do produto e salve.</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <form id="create-product-form" onSubmit={(e) => { e.preventDefault(); createMut.mutate() }} className="px-6 py-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Produto</Label>
                <Input id="nome" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} required className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11" placeholder="Ex: Mouse Sem Fio" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria</Label>
                <Select value={formData.categoria} onValueChange={(v) => setFormData({ ...formData, categoria: v })}>
                  <SelectTrigger className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Periféricos">Periféricos</SelectItem>
                    <SelectItem value="Desktop">Desktop</SelectItem>
                    <SelectItem value="Notebook">Notebook</SelectItem>
                    <SelectItem value="Tablet">Tablet</SelectItem>
                    <SelectItem value="Monitor">Monitor</SelectItem>
                    <SelectItem value="Impressora">Impressora</SelectItem>
                    <SelectItem value="Smartphone">Smartphone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="estoque">Quantidade Inicial</Label>
                <Input id="estoque" type="number" min="0" value={formData.estoque} onChange={(e) => setFormData({ ...formData, estoque: parseInt(e.target.value) || 0 })} required className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea id="descricao" value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} rows={4} required className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 resize-none" placeholder="Detalhes técnicos ou observações..." />
              </div>
            </form>
          </ScrollArea>
          <SheetFooter className="px-6 py-4 border-t border-slate-200 dark:border-emerald-900/40 shrink-0 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button type="submit" form="create-product-form" className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white">Cadastrar Produto</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── SHEET: Visualizar Produto ── */}
      <Sheet open={viewOpen} onOpenChange={setViewOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[480px] p-0 flex flex-col bg-white dark:bg-[#061C14] border-l border-slate-200 dark:border-emerald-900/40">
          <SheetHeader className="px-6 py-5 border-b border-slate-200 dark:border-emerald-900/40 shrink-0 text-left">
            <SheetTitle className="text-lg font-bold text-slate-950 dark:text-white">Detalhes do Produto</SheetTitle>
            <SheetDescription className="text-sm text-slate-500 dark:text-slate-400">Informações cadastradas do produto.</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            {selectedProduct && (
              <div className="px-6 py-6 space-y-6">
                <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-emerald-900/20">
                  <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center shrink-0', getProductStockConfig(selectedProduct.estoque).accent)}>
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-950 dark:text-white">{selectedProduct.nome}</h3>
                    <Badge variant="outline" className="mt-1">{selectedProduct.categoria}</Badge>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider mb-1">Descrição</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{selectedProduct.descricao || 'Sem descrição cadastrada.'}</p>
                  </div>
                  <div className="pt-4 border-t border-slate-100 dark:border-emerald-900/20">
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider mb-2">Status do Estoque</p>
                    <StockBadge estoque={selectedProduct.estoque} />
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

      {/* ── SHEET: Editar Produto ── */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[480px] p-0 flex flex-col bg-white dark:bg-[#061C14] border-l border-slate-200 dark:border-emerald-900/40">
          <SheetHeader className="px-6 py-5 border-b border-slate-200 dark:border-emerald-900/40 shrink-0 text-left">
            <SheetTitle className="text-lg font-bold text-slate-950 dark:text-white">Editar Produto</SheetTitle>
            <SheetDescription className="text-sm text-slate-500 dark:text-slate-400">Atualize os campos e salve as alterações.</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <form id="edit-product-form" onSubmit={(e) => { e.preventDefault(); if (!selectedProduct) return; updateMut.mutate({ id: selectedProduct.id, input: { ...formData } }) }} className="px-6 py-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="edit-nome">Nome</Label>
                <Input id="edit-nome" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-categoria">Categoria</Label>
                <Select value={formData.categoria} onValueChange={(v) => setFormData({ ...formData, categoria: v })}>
                  <SelectTrigger id="edit-categoria" className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Periféricos">Periféricos</SelectItem>
                    <SelectItem value="Desktop">Desktop</SelectItem>
                    <SelectItem value="Notebook">Notebook</SelectItem>
                    <SelectItem value="Tablet">Tablet</SelectItem>
                    <SelectItem value="Monitor">Monitor</SelectItem>
                    <SelectItem value="Impressora">Impressora</SelectItem>
                    <SelectItem value="Smartphone">Smartphone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-estoque">Estoque</Label>
                <Input id="edit-estoque" type="number" value={formData.estoque} onChange={(e) => setFormData({ ...formData, estoque: parseInt(e.target.value) || 0 })} className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-descricao">Descrição</Label>
                <Textarea id="edit-descricao" rows={4} value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 resize-none" />
              </div>
            </form>
          </ScrollArea>
          <SheetFooter className="px-6 py-4 border-t border-slate-200 dark:border-emerald-900/40 shrink-0 flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 text-red-600 hover:bg-red-50 border-red-100"
              onClick={() => {
                if (!selectedProduct) return
                openConfirm(
                  'Excluir produto',
                  `"${selectedProduct.nome}" será removido permanentemente do estoque.`,
                  () => deleteMut.mutate(selectedProduct.id, {
                    onSuccess: async () => {
                      await queryClient.invalidateQueries({ queryKey: ['produtos'] })
                      setEditOpen(false)
                      setSelectedProduct(null)
                    }
                  })
                )
              }}
            >
              Excluir
            </Button>
            <Button type="submit" form="edit-product-form" className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white">Salvar Alterações</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── SHEET: Registrar Saída ── */}
      <Sheet open={saidaOpen} onOpenChange={setSaidaOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[480px] p-0 flex flex-col bg-white dark:bg-[#061C14] border-l border-slate-200 dark:border-emerald-900/40">
          <SheetHeader className="px-6 py-5 border-b border-slate-200 dark:border-emerald-900/40 shrink-0 text-left">
            <SheetTitle className="text-lg font-bold text-slate-950 dark:text-white">Registrar Saída</SheetTitle>
            <SheetDescription className="text-sm text-slate-500 dark:text-slate-400">Informe quantidade, destinatário e data.</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            {selectedProduct && (
              <form
                id="saida-product-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  const qty = Math.max(0, Math.floor(saidaQty))
                  if (qty <= 0) { toast.error('Informe uma quantidade válida'); return }
                  if (!selectedProduct) return
                  registrarSaida(selectedProduct.id, qty, saidaDestinatario, saidaData || undefined)
                    .then(async () => {
                      await queryClient.invalidateQueries({ queryKey: ['produtos'] })
                      await queryClient.invalidateQueries({ queryKey: ['produto_saidas'] })
                      setSaidaOpen(false)
                      toast.success('Saída registrada e estoque atualizado')
                    })
                    .catch(() => toast.error('Falha ao registrar saída'))
                }}
                className="px-6 py-6 space-y-6"
              >
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-emerald-900/20">
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider mb-1">Produto Selecionado</p>
                  <p className="text-sm font-bold text-slate-950 dark:text-white">{selectedProduct.nome}</p>
                  <p className="text-xs text-slate-500 mt-1">Estoque disponível: {selectedProduct.estoque} unidades</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="saida-qty">Quantidade de Saída</Label>
                  <Input id="saida-qty" type="number" min="1" max={selectedProduct.estoque} value={saidaQty} onChange={(e) => setSaidaQty(parseInt(e.target.value) || 0)} className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="saida-dest">Destinatário / Responsável</Label>
                  <Input id="saida-dest" value={saidaDestinatario} onChange={(e) => setSaidaDestinatario(e.target.value)} className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11" placeholder="Ex: João Silva - TI" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="saida-data">Data da Movimentação</Label>
                  <Input id="saida-data" type="date" value={saidaData} onChange={(e) => setSaidaData(e.target.value)} className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11" />
                </div>
              </form>
            )}
          </ScrollArea>
          <SheetFooter className="px-6 py-4 border-t border-slate-200 dark:border-emerald-900/40 shrink-0 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setSaidaOpen(false)}>Cancelar</Button>
            <Button type="submit" form="saida-product-form" className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white">Confirmar Saída</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── SHEET: Editar Saída ── */}
      <Sheet open={saidaEditOpen} onOpenChange={setSaidaEditOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[480px] p-0 flex flex-col bg-white dark:bg-[#061C14] border-l border-slate-200 dark:border-emerald-900/40">
          <SheetHeader className="px-6 py-5 border-b border-slate-200 dark:border-emerald-900/40 shrink-0 text-left">
            <SheetTitle className="text-lg font-bold text-slate-950 dark:text-white">Editar Saída</SheetTitle>
            <SheetDescription className="text-sm text-slate-500 dark:text-slate-400">Altere os dados da movimentação e salve.</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <form
              id="edit-saida-form"
              onSubmit={async (e) => {
                e.preventDefault()
                if (!selectedSaida) return
                await updateSaida(selectedSaida.id, {
                  quantidade: Math.max(1, Number(saidaEditForm.quantidade) || 1),
                  destinatario: saidaEditForm.destinatario || undefined,
                  data: saidaEditForm.data || undefined,
                })
                await queryClient.invalidateQueries({ queryKey: ['produto_saidas'] })
                await queryClient.invalidateQueries({ queryKey: ['produtos'] })
                setSaidaEditOpen(false)
              }}
              className="px-6 py-6 space-y-6"
            >
              <div className="space-y-2">
                <Label htmlFor="edit-qty">Quantidade</Label>
                <Input id="edit-qty" type="number" min="1" value={saidaEditForm.quantidade} onChange={(e) => setSaidaEditForm({ ...saidaEditForm, quantidade: parseInt(e.target.value) || 1 })} className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-dest">Destinatário</Label>
                <Input id="edit-dest" value={saidaEditForm.destinatario} onChange={(e) => setSaidaEditForm({ ...saidaEditForm, destinatario: e.target.value })} className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-data">Data</Label>
                <Input id="edit-data" type="date" value={saidaEditForm.data} onChange={(e) => setSaidaEditForm({ ...saidaEditForm, data: e.target.value })} className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 h-11" />
              </div>
            </form>
          </ScrollArea>
          <SheetFooter className="px-6 py-4 border-t border-slate-200 dark:border-emerald-900/40 shrink-0 flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 text-red-600 hover:bg-red-50 border-red-100"
              onClick={() => {
                if (!selectedSaida) return
                openConfirm(
                  'Excluir saída',
                  'Esta movimentação será removida permanentemente do histórico.',
                  () => handleDeleteSaida(selectedSaida)
                )
              }}
            >
              Excluir
            </Button>
            <Button type="submit" form="edit-saida-form" className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white">Salvar Alterações</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── CONFIRM DIALOG ── */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
      />
    </div>
  )
}

// ── SUBCOMPONENTES ──────────────────────────────────────────────────────────

const ProductRow = ({
  product,
  onView,
  onEdit,
  onDelete,
  onSaida,
}: {
  product: Product
  onView: (product: Product) => void
  onEdit: (product: Product) => void
  onDelete: (product: Product) => void
  onSaida: (product: Product) => void
}) => {
  const stock = getProductStockConfig(product.estoque)
  return (
    <div className="group flex flex-col lg:flex-row lg:items-center justify-between gap-5 p-6 hover:bg-slate-50/70 transition-all border-l-4 border-transparent hover:border-primary">
      <div className="flex items-start gap-4 min-w-0 flex-1">
        <div className={cn('h-12 w-12 rounded-2xl flex items-center justify-center shrink-0', stock.accent)}>
          <Package className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h3 className="text-lg font-bold text-slate-900 truncate">{product.nome}</h3>
            <Badge variant="outline" className="rounded-full border-slate-200 bg-white text-slate-600 font-semibold px-3 py-1">
              {product.categoria}
            </Badge>
          </div>
          <p className="text-sm text-slate-500 line-clamp-2">{product.descricao || 'Sem descrição cadastrada.'}</p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 lg:pl-6 lg:border-l lg:border-slate-100">
        <div className="flex flex-col items-start sm:items-end gap-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Quantidade</div>
          <StockBadge estoque={product.estoque} />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-white" aria-label={`Ações de ${product.nome}`}>
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => onView(product)}>
              <Eye className="w-4 h-4 mr-2" />Visualizar
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onEdit(product)}>
              <PencilLine className="w-4 h-4 mr-2" />Editar
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onSaida(product)}>
              <MinusCircle className="w-4 h-4 mr-2" />Registrar saída
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onDelete(product)} className="text-red-600 focus:text-red-700">
              <Trash2 className="w-4 h-4 mr-2" />Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

const SaidaRow = ({
  saida,
  productName,
  onEdit,
  onDelete,
}: {
  saida: ProdutoSaida
  productName: string
  onEdit: (saida: ProdutoSaida) => void
  onDelete: (saida: ProdutoSaida) => void
}) => (
  <div className="group flex flex-col lg:flex-row lg:items-center justify-between gap-5 p-5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/70 transition-all">
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <h4 className="text-base font-bold text-slate-900 truncate">{productName}</h4>
        <Badge className="rounded-full px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-50">
          {saida.quantidade} un.
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-500">
        <div className="flex items-center gap-2 min-w-0">
          <UserRound className="w-4 h-4 text-slate-400" />
          <span className="font-medium truncate">{saida.destinatario || 'Sem responsável informado'}</span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays className="w-4 h-4 text-slate-400" />
          <span className="font-medium">{formatDate(getSaidaDateValue(saida))}</span>
        </div>
      </div>
    </div>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-white" aria-label={`Ações da saída de ${productName}`}>
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={() => onEdit(saida)}>
          <PencilLine className="w-4 h-4 mr-2" />Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onDelete(saida)} className="text-red-600 focus:text-red-700">
          <Trash2 className="w-4 h-4 mr-2" />Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
)

export default Produtos
