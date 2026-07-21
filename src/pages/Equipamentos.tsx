import { useState, useMemo, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Plus, Search, Printer, FileText, PencilLine, Trash2, FilterX,
  MoreHorizontal, Laptop, Monitor, Smartphone, Tablet, Cpu, Package,
  User as UserIcon, Building2, Activity, CheckCircle2, XCircle, Eye,
  LayoutGrid, List, SlidersHorizontal, ChevronRight, Hash, HardDrive, 
  Settings2, ArrowRight, Upload, Image as ImageIcon, X, Star, QrCode, Download
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listEquipamentos, createEquipamento, updateEquipamento, deleteEquipamento,
  listEquipamentoImagens, uploadEquipamentoImagem, deleteEquipamentoImagem, setEquipamentoImagemPrincipal,
  EQUIPMENT_IMAGE_MAX_SIZE, type EquipamentoImagem,
  type Equipamento as EquipamentoType,
} from '@/lib/api/equipamentos';
import { listSetores, createSetor, type Setor as SetorType } from '@/lib/api/setores';
import { listUsuarios, createUsuario, type Usuario } from '@/lib/api/usuarios';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase';
import { useResponsive } from '@/hooks/useResponsive';
import { useSearchParams } from 'react-router-dom';
import { LOGO_MINI_SRC } from '@/config/branding';
import { preparePublicEquipmentQr } from '@/lib/public-equipment-qr';
import { PUBLIC_EQUIPMENT_QR_UNAVAILABLE_MESSAGE } from '@/lib/public-equipment';
import { EquipmentQrBatchDialog } from '@/components/equipment-qr/EquipmentQrBatchDialog';
import { EquipmentQrScannerDialog } from '@/components/equipment-qr/EquipmentQrScannerDialog';
import { EquipmentQrBindExistingDialog } from '@/components/equipment-qr/EquipmentQrBindExistingDialog';
import { EquipmentQrManageDialog } from '@/components/equipment-qr/EquipmentQrManageDialog';
import { EQUIPMENT_QR_LABELS_UNAVAILABLE_MESSAGE, type EquipmentQrLookupDTO } from '@/lib/equipment-qr-labels';

type Equipment = EquipamentoType;

type PendingImage = { file: File; previewUrl: string; principal: boolean };
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_SIZE = EQUIPMENT_IMAGE_MAX_SIZE;
const MAX_IMAGES = 5;

const emptyEquipmentForm = () => ({
  nome: '', tipo: 'Notebook', patrimonio: '', marca: '', modelo: '',
  status: 'Disponível' as Equipment['status'], usuario: '', setor: '', ram: '',
  armazenamento: '', processador: '', polegadas: '', ghz: '',
});

const safeFilePart = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'equipamento';

// ── Status Styling ──────────────────────────────────────────────────────────

const getStatusConfig = (status: string) => {
  const configs: Record<string, { label: string; color: string; icon: any }> = {
    'Disponível': { label: 'Disponível', color: 'text-blue-600 bg-blue-50 border-blue-100', icon: CheckCircle2 },
    'Em Uso':     { label: 'Em Uso', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: Activity },
    'Manutenção': { label: 'Manutenção', color: 'text-amber-600 bg-amber-50 border-amber-100', icon: Settings2 },
    'Inativo':    { label: 'Inativo', color: 'text-slate-500 bg-slate-50 border-slate-100', icon: XCircle },
  };
  return configs[status] || configs['Disponível'];
};

const getTypeIcon = (tipo: string): any => {
  const map: Record<string, any> = {
    'Notebook': Laptop, 'Desktop': Cpu, 'Monitor': Monitor,
    'Tablet': Tablet, 'Smartphone': Smartphone, 'Impressora': Printer,
  };
  return map[tipo] ?? Package;
};

// ── Main Component ──────────────────────────────────────────────────────────

