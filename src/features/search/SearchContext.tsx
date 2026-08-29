import { createContext, useContext, type ReactNode } from 'react'

type SearchContextValue = {
  openSearch: () => void
}

const SearchContext = createContext<SearchContextValue | null>(null)

export function SearchProvider({
  openSearch,
  children,
}: {
  openSearch: () => void
  children: ReactNode
}) {
  return (
    <SearchContext.Provider value={{ openSearch }}>
      {children}
    </SearchContext.Provider>
  )
}

export function useGlobalSearch(): SearchContextValue {
  const ctx = useContext(SearchContext)
  if (!ctx) {
    throw new Error('useGlobalSearch must be used within SearchProvider')
  }
  return ctx
}
