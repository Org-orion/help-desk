import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useResponsive } from '@/hooks/useResponsive';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Search, Clock, Trash2, FilterX, ChevronRight,
  AlertTriangle, Activity, CheckCircle2, Inbox, Star,
  User as UserIcon, Building2, Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listChamados, createChamado, updateChamado, deleteChamado, rateChamado,
  type Chamado as ChamadoType,
} from '@/lib/api/chamados';
import { listSetores, type Setor as SetorType } from '@/lib/api/setores';
import { listUsuarios, createUsuario, type Usuario } from '@/lib/api/usuarios';

interface Ticket extends Omit<ChamadoType, 'tipo_servico' | 'is_vip'> {
  tipoServico: string;
  isVip?: boolean;
}

// ── Badge helpers ────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    alta: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-900/40',
    media: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900/40',
    baixa: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700',
  };
  const labels: Record<string, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
  return (
    <Badge variant="outline" className={cn(styles[priority] ?? styles.baixa)}>
      {labels[priority] ?? priority}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    'Aberto': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900/40',
    'Em Andamento': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-900/40',
    'Concluído': 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700',
  };
  return (
    <Badge variant="outline" className={styles[status] ?? styles['Aberto']}>
      {status}
    </Badge>
  );
}

function VipBadge() {
  return (
    <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40 gap-1">
      <Star className="w-2.5 h-2.5 fill-current" />
      VIP
    </Badge>
  );
}

function priorityDot(priority: string) {
  if (priority === 'alta') return 'bg-red-500';
  if (priority === 'media') return 'bg-amber-400';
  return 'bg-slate-400 dark:bg-slate-500';
}

// ── Skeleton row ─────────────────────────────────────────────────────────────