const Equipamentos = () => {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  useResponsive();

  // Data Fetching
  const { data: equipamentosData, isLoading: loadingEquipamentos } = useQuery({
    queryKey: ['equipamentos'],
    queryFn: listEquipamentos,
    staleTime: 1000 * 30,
  });
  const equipamentos = useMemo(() => (equipamentosData ?? []) as Equipment[], [equipamentosData]);

  useEffect(() => {
    const requestedId = searchParams.get('equipamento');
    if (!requestedId || !equipamentos.length) return;
    const requested = equipamentos.find((equipment) => equipment.id === requestedId);
    if (requested) { setSelectedEquipment(requested); setViewOpen(true); }
  }, [equipamentos, searchParams]);

  const { data: setoresData } = useQuery({
    queryKey: ['setores'],
    queryFn: listSetores,
    staleTime: 1000 * 60,
  });
  const setoresOptions = (setoresData ?? [])
    .map((s: SetorType) => (s.nome || '').toUpperCase())
    .sort((a, b) => a.localeCompare(b, 'pt', { sensitivity: 'base' }));

  const { data: usuariosData } = useQuery({
    queryKey: ['usuarios'],
    queryFn: listUsuarios,
    staleTime: 1000 * 60,
  });
  const usuariosOptions = (usuariosData ?? []).map((u: Usuario) => ({
    id: u.id,
    nome: u.name || u.username,
    setor: (u.setor || '').toUpperCase(),
  }));

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [activeType, setActiveType] = useState<'all' | 'PC' | 'TAB' | 'CEL' | 'IMP' | 'MON'>('all');
  const [activeStatus, setActiveStatus] = useState<string>('all');
  const [activeSetor, setActiveSetor] = useState<string>('all');
  
  const [assetSheetOpen, setAssetSheetOpen] = useState(false);
  const [assetSheetMode, setAssetSheetMode] = useState<'create' | 'edit'>('create');
  const [viewOpen, setViewOpen] = useState(false);
  const [termDialogOpen, setTermDialogOpen] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);

  const [formData, setFormData] = useState(emptyEquipmentForm);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [savedImages, setSavedImages] = useState<EquipamentoImagem[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [imageError, setImageError] = useState('');
  const [createdEquipment, setCreatedEquipment] = useState<Equipment | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [successOpen, setSuccessOpen] = useState(false);
  const [qrFromMenu, setQrFromMenu] = useState(false);
  const [qrBatchOpen, setQrBatchOpen] = useState(false);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [pendingQrLabel, setPendingQrLabel] = useState<EquipmentQrLookupDTO | null>(null);
  const [linkQrLabel, setLinkQrLabel] = useState<EquipmentQrLookupDTO | null>(null);
  const [manageQrEquipment, setManageQrEquipment] = useState<Equipment | null>(null);
  const [qrSubmitting, setQrSubmitting] = useState(false);

  const [newUser, setNewUser] = useState({ nome: '', username: '', setor: '', password: '', tipo: 'padrao' as 'padrao' | 'vip' | 'admin' });

  const addImages = (files: FileList | File[]) => {
    setImageError('');
    const incoming = Array.from(files);
    if (savedImages.length + pendingImages.length + incoming.length > MAX_IMAGES) return setImageError(`Selecione no máximo ${MAX_IMAGES} imagens.`);
    const invalidType = incoming.find((file) => !IMAGE_TYPES.has(file.type));
    if (invalidType) return setImageError(`${invalidType.name}: formato inválido. Use JPG, PNG ou WebP.`);
    const oversized = incoming.find((file) => file.size > MAX_IMAGE_SIZE);
    if (oversized) return setImageError(`${oversized.name}: o arquivo excede 10 MB.`);
    setPendingImages((current) => [...current, ...incoming.map((file, index) => ({ file, previewUrl: URL.createObjectURL(file), principal: savedImages.length === 0 && current.length === 0 && index === 0 }))]);
  };

  const removePendingImage = (index: number) => setPendingImages((current) => {
    URL.revokeObjectURL(current[index].previewUrl);
    const next = current.filter((_, itemIndex) => itemIndex !== index);
    if (current[index].principal && next.length) next[0] = { ...next[0], principal: true };
    return next;
  });

  const setMainImage = (index: number) => {
    setSavedImages((current) => current.map((image) => ({ ...image, principal: false })));
    setPendingImages((current) => current.map((image, itemIndex) => ({ ...image, principal: itemIndex === index })));
  };
  const refreshImages = async (equipmentId: string) => {
    setImagesLoading(true);
    try { setSavedImages(await listEquipamentoImagens(equipmentId)); }
    finally { setImagesLoading(false); }
  };

  const handleAssetSheetOpenChange = (open: boolean) => {
    if (!open) {
      pendingImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      setPendingImages([]);
      setImageError('');
    }
    setAssetSheetOpen(open);
  };

  // Logic Helpers
  const getPrefix = useCallback((tipo: string) => {
    if (['Desktop', 'Notebook'].includes(tipo)) return 'PC';
    if (tipo === 'Tablet') return 'TAB';
    if (tipo === 'Smartphone') return 'CEL';
    if (tipo === 'Impressora') return 'IMP';
    if (tipo === 'Monitor') return 'MON';
    return '-';
  }, []);

  const isJVName = useCallback((nome: string) => /^\s*jovem\s+aprendiz\s+\d{1,2}\s*$/i.test(nome || ''), []);
  const getPrefixByEquipment = useCallback((e: Equipment) => (isJVName(e.nome) ? 'JV' : getPrefix(e.tipo)), [isJVName, getPrefix]);

  const parseCode = useCallback((pat: string) => {
    const m = (pat || '').match(/^(JV|PC|TAB|CEL|IMP|MON)-?(\d{3})$/i);
    if (!m) return null;
    return { prefix: m[1].toUpperCase(), num: Number(m[2]) };
  }, []);

  const filteredEquipments = useMemo(() => {
    const term = searchTerm.toLowerCase();
    let rows = equipamentos.filter(eq =>
      eq.nome.toLowerCase().includes(term) ||
      eq.patrimonio.toLowerCase().includes(term) ||
      (eq.usuario || '').toLowerCase().includes(term)
    );
    if (activeType !== 'all') rows = rows.filter(e => getPrefixByEquipment(e) === activeType || (activeType === 'PC' && getPrefixByEquipment(e) === 'JV'));
    if (activeStatus !== 'all') rows = rows.filter(e => e.status === activeStatus);
    if (activeSetor !== 'all') rows = rows.filter(e => (e.setor || '').toUpperCase() === activeSetor);
    
    return rows.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [equipamentos, searchTerm, activeType, activeStatus, activeSetor, getPrefixByEquipment]);

  const stats = useMemo(() => ({
    total: equipamentos.length,
    emUso: equipamentos.filter(e => e.status === 'Em Uso').length,
    disponiveis: equipamentos.filter(e => e.status === 'Disponível').length,
    manutencao: equipamentos.filter(e => e.status === 'Manutenção').length,
  }), [equipamentos]);

  // Mutations
  const createMut = useMutation({
    mutationFn: createEquipamento,
    onSuccess: async (equipment) => {
      queryClient.invalidateQueries({ queryKey: ['equipamentos'] });
      setAssetSheetOpen(false);
      setCreatedEquipment(equipment);
      setQrFromMenu(false);
      setQrDataUrl('');
      const prepared = await preparePublicEquipmentQr(equipment.id);
      if (prepared.available) setQrDataUrl(await QRCode.toDataURL(prepared.url, { margin: 0, width: 512, errorCorrectionLevel: 'M' }));
      setSuccessOpen(true);
      toast.success('Equipamento registrado com sucesso');
      if (pendingImages.length) toast.error('Equipamento cadastrado, mas as imagens não foram enviadas: armazenamento seguro ainda não configurado.');
    }
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<Equipment> }) => {
      const updated = await updateEquipamento(id, input);
      for (const image of pendingImages) await uploadEquipamentoImagem(id, image.file, image.principal);
      return updated;
    },
    onSuccess: async (updated) => {
      queryClient.invalidateQueries({ queryKey: ['equipamentos'] });
      pendingImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      setPendingImages([]);
      await refreshImages(updated.id);
      setAssetSheetOpen(false);
      toast.success('Equipamento atualizado');
    },
    onError: (error: Error) => toast.error(error.message || 'Falha ao atualizar o equipamento. Tente novamente.'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteEquipamento,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipamentos'] });
      toast.success('Equipamento removido');
    }
  });

  // Handlers
  const handleEdit = (e: Equipment) => {
    pendingImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setPendingImages([]);
    setImageError('');
    setSavedImages([]);
    setSelectedEquipment(e);
    setFormData({
      nome: e.nome, tipo: e.tipo, patrimonio: e.patrimonio,
      marca: e.marca || '', modelo: e.modelo || '', status: e.status,
      usuario: e.usuario || '', setor: (e.setor || '').toUpperCase(),
      ram: e.ram || '', armazenamento: e.armazenamento || '',
      processador: e.processador || '', polegadas: e.polegadas || '', ghz: e.ghz || '',
    });
    setAssetSheetMode('edit');
    setAssetSheetOpen(true);
    refreshImages(e.id).catch(() => toast.error('Não foi possível carregar as imagens do equipamento.'));
  };

  const handleGenerateQrCode = async (equipment: Equipment) => {
    setManageQrEquipment(equipment);
  };

  const handleQrCreateNew = (label: EquipmentQrLookupDTO) => {
    setQrScannerOpen(false);
    setPendingQrLabel(label);
    setFormData({ ...emptyEquipmentForm(), patrimonio: label.displayCode });
    setAssetSheetMode('create');
    setAssetSheetOpen(true);
  };

  const handleQrLinkExisting = (label: EquipmentQrLookupDTO) => {
    setQrScannerOpen(false);
    setLinkQrLabel(label);
  };

  const submitQrBoundEquipment = async () => {
    if (!pendingQrLabel || qrSubmitting) return;
    if (formData.patrimonio !== pendingQrLabel.displayCode && !confirm(`O patrimônio foi alterado de ${pendingQrLabel.displayCode} para ${formData.patrimonio}. Deseja continuar?`)) return;
    setQrSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('equipment-qr-admin', { body: { action: 'bind-new', labelId: pendingQrLabel.id, equipment: formData } });
      if (error) toast.error('Não foi possível cadastrar e vincular o equipamento.');
      else {
        setPendingQrLabel(null);
        setAssetSheetOpen(false);
        queryClient.invalidateQueries({ queryKey: ['equipamentos'] });
        toast.success('Equipamento cadastrado e etiqueta vinculada.');
      }
    } catch {
      toast.error('Não foi possível concluir a operação segura.');
    } finally {
      setQrSubmitting(false);
    }
  };

  const handleSavedMainImage = async (image: EquipamentoImagem) => {
    try {
      await setEquipamentoImagemPrincipal(image.equipamento_id, image.id);
      setPendingImages((current) => current.map((item) => ({ ...item, principal: false })));
      await refreshImages(image.equipamento_id);
    } catch { toast.error('Não foi possível alterar a imagem principal.'); }
  };

  const handleDeleteSavedImage = async (image: EquipamentoImagem) => {
    if (!confirm(`Excluir a imagem ${image.nome_arquivo}?`)) return;
    try { await deleteEquipamentoImagem(image); await refreshImages(image.equipamento_id); toast.success('Imagem excluída.'); }
    catch { toast.error('Não foi possível excluir a imagem.'); }
  };

  const handleDownloadPDF = async () => {
    if (!selectedEquipment) {
      toast.error('Nenhum equipamento selecionado.');
      return;
    }

    try {
      toast.info('Gerando PDF...');
      const eq = selectedEquipment;

      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 20;
      const contentWidth = pageWidth - marginX * 2;
      let y = 22;

      const dataEmissao = new Date().toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric',
      });

      // ── Cabeçalho ──
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('TERMO DE RESPONSABILIDADE', pageWidth / 2, y, { align: 'center' });
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(110);
      doc.text('Entrega e uso de equipamento', pageWidth / 2, y, { align: 'center' });
      doc.setTextColor(0);
      y += 6;
      doc.setDrawColor(200);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 12;

      // ── Texto introdutório ──
      doc.setFontSize(11);
      const intro =
        `O presente termo formaliza a entrega do equipamento abaixo descrito ao(à) colaborador(a) ` +
        `${eq.usuario || 'Não informado'}, do setor ${eq.setor || 'Não informado'}, que declara ` +
        `recebê-lo em perfeitas condições de uso, comprometendo-se a zelar pela sua conservação e ` +
        `a utilizá-lo exclusivamente para fins profissionais.`;
      const introLines = doc.splitTextToSize(intro, contentWidth);
      doc.text(introLines, marginX, y);
      y += introLines.length * 6 + 6;

      // ── Tabela de dados do equipamento ──
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Dados do Equipamento', marginX, y);
      y += 4;
      doc.setDrawColor(200);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 8;

      const essenciais = new Set(['Nome / Descrição', 'Tipo', 'Patrimônio', 'Status']);
      const rows = ([
        ['Nome / Descrição', eq.nome],
        ['Tipo', eq.tipo],
        ['Patrimônio', eq.patrimonio],
        ['Marca', eq.marca],
        ['Modelo', eq.modelo],
        ['Status', eq.status],
        ['Processador', eq.processador],
        ['Memória (RAM)', eq.ram],
        ['Armazenamento', eq.armazenamento],
      ] as [string, string | undefined][])
        .filter(([label, value]) => essenciais.has(label) || (value && value.trim()))
        .map(([label, value]) => [label, value && value.trim() ? value : '—'] as [string, string]);

      doc.setFontSize(10);
      rows.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, marginX, y);
        doc.setFont('helvetica', 'normal');
        const valueLines = doc.splitTextToSize(String(value), contentWidth - 50);
        doc.text(valueLines, marginX + 50, y);
        y += valueLines.length * 6 + 1;
      });

      y += 10;

      // ── Responsável / colaborador ──
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Responsável', marginX, y);
      y += 4;
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Colaborador:', marginX, y);
      doc.setFont('helvetica', 'normal');
      doc.text(eq.usuario || 'Não informado', marginX + 50, y);
      y += 7;
      doc.setFont('helvetica', 'bold');
      doc.text('Setor:', marginX, y);
      doc.setFont('helvetica', 'normal');
      doc.text(eq.setor || 'Não informado', marginX + 50, y);
      y += 7;
      doc.setFont('helvetica', 'bold');
      doc.text('Data de emissão:', marginX, y);
      doc.setFont('helvetica', 'normal');
      doc.text(dataEmissao, marginX + 50, y);

      // ── Assinaturas ──
      const signY = 250;
      doc.setDrawColor(120);
      doc.line(marginX, signY, marginX + 70, signY);
      doc.line(pageWidth - marginX - 70, signY, pageWidth - marginX, signY);
      doc.setFontSize(9);
      doc.setTextColor(90);
      doc.text('Colaborador', marginX + 35, signY + 5, { align: 'center' });
      doc.text('Responsável (TI)', pageWidth - marginX - 35, signY + 5, { align: 'center' });
      doc.setTextColor(0);

      const fileName = `termo-${(eq.patrimonio || eq.nome || 'equipamento')
        .toString()
        .replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
      doc.save(fileName);

      toast.success('PDF gerado com sucesso!');
      setTermDialogOpen(false);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      toast.error('Falha ao gerar o PDF.');
    }
  };

  const downloadQrCode = () => {
    if (!createdEquipment || !qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `qr-code-${safeFilePart(createdEquipment.patrimonio || createdEquipment.nome)}.png`;
    link.click();
  };

  const registerAnother = () => {
    pendingImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setPendingImages([]);
    setImageError('');
    setFormData(emptyEquipmentForm());
    setCreatedEquipment(null);
    setQrDataUrl('');
    setSuccessOpen(false);
    setAssetSheetMode('create');
    setAssetSheetOpen(true);
  };

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-10 animate-in fade-in duration-700">
      
      {/* ── HEADER & ACTIONS ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Análise de Equipamentos</h1>
          <p className="text-slate-500 mt-1 font-medium text-lg">Visão estratégica do inventário e ativos da operação</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setQrScannerOpen(true)} className="h-12 rounded-xl"><QrCode className="h-5 w-5" />Escanear etiqueta QR</Button>
          <Button type="button" variant="outline" onClick={() => setQrBatchOpen(true)} className="h-12 rounded-xl"><Printer className="h-5 w-5" />Gerar etiquetas QR</Button>
          <Button
            onClick={() => { setPendingQrLabel(null); setAssetSheetMode('create'); setAssetSheetOpen(true); }}
            className="h-12 px-6 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-5 h-5 mr-2" />
            Registrar Ativo
          </Button>
        </div>
      </div>

      {/* ── RESUMO ANALÍTICO (KPIs) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          label="Total em Inventário" 
          value={stats.total} 
          icon={Package} 
          description="Ativos catalogados"
          color="bg-slate-50 text-slate-600"
        />
        <KPICard 
          label="Ativos em Operação" 
          value={stats.emUso} 
          icon={Activity} 
          description="Equipamentos ativos"
          color="bg-emerald-50 text-emerald-600"
        />
        <KPICard 
          label="Disponibilidade" 
          value={stats.disponiveis} 
          icon={CheckCircle2} 
          description="Prontos para uso"
          color="bg-blue-50 text-blue-600"
        />
        <KPICard 
          label="Em Manutenção" 
          value={stats.manutencao} 
          icon={Settings2} 
          description="Necessitam atenção"
          color="bg-amber-50 text-amber-600"
        />
      </div>

      {/* ── FILTROS INTELIGENTES (CHIPS) ── */}
      <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input 
              placeholder="Pesquisar por nome, patrimônio ou responsável..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-12 pl-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all text-base"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
            <FilterChip 
              active={activeType === 'all'} 
              label="Todos" 
              onClick={() => setActiveType('all')} 
            />
            <FilterChip 
              active={activeType === 'PC'} 
              label="Computadores" 
              icon={Laptop}
              onClick={() => setActiveType('PC')} 
            />
            <FilterChip 
              active={activeType === 'CEL'} 
              label="Celulares" 
              icon={Smartphone}
              onClick={() => setActiveType('CEL')} 
            />
            <FilterChip 
              active={activeType === 'MON'} 
              label="Monitores" 
              icon={Monitor}
              onClick={() => setActiveType('MON')} 
            />
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

          {(searchTerm || activeType !== 'all' || activeStatus !== 'all' || activeSetor !== 'all') && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => { setSearchTerm(''); setActiveType('all'); setActiveStatus('all'); setActiveSetor('all'); }}
              className="text-xs font-bold text-red-500 hover:text-red-600 hover:bg-red-50 uppercase tracking-wider px-3"
            >
              Limpar Filtros
            </Button>
          )}
        </div>
      </div>

      {/* ── LISTA DE EQUIPAMENTOS ── */}
      <div className="bg-white rounded-3xl border shadow-md overflow-hidden">
        <div className="p-8 border-b bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <List className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Ativos Encontrados</h2>
          </div>
          <span className="px-4 py-1.5 rounded-full bg-white border text-sm font-bold text-slate-500 shadow-sm">
            {filteredEquipments.length} {filteredEquipments.length === 1 ? 'resultado' : 'resultados'}
          </span>
        </div>

        {loadingEquipamentos ? (
          <div className="p-8 space-y-6">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
          </div>
        ) : filteredEquipments.length === 0 ? (
          <div className="py-24 text-center">
            <div className="h-20 w-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Package className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Nenhum ativo localizado</h3>
            <p className="text-slate-500 mt-2 font-medium">Tente ajustar seus critérios de busca ou filtros.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredEquipments.map((eq) => (
              <EquipmentItem 
                key={eq.id} 
                equipment={eq} 
                onView={() => { setSelectedEquipment(eq); setViewOpen(true); }}
                onEdit={() => handleEdit(eq)}
                onDelete={() => { if(confirm('Excluir ativo?')) deleteMut.mutate(eq.id); }}
                onPrint={() => { setSelectedEquipment(eq); setTermDialogOpen(true); }}
                onQrCode={() => handleGenerateQrCode(eq)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Asset (Create/Edit) — Side Sheet ───────────────────────────────── */}
      <Sheet open={assetSheetOpen} onOpenChange={handleAssetSheetOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-[540px] p-0 flex flex-col bg-white dark:bg-[#061C14] border-l border-slate-200 dark:border-emerald-900/40">
          <SheetHeader className="px-6 py-5 border-b border-slate-200 dark:border-emerald-900/40 shrink-0 text-left sm:text-left">
            <SheetTitle className="text-lg font-bold text-slate-950 dark:text-white">
              {assetSheetMode === 'create' ? 'Novo Equipamento' : 'Editar Equipamento'}
            </SheetTitle>
            <SheetDescription className="text-sm text-slate-500 dark:text-slate-400">
              {assetSheetMode === 'create' ? 'Cadastre um novo ativo no inventário.' : 'Atualize as informações do ativo selecionado.'}
            </SheetDescription>
            {pendingQrLabel && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">Etiqueta {pendingQrLabel.displayCode} validada e aguardando vínculo.</p>}
          </SheetHeader>
          <ScrollArea className="flex-1">
            <form
              id="asset-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (assetSheetMode === 'create') {
                  if (pendingQrLabel) void submitQrBoundEquipment();
                  else createMut.mutate(formData as any);
                } else if (selectedEquipment) {
                  updateMut.mutate({ id: selectedEquipment.id, input: formData as any });
                }
              }}
              className="px-6 py-6 space-y-8"
            >
              {/* Section 1: Informações Básicas */}
              <div className="space-y-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Informações Básicas</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome do Ativo</Label>
                    <Input id="nome" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} required className="bg-slate-50 dark:bg-slate-900/50" placeholder="Ex: Notebook TI 01" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tipo">Tipo</Label>
                    <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                      <SelectTrigger className="bg-slate-50 dark:bg-slate-900/50"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Notebook">Notebook</SelectItem>
                        <SelectItem value="Desktop">Desktop</SelectItem>
                        <SelectItem value="Monitor">Monitor</SelectItem>
                        <SelectItem value="Impressora">Impressora</SelectItem>
                        <SelectItem value="Smartphone">Smartphone</SelectItem>
                        <SelectItem value="Tablet">Tablet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="patrimonio">Patrimônio / Código</Label>
                    <Input id="patrimonio" value={formData.patrimonio} onChange={(e) => setFormData({ ...formData, patrimonio: e.target.value })} required className="bg-slate-50 dark:bg-slate-900/50" placeholder="Ex: PC-001" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status Operacional</Label>
                    <Select value={formData.status} onValueChange={(v: any) => setFormData({ ...formData, status: v })}>
                      <SelectTrigger className="bg-slate-50 dark:bg-slate-900/50"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Disponível">Disponível</SelectItem>
                        <SelectItem value="Em Uso">Em Uso</SelectItem>
                        <SelectItem value="Manutenção">Manutenção</SelectItem>
                        <SelectItem value="Inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Section 2: Especificações */}
              <div className="space-y-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Especificações Técnicas</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="marca">Marca</Label>
                    <Input id="marca" value={formData.marca} onChange={(e) => setFormData({ ...formData, marca: e.target.value })} className="bg-slate-50 dark:bg-slate-900/50" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="modelo">Modelo</Label>
                    <Input id="modelo" value={formData.modelo} onChange={(e) => setFormData({ ...formData, modelo: e.target.value })} className="bg-slate-50 dark:bg-slate-900/50" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="ram">RAM</Label>
                    <Input id="ram" value={formData.ram} onChange={(e) => setFormData({ ...formData, ram: e.target.value })} className="bg-slate-50 dark:bg-slate-900/50" placeholder="8GB" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="armazenamento">Armazenamento</Label>
                    <Input id="armazenamento" value={formData.armazenamento} onChange={(e) => setFormData({ ...formData, armazenamento: e.target.value })} className="bg-slate-50 dark:bg-slate-900/50" placeholder="256GB SSD" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="processador">CPU</Label>
                    <Input id="processador" value={formData.processador} onChange={(e) => setFormData({ ...formData, processador: e.target.value })} className="bg-slate-50 dark:bg-slate-900/50" placeholder="i5 12th" />
                  </div>
                </div>
              </div>

              {/* Section 3: Atribuição */}
              <div className="space-y-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Atribuição</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="usuario">Responsável / Usuário</Label>
                    <div className="flex gap-2">
                      <Select value={formData.usuario} onValueChange={(v) => {
                        const u = usuariosOptions.find(opt => opt.nome === v);
                        setFormData({ ...formData, usuario: v, setor: u?.setor || formData.setor });
                      }}>
                        <SelectTrigger className="bg-slate-50 dark:bg-slate-900/50"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {usuariosOptions.map(u => <SelectItem key={u.id} value={u.nome}>{u.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => setAddUserOpen(true)}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="setor">Setor</Label>
                    <Select value={formData.setor} onValueChange={(v) => setFormData({ ...formData, setor: v })}>
                      <SelectTrigger className="bg-slate-50 dark:bg-slate-900/50"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {setoresOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {(
                <div className="space-y-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Imagens do Equipamento</p>
                  {assetSheetMode === 'edit' && imagesLoading && <p className="text-sm text-slate-500">Carregando imagens...</p>}
                  {assetSheetMode === 'edit' && savedImages.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {savedImages.map((image) => (
                        <div key={image.id} className="relative overflow-hidden rounded-xl border bg-white">
                          <img src={image.url} alt={image.nome_arquivo} className="aspect-square w-full object-cover" />
                          <div className="absolute inset-x-1 top-1 flex justify-between gap-1">
                            <button type="button" aria-label="Definir como imagem principal" onClick={() => handleSavedMainImage(image)} className={cn('rounded-lg p-1.5 shadow-sm', image.principal ? 'bg-amber-400 text-white' : 'bg-white/90 text-slate-600')}><Star className="h-3.5 w-3.5" /></button>
                            <button type="button" aria-label="Excluir imagem" onClick={() => handleDeleteSavedImage(image)} className="rounded-lg bg-white/90 p-1.5 text-red-600 shadow-sm"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                          <p className="truncate px-2 py-1.5 text-[10px] text-slate-500">{image.principal ? 'Principal · ' : ''}{image.nome_arquivo}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <label
                    htmlFor="equipment-images"
                    className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 py-7 text-center transition-colors hover:border-emerald-500 hover:bg-emerald-50/40"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => { event.preventDefault(); addImages(event.dataTransfer.files); }}
                  >
                    <Upload className="mb-2 h-6 w-6 text-emerald-700" />
                    <span className="text-sm font-semibold text-slate-800">Selecione ou arraste as imagens</span>
                    <span className="mt-1 text-xs text-slate-500">PNG, JPG ou WebP — máximo de 10 MB por imagem</span>
                    <input id="equipment-images" type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { if (event.target.files) addImages(event.target.files); event.target.value = ''; }} />
                  </label>
                  {imageError && <p role="alert" className="text-sm font-medium text-red-600">{imageError}</p>}
                  {pendingImages.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {pendingImages.map((image, index) => (
                        <div key={`${image.file.name}-${image.file.lastModified}`} className="relative overflow-hidden rounded-xl border bg-white">
                          <img src={image.previewUrl} alt={`Pré-visualização de ${image.file.name}`} className="aspect-square w-full object-cover" />
                          <div className="absolute inset-x-1 top-1 flex justify-between gap-1">
                            <button type="button" aria-label="Definir como imagem principal" onClick={() => setMainImage(index)} className={cn('rounded-lg p-1.5 shadow-sm', image.principal ? 'bg-amber-400 text-white' : 'bg-white/90 text-slate-600')}><Star className="h-3.5 w-3.5" /></button>
                            <button type="button" aria-label="Remover imagem" onClick={() => removePendingImage(index)} className="rounded-lg bg-white/90 p-1.5 text-red-600 shadow-sm"><X className="h-3.5 w-3.5" /></button>
                          </div>
                          <p className="truncate px-2 py-1.5 text-[10px] text-slate-500">{image.principal ? 'Principal · ' : ''}{image.file.name}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </form>
          </ScrollArea>
          <SheetFooter className="px-6 py-4 border-t border-slate-200 dark:border-emerald-900/40 shrink-0 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { pendingImages.forEach((image) => URL.revokeObjectURL(image.previewUrl)); setPendingImages([]); setPendingQrLabel(null); setAssetSheetOpen(false); }}>Cancelar</Button>
            <Button type="submit" form="asset-form" className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white" disabled={createMut.isPending || updateMut.isPending || qrSubmitting}>
              {assetSheetMode === 'create' ? 'Registrar Ativo' : 'Salvar Alterações'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── View Asset — Side Sheet ─────────────────────────────────────────── */}
      <Sheet open={viewOpen} onOpenChange={setViewOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[500px] p-0 flex flex-col bg-white dark:bg-[#061C14] border-l border-slate-200 dark:border-emerald-900/40">
          <SheetHeader className="px-6 py-5 border-b border-slate-200 dark:border-emerald-900/40 shrink-0 text-left sm:text-left">
            <div className="flex items-start justify-between pr-6">
              <div>
                <SheetTitle className="text-xl font-bold text-slate-950 dark:text-white leading-tight">{selectedEquipment?.nome}</SheetTitle>
                <p className="text-xs text-slate-400 font-mono mt-1">{selectedEquipment?.patrimonio}</p>
              </div>
              {selectedEquipment && (
                <Badge variant="outline" className={cn("px-3 py-1", getStatusConfig(selectedEquipment.status).color)}>
                  {selectedEquipment.status}
                </Badge>
              )}
            </div>
          </SheetHeader>
          <ScrollArea className="flex-1">
            {selectedEquipment && (
              <div className="px-6 py-6 space-y-8">
                <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                  {[
                    { label: 'Tipo', value: selectedEquipment.tipo, icon: getTypeIcon(selectedEquipment.tipo) },
                    { label: 'Marca', value: selectedEquipment.marca || '—', icon: Package },
                    { label: 'Modelo', value: selectedEquipment.modelo || '—', icon: Settings2 },
                    { label: 'Setor', value: selectedEquipment.setor || '—', icon: Building2 },
                    { label: 'Responsável', value: selectedEquipment.usuario || '—', icon: UserIcon },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label}>
                      <div className="flex items-center gap-1.5 mb-1 text-slate-400">
                        <Icon className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-emerald-900/20">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-4">Hardware & Specs</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'RAM', value: selectedEquipment.ram || '—', icon: Cpu },
                      { label: 'Disco', value: selectedEquipment.armazenamento || '—', icon: HardDrive },
                      { label: 'CPU', value: selectedEquipment.processador || '—', icon: Activity },
                    ].map(({ label, value, icon: Icon }) => (
                      <div key={label} className="p-3 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-emerald-900/20 text-center">
                        <Icon className="w-4 h-4 mx-auto mb-2 text-slate-400" />
                        <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">{label}</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
          <SheetFooter className="px-6 py-4 border-t border-slate-200 dark:border-emerald-900/40 shrink-0">
            <Button variant="outline" className="w-full" onClick={() => setViewOpen(false)}>Fechar Detalhes</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Termo PDF — Side Sheet ──────────────────────────────────────────── */}
      <Sheet open={termDialogOpen} onOpenChange={setTermDialogOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[480px] p-0 flex flex-col bg-white dark:bg-[#061C14] border-l border-slate-200 dark:border-emerald-900/40">
          <SheetHeader className="px-6 py-5 border-b border-slate-200 dark:border-emerald-900/40 shrink-0 text-left sm:text-left">
            <SheetTitle className="text-lg font-bold text-slate-950 dark:text-white">Gerar Termo de Responsabilidade</SheetTitle>
            <SheetDescription className="text-sm text-slate-500 dark:text-slate-400">Visualize as informações antes de exportar o PDF.</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            {selectedEquipment && (
              <div className="px-6 py-6 space-y-6">
                <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-emerald-900/20 shadow-inner">
                  <div className="flex justify-center mb-6">
                    <FileText className="w-12 h-12 text-primary/40" />
                  </div>
                  <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
                    <p>O presente termo formaliza a entrega do equipamento <strong>{selectedEquipment.nome}</strong> ({selectedEquipment.patrimonio}) para o colaborador <strong>{selectedEquipment.usuario || 'Não informado'}</strong>.</p>
                    <p>Ao gerar este documento, você confirma que o ativo está em perfeitas condições de uso.</p>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
          <SheetFooter className="px-6 py-4 border-t border-slate-200 dark:border-emerald-900/40 shrink-0 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setTermDialogOpen(false)}>Cancelar</Button>
            <Button className="flex-1 bg-primary text-white font-bold" onClick={handleDownloadPDF}>
              <Printer className="w-4 h-4 mr-2" />
              Gerar PDF
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Add User — Side Sheet ───────────────────────────────────────────── */}
      <Sheet open={addUserOpen} onOpenChange={setAddUserOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[400px] p-0 flex flex-col bg-white dark:bg-[#061C14] border-l border-slate-200 dark:border-emerald-900/40">
          <SheetHeader className="px-6 py-5 border-b border-slate-200 dark:border-emerald-900/40 shrink-0 text-left sm:text-left">
            <SheetTitle className="text-lg font-bold text-slate-950 dark:text-white">Cadastrar Usuário</SheetTitle>
            <SheetDescription className="text-sm text-slate-500 dark:text-slate-400">Crie um novo perfil rapidamente.</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <form
              id="add-user-form"
              onSubmit={(e) => {
                e.preventDefault();
                Promise.resolve(createUsuario({ nome: newUser.nome, username: newUser.username, setor: newUser.setor, password: newUser.password, tipo: newUser.tipo }))
                  .then(async () => {
                    await queryClient.invalidateQueries({ queryKey: ['usuarios'] });
                    setFormData({ ...formData, usuario: newUser.nome || newUser.username, setor: (newUser.setor || formData.setor).toUpperCase() });
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
                <Input id="nu-nome" value={newUser.nome} onChange={(e) => setNewUser({ ...newUser, nome: e.target.value })} required className="bg-slate-50 dark:bg-slate-900/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nu-username">Login / Usuário</Label>
                <Input id="nu-username" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} required className="bg-slate-50 dark:bg-slate-900/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nu-setor">Setor</Label>
                <Select value={newUser.setor} onValueChange={(v) => setNewUser({ ...newUser, setor: v })}>
                  <SelectTrigger className="bg-slate-50 dark:bg-slate-900/50"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {setoresOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nu-password">Senha Provisória</Label>
                <Input id="nu-password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required className="bg-slate-50 dark:bg-slate-900/50" />
              </div>
            </form>
          </ScrollArea>
          <SheetFooter className="px-6 py-4 border-t border-slate-200 dark:border-emerald-900/40 shrink-0 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setAddUserOpen(false)}>Cancelar</Button>
            <Button type="submit" form="add-user-form" className="flex-1 bg-emerald-700 text-white">Cadastrar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <EquipmentQrBatchDialog open={qrBatchOpen} onOpenChange={setQrBatchOpen} />
      <EquipmentQrScannerDialog open={qrScannerOpen} onOpenChange={setQrScannerOpen} onCreateNew={handleQrCreateNew} onLinkExisting={handleQrLinkExisting} />
      <EquipmentQrBindExistingDialog label={linkQrLabel} equipment={equipamentos.map(({ id, nome, patrimonio }) => ({ id, nome, patrimonio }))} onOpenChange={(open) => { if (!open) setLinkQrLabel(null); }} />
      <EquipmentQrManageDialog equipment={manageQrEquipment} onOpenChange={(open) => { if (!open) setManageQrEquipment(null); }} />

      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{qrFromMenu ? 'QR Code do equipamento' : 'Equipamento registrado com sucesso'}</DialogTitle>
            <DialogDescription>{qrDataUrl ? 'QR Code público gerado com segurança.' : PUBLIC_EQUIPMENT_QR_UNAVAILABLE_MESSAGE}</DialogDescription>
          </DialogHeader>
          {createdEquipment && (
            <div className="space-y-5">
              <div className="rounded-xl border bg-slate-50 p-4 text-sm">
                <p className="font-bold text-slate-900">{createdEquipment.nome}</p>
                <p className="mt-1 font-mono text-slate-500">{createdEquipment.patrimonio}</p>
              </div>
              {qrDataUrl && <img src={qrDataUrl} alt={`QR Code do equipamento ${createdEquipment.nome}`} className="mx-auto h-52 w-52 rounded-xl border bg-white p-2" />}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {qrDataUrl && <>
                  <Button variant="outline" onClick={downloadQrCode}><Download className="h-4 w-4" />Baixar QR Code</Button>
                  <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />Imprimir etiqueta</Button>
                </>}
                {qrFromMenu ? <Button className="sm:col-span-2" onClick={() => setSuccessOpen(false)}>Fechar</Button> : <>
                  <Button variant="outline" onClick={() => { setSuccessOpen(false); setSelectedEquipment(createdEquipment); setViewOpen(true); }}><Eye className="h-4 w-4" />Visualizar equipamento</Button>
                  <Button onClick={registerAnother}><Plus className="h-4 w-4" />Cadastrar outro</Button>
                </>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {createdEquipment && qrDataUrl && (
        <div className="equipment-print-label hidden">
          <div className="equipment-print-qr"><img src={qrDataUrl} alt="QR Code" /></div>
          <div className="equipment-print-info">
            <img src={LOGO_MINI_SRC} alt="CONCREM" />
            <strong>PATRIMÔNIO</strong>
            <span>{createdEquipment.patrimonio}</span>
          </div>
        </div>
      )}
      <style>{`@media print { body * { visibility: hidden !important; } .equipment-print-label, .equipment-print-label * { visibility: visible !important; } .equipment-print-label { display:grid !important; grid-template-columns:40% 60%; position:fixed; inset:0 auto auto 0; width:58mm; height:38mm; padding:3mm; border:1px solid #111; box-sizing:border-box; overflow:hidden; background:#fff; color:#000; text-align:center; font-family:Arial,sans-serif; } .equipment-print-qr { display:flex; align-items:center; justify-content:center; padding:1.5mm; } .equipment-print-qr img { width:100%; max-width:25mm; aspect-ratio:1; object-fit:contain; } .equipment-print-info { min-width:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1.5mm; padding-left:2mm; } .equipment-print-info img { width:100%; height:10mm; object-fit:contain; } .equipment-print-info strong { font-size:7pt; letter-spacing:.4pt; } .equipment-print-info span { max-width:100%; overflow-wrap:anywhere; font-family:monospace; font-size:13pt; font-weight:700; line-height:1; } }`}</style>

    </div>
  );
};

