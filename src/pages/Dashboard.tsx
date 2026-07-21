import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { 
  Activity, 
  Zap, 
  ShieldAlert, 
  Timer, 
  ArrowUpRight, 
  ChevronRight,
  Bell,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock
} from 'lucide-react';
import { motion, Variants } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { listChamados } from '@/lib/api/chamados';
import { cn } from '@/lib/utils';

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

function parseChamadoDate(value?: string) {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Data Fetching
  const { data: chamados, isLoading: loadingChamados, refetch } = useQuery({ 
    queryKey: ['chamados'], 
    queryFn: listChamados, 
    staleTime: 30000 
  });

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Calculations & Strategic Analytics
  const analytics = useMemo(() => {
    if (!chamados) return null;

    const total = chamados.length;
    const abertos = chamados.filter(c => c.status === 'Aberto').length;
    const criticos = chamados.filter(c => c.prioridade === 'alta' && c.status !== 'Concluído').length;

    const durations = chamados
      .filter(c => c.status === 'Concluído')
      .map(c => {
        if (typeof c.tempo_solucao_minutos === 'number') return c.tempo_solucao_minutos;
        const s = parseChamadoDate(c.started_at || c.created_at || c.data);
        const e = parseChamadoDate(c.completed_at);
        return s && e ? (e.getTime() - s.getTime()) / 60000 : null;
      })
      .filter((m): m is number => m !== null && m > 0 && isFinite(m));
    const avgMinutes = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;
    const formatAvg = (m: number | null) => {
      if (m === null) return '-';
      if (m < 60) return `${m}m`;
      const h = Math.floor(m / 60), min = m % 60;
      return min > 0 ? `${h}h ${min}m` : `${h}h`;
    };

    return {
      total,
      abertos,
      criticos,
      systemStatus: criticos > 5 ? 'Atenção Necessária' : 'Estável',
      systemColor: criticos > 5 ? 'rose' : 'emerald',
      metrics: [
        {
          title: 'Total de Chamados',
          value: total,
          label: total > 200 ? 'Volume sob controle' : 'Fluxo estável',
          icon: Activity,
          trend: null,
          trendType: 'neutral',
          color: 'emerald'
        },
        {
          title: 'Aguardando Triagem',
          value: abertos,
          label: abertos === 0 ? 'Fila limpa' : `${abertos} pendentes de ação`,
          icon: Zap,
          trend: null,
          trendType: 'neutral',
          color: abertos > 0 ? 'amber' : 'emerald'
        },
        {
          title: 'Impacto Crítico',
          value: criticos,
          label: criticos === 0 ? 'Nenhum bloqueio' : 'Ação imediata requerida',
          icon: ShieldAlert,
          trend: criticos > 0 ? 'Urgente' : 'Estável',
          trendType: criticos > 0 ? 'up' : 'neutral',
          color: criticos > 0 ? 'rose' : 'emerald'
        },
        {
          title: 'Eficiência de Resposta',
          value: formatAvg(avgMinutes),
          label: avgMinutes !== null ? 'Média real de resolução' : 'Sem dados suficientes',
          icon: Timer,
          trend: null,
          trendType: 'neutral',
          color: 'emerald'
        },
      ]
    };
  }, [chamados]);

  // Chart Data (real)
  const chartData = useMemo(() => {
    const base = WEEK_DAYS.map((day) => ({
      name: day,
      chamados: 0,
      resolvidos: 0,
    }));

    for (const chamado of chamados ?? []) {
      const openedAt = parseChamadoDate(chamado.data || chamado.created_at);
      if (openedAt) {
        base[openedAt.getDay()].chamados += 1;
      }

      const resolvedAt = parseChamadoDate(chamado.completed_at);
      if (resolvedAt) {
        base[resolvedAt.getDay()].resolvidos += 1;
      }
    }

    return [...base.slice(1), base[0]];
  }, [chamados]);

  const criticosList = useMemo(() => {
    return (chamados ?? [])
      .filter(c => c.prioridade === 'alta' && c.status !== 'Concluído')
      .slice(0, 5);
  }, [chamados]);

  const openCriticalQueue = () => {
    navigate('/chamados?priority=alta');
  };

  const openCriticalTicket = (ticketId: string) => {
    navigate(`/chamados?priority=alta&ticket=${ticketId}`);
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const itemVariants: Variants = {
    hidden: { y: 15, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1, 
      transition: { 
        duration: 0.4, 
        ease: [0.23, 1, 0.32, 1] 
      } 
    }
  };

  if (loadingChamados) {
    return (
      <div className="space-y-8 p-1 animate-pulse">
        <div className="h-16 bg-emerald-950/20 rounded-2xl border border-emerald-900/20" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-emerald-950/10 rounded-2xl border border-emerald-900/10" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-emerald-950/5 rounded-2xl border border-emerald-900/10" />
          <div className="h-80 bg-emerald-950/5 rounded-2xl border border-emerald-900/10" />
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8 pb-12 font-sans selection:bg-emerald-500/30"
    >
      {/* 01. HEADER ESTRATÉGICO */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider animate-in fade-in slide-in-from-left-2",
              analytics?.criticos !== undefined && analytics.criticos > 0 
                ? "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400" 
                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", analytics?.criticos !== undefined && analytics.criticos > 0 ? "bg-rose-500" : "bg-emerald-500")} />
              {analytics?.systemStatus}
            </div>
            <span className="text-slate-300 dark:text-white/20 text-xs">•</span>
            <span className="text-slate-400 dark:text-white/40 text-[10px] font-bold uppercase tracking-widest">
              Live Monitoring
            </span>
          </div>
          <h1 className="title-primary mb-2">
            Operação <span className="text-primary">Concrem.</span>
          </h1>
          <p className="text-secondary max-w-lg">
            {analytics?.abertos !== undefined && analytics.abertos > 0 
              ? `Existem ${analytics?.abertos} chamados aguardando triagem imediata para manter o SLA.`
              : 'Excelente! Todos os chamados foram triados e a fila está limpa.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="btn-secondary rounded-xl h-12 px-5"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
            Atualizar
          </Button>
          <Button 
            onClick={() => navigate('/chamados')}
            className="btn-primary rounded-xl h-12 px-6 shadow-lg shadow-primary/20"
          >
            <Zap className="w-4 h-4 mr-2 fill-current" />
            Novo Chamado
          </Button>
        </div>
      </div>

      {/* 02. CARDS DE MÉTRICAS (Acionáveis e Dinâmicos) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {analytics?.metrics.map((stat) => (
          <motion.div key={stat.title} variants={itemVariants} whileHover={{ y: -4 }}>
            <Card className="premium-card overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={cn(
                    "p-2.5 rounded-xl bg-surface-muted",
                    stat.color === 'emerald' && "text-emerald-600 dark:text-emerald-400",
                    stat.color === 'amber' && "text-amber-600 dark:text-amber-400",
                    stat.color === 'rose' && "text-rose-600 dark:text-rose-400"
                  )}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  {stat.trend !== null && (
                    <div className={cn(
                      "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full",
                      stat.trendType === 'up' && stat.color === 'rose' ? "bg-rose-500/10 text-rose-600" : "bg-emerald-500/10 text-emerald-600",
                      stat.trendType === 'neutral' && "bg-slate-500/10 text-slate-600"
                    )}>
                      {stat.trend}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-secondary text-xs font-bold uppercase tracking-wider mb-1">{stat.title}</p>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-2xl font-black text-foreground">{stat.value}</h3>
                  </div>
                  <p className="text-secondary text-xs mt-2 flex items-center gap-1">
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      stat.color === 'emerald' && "bg-emerald-500",
                      stat.color === 'amber' && "bg-amber-500",
                      stat.color === 'rose' && "bg-rose-500"
                    )} />
                    {stat.label}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* 03. GRÁFICO E CHAMADOS CRÍTICOS (Hierarquia Clara) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Gráfico Modernizado */}
        <motion.div variants={itemVariants} className="lg:col-span-8">
          <Card className="premium-card h-full overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-8">
              <div>
                <CardTitle className="text-xl font-bold">Fluxo de Demanda</CardTitle>
                <CardDescription className="text-secondary uppercase text-[10px] font-bold tracking-widest mt-1">Análise de volume vs resoluções</CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">Abertos</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">Resolvidos</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="h-[300px] w-full pr-0 pl-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAreaEmerald" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorAreaBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'hsl(var(--muted))', fontSize: 10, fontWeight: 600 }}
                    dy={10}
                  />
                  <YAxis hide />
                  <Tooltip 
                    cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))', 
                      borderRadius: '12px',
                      padding: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: 'hsl(var(--foreground))' }}
                  />
                  <Area type="monotone" dataKey="chamados" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorAreaEmerald)" />
                  <Area type="monotone" dataKey="resolvidos" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorAreaBlue)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Chamados Críticos (Destaque Real) */}
        <motion.div variants={itemVariants} className="lg:col-span-4">
          <Card className={cn(
            "premium-card h-full overflow-hidden flex flex-col",
            analytics?.criticos !== undefined && analytics.criticos > 0 && "border-rose-500/20 shadow-[0_0_40px_-15px_rgba(244,63,94,0.1)]"
          )}>
            <CardHeader className="border-b border-border pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold">Bloqueios Críticos</CardTitle>
                  <CardDescription className="text-secondary uppercase text-[10px] font-bold tracking-widest mt-1">Ação prioritária imediata</CardDescription>
                </div>
                {analytics?.criticos !== undefined && analytics.criticos > 0 && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/20">
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto">
              <div className="divide-y divide-border">
                {criticosList.length > 0 ? criticosList.map((c, i) => (
                  <motion.div 
                    key={c.id} 
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.2 + (i * 0.1) }}
                    className="p-5 hover:bg-surface-muted transition-all cursor-pointer group relative"
                    role="button"
                    tabIndex={0}
                    onClick={() => openCriticalTicket(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openCriticalTicket(c.id);
                      }
                    }}
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-start gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.4)] animate-pulse" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-bold text-rose-500 uppercase tracking-widest">Prioridade Crítica</p>
                          <span className="text-[10px] text-muted-foreground font-medium uppercase">{c.data}</span>
                        </div>
                        <h4 className="text-sm font-bold text-foreground group-hover:text-rose-500 transition-colors line-clamp-1 leading-none py-1">
                          {c.titulo}
                        </h4>
                        <p className="text-[11px] text-muted-foreground font-medium line-clamp-1 italic">
                          Solicitante: {c.solicitante}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground/30 group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                    </div>
                  </motion.div>
                )) : (
                  <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/5 flex items-center justify-center border border-emerald-500/10">
                      <CheckCircle2 size={32} className="text-emerald-500/20" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-foreground">Operação Limpa</p>
                      <p className="text-[11px] text-secondary font-medium">Nenhum chamado crítico pendente de ação.</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            {criticosList.length > 0 && (
              <div className="p-4 bg-surface-muted border-t border-border">
                <Button
                  variant="ghost"
                  onClick={openCriticalQueue}
                  className="w-full text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground hover:bg-transparent transition-all"
                >
                  Ver Fila de Urgência <ArrowUpRight size={14} className="ml-2" />
                </Button>
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* 04. RODAPÉ DE INFRAESTRUTURA (Sensação de Sistema Vivo) */}
      <motion.div 
        variants={itemVariants}
        className="flex flex-col md:flex-row items-center justify-between p-6 premium-card gap-4"
      >
        <div className="flex flex-wrap items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping opacity-75" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-secondary uppercase tracking-widest leading-none mb-1">Status Global</p>
              <p className="text-xs font-bold text-foreground leading-none tracking-tight">Infraestrutura Operacional</p>
            </div>
          </div>
          <div className="h-8 w-px bg-border hidden md:block" />
          <div className="flex items-center gap-3">
            <Activity className="w-4 h-4 text-primary/50" />
            <div>
              <p className="text-[10px] font-bold text-secondary uppercase tracking-widest leading-none mb-1">Database</p>
              <p className="text-xs font-bold text-foreground leading-none tracking-tight">Sincronizado</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Bell className="w-4 h-4 text-primary/50" />
            <div>
              <p className="text-[10px] font-bold text-secondary uppercase tracking-widest leading-none mb-1">Notificações</p>
              <p className="text-xs font-bold text-foreground leading-none tracking-tight">Habilitadas</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 px-4 py-2 bg-surface-muted rounded-full border border-border">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em]">
            Último Scan: agora mesmo
          </span>
        </div>
      </motion.div>
    </motion.div>

  );
};

export default Dashboard;
