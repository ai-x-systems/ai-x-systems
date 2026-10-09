'use client'

import { useState } from 'react'
import { OnboardForm } from './onboard-form'
import { IntakePanel, PreviewPanel } from './onboard-panels'

const TABS = [
  { id: 'intake', label: 'Send setup link', hint: 'After they say yes' },
  { id: 'preview', label: 'Create preview', hint: 'For a prospect' },
  { id: 'manual', label: 'Set up myself', hint: 'Full form' },
] as const

export function OnboardHub() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('intake')
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`rounded-lg border px-3 py-2 text-left text-sm ${tab === t.id ? 'border-primary bg-primary/10' : 'border-border'}`}>
            <span className="block font-medium">{t.label}</span>
            <span className="block text-xs text-muted-foreground">{t.hint}</span>
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tab === 'intake' ? <IntakePanel /> : tab === 'preview' ? <PreviewPanel /> : <OnboardForm />}
      </div>
    </div>
  )
}