// ── SUBCOMPONENTES PREMIUM ──

const KPICard = ({ label, value, icon: Icon, description, color }: any) => (
  <div className="bg-white p-6 rounded-3xl border shadow-sm group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
    <div className="flex justify-between items-start">
      <div className={cn("p-3 rounded-2xl transition-colors", color)}>
        <Icon className="w-6 h-6" />
      </div>
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 group-hover:text-primary transition-colors">KPI</span>
    </div>
    <div className="mt-6">
      <div className="text-4xl font-black text-slate-900 tracking-tighter">{value}</div>
      <div className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-2">{label}</div>
      <p className="text-xs text-slate-400 font-medium mt-1">{description}</p>
    </div>
  </div>
);

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

const EquipmentItem = ({ equipment, onView, onEdit, onDelete, onPrint, onQrCode }: any) => {
  const status = getStatusConfig(equipment.status);
  const TypeIcon = getTypeIcon(equipment.tipo);

  return (
    <div className="group flex flex-col lg:flex-row lg:items-center justify-between p-8 hover:bg-slate-50/80 transition-all cursor-pointer border-l-4 border-transparent hover:border-primary">
      <div className="flex items-center gap-6 flex-1 min-w-0">
        <div className="h-16 w-16 rounded-2xl bg-white border-2 border-slate-100 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform shrink-0">
          <TypeIcon className="w-8 h-8 text-slate-400 group-hover:text-primary transition-colors" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 mb-1.5">
            <h3 className="text-lg font-bold text-slate-900 truncate group-hover:text-primary transition-colors">{equipment.nome}</h3>
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
        <div className="hidden xl:flex items-center gap-4 border-x px-8 border-slate-200">
          <div className="flex flex-col items-center">
            <Cpu className="w-4 h-4 text-slate-300 mb-1" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">{equipment.ram || '-'}</span>
          </div>
          <div className="flex flex-col items-center">
            <HardDrive className="w-4 h-4 text-slate-300 mb-1" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">{equipment.armazenamento || '-'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onView} className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors">
            <Eye className="w-5 h-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-slate-200 transition-colors">
                <MoreHorizontal className="w-5 h-5 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl shadow-xl border-slate-100">
              <DropdownMenuItem onClick={onEdit} className="rounded-xl py-3 cursor-pointer">
                <PencilLine className="w-4 h-4 mr-3 text-slate-400" />
                <span className="font-bold text-slate-700">Editar Detalhes</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onPrint} className="rounded-xl py-3 cursor-pointer">
                <FileText className="w-4 h-4 mr-3 text-slate-400" />
                <span className="font-bold text-slate-700">Gerar Termo PDF</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onQrCode} className="rounded-xl py-3 cursor-pointer">
                <QrCode className="w-4 h-4 mr-3 text-slate-400" />
                <span className="font-bold text-slate-700">Gerar QR Code</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-2" />
              <DropdownMenuItem onClick={onDelete} className="rounded-xl py-3 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
                <Trash2 className="w-4 h-4 mr-3" />
                <span className="font-bold">Excluir Ativo</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};

export default Equipamentos;