function TicketRowSkeleton() {
  return (
    <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100 dark:border-emerald-900/20 last:border-0">
      <Skeleton className="mt-2 h-2 w-2 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
        <div className="flex gap-2 mt-1">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const Chamados = () => {
  const queryClient = useQueryClient();
  useResponsive();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const currentUserName = user?.name || user?.email || '';

  const { data: chamadosData, isLoading: loadingChamados } = useQuery({
    queryKey: ['chamados'],
    queryFn: async () => {
      const rows = await listChamados();
      return rows.map(r => ({ ...r, tipoServico: r.tipo_servico, isVip: r.is_vip })) as Ticket[];
    },
    staleTime: 1000 * 30,
  });

  const { data: setoresData } = useQuery({
    queryKey: ['setores'],
    queryFn: async () => await listSetores(),
    staleTime: 1000 * 60,
  });

  const { data: usuariosData } = useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => await listUsuarios(),
    staleTime: 1000 * 60,
  });

  const chamados = (chamadosData ?? []) as Ticket[];
  const setoresList = (setoresData ?? [])
    .map((s: SetorType) => ({ id: s.id, nome: (s.nome || '').toUpperCase() }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }));
  const solicitantesList = (usuariosData ?? [])
    .map((u: Usuario) => ({ id: u.id, nome: u.name || u.username }))
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt', { sensitivity: 'base' }));

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [setorFilter, setSetorFilter] = useState<string>('all');

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all' || priorityFilter !== 'all' || setorFilter !== 'all';
  const clearFilters = () => { setSearchTerm(''); setStatusFilter('all'); setPriorityFilter('all'); setSetorFilter('all'); };

  // Sheets / dialogs
  const [sheetOpen, setSheetOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  // Form
  const emptyForm = { titulo: '', descricao: '', solicitante: '', setor: '', tipoServico: '', prioridade: 'media' as 'baixa' | 'media' | 'alta', isVip: false };
  const [formData, setFormData] = useState(emptyForm);

  const [newUser, setNewUser] = useState({ nome: '', username: '', setor: '', password: '', tipo: 'padrao' as 'padrao' | 'vip' | 'admin' });

  useEffect(() => {
    if (sheetOpen) {
      const currUser = (usuariosData ?? []).find((u: Usuario) => (u.name || u.username) === currentUserName);
      setFormData(fd => ({
        ...fd,
        solicitante: currentUserName || fd.solicitante,
        setor: (currUser?.setor || fd.setor).toUpperCase(),
      }));
    }
  }, [sheetOpen, usuariosData, currentUserName]);

  // Mutations
  const createMut = useMutation({
    mutationFn: async () => {
      return await createChamado({
        titulo: formData.titulo,
        descricao: formData.descricao,
        usuario: user?.name || user?.email || 'Usuário Atual',
        solicitante: formData.solicitante,
        setor: formData.setor,
        tipo_servico: formData.tipoServico,
        is_vip: user?.tier === 'vip',
        status: 'Aberto',
        data: new Date().toISOString().split('T')[0],
        prioridade: formData.prioridade,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['chamados'] });
      setFormData(emptyForm);
      setSheetOpen(false);
      toast.success(user?.tier === 'vip' ? 'Chamado VIP aberto e priorizado!' : 'Chamado aberto com sucesso!');
    },
    onError: () => toast.error('Falha ao abrir chamado'),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<ChamadoType> }) => updateChamado(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['chamados'] });
      toast.success('Chamado atualizado!');
      setViewOpen(false);
      setSelectedTicket(null);
    },
    onError: () => toast.error('Falha ao atualizar chamado'),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => deleteChamado(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['chamados'] });
      toast.success('Chamado excluído');
      setViewOpen(false);
      setSelectedTicket(null);
    },
    onError: () => toast.error('Falha ao excluir chamado'),
  });

  const canEditTicket = (t: Ticket) => (isAdmin || t.solicitante === currentUserName) && t.status !== 'Concluído';

  const handleView = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setFormData({ titulo: ticket.titulo, descricao: ticket.descricao, solicitante: ticket.solicitante, setor: ticket.setor, tipoServico: ticket.tipoServico, prioridade: ticket.prioridade, isVip: ticket.isVip ?? false });
    setViewOpen(true);
  };

  useEffect(() => {
    const priority = searchParams.get('priority');
    if (priority && ['alta', 'media', 'baixa'].includes(priority)) {
      setPriorityFilter(priority);
    }
  }, [searchParams]);

  useEffect(() => {
    const ticketId = searchParams.get('ticket');
    if (!ticketId || chamados.length === 0) return;

    const ticket = chamados.find((item) => item.id === ticketId);
    if (!ticket) return;

    handleView(ticket);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('ticket');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, chamados, setSearchParams]);

  const updateStatus = (id: string, newStatus: Ticket['status']) => updateMut.mutate({ id, input: { status: newStatus } });

  // Filtered tickets (queue — excludes Concluído)
  const filteredTickets = chamados.filter(ticket => {
    if (ticket.status === 'Concluído') return false;
    const s = searchTerm.toLowerCase();
    const matchSearch = ticket.titulo.toLowerCase().includes(s) || ticket.descricao.toLowerCase().includes(s) || ticket.solicitante.toLowerCase().includes(s);
    const matchStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchPriority = priorityFilter === 'all' || ticket.prioridade === priorityFilter;
    const matchSetor = setorFilter === 'all' || ticket.setor === setorFilter;
    return matchSearch && matchStatus && matchPriority && matchSetor;
  });
  const orderedTickets = [...filteredTickets].sort((a, b) => (b.isVip ? 1 : 0) - (a.isVip ? 1 : 0));

  const myTicketsAll = chamados.filter(t => t.solicitante === currentUserName);

  // KPI stats
  const todayStr = new Date().toISOString().split('T')[0];
  const src = isAdmin ? chamados : myTicketsAll;
  const stats = {
    abertos: src.filter(t => t.status === 'Aberto').length,
    altaPrioridade: src.filter(t => t.prioridade === 'alta' && t.status !== 'Concluído').length,
    emAtendimento: src.filter(t => t.status === 'Em Andamento').length,
    resolvidosHoje: src.filter(t => t.status === 'Concluído' && ((t.data ?? '').startsWith(todayStr) || (t.completed_at ?? '').startsWith(todayStr))).length,
  };

  // Rating
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingTicket, setRatingTicket] = useState<Ticket | null>(null);
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingComment, setRatingComment] = useState('');

  useEffect(() => {
    if (isAdmin) return;
    const first = myTicketsAll.find(t => t.status === 'Concluído' && !t.avaliado);
    if (!first) return;
    const key = `rating_shown_${first.id}`;
    if (!localStorage.getItem(key)) { setRatingTicket(first); setRatingOpen(true); localStorage.setItem(key, '1'); }
  }, [myTicketsAll, isAdmin]);

  const sendRatingMut = useMutation({
    mutationFn: async () => {
      if (!ratingTicket || ratingStars < 1) throw new Error('Selecione uma avaliação');
      return await rateChamado(ratingTicket.id, ratingStars, ratingComment || undefined);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['chamados'] });
      toast.success('Avaliação enviada. Obrigado!');
      setRatingOpen(false); setRatingTicket(null); setRatingStars(0); setRatingComment('');
    },
    onError: () => toast.error('Falha ao enviar avaliação'),
  });
  const postponeRating = () => { if (ratingTicket) localStorage.setItem(`rating_postpone_${ratingTicket.id}`, '1'); setRatingOpen(false); };

  // ── Sub-components (need closure over handlers) ──────────────────────────

  const TicketRow = ({ ticket, showRating = false }: { ticket: Ticket; showRating?: boolean }) => (
    <div
      className="group flex items-start gap-3 px-5 py-4 hover:bg-slate-50 dark:hover:bg-emerald-950/20 cursor-pointer transition-colors"
      onClick={() => handleView(ticket)}
    >
      <div className={cn('mt-2 h-2 w-2 rounded-full shrink-0', priorityDot(ticket.prioridade))} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-slate-900 dark:text-white truncate leading-snug">{ticket.titulo}</p>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
              <UserIcon className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[120px]">{ticket.solicitante}</span>
              <span>·</span>
              <Building2 className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[100px]">{ticket.setor}</span>
              {ticket.tipoServico && (
                <><span>·</span><Tag className="w-3 h-3 shrink-0" /><span className="truncate max-w-[100px]">{ticket.tipoServico}</span></>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            {!showRating && <PriorityBadge priority={ticket.prioridade} />}
            {ticket.isVip && <VipBadge />}
            <StatusBadge status={ticket.status} />
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            <Clock className="w-3 h-3" />
            <span>{ticket.data}</span>
          </div>
          <div className="flex items-center gap-2">
            {showRating && ticket.status === 'Concluído' && (
              ticket.avaliado ? (
                <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40">Avaliado</Badge>
              ) : (
                <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={(e) => { e.stopPropagation(); setRatingTicket(ticket); setRatingOpen(true); }}>
                  Avaliar
                </Button>
              )
            )}
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5">
              Ver detalhes <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const TicketList = ({ tickets, emptyText, showRating = false }: { tickets: Ticket[]; emptyText?: string; showRating?: boolean }) => {
    if (loadingChamados) {
      return <div className="divide-y divide-slate-100 dark:divide-emerald-900/20">{[...Array(4)].map((_, i) => <TicketRowSkeleton key={i} />)}</div>;
    }
    if (tickets.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
            <Inbox className="w-6 h-6 text-slate-400 dark:text-slate-500" />
          </div>
          <p className="font-medium text-slate-700 dark:text-slate-300 text-sm">
            {hasActiveFilters ? 'Nenhum resultado' : 'Fila limpa por enquanto'}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {emptyText ?? (hasActiveFilters ? 'Nenhum chamado com os filtros atuais.' : 'Nenhum chamado em aberto no momento.')}
          </p>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="mt-3 text-xs" onClick={clearFilters}>
              <FilterX className="w-3 h-3 mr-1.5" />Limpar filtros
            </Button>
          )}
        </div>
      );
    }
    return (
      <div className="divide-y divide-slate-100 dark:divide-emerald-900/20">
        {tickets.map(t => <TicketRow key={t.id} ticket={t} showRating={showRating} />)}
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">Central de Chamados</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Acompanhe solicitações, prioridades e atendimentos em tempo real.
          </p>
        </div>
        <Button
          className="shrink-0 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white"
          onClick={() => setSheetOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Chamado
        </Button>
      </div>

      {/* KPI Mini Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Inbox,        label: 'Abertos',          value: stats.abertos,        textColor: 'text-blue-600 dark:text-blue-400',    bgColor: 'bg-blue-50 dark:bg-blue-950/30' },
          { icon: AlertTriangle,label: 'Alta prioridade',  value: stats.altaPrioridade, textColor: 'text-red-600 dark:text-red-400',      bgColor: 'bg-red-50 dark:bg-red-950/30' },
          { icon: Activity,     label: 'Em atendimento',   value: stats.emAtendimento,  textColor: 'text-amber-600 dark:text-amber-400',  bgColor: 'bg-amber-50 dark:bg-amber-950/30' },
          { icon: CheckCircle2, label: 'Resolvidos hoje',  value: stats.resolvidosHoje, textColor: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30' },
        ].map(({ icon: Icon, label, value, textColor, bgColor }) => (
          <div key={label} className="rounded-xl border border-slate-200 dark:border-emerald-900/40 bg-white dark:bg-[#061C14] px-4 py-3 flex items-center gap-3">
            <div className={cn('p-2 rounded-lg shrink-0', bgColor)}>
              <Icon className={cn('w-4 h-4', textColor)} />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-slate-950 dark:text-white leading-none">{value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar por título, solicitante..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 bg-white dark:bg-[#061C14] border-slate-200 dark:border-emerald-900/40 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36 h-9 bg-white dark:bg-[#061C14] border-slate-200 dark:border-emerald-900/40 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="Aberto">Aberto</SelectItem>
            <SelectItem value="Em Andamento">Em Atendimento</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-full sm:w-36 h-9 bg-white dark:bg-[#061C14] border-slate-200 dark:border-emerald-900/40 text-sm">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>
        {setoresList.length > 0 && (
          <Select value={setorFilter} onValueChange={setSetorFilter}>
            <SelectTrigger className="w-full sm:w-40 h-9 bg-white dark:bg-[#061C14] border-slate-200 dark:border-emerald-900/40 text-sm">
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              {setoresList.map(s => <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-9 text-sm text-slate-500 dark:text-slate-400 shrink-0" onClick={clearFilters}>
            <FilterX className="w-3.5 h-3.5 mr-1.5" />Limpar
          </Button>
        )}
      </div>

      {/* Ticket lists */}
      {isAdmin ? (
        <div className="rounded-2xl border border-slate-200 dark:border-emerald-900/40 bg-white dark:bg-[#061C14] shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 dark:border-emerald-900/40 px-5 py-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-950 dark:text-white">Fila de chamados</h2>
            <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">{orderedTickets.length} {orderedTickets.length === 1 ? 'ativo' : 'ativos'}</span>
          </div>
          <TicketList tickets={orderedTickets} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-emerald-900/40 bg-white dark:bg-[#061C14] shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 dark:border-emerald-900/40 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">Meus chamados</h2>
            </div>
            <TicketList tickets={myTicketsAll} emptyText="Você ainda não abriu nenhum chamado." showRating />
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-emerald-900/40 bg-white dark:bg-[#061C14] shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 dark:border-emerald-900/40 px-5 py-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">Fila de atendimento</h2>
              <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">{orderedTickets.length} {orderedTickets.length === 1 ? 'ativo' : 'ativos'}</span>
            </div>
            <TicketList tickets={orderedTickets} />
          </div>
        </div>
      )}

      {/* ── Create Chamado — Side Sheet ─────────────────────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[520px] p-0 flex flex-col bg-white dark:bg-[#061C14] border-l border-slate-200 dark:border-emerald-900/40">
          <SheetHeader className="px-6 py-5 border-b border-slate-200 dark:border-emerald-900/40 shrink-0">
            <SheetTitle className="text-lg font-bold text-slate-950 dark:text-white">Novo Chamado</SheetTitle>
            <p className="text-sm text-slate-500 dark:text-slate-400">Preencha as informações para abrir um ticket de suporte.</p>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <div className="px-6 py-6 space-y-7">

              {/* Section 1: Identificação */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Identificação</p>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Título do chamado</Label>
                    <Input
                      placeholder="Ex: Impressora não imprime no 2º andar"
                      value={formData.titulo}
                      onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                      className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Solicitante</Label>
                      <div className="flex gap-2">
                        <Select value={formData.solicitante} onValueChange={(v) => setFormData({ ...formData, solicitante: v })}>
                          <SelectTrigger className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {solicitantesList.map(s => <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="icon" className="shrink-0 w-9 h-9" onClick={() => setAddUserOpen(true)}>
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Setor</Label>
                      <Select value={formData.setor} onValueChange={(v) => setFormData({ ...formData, setor: v })}>
                        <SelectTrigger className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {setoresList.map(s => <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Classificação */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Classificação</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Tipo de serviço</Label>
                    <Select value={formData.tipoServico} onValueChange={(v) => setFormData({ ...formData, tipoServico: v })}>
                      <SelectTrigger className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Suporte Técnico">Suporte Técnico</SelectItem>
                        <SelectItem value="Manutenção">Manutenção</SelectItem>
                        <SelectItem value="Instalação">Instalação</SelectItem>
                        <SelectItem value="Rede/Internet">Rede/Internet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Prioridade</Label>
                    <Select value={formData.prioridade} onValueChange={(v: 'baixa' | 'media' | 'alta') => setFormData({ ...formData, prioridade: v })}>
                      <SelectTrigger className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Section 3: Descrição */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Descrição</p>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Descreva o problema</Label>
                  <Textarea
                    placeholder="Detalhe o problema: quando começou, o que foi tentado, equipamentos envolvidos..."
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    className="min-h-[120px] bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 resize-none"
                  />
                </div>
              </div>
            </div>
          </ScrollArea>
          <SheetFooter className="px-6 py-4 border-t border-slate-200 dark:border-emerald-900/40 shrink-0 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>Cancelar</Button>
            <Button
              className="flex-1 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white"
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending}
            >
              {createMut.isPending ? 'Abrindo...' : 'Abrir chamado'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── View / Edit Ticket — Side Sheet ─────────────────────────────────── */}
      <Sheet open={viewOpen} onOpenChange={setViewOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[520px] p-0 flex flex-col bg-white dark:bg-[#061C14] border-l border-slate-200 dark:border-emerald-900/40">
          <SheetHeader className="px-6 py-5 border-b border-slate-200 dark:border-emerald-900/40 shrink-0">
            <div className="flex items-start justify-between gap-3 pr-6">
              <div className="min-w-0">
                <SheetTitle className="text-base font-bold text-slate-950 dark:text-white leading-snug truncate">
                  {selectedTicket?.titulo}
                </SheetTitle>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Aberto em {selectedTicket?.data}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                {selectedTicket && <PriorityBadge priority={selectedTicket.prioridade} />}
                {selectedTicket?.isVip && <VipBadge />}
                {selectedTicket && <StatusBadge status={selectedTicket.status} />}
              </div>
            </div>
          </SheetHeader>
          <ScrollArea className="flex-1">
            {selectedTicket && (
              <div className="px-6 py-6 space-y-5">
                <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                  {[
                    { label: 'Solicitante', value: selectedTicket.solicitante },
                    { label: 'Setor', value: selectedTicket.setor },
                    { label: 'Tipo de serviço', value: selectedTicket.tipoServico || '—' },
                    { label: 'Responsável', value: selectedTicket.usuario || '—' },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">{label}</p>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-100 dark:border-emerald-900/20 pt-5">
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Descrição</p>
                  {canEditTicket(selectedTicket) ? (
                    <Textarea
                      rows={5}
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      className="text-sm bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40 resize-none"
                    />
                  ) : (
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{selectedTicket.descricao || '—'}</p>
                  )}
                </div>

                {isAdmin && (
                  <div className="border-t border-slate-100 dark:border-emerald-900/20 pt-5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Ações</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedTicket.status !== 'Em Andamento' && (
                        <Button
                          variant="outline" size="sm"
                          className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-950/30"
                          onClick={() => updateStatus(selectedTicket.id, 'Em Andamento')}
                          disabled={updateMut.isPending}
                        >
                          <Activity className="w-3.5 h-3.5 mr-1.5" />Iniciar atendimento
                        </Button>
                      )}
                      {selectedTicket.status !== 'Concluído' && (
                        <Button
                          size="sm"
                          className="bg-emerald-700 hover:bg-emerald-800 text-white"
                          onClick={() => updateStatus(selectedTicket.id, 'Concluído')}
                          disabled={updateMut.isPending}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />Concluir
                        </Button>
                      )}
                      <Button
                        variant="outline" size="sm"
                        className="ml-auto border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/30"
                        onClick={() => deleteMut.mutate(selectedTicket.id)}
                        disabled={deleteMut.isPending}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />Excluir
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
          <SheetFooter className="px-6 py-4 border-t border-slate-200 dark:border-emerald-900/40 shrink-0 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setViewOpen(false)}>Fechar</Button>
            {selectedTicket && canEditTicket(selectedTicket) && (
              <Button
                className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white"
                onClick={() => updateMut.mutate({ id: selectedTicket.id, input: { descricao: formData.descricao } })}
                disabled={updateMut.isPending}
              >
                Salvar alterações
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Add User — Side Sheet ────────────────────────────────────────────── */}
      <Sheet open={addUserOpen} onOpenChange={setAddUserOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[480px] p-0 flex flex-col bg-white dark:bg-[#061C14] border-l border-slate-200 dark:border-emerald-900/40">
          <SheetHeader className="px-6 py-5 border-b border-slate-200 dark:border-emerald-900/40 shrink-0 text-left sm:text-left">
            <SheetTitle className="text-lg font-bold text-slate-950 dark:text-white">Cadastrar Usuário</SheetTitle>
            <SheetDescription className="text-sm text-slate-500 dark:text-slate-400">Informe os dados do novo usuário.</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <form
              id="add-user-form"
              onSubmit={(e) => {
                e.preventDefault();
                Promise.resolve(createUsuario({ nome: newUser.nome, username: newUser.username, setor: newUser.setor, password: newUser.password, tipo: newUser.tipo }))
                  .then(async () => {
                    await queryClient.invalidateQueries({ queryKey: ['usuarios'] });
                    setFormData({ ...formData, solicitante: newUser.nome || newUser.username, setor: (newUser.setor || formData.setor).toUpperCase() });
                    setNewUser({ nome: '', username: '', setor: '', password: '', tipo: 'padrao' });
                    setAddUserOpen(false);
                    toast.success('Usuário cadastrado!');
                  })
                  .catch(() => toast.error('Falha ao cadastrar usuário'));
              }}
              className="px-6 py-6 space-y-6"
            >
              <div className="space-y-2">
                <Label htmlFor="nu-nome">Nome Completo</Label>
                <Input id="nu-nome" value={newUser.nome} onChange={(e) => setNewUser({ ...newUser, nome: e.target.value })} required className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nu-username">Usuário</Label>
                  <Input id="nu-username" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} required className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nu-tipo">Tipo</Label>
                  <Select value={newUser.tipo} onValueChange={(v: 'padrao' | 'vip' | 'admin') => setNewUser({ ...newUser, tipo: v })}>
                    <SelectTrigger id="nu-tipo" className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="padrao">Padrão</SelectItem>
                      <SelectItem value="vip">VIP</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nu-setor">Setor</Label>
                <Select value={newUser.setor} onValueChange={(v) => setNewUser({ ...newUser, setor: v })}>
                  <SelectTrigger id="nu-setor" className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40"><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                  <SelectContent>
                    {setoresList.map(s => <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nu-password">Senha</Label>
                <Input id="nu-password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40" />
              </div>
            </form>
          </ScrollArea>
          <SheetFooter className="px-6 py-4 border-t border-slate-200 dark:border-emerald-900/40 shrink-0 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setAddUserOpen(false)}>Cancelar</Button>
            <Button type="submit" form="add-user-form" className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white">Cadastrar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Rating — Side Sheet ────────────────────────────────────────────────── */}
      {!isAdmin && (
        <Sheet open={ratingOpen} onOpenChange={setRatingOpen}>
          <SheetContent side="right" className="w-full sm:max-w-[480px] p-0 flex flex-col bg-white dark:bg-[#061C14] border-l border-slate-200 dark:border-emerald-900/40">
            <SheetHeader className="px-6 py-5 border-b border-slate-200 dark:border-emerald-900/40 shrink-0 text-left sm:text-left">
              <SheetTitle className="text-lg font-bold text-slate-950 dark:text-white">Como foi o atendimento?</SheetTitle>
              <SheetDescription className="text-sm text-slate-500 dark:text-slate-400">
                {ratingTicket?.titulo} — selecione uma nota de 1 a 5.
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="flex-1">
              <div className="px-6 py-6 space-y-6">
                <div className="flex items-center justify-center gap-2 py-4 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-emerald-900/20">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
                      onClick={() => setRatingStars(n)}
                      className={cn('transition-transform hover:scale-110 p-1', ratingStars >= n ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600')}
                    >
                      <Star className="w-10 h-10" fill={ratingStars >= n ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rating-comment" className="text-sm font-medium">Comentário (opcional)</Label>
                  <Textarea
                    id="rating-comment"
                    rows={4}
                    value={ratingComment}
                    onChange={(e) => setRatingComment(e.target.value)}
                    placeholder="Conte como foi sua experiência..."
                    className="resize-none bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-emerald-900/40"
                  />
                </div>
              </div>
            </ScrollArea>
            <SheetFooter className="px-6 py-4 border-t border-slate-200 dark:border-emerald-900/40 shrink-0 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={postponeRating}>Avaliar depois</Button>
              <Button
                className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white"
                onClick={() => sendRatingMut.mutate()}
                disabled={ratingStars < 1 || sendRatingMut.isPending}
              >
                {sendRatingMut.isPending ? 'Enviando...' : 'Enviar avaliação'}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      )}

    </div>
  );
};

export default Chamados;
