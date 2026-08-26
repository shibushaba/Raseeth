const dateFmt = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const dateTimeFmt = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso))
}

/** Signed inventory quantity for display, e.g. +100 / -12 */
export function formatSignedQty(quantity: number): string {
  if (quantity > 0) return `+${quantity}`
  return String(quantity)
}
