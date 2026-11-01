'use client'

import { useEffect, useState } from 'react'
import type { ToastKind } from '@/lib/toast'

type Item = { id: number; text: string; kind: ToastKind }

/** Corner notifications for "saved", "copied", "deleted" and errors, so every click gets a visible answer. */
export function Toaster() {
  const [items, setItems] = useState<Item[]>([])

  useEffect(() => {
    let next = 1
    function onToast(e: Event) {
      const { text, kind } = (e as CustomEvent<{ text: string; kind: ToastKind }>).detail
      const id = next++
      setItems((list) => [...list.slice(-3), { id, text, kind }])
      setTimeout(() => setItems((list) => list.filter((i) => i.id !== id)), kind === 'error' ? 6000 : 3200)
    }
    window.addEventListener('app:toast', onToast)
    return () => window.removeEventListener('app:toast', onToast)
  }, [])

  if (items.length === 0) return null
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2" role="status" aria-live="polite">
      {items.map((i) => (
        <button
          key={i.id}
          type="button"
          onClick={() => setItems((list) => list.filter((x) => x.id !== i.id))}
          className={`pointer-events-auto flex items-start gap-2 rounded-xl border px-4 py-3 text-left text-sm shadow-lg backdrop-blur animate-in fade-in slide-in-from-bottom-3 duration-200 ${
            i.kind === 'error' ? 'border-destructive/50 bg-card text-foreground' : i.kind === 'info' ? 'border-border bg-card text-foreground' : 'border-primary/50 bg-card text-foreground'
          }`}
        >
          <span aria-hidden className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${i.kind === 'error' ? 'bg-destructive' : 'bg-primary'}`}>{i.kind === 'error' ? '!' : '✓'}</span>
          <span>{i.text}</span>
        </button>
      ))}
    </div>
  )
}
