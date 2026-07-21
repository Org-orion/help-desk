import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuery } from '@tanstack/react-query'
import { listChamados, type Chamado } from '@/lib/api/chamados'
import { useMemo, useState, useCallback } from 'react'
import {
  HeadphonesIcon,
  LayoutDashboard,
  ListFilter,
  FilterX,
  Clock3,
  CircleDashed,
  CheckCircle2,
  AlertCircle,
  UserCog,
  CalendarDays,
  BriefcaseBusiness,
  ArrowUpRight,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { MetricCard, StatusBadge, PageHeader, EmptyState, SearchInput } from '@/components/shared'
import { formatMinutes, formatDate } from '@/lib/utils/format'

const AnaliseServicos = () => {
  const navigate = useNavigate()
  const { data: chamados, isLoading } = useQuery({ queryKey: ['chamados'], queryFn: listChamados, staleTime: 30000 })

  const tipos = useMemo(() => Array.from(new Set((chamados ?? []).map(c => c.tipo_servico))).filter(Boolean), [chamados])
  const responsaveis = useMemo(
    () => Array.from(new Set((chamados ?? []).map(c => c.usuario))).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [chamados]
  )

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | Chamado['status']>('all')
  const [tipoFilter, setTipoFilter] = useState<string>('all')
  const [responsavelFilter, setResponsavelFilter] = useState<string>('all')
  const [periodo, setPeriodo] = useState<'todos' | 'hoje' | 'semana' | 'mes'>('todos')

  const parseRowDate = (d?: string) => {
    if (!d) return null
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(d)
    const dt = isDateOnly ? new Date(`${d}T00:00:00`) : new Date(d)
    return isNaN(dt.getTime()) ? null : dt
  }

  const isInPeriodo = useCallback((dateStr?: string) => {
    if (!dateStr || periodo === 'todos') return true
    const d = parseRowDate(dateStr)
    if (!d) return false
    const now = new Date()
    if (periodo === 'hoje') {
      return d.toDateString() === now.toDateString()
    }
    if (periodo === 'semana') {
      const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
      return diff <= 7
    }
    if (periodo === 'mes') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }
    return true
  }, [periodo])

  const filtered = useMemo(() => {
    const rows = (chamados ?? [])
    return rows.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (tipoFilter !== 'all' && c.tipo_servico !== tipoFilter) return false
      if (responsavelFilter !== 'all' && c.usuario !== responsavelFilter) return false
      const rowDate = c.completed_at || c.data || c.created_at
      if (!isInPeriodo(rowDate)) return false
      const term = search.toLowerCase()
      if (term && !`${c.titulo} ${c.usuario} ${c.solicitante} ${c.tipo_servico}`.toLowerCase().includes(term)) return false
      return true
    })
  }, [chamados, statusFilter, tipoFilter, responsavelFilter, search, isInPeriodo])

  const metrics = useMemo(() => {
    const rows = filtered
    const hojeStr = (() => {
      const now = new Date()
      const y = now.getFullYear()
      const m = String(now.getMonth() + 1).padStart(2, '0')
      const d = String(now.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    })()
    const feitosHoje = rows.filter(r => {
      const rowDate = r.completed_at || r.data || r.created_at
      if (!rowDate) return false
      if (/^\d{4}-\d{2}-\d{2}$/.test(rowDate)) return rowDate === hojeStr && r.status === 'Concluído'
      const dt = parseRowDate(rowDate)
      return !!dt && dt.toDateString() === new Date().toDateString() && r.status === 'Concluído'
    }).length
    const total = rows.length
    const concluidos = rows.filter(r => r.status === 'Concluído').length
    const emAberto = rows.filter(r => r.status === 'Aberto').length
    const emAndamento = rows.filter(r => r.status === 'Em Andamento').length
    const durationsMs = rows
      .filter(r => r.status === 'Concluído' && !!r.started_at && !!r.completed_at)
      .map(r => {
        const start = new Date(r.started_at as string).getTime()
        const end = new Date(r.completed_at as string).getTime()
        return Math.max(0, end - start)
      })
    const minMs = durationsMs.length ? Math.min(...durationsMs) : null
    const tempoMinimoPorServico = (() => {
      if (!minMs || !isFinite(minMs)) return '-'
      const totalMin = Math.floor(minMs / 60000)
      const h = Math.floor(totalMin / 60)
      const m = totalMin % 60
      if (h > 0) return `${h}h ${m}m`
      return `${m}m`
    })()
    const durationsMin = durationsMs.map(ms => Math.floor(ms / 60000)).filter(m => Number.isFinite(m))
    const tempoMedio = durationsMin.length ? formatMinutes(Math.floor(durationsMin.reduce((acc, m) => acc + m, 0) / durationsMin.length)) : '-'
    return { total, concluidos, tempoMinimoPorServico, tempoMedio, feitosHoje, emAberto, emAndamento }
  }, [filtered])

  const hasActiveFilters = search || statusFilter !== 'all' || tipoFilter !== 'all' || responsavelFilter !== 'all' || periodo !== 'todos'

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-10 animate-in fade-in duration-700">
      <PageHeader
        title="Análise de Serviços"
        description="Visão operacional dos atendimentos com foco em status, fila e performance."
        icon={HeadphonesIcon}
        action={
          <Button
            variant="outline"
            onClick={() => navigate('/dashboard')}
            className="h-12 px-6 rounded-xl border-slate-200 hover:bg-slate-50 font-bold transition-all"
          >
            <LayoutDashboard className="w-5 h-5 mr-2 text-slate-400" />
            Painel de Controle
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          label="Filtrados"
          value={metrics.total}
          description="Volume atual na análise"
          accent="bg-slate-50 text-slate-700"
          icon={BriefcaseBusiness}
        />
        <MetricCard
          label="Concluídos"
          value={metrics.concluidos}
          description="Finalizados no recorte"
          accent="bg-emerald-50 text-emerald-700"
          icon={CheckCircle2}
        />
        <MetricCard
          label="Em aberto"
          value={metrics.emAberto}
          description="Demandas aguardando ação"
          accent="bg-rose-50 text-rose-700"
          icon={AlertCircle}
        />
        <MetricCard
          label="Em andamento"
          value={metrics.emAndamento}
          description="Execução em curso"
          accent="bg-amber-50 text-amber-700"
          icon={CircleDashed}
        />
        <MetricCard
          label="Tempo médio"
          value={metrics.tempoMedio}
          description={`Melhor tempo: ${metrics.tempoMinimoPorServico}`}
          accent="bg-blue-50 text-blue-700"
          icon={Clock3}
        />
      </div>

      <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ListFilter className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Filtros operacionais</h2>
            <p className="text-sm text-slate-500">Use busca e seletores para refinar a visão do time.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(180px,1fr))_auto] gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por título, solicitante, responsável ou tipo..."
          />

          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {tipos.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | Chamado['status'])}>
            <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="Aberto">Aberto</SelectItem>
              <SelectItem value="Em Andamento">Em Andamento</SelectItem>
              <SelectItem value="Concluído">Concluído</SelectItem>
            </SelectContent>
          </Select>

          <Select value={responsavelFilter} onValueChange={setResponsavelFilter}>
            <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os responsáveis</SelectItem>
              {responsaveis.map((nome) => (
                <SelectItem key={nome} value={nome}>
                  {nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={periodo} onValueChange={(v) => setPeriodo(v as 'todos' | 'hoje' | 'semana' | 'mes')}>
            <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todo período</SelectItem>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="semana">Últimos 7 dias</SelectItem>
              <SelectItem value="mes">Este mês</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => {
              setSearch('')
              setStatusFilter('all')
              setTipoFilter('all')
              setResponsavelFilter('all')
              setPeriodo('todos')
            }}
            className="h-11 rounded-xl border-slate-200 px-4"
            disabled={!hasActiveFilters}
          >
            <FilterX className="w-4 h-4" />
            Limpar
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden rounded-3xl border shadow-md">
        <CardHeader className="p-8 border-b bg-slate-50/50">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold text-slate-900">Fila de serviços</CardTitle>
              <CardDescription className="mt-2 text-slate-500">
                Leitura rápida por status, tipo, responsável e data de execução.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="rounded-full px-4 py-1.5 text-sm font-bold border-slate-200 text-slate-600 bg-white">
                {filtered.length} registros
              </Badge>
              <Badge variant="outline" className="rounded-full px-4 py-1.5 text-sm font-bold border-slate-200 text-slate-600 bg-white">
                {metrics.feitosHoje} concluídos hoje
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3, 4].map((item) => (
                <Skeleton key={item} className="h-28 w-full rounded-2xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={HeadphonesIcon}
              title="Nenhum serviço encontrado"
              description="Ajuste os filtros para ampliar a visão operacional."
            />
          ) : (
            <>
              <div className="divide-y divide-slate-100">
                {filtered.slice(0, 100).map((chamado) => (
                  <ServiceRow key={chamado.id} chamado={chamado} />
                ))}
              </div>
              {filtered.length > 100 && (
                <div className="px-8 py-4 border-t bg-amber-50/60 flex items-center justify-between">
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                    Exibindo 100 de {filtered.length} resultados
                  </p>
                  <p className="text-xs text-amber-600 font-medium">
                    Refine os filtros para ver os demais registros
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const ServiceRow = ({ chamado }: { chamado: Chamado }) => {
  const rowDate = chamado.completed_at || chamado.data || chamado.created_at

  return (
    <div className="group flex flex-col xl:flex-row xl:items-center justify-between gap-6 p-6 hover:bg-slate-50/70 transition-all border-l-4 border-transparent hover:border-primary">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h3 className="text-lg font-bold text-slate-900 truncate">{chamado.titulo}</h3>
          <Badge variant="outline" className="rounded-full border-slate-200 bg-white text-slate-600 font-semibold px-3 py-1">
            {chamado.tipo_servico}
          </Badge>
          {chamado.is_vip && (
            <Badge className="rounded-full px-3 py-1 bg-violet-100 text-violet-700 border-violet-200">
              VIP
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-500">
          <div className="flex items-center gap-2 min-w-0">
            <UserCog className="w-4 h-4 text-slate-400" />
            <span className="font-medium truncate">{chamado.usuario || 'Sem responsável'}</span>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <BriefcaseBusiness className="w-4 h-4 text-slate-400" />
            <span className="font-medium truncate">{chamado.solicitante || 'Sem solicitante'}</span>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <CalendarDays className="w-4 h-4 text-slate-400" />
            <span className="font-medium">{formatDate(rowDate)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 xl:pl-6 xl:border-l xl:border-slate-100">
        <StatusBadge status={chamado.status} />
        <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3 min-w-[180px]">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Performance</div>
          <div className="mt-1 flex items-center gap-2 text-slate-700">
            <Clock3 className="w-4 h-4 text-slate-400" />
            <span className="font-semibold">{formatMinutes(chamado.tempo_solucao_minutos ?? chamado.solution_duration_min ?? null)}</span>
          </div>
        </div>
        <div className="hidden xl:flex items-center justify-center h-10 w-10 rounded-xl bg-slate-100 text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
          <ArrowUpRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  )
}

export default AnaliseServicos
