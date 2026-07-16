import type { ReactNode } from 'react'

export function PageHeader({
  eyebrow,
  title,
  description,
  align = 'left',
}: {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  align?: 'left' | 'center'
}) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      {eyebrow ? <p className="text-sm font-medium text-primary">{eyebrow}</p> : null}
      <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}
