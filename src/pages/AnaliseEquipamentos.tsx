import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuery } from '@tanstack/react-query'
import { listEquipamentos, type Equipamento } from '@/lib/api/equipamentos'
import { listSetores } from '@/lib/api/setores'
import { useMemo, useState } from 'react'
import {
  Package, Activity, CheckCircle2, Settings2, XCircle,
  Cpu, List,
  FilterX, Hash, User as UserIcon, Building2, HardDrive,
  ChevronRight, LayoutDashboard, SlidersHorizontal
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { MetricCard, PageHeader, EmptyState, SearchInput } from '@/components/shared'
import { getEquipmentStatusConfig, getEquipmentTypeIcon } from '@/lib/config/equipment'

// ── Main Component ──────────────────────────────────────────────────────────

const AnaliseEquipamentos = () => {
  const navigate = useNavigate()
  const { data: equipamentos, isLoading: loadingEquipamentos } = useQuery({ 
    queryKey: ['equipamentos'], 
    queryFn: listEquipamentos, 
    staleTime: 30000 
  })
  const { data: setores } = useQuery({ 
    queryKey: ['setores'], 
    queryFn: listSetores, 
    staleTime: 60000 
  })

  const setoresOptions = useMemo(() => {
    return (setores ?? [])
      .map(s => (s.nome || '').toUpperCase())
      .sort((a, b) => a.localeCompare(b, 'pt', { sensitivity: 'base' }))
  }, [setores])

  // Filters State
  const [search, setSearch] = useState('')
  const [activeType, setActiveType] = useState<string>('all')
  const [activeStatus, setActiveStatus] = useState<string>('all')
  const [activeSetor, setActiveSetor] = useState<string>('all')

  const filtered = useMemo(() => {
    let rows = (equipamentos ?? []) as Equipamento[]
    
    if (search) {
      const term = search.toLowerCase()
      rows = rows.filter(e => 
        e.nome.toLowerCase().includes(term) || 
        e.patrimonio.toLowerCase().includes(term) || 
        (e.usuario ?? '').toLowerCase().includes(term)
      )
    }

    if (activeType !== 'all') rows = rows.filter(e => e.tipo === activeType)
    if (activeStatus !== 'all') rows = rows.filter(e => e.status === activeStatus)
    if (activeSetor !== 'all') rows = rows.filter(e => (e.setor ?? '').toUpperCase() === activeSetor)

    return rows.sort((a, b) => a.nome.localeCompare(b.nome))
  }, [equipamentos, search, activeType, activeStatus, activeSetor])

  const stats = useMemo(() => {
    const total = filtered.length
    const count = (s: string) => filtered.filter(r => r.status === s).length
    return {
      total,
      disponivel: count('Disponível'),
      emUso: count('Em Uso'),
      manutencao: count('Manutenção'),
      inativo: count('Inativo'),
    }
  }, [filtered])

  const tiposDisponiveis = useMemo(() => {
    return Array.from(new Set((equipamentos ?? []).map(e => e.tipo))).sort()
  }, [equipamentos])

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-10 animate-in fade-in duration-700">
      
      {/* ── HEADER ── */}
      <PageHeader
        title="Análise de Inventário"
        description="Métricas e filtros avançados de ativos em tempo real"
        icon={SlidersHorizontal}
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

      {/* ── RESUMO ANALÍTICO (KPIs) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard label="Filtrados" value={stats.total} icon={Package} accent="bg-slate-50 text-slate-600" />
        <MetricCard label="Em Uso" value={stats.emUso} icon={Activity} accent="bg-emerald-50 text-emerald-600" />
        <MetricCard label="Disponíveis" value={stats.disponivel} icon={CheckCircle2} accent="bg-blue-50 text-blue-600" />
        <MetricCard label="Manutenção" value={stats.manutencao} icon={Settings2} accent="bg-amber-50 text-amber-600" />
        <MetricCard label="Inativos" value={stats.inativo} icon={XCircle} accent="bg-slate-50 text-slate-400" />
      </div>

      {/* ── BARRA DE FILTROS (CHIPS) ── */}
      <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Pesquisar por nome, patrimônio ou responsável..."
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
            <FilterChip 
              active={activeType === 'all'} 
              label="Todos Tipos" 
              onClick={() => setActiveType('all')} 
            />
            {tiposDisponiveis.map(tipo => (
              <FilterChip 
                key={tipo}
                active={activeType === tipo} 
                label={tipo} 
                icon={getEquipmentTypeIcon(tipo)}
                onClick={() => setActiveType(tipo)} 
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-2">Refinar por:</span>
          
          <Select value={activeStatus} onValueChange={setActiveStatus}>
            <SelectTrigger className="w-[160px] h-9 rounded-lg border-slate-200 bg-white text-xs font-bold uppercase tracking-wider">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="Disponível">Disponível</SelectItem>
              <SelectItem value="Em Uso">Em Uso</SelectItem>
              <SelectItem value="Manutenção">Manutenção</SelectItem>
              <SelectItem value="Inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>

          <Select value={activeSetor} onValueChange={setActiveSetor}>
            <SelectTrigger className="w-[200px] h-9 rounded-lg border-slate-200 bg-white text-xs font-bold uppercase tracking-wider">
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Setores</SelectItem>
              {setoresOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          {(search || activeType !== 'all' || activeStatus !== 'all' || activeSetor !== 'all') && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => { setSearch(''); setActiveType('all'); setActiveStatus('all'); setActiveSetor('all'); }}
              className="text-xs font-bold text-red-500 hover:text-red-600 hover:bg-red-50 uppercase tracking-wider px-3"
            >
              <FilterX className="w-3.5 h-3.5 mr-1.5" />
              Limpar Filtros
            </Button>
          )}
        </div>
      </div>

      {/* ── LISTA DE RESULTADOS ── */}
      <div className="bg-white rounded-3xl border shadow-md overflow-hidden">
        <div className="p-8 border-b bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <List className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Ativos Catalogados</h2>
          </div>
          <span className="px-4 py-1.5 rounded-full bg-white border text-sm font-bold text-slate-500 shadow-sm">
            {filtered.length} ativos encontrados
          </span>
        </div>

        {loadingEquipamentos ? (
          <div className="p-8 space-y-6">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Nenhum ativo localizado"
            description="Tente ajustar seus critérios de busca ou filtros."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((eq) => (
              <AnaliseItem key={eq.id} equipment={eq} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── SUBCOMPONENTES ──

const FilterChip = ({ active, label, icon: Icon, onClick }: any) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-bold transition-all whitespace-nowrap",
      active 
        ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105" 
        : "bg-white text-slate-600 border-slate-200 hover:border-primary/50 hover:text-primary"
    )}
  >
    {Icon && <Icon className={cn("w-4 h-4", active ? "text-white" : "text-slate-400")} />}
    {label}
  </button>
);

const AnaliseItem = ({ equipment }: { equipment: Equipamento }) => {
  const status = getEquipmentStatusConfig(equipment.status);
  const TypeIcon = getEquipmentTypeIcon(equipment.tipo);

  return (
    <div className="group flex flex-col lg:flex-row lg:items-center justify-between p-8 hover:bg-slate-50/80 transition-all border-l-4 border-transparent hover:border-primary">
      <div className="flex items-center gap-6 flex-1 min-w-0">
        <div className="h-14 w-14 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shadow-sm shrink-0">
          <TypeIcon className="w-7 h-7 text-slate-400 group-hover:text-primary transition-colors" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 mb-1.5">
            <h3 className="text-lg font-bold text-slate-900 truncate">{equipment.nome}</h3>
            <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border", status.color)}>
              {status.label}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-y-2 gap-x-6">
            <div className="flex items-center gap-2 text-slate-500">
              <Hash className="w-3.5 h-3.5" />
              <span className="text-sm font-mono font-bold">{equipment.patrimonio}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <UserIcon className="w-3.5 h-3.5" />
              <span className="text-sm font-medium">{equipment.usuario || 'Sem responsável'}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <Building2 className="w-3.5 h-3.5" />
              <span className="text-sm font-medium">{equipment.setor || 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-8 mt-6 lg:mt-0">
        {/* Specs Rápidas */}
        <div className="flex items-center gap-4 border-x px-8 border-slate-100">
          <div className="flex flex-col items-center">
            <Cpu className="w-4 h-4 text-slate-300 mb-1" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">{equipment.ram || '-'}</span>
          </div>
          <div className="flex flex-col items-center">
            <HardDrive className="w-4 h-4 text-slate-300 mb-1" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">{equipment.armazenamento || '-'}</span>
          </div>
        </div>

        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors">
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
};

export default AnaliseEquipamentos;
