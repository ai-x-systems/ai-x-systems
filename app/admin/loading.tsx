/** Shown instantly while an admin page loads. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-muted/50" />
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="card h-24 animate-pulse bg-muted/40" />)}
      </div>
      <div className="card mt-6 h-72 animate-pulse bg-muted/40" />
    </div>
  )
}
