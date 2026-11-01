/** Shown instantly while an admin page loads. */
export default function Loading() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-16 md:px-6" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-muted/50" />
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="card h-24 animate-pulse bg-muted/40" />)}
      </div>
      <div className="card mt-8 h-72 animate-pulse bg-muted/40" />
    </main>
  )
}
