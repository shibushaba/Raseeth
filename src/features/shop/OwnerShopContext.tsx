import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { useAuth } from '@/features/auth/AuthProvider'

const STORAGE_KEY = 'raseeth.owner.shop_filter'

type OwnerShopContextValue = {
  /** null = all shops the owner can access */
  selectedShopId: string | null
  setSelectedShopId: (id: string | null) => void
}

const OwnerShopContext = createContext<OwnerShopContextValue | null>(null)

export function OwnerShopProvider({ children }: { children: ReactNode }) {
  const { role } = useAuth()
  const [selectedShopId, setSelectedShopIdState] = useState<string | null>(() => {
    if (role !== 'OWNER') return null
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw === 'all' || !raw) return null
      return raw
    } catch {
      return null
    }
  })

  const setSelectedShopId = useCallback((id: string | null) => {
    setSelectedShopIdState(id)
    try {
      sessionStorage.setItem(STORAGE_KEY, id ?? 'all')
    } catch {
      /* ignore */
    }
  }, [])

  const value = useMemo(
    () => ({ selectedShopId, setSelectedShopId }),
    [selectedShopId, setSelectedShopId],
  )

  if (role !== 'OWNER') {
    return <>{children}</>
  }

  return (
    <OwnerShopContext.Provider value={value}>{children}</OwnerShopContext.Provider>
  )
}

export function useOwnerShopFilter(): OwnerShopContextValue {
  const ctx = useContext(OwnerShopContext)
  return (
    ctx ?? {
      selectedShopId: null,
      setSelectedShopId: () => undefined,
    }
  )
}
