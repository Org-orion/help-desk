import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
  BarChart3, Clock, CheckCircle2, Users, Smile, Filter,
  ChevronRight, Trash2, Download, Building2, User as UserIcon, Search, CalendarDays
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listEquipamentos } from '@/lib/api/equipamentos'
import { listChamados, updateChamado, deleteChamado, type Chamado } from '@/lib/api/chamados'
import { cn } from '@/lib/utils'
import { formatMinutes, formatDate } from '@/lib/utils/format'
import { PageHeader, MetricCard, EmptyState } from '@/components/shared'

// ── Main Component ──────────────────────────────────────────────────────────

const Relatorios = () => {
  const [periodo, setPeriodo] = useState<'todos' | 'hoje' | 'semana' | 'mes'>('todos')
  const queryClient = useQueryClient()
  const { data: equipamentos, isLoading: loadingEquipamentos } = useQuery({ queryKey: ['equipamentos'], queryFn: listEquipamentos, staleTime: 30000 })
  const { data: chamados, isLoading: loadingChamados } = useQuery({ queryKey: ['chamados'], queryFn: listChamados, staleTime: 30000 })

  const isLoading = loadingChamados || loadingEquipamentos

  // Filtro por período
  const isInPeriodo = useMemo(() => (dateStr?: string) => {
    if (!dateStr || periodo === 'todos') return true
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return false
    const now = new Date()
    if (periodo === 'hoje') return d.toDateString() === now.toDateString()
    if (periodo === 'semana') return (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24) <= 7
    if (periodo === 'mes') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    return true
  }, [periodo])

  const filteredChamados = useMemo(() => (chamados ?? []).filter(r => isInPeriodo(r.completed_at || r.data || r.created_at)), [chamados, isInPeriodo])
  const filteredEquipamentos = useMemo(() => (equipamentos ?? []).filter(r => isInPeriodo(r.created_at)), [equipamentos, isInPeriodo])

  // Cálculos de KPIs
  const stats = useMemo(() => {
    const total = filteredChamados.length || 1
    const resolvidos = filteredChamados.filter(r => r.status === 'Concluído').length
    const taxaResolucao = Math.round((resolvidos / total) * 100)

    const rated = filteredChamados.filter(r => typeof r.avaliacao === 'number' && r.avaliacao >= 1 && r.avaliacao <= 5)
    const avgSatisfacao = rated.length ? (rated.reduce((acc, r) => acc + (r.avaliacao || 0), 0) / rated.length) : 0
    const satisfacaoPct = Math.round(avgSatisfacao * 20)

    const durations = filteredChamados.filter(r => r.status === 'Concluído').map(r => {
      if (typeof r.tempo_solucao_minutos === 'number') return r.tempo_solucao_minutos
      const s = new Date(r.started_at || r.created_at || r.data)
      const e = new Date(r.completed_at || '')
      return (s.getTime() && e.getTime()) ? (e.getTime() - s.getTime()) / 60000 : null
    }).filter((m): m is number => m !== null && isFinite(m))

    const avgTempo = durations.length ? Math.floor(durations.reduce((a, b) => a + b, 0) / durations.length) : 0

    return { resolvidos, taxaResolucao, satisfacaoPct, avgTempo }
  }, [filteredChamados])

  const eqStatus = useMemo(() => {
    const total = filteredEquipamentos.length || 1
    const count = (s: string) => filteredEquipamentos.filter(r => r.status === s).length
    return {
      disponivel: Math.round((count('Disponível') / total) * 100),
      emUso: Math.round((count('Em Uso') / total) * 100),
      manutencao: Math.round((count('Manutenção') / total) * 100),
    }
  }, [filteredEquipamentos])

  // Estado do log
  const [logSearch, setLogSearch] = useState('')
  const [showAll, setShowAll] = useState(false)

  const concludedTickets = useMemo(() => filteredChamados.filter(r => r.status === 'Concluído'), [filteredChamados])

  const logFiltered = useMemo(() => {
    if (!logSearch.trim()) return concludedTickets
    const term = logSearch.toLowerCase()
    return concludedTickets.filter(c =>
      c.titulo.toLowerCase().includes(term) ||
      c.solicitante.toLowerCase().includes(term) ||
      (c.setor ?? '').toLowerCase().includes(term)
    )
  }, [concludedTickets, logSearch])

  const displayedTickets = showAll ? logFiltered : logFiltered.slice(0, 10)

  // Sheet de edição
  const [editOpen, setEditOpen] = useState(false)
  const [selected, setSelected] = useState<Chamado | null>(null)
  const [formData, setFormData] = useState({ titulo: '', descricao: '', solicitante: '', setor: '', tipo_servico: '', data: '' })

  const handleExportData = () => {
    const concluded = filteredChamados.filter(r => r.status === 'Concluído')
    const header = ['ID', 'Título', 'Solicitante', 'Setor', 'Tipo de Serviço', 'Tempo (min)', 'Avaliação', 'Data de Conclusão']
    const rows = concluded.map(c => [
      c.id,
      c.titulo,
      c.solicitante,
      c.setor ?? '',
      c.tipo_servico ?? '',
      c.tempo_solucao_minutos ?? '',
      c.avaliacao ?? '',
      formatDate(c.completed_at),
    ])
    const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const csv = [header, ...rows].map(r => r.map(escape).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `relatorio-${periodo}-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleOpenTicket = (c: Chamado) => {
    setSelected(c)
    setFormData({
      titulo: c.titulo,
      descricao: c.descricao,
      solicitante: c.solicitante,
      setor: c.setor,
      tipo_servico: c.tipo_servico,
      data: c.data || '',
    })
    setEditOpen(true)
  }

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-8 animate-in fade-in duration-700">

      {/* ── HEADER ── */}
      <PageHeader
        title="Inteligência Operacional"
        description="Análise estratégica de performance e ativos"
        icon={BarChart3}
        action={
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 px-3 text-slate-400">
              <Filter className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Período</span>
            </div>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as typeof periodo)}>
              <SelectTrigger className="w-[160px] border-none bg-transparent shadow-none focus:ring-0 font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" className="rounded-xl">
                <SelectItem value="todos">Todo histórico</SelectItem>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="semana">Últimos 7 dias</SelectItem>
                <SelectItem value="mes">Este mês</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      {isLoading ? (
        /* ── SKELETON ── */
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="lg:col-span-2 h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : (
        <>
          {/* ── KPIs ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              label="Tempo de Resolução"
              value={formatMinutes(stats.avgTempo)}
              icon={Clock}
              accent="bg-amber-50 text-amber-600"
              description="Média de conclusão por ticket"
            />
            <MetricCard
              label="Taxa de Resolução"
              value={`${stats.taxaResolucao}%`}
              icon={CheckCircle2}
              accent="bg-emerald-50 text-emerald-600"
              description="Tickets resolvidos vs abertos"
            />
            <MetricCard
              label="NPS de Atendimento"
              value={`${stats.satisfacaoPct}%`}
              icon={Smile}
              accent="bg-violet-50 text-violet-600"
              description="Média de satisfação dos usuários"
            />
            <MetricCard
              label="Volume Resolvido"
              value={stats.resolvidos}
              icon={Users}
              accent="bg-blue-50 text-blue-600"
              description="Total de chamados finalizados"
            />
          </div>

          {/* ── VISUALIZAÇÕES ANALÍTICAS ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfico de Satisfação */}
            <Card className="lg:col-span-2 overflow-hidden border shadow-sm rounded-2xl">
              <CardHeader className="border-b bg-slate-50/50 py-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-800">Distribuição de Satisfação</CardTitle>
                    <CardDescription className="font-medium">Análise qualitativa baseada em avaliações reais</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-lg gap-2" onClick={handleExportData}>
                    <Download className="h-3.5 w-3.5" />
                    Exportar CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-8">
                <SatisfactionChart chamados={filteredChamados} />
              </CardContent>
            </Card>

            {/* Saúde da Infraestrutura */}
            <Card className="border shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="border-b bg-slate-50/50 py-6">
                <CardTitle className="text-xl font-bold text-slate-800">Saúde da Infraestrutura</CardTitle>
                <CardDescription className="font-medium">Disponibilidade de ativos em tempo real</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                <StatusMetric label="Ativos Disponíveis" value={eqStatus.disponivel} color="bg-green-500" />
                <StatusMetric label="Equipamentos em Uso" value={eqStatus.emUso} color="bg-blue-600" />
                <StatusMetric label="Em Manutenção" value={eqStatus.manutencao} color="bg-amber-500" />

                <div className="pt-6 mt-6 border-t">
                  <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Capacidade Total</p>
                      <p className="text-2xl font-bold text-slate-900">{filteredEquipamentos.length}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-sm border">
                      <BarChart3 className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── LOG DE ENCERRAMENTO ── */}
          <div className="bg-white rounded-3xl border shadow-md overflow-hidden">
            <div className="p-8 border-b bg-slate-50/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Log de Encerramento</h2>
                <p className="text-sm text-slate-500 font-medium mt-0.5">Detalhamento técnico dos chamados concluídos</p>
              </div>
              <div className="relative w-full lg:w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar por título, solicitante ou setor..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="h-10 w-full pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
              </div>
            </div>

            {logFiltered.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Nenhum chamado concluído"
                description={logSearch ? 'Nenhum resultado para esta busca.' : 'Ainda não há chamados encerrados neste período.'}
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {displayedTickets.map((c) => (
                  <ClosedTicketRow key={c.id} chamado={c} onClick={() => handleOpenTicket(c)} />
                ))}
              </div>
            )}

            {logFiltered.length > 0 && (
              <div className="p-6 border-t bg-slate-50/30 flex items-center justify-between">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                  {showAll ? `${logFiltered.length} chamados` : `Mostrando ${Math.min(10, logFiltered.length)} de ${logFiltered.length}`}
                </p>
                {logFiltered.length > 10 && (
                  <Button
                    variant="link"
                    className="text-xs font-bold text-primary uppercase tracking-widest p-0 h-auto"
                    onClick={() => setShowAll(v => !v)}
                  >
                    {showAll ? 'Recolher' : `Ver todos ${logFiltered.length} chamados`}
                  </Button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── SHEET DE DETALHAMENTO TÉCNICO ── */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[540px] p-0 flex flex-col bg-white dark:bg-[#061C14] border-l border-slate-200 dark:border-emerald-900/40">
          <SheetHeader className="px-6 py-5 border-b border-slate-200 dark:border-emerald-900/40 shrink-0 text-left sm:text-left">
            <SheetTitle className="text-xl font-bold text-slate-950 dark:text-white">Detalhamento Técnico</SheetTitle>
            <SheetDescription className="text-sm text-slate-500 dark:text-slate-400">Ajuste as informações históricas do ticket.</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <div className="px-6 py-6">
              <form
                id="edit-ticket-form"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!selected) return
                  await updateChamado(selected.id, {
                    titulo: formData.titulo,
                    descricao: formData.descricao,
                    solicitante: formData.solicitante,
                    setor: formData.setor,
                    tipo_servico: formData.tipo_servico,
                    data: formData.data || undefined,
                  })
                  await queryClient.invalidateQueries({ queryKey: ['chamados'] })
                  setEditOpen(false)
                }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <Label htmlFor="hist-titulo" className="text-xs font-bold uppercase tracking-widest text-slate-400">Título do Incidente</Label>
                  <Input id="hist-titulo" className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40" value={formData.titulo} onChange={(e) => setFormData({ ...formData, titulo: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hist-desc" className="text-xs font-bold uppercase tracking-widest text-slate-400">Resumo da Solução</Label>
                  <Textarea id="hist-desc" rows={6} className="rounded-xl resize-none bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40" value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="hist-solic" className="text-xs font-bold uppercase tracking-widest text-slate-400">Responsável</Label>
                    <Input id="hist-solic" className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40" value={formData.solicitante} onChange={(e) => setFormData({ ...formData, solicitante: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hist-setor" className="text-xs font-bold uppercase tracking-widest text-slate-400">Unidade/Setor</Label>
                    <Input id="hist-setor" className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40" value={formData.setor} onChange={(e) => setFormData({ ...formData, setor: e.target.value })} />
                  </div>
                </div>
              </form>
            </div>
          </ScrollArea>
          <SheetFooter className="px-6 py-4 border-t border-slate-200 dark:border-emerald-900/40 shrink-0 flex flex-col sm:flex-row gap-3">
            <Button type="submit" form="edit-ticket-form" className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold h-11">
              Atualizar Registro
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-11 font-bold"
                onClick={async () => {
                  if (!selected) return
                  await updateChamado(selected.id, { status: 'Aberto' })
                  await queryClient.invalidateQueries({ queryKey: ['chamados'] })
                  setEditOpen(false)
                }}
              >
                Reabrir Ticket
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={async () => {
                  if (!selected) return
                  if (!confirm('Excluir permanentemente?')) return
                  await deleteChamado(selected.id)
                  await queryClient.invalidateQueries({ queryKey: ['chamados'] })
                  setEditOpen(false)
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ── SUBCOMPONENTES ──────────────────────────────────────────────────────────

const ClosedTicketRow = ({ chamado, onClick }: { chamado: Chamado; onClick: () => void }) => (
  <div
    className="group flex flex-col lg:flex-row lg:items-center justify-between p-6 hover:bg-slate-50/80 transition-all cursor-pointer border-l-4 border-transparent hover:border-primary"
    onClick={onClick}
  >
    <div className="flex items-start gap-4 flex-1 min-w-0">
      <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-bold text-slate-900 group-hover:text-primary transition-colors truncate">{chamado.titulo}</h3>
        <p className="text-xs text-slate-400 mt-0.5">{chamado.tipo_servico}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <UserIcon className="w-3 h-3" />
            {chamado.solicitante}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <Building2 className="w-3 h-3" />
            {chamado.setor || 'N/A'}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <CalendarDays className="w-3 h-3" />
            {formatDate(chamado.completed_at || chamado.data)}
          </span>
        </div>
      </div>
    </div>

    <div className="flex items-center gap-4 mt-4 lg:mt-0 pl-14 lg:pl-0 shrink-0">
      <div className="flex items-center gap-1.5 text-slate-500">
        <Clock className="w-3.5 h-3.5" />
        <span className="text-xs font-mono font-bold">
          {typeof chamado.tempo_solucao_minutos === 'number' ? formatMinutes(chamado.tempo_solucao_minutos) : '-'}
        </span>
      </div>
      {typeof chamado.avaliacao === 'number' && (
        <div className="flex items-center gap-1 text-slate-500">
          <Smile className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-bold">{chamado.avaliacao}/5</span>
        </div>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10 hover:text-primary"
        onClick={(e) => { e.stopPropagation(); onClick() }}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  </div>
)

const StatusMetric = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{label}</span>
      <span className="text-sm font-bold text-slate-900">{value}%</span>
    </div>
    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
      <div className={cn("h-full transition-all duration-1000", color)} style={{ width: `${value}%` }} />
    </div>
  </div>
)

const SatisfactionChart = ({ chamados }: { chamados: Chamado[] }) => {
  const rated = chamados.filter(r => typeof r.avaliacao === 'number' && r.avaliacao >= 1 && r.avaliacao <= 5)
  const total = rated.length || 1
  const counts = [1, 2, 3, 4, 5].map(star => rated.filter(r => r.avaliacao === star).length)
  const colors = ['bg-red-400', 'bg-orange-400', 'bg-amber-400', 'bg-lime-500', 'bg-green-500']
  const labels = ['Muito Insatisfeito', 'Insatisfeito', 'Neutro', 'Satisfeito', 'Muito Satisfeito']

  return (
    <div className="flex flex-col md:flex-row items-center gap-12">
      <div className="relative h-48 w-48 flex-shrink-0">
        <svg viewBox="0 0 32 32" className="h-full w-full transform -rotate-90">
          {counts.map((n, i) => {
            const pct = (n / total) * 100
            const offset = (counts.slice(0, i).reduce((a, b) => a + b, 0) / total) * 100
            return (
              <circle
                key={i}
                cx="16"
                cy="16"
                r="14"
                fill="transparent"
                stroke={i === 0 ? '#f87171' : i === 1 ? '#fb923c' : i === 2 ? '#fbbf24' : i === 3 ? '#84cc16' : '#22c55e'}
                strokeWidth="4"
                strokeDasharray={`${pct} 100`}
                strokeDashoffset={`-${offset}`}
                className="transition-all duration-1000 ease-out"
              />
            )
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-3xl font-black text-slate-900 tracking-tighter">
            {rated.length ? (rated.reduce((a, b) => a + (b.avaliacao || 0), 0) / rated.length).toFixed(1) : '-'}
          </p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Score</p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 w-full">
        {[5, 4, 3, 2, 1].map((star) => {
          const i = star - 1
          const pct = Math.round((counts[i] / total) * 100)
          return (
            <div key={star} className="flex items-center gap-4">
              <div className={cn("h-3 w-3 rounded-full flex-shrink-0", colors[i])} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-xs font-bold text-slate-600 truncate">{labels[i]}</span>
                  <span className="text-xs font-black text-slate-900 ml-2">{pct}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className={cn("h-full transition-all duration-1000", colors[i])} style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Relatorios
