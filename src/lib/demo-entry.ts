const KEY = 'raseeth-demo-entry'

export function setDemoEntryPath(path: string): void {
  sessionStorage.setItem(KEY, path)
}

export function consumeDemoEntryPath(): string | null {
  const path = sessionStorage.getItem(KEY)
  if (path) sessionStorage.removeItem(KEY)
  return path
}

export function clearDemoEntryPath(): void {
  sessionStorage.removeItem(KEY)
}
