'use client'

import { useState } from 'react'

/** A read-only box with a Copy button (for the website install line and share links). */
export function CopyField({ value, multiline = false }: { value: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* clipboard blocked: the text is still selectable */ }
  }
  return (
    <div className="flex items-start gap-2">
      {multiline ? (
        <pre className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-secondary p-3 text-xs">{value}</pre>
      ) : (
        <input readOnly value={value} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-md border border-input bg-input/30 px-3 py-2 text-xs" />
      )}
      <button type="button" onClick={copy} className="shrink-0 rounded-md border border-input px-3 py-2 text-xs hover:bg-muted">{copied ? 'Copied' : 'Copy'}</button>
    </div>
  )
}
