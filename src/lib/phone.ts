/** Normalize user input to 10-digit Indian mobile (strips +91 / spaces). */
export function normalizePhoneDigits(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2)
  }
  return digits
}

export function isValidIndianMobile(digits: string): boolean {
  return /^[6-9]\d{9}$/.test(digits)
}

export function formatPhoneDisplay(digits: string): string {
  if (digits.length !== 10) return digits
  return `${digits.slice(0, 5)} ${digits.slice(5)}`
}
