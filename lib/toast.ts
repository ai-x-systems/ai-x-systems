/** Show a small message in the corner of the screen. Safe to call from any client component. */
export type ToastKind = 'success' | 'error' | 'info'

export function toast(text: string, kind: ToastKind = 'success') {
  if (typeof window === 'undefined' || !text) return
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { text, kind } }))
}
