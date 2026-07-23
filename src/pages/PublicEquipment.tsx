import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Cpu, HardDrive, MemoryStick, RefreshCw, ShieldCheck } from 'lucide-react'
import { LOGO_SRC } from '@/config/branding'
import { PUBLIC_EQUIPMENT_QR_UNAVAILABLE_MESSAGE, PUBLIC_EQUIPMENT_TOKEN_PATTERN, requestPublicEquipment, type PublicEquipmentDTO } from '@/lib/public-equipment'

type ViewState = { kind: 'loading' } | { kind: 'unavailable' } | { kind: 'not-found' } | { kind: 'unlinked' } | { kind: 'ready'; equipment: PublicEquipmentDTO }

const PublicEquipment = () => {
  const { token = '' } = useParams()
  const [state, setState] = useState<ViewState>(PUBLIC_EQUIPMENT_TOKEN_PATTERN.test(token) ? { kind: 'loading' } : { kind: 'not-found' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    document.title = 'Identificação de equipamento | CONCREM'
    const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]') ?? document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex, nofollow, noarchive'
    if (!robots.parentNode) document.head.appendChild(robots)
  }, [])

  useEffect(() => {
    if (!PUBLIC_EQUIPMENT_TOKEN_PATTERN.test(token)) { setState({ kind: 'not-found' }); return }
    setState({ kind: 'loading' })
    const controller = new AbortController()
    const timeout = window.setTimeout(() => { controller.abort(); setState({ kind: 'unavailable' }) }, 12000)
    requestPublicEquipment(token, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setState(result) })
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === 'AbortError')) setState({ kind: 'unavailable' }) })
      .finally(() => window.clearTimeout(timeout))
    return () => { controller.abort(); window.clearTimeout(timeout) }
  }, [token, attempt])

  const retry = () => { setState({ kind: 'loading' }); setAttempt((value) => value + 1) }

  return (
    <main className="min-h-screen overflow-x-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 px-4 py-8 sm:py-14">
      <section className="mx-auto w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="border-b border-emerald-100 px-6 py-6 text-center sm:px-10">
          <img src={LOGO_SRC} alt="CONCREM" className="mx-auto h-16 max-w-[220px] object-contain" />
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.24em] text-emerald-800">Identificação de equipamento</p>
        </header>
        <div className="px-6 py-8 sm:px-10">
          {state.kind === 'loading' && <PublicMessage title="Consultando equipamento" text="Aguarde um instante…" pulse />}
          {state.kind === 'unavailable' && <PublicMessage title="Consulta temporariamente indisponível" text={PUBLIC_EQUIPMENT_QR_UNAVAILABLE_MESSAGE} action={<button type="button" onClick={retry} className="mx-auto mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"><RefreshCw className="h-4 w-4" aria-hidden="true" />Tentar novamente</button>} />}
          {state.kind === 'not-found' && <PublicMessage title="Etiqueta inválida ou não encontrada" text="Este código é inválido, expirou ou foi revogado." />}
          {state.kind === 'unlinked' && <PublicMessage title="Etiqueta CONCREM" text="Etiqueta ainda não vinculada a um equipamento" />}
          {state.kind === 'ready' && <EquipmentCard equipment={state.equipment} />}
        </div>
        <footer className="flex items-center justify-center gap-2 bg-emerald-50 px-6 py-4 text-sm font-semibold text-emerald-950"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Consulta oficial CONCREM</footer>
      </section>
    </main>
  )
}

const PublicMessage = ({ title, text, pulse = false, action }: { title: string; text: string; pulse?: boolean; action?: React.ReactNode }) => (
  <div className="py-10 text-center" role="status"><div className={`mx-auto mb-5 h-12 w-12 rounded-full bg-emerald-100 ${pulse ? 'animate-pulse' : ''}`} /><h1 className="text-xl font-bold text-slate-900">{title}</h1><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-600">{text}</p>{action}</div>
)

const EquipmentCard = ({ equipment }: { equipment: PublicEquipmentDTO }) => {
  const specs = [{ label: 'RAM', value: equipment.ram, icon: MemoryStick }, { label: 'Armazenamento/Disco', value: equipment.storage, icon: HardDrive }, { label: 'CPU', value: equipment.cpu, icon: Cpu }]
  return <article>
    <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4"><div className="min-w-0"><h1 className="break-words text-2xl font-black text-slate-950">{equipment.name}</h1><p className="mt-1 break-all font-mono text-sm text-slate-500">{equipment.assetCode}</p></div><span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">{equipment.status}</span></div>
    {equipment.images.length > 0 && <EquipmentGallery images={equipment.images} />}
    <dl className="mt-7 grid grid-cols-2 gap-4 text-sm"><Info label="Tipo" value={equipment.type} /><Info label="Marca" value={equipment.brand} /><Info label="Modelo" value={equipment.model} /><Info label="Setor" value={equipment.sector} /></dl>
    <section className="mt-7" aria-labelledby="hardware-specs-title"><h2 id="hardware-specs-title" className="text-xs font-black uppercase tracking-[0.18em] text-emerald-800">Hardware &amp; Specs</h2><div className="mt-3 grid gap-3 sm:grid-cols-3">{specs.map(({ label, value, icon: Icon }) => <div key={label} className="min-w-0 rounded-xl bg-slate-50 p-3"><Icon className="mb-2 h-4 w-4 text-emerald-700" aria-hidden="true" /><p className="text-xs text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-bold text-slate-900">{value || 'Não informado'}</p></div>)}</div></section>
  </article>
}

const EquipmentGallery = ({ images }: { images: PublicEquipmentDTO['images'] }) => (
  <section aria-label="Imagens do equipamento" className="mt-6 flex snap-x gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible">
    {images.map((image, index) => (
      <div key={image.url} className={`shrink-0 snap-start overflow-hidden rounded-2xl bg-slate-100 ${index === 0 ? 'w-[82%] sm:col-span-2 sm:w-auto' : 'w-36 sm:w-auto'}`}>
        <img src={image.url} alt={image.principal ? 'Imagem principal do equipamento' : `Imagem ${index + 1} do equipamento`} loading="lazy" className={`${index === 0 ? 'h-64' : 'h-36 sm:h-40'} w-full object-contain`} onError={(event) => { event.currentTarget.parentElement?.remove() }} />
      </div>
    ))}
  </section>
)

const Info = ({ label, value }: { label: string; value: string | null }) => <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 break-words font-semibold text-slate-800">{value || 'Não informado'}</dd></div>

export default PublicEquipment
