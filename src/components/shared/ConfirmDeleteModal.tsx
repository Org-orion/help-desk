import { useEffect, useRef, useState } from 'react'
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ConfirmDeleteModalProps {
  open: boolean
  asset: { nome: string; patrimonio?: string | null } | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
  returnFocusRef?: React.RefObject<HTMLElement>
}

export function ConfirmDeleteModal({
  open,
  asset,
  onOpenChange,
  onConfirm,
  returnFocusRef,
}: ConfirmDeleteModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const submittingRef = useRef(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) setError('')
  }, [open, asset])

  const close = () => {
    if (submittingRef.current) return
    onOpenChange(false)
  }

  const confirmDelete = async () => {
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setError('')

    try {
      await onConfirm()
      onOpenChange(false)
    } catch {
      setError('Não foi possível excluir este ativo. Tente novamente.')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) close()
    }}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <AlertDialogPrimitive.Content
          role="dialog"
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl outline-none sm:p-7',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 duration-200',
          )}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            cancelRef.current?.focus()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            window.requestAnimationFrame(() => returnFocusRef?.current?.focus())
          }}
          onEscapeKeyDown={(event) => {
            if (submittingRef.current) event.preventDefault()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.preventDefault()
          }}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 ring-8 ring-red-50/60">
            <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
          </div>

          <AlertDialogPrimitive.Title className="mt-6 text-xl font-bold text-slate-950">
            Excluir ativo?
          </AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="mt-2 text-sm leading-6 text-slate-600">
            Você está prestes a excluir permanentemente este ativo. Essa ação não poderá ser desfeita.
          </AlertDialogPrimitive.Description>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" aria-label="Ativo selecionado">
            <p className="break-words text-sm font-bold text-slate-900">{asset?.nome}</p>
            <p className="mt-1 break-words text-sm text-slate-600">
              Patrimônio: <span className="font-semibold text-slate-700">{asset?.patrimonio || 'Não informado'}</span>
            </p>
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AlertDialogPrimitive.Cancel asChild>
              <Button ref={cancelRef} type="button" variant="outline" disabled={submitting} className="w-full rounded-xl focus-visible:ring-2 focus-visible:ring-slate-500 sm:w-auto">
                Cancelar
              </Button>
            </AlertDialogPrimitive.Cancel>
            <Button
              type="button"
              variant="destructive"
              disabled={submitting}
              onClick={() => void confirmDelete()}
              className="w-full rounded-xl bg-red-600 text-white hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 sm:w-auto"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
              {submitting ? 'Excluindo...' : 'Excluir ativo'}
            </Button>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}
