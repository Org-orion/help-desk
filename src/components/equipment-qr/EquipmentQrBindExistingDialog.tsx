import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { type EquipmentQrLookupDTO } from '@/lib/equipment-qr-labels'
import { supabase } from '@/lib/supabase'

type EquipmentOption = { id: string; nome: string; patrimonio: string }

export function EquipmentQrBindExistingDialog({ label, equipment, onOpenChange }: { label: EquipmentQrLookupDTO | null; equipment: EquipmentOption[]; onOpenChange: (open: boolean) => void }) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [decision, setDecision] = useState<'KEEP' | 'REPLACE' | 'FILL'>('KEEP')
  const [submitting, setSubmitting] = useState(false)
  const options = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    if (!term) return equipment.slice(0, 20)
    return equipment.filter((item) => item.nome.toLocaleLowerCase('pt-BR').includes(term) || item.patrimonio.toLocaleLowerCase('pt-BR').includes(term)).slice(0, 20)
  }, [equipment, search])
  const selected = equipment.find((item) => item.id === selectedId)

  const submit = async () => {
    if (!label || !selected || submitting) return
    if (!confirm(`Vincular a etiqueta ${label.displayCode} ao equipamento selecionado?`)) return
    setSubmitting(true)
    try {
      const { error } = await supabase.functions.invoke('equipment-qr-admin', { body: { action: 'bind-existing', labelId: label.id, equipmentId: selected.id, patrimonyDecision: decision, revokePrevious: false } })
      if (error) alert('Não foi possível vincular a etiqueta.')
      else onOpenChange(false)
    } catch { alert('Não foi possível concluir a operação segura.') }
    finally { setSubmitting(false) }
  }

  return <Dialog open={Boolean(label)} onOpenChange={onOpenChange}>
    <DialogContent className="w-[calc(100vw-2rem)] max-w-xl rounded-2xl">
      <DialogHeader><DialogTitle>Vincular equipamento existente</DialogTitle><DialogDescription>Etiqueta {label?.displayCode}. Pesquise na fonte atual de equipamentos e selecione somente um.</DialogDescription></DialogHeader>
      <div className="space-y-4">
        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Nome ou patrimônio" /></div>
        <RadioGroup value={selectedId} onValueChange={setSelectedId} className="max-h-52 overflow-y-auto rounded-xl border p-2">{options.map((item) => <Label key={item.id} htmlFor={`qr-eq-${item.id}`} className="flex cursor-pointer items-center gap-3 rounded-lg p-3 hover:bg-slate-50"><RadioGroupItem id={`qr-eq-${item.id}`} value={item.id} /><span className="min-w-0"><b className="block truncate text-slate-900">{item.nome}</b><small className="font-mono text-slate-500">{item.patrimonio || 'Sem patrimônio'}</small></span></Label>)}</RadioGroup>
        {selected && <div className="space-y-2 rounded-xl bg-slate-50 p-4"><p className="text-sm font-semibold">Patrimônio atual: {selected.patrimonio || 'Não informado'}</p><RadioGroup value={decision} onValueChange={(value: 'KEEP' | 'REPLACE' | 'FILL') => setDecision(value)}><Label className="flex items-center gap-2"><RadioGroupItem value="KEEP" />Manter patrimônio atual</Label><Label className="flex items-center gap-2"><RadioGroupItem value={selected.patrimonio ? 'REPLACE' : 'FILL'} />{selected.patrimonio ? `Substituir por ${label?.displayCode}` : `Preencher com ${label?.displayCode}`}</Label></RadioGroup></div>}
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">O vínculo será validado e registrado no servidor após sua confirmação.</p>
      </div>
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={submit} disabled={!selected || submitting}>Confirmar vínculo</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
