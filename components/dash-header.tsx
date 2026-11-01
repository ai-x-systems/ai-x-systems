import type { ReactNode } from 'react'

/** The title block at the top of every dashboard page: compact, with room for action buttons on the right. */
export function DashHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-balance text-2xl font-semibold tracking-tight md:text-[1.75rem]">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
