import { useEffect, useRef, useState } from 'react'
import { Camera, Image as ImageIcon, Keyboard, Loader2, ScanLine } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EQUIPMENT_QR_LABELS_UNAVAILABLE_MESSAGE, parseEquipmentQrUrl, type EquipmentQrLookupDTO } from '@/lib/equipment-qr-labels'
import { supabase } from '@/lib/supabase'

type BarcodeDetectorLike = { detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string }>> }
type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorLike

declare global {
  interface Window { BarcodeDetector?: BarcodeDetectorConstructor }
}

export function EquipmentQrScannerDialog({ open, onOpenChange, onCreateNew, onLinkExisting }: { open: boolean; onOpenChange: (open: boolean) => void; onCreateNew: (label: EquipmentQrLookupDTO) => void; onLinkExisting: (label: EquipmentQrLookupDTO) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(false)
  const [manualValue, setManualValue] = useState('')
  const [message, setMessage] = useState('Aponte a câmera para uma etiqueta ou informe o endereço manualmente.')
  const [cameraBusy, setCameraBusy] = useState(false)
  const [lookup, setLookup] = useState<EquipmentQrLookupDTO | null>(null)

  const stopCamera = () => {
    scanningRef.current = false
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraBusy(false)
  }

  useEffect(() => {
    if (!open) stopCamera()
    return stopCamera
  }, [open])

  const processValue = async (value: string) => {
    const token = parseEquipmentQrUrl(value.trim(), window.location.origin)
    if (!token) {
      setMessage('O código informado não pertence a esta aplicação.')
      return
    }
    scanningRef.current = false
    try {
      const { data: result, error } = await supabase.functions.invoke('equipment-qr-admin', { body: { action: 'lookup', token } })
      if (error || !result) setMessage('Etiqueta inválida ou não disponível.')
      else {
        const typed = result as EquipmentQrLookupDTO
        setLookup(typed)
        if (typed.status === 'UNUSED') setMessage(`Etiqueta ${typed.displayCode} disponível`)
        else if (typed.status === 'REVOKED' || typed.status === 'VOID') setMessage('Esta etiqueta não está mais ativa.')
        else setMessage('Etiqueta vinculada. Abrindo a ficha conforme suas permissões.')
      }
    } catch {
      setMessage(EQUIPMENT_QR_LABELS_UNAVAILABLE_MESSAGE)
    }
  }

  const startCamera = async () => {
    stopCamera()
    if (!navigator.mediaDevices?.getUserMedia || !window.BarcodeDetector) {
      setMessage('Leitura por câmera indisponível neste navegador. Use a entrada manual ou uma imagem.')
      return
    }
    setCameraBusy(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      streamRef.current = stream
      if (!videoRef.current) return stopCamera()
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      scanningRef.current = true
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
      const scan = async () => {
        if (!scanningRef.current || !videoRef.current) return
        try {
          const codes = await detector.detect(videoRef.current)
          if (codes[0]?.rawValue) {
            stopCamera()
            await processValue(codes[0].rawValue)
            return
          }
        } catch { /* frame not ready */ }
        if (scanningRef.current) window.setTimeout(scan, 300)
      }
      void scan()
    } catch {
      stopCamera()
      setMessage('Não foi possível acessar a câmera. Verifique a permissão do navegador.')
    } finally {
      setCameraBusy(false)
    }
  }

  const readImage = async (file: File) => {
    if (!window.BarcodeDetector) return setMessage('Leitura de imagem indisponível neste navegador.')
    try {
      const bitmap = await createImageBitmap(file)
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
      const codes = await detector.detect(bitmap)
      bitmap.close()
      if (!codes[0]?.rawValue) return setMessage('Nenhum QR Code válido foi encontrado na imagem.')
      await processValue(codes[0].rawValue)
    } catch {
      setMessage('Não foi possível ler esta imagem.')
    }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="w-[calc(100vw-2rem)] max-w-xl rounded-2xl">
      <DialogHeader><DialogTitle>Escanear etiqueta QR</DialogTitle><DialogDescription>Aponte a câmera para uma etiqueta CONCREM ou informe o endereço completo.</DialogDescription></DialogHeader>
      <div className="space-y-5">
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-slate-950">
          <video ref={videoRef} muted playsInline className="h-full w-full object-cover" aria-label="Visualização da câmera" />
          {!streamRef.current && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-300"><ScanLine className="h-12 w-12" /><span className="text-sm">Área de leitura</span></div>}
          <div className="pointer-events-none absolute inset-[15%] rounded-2xl border-2 border-emerald-400/80" />
        </div>
        <Button type="button" className="w-full" onClick={startCamera} disabled={cameraBusy}>{cameraBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} Usar câmera</Button>
        <div className="space-y-2"><Label htmlFor="equipment-qr-manual"><Keyboard className="mr-2 inline h-4 w-4" />Digitar código manualmente</Label><div className="flex gap-2"><Input id="equipment-qr-manual" value={manualValue} onChange={(event) => setManualValue(event.target.value)} placeholder="https://.../consulta/equipamento/token" /><Button type="button" variant="outline" onClick={() => processValue(manualValue)}>Validar</Button></div></div>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"><ImageIcon className="h-4 w-4" />Selecionar imagem com QR<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readImage(file); event.target.value = '' }} /></label>
        <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm leading-5 text-amber-900">{message}</p>
        {lookup?.status === 'UNUSED' && <div className="space-y-3 rounded-xl border p-4"><p className="font-bold text-slate-900">Como deseja utilizar esta etiqueta?</p><div className="grid gap-2 sm:grid-cols-2"><Button type="button" onClick={() => onCreateNew(lookup)}>Cadastrar novo equipamento</Button><Button type="button" variant="outline" onClick={() => onLinkExisting(lookup)}>Vincular equipamento existente</Button></div><Button type="button" variant="ghost" className="w-full" onClick={() => setLookup(null)}>Cancelar</Button></div>}
      </div>
    </DialogContent>
  </Dialog>
}
