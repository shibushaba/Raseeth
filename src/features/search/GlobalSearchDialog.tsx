import { useQuery } from '@tanstack/react-query'
import {
  useDeferredValue,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { AppIcon } from '@/components/ui/icon'
import { Input } from '@/components/ui/input'
import { Search01Icon } from '@/lib/icons'
import { globalSearch } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import {
  groupSearchResults,
  pushRecentSearch,
  readRecentSearches,
  type RecentSearchItem,
  type SearchResult,
} from '@/lib/global-search'
import { cn } from '@/lib/utils'

export function GlobalSearchTrigger({
  onOpen,
  triggerRef,
}: {
  onOpen: () => void
  triggerRef?: import('react').RefObject<HTMLButtonElement | null>
}) {
  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="secondary"
        size="sm"
        className="hidden sm:inline-flex"
        onClick={onOpen}
        aria-label="Open search"
        aria-keyshortcuts="Control+K Meta+K"
      >
        <AppIcon icon={Search01Icon} size="sm" className="text-muted" />
        Search
        <kbd className="ml-2 hidden rounded-md border border-border px-1.5 py-0.5 text-[10px] font-normal text-muted md:inline">
          ⌘K
        </kbd>
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="inline-flex h-11 w-11 px-0 sm:hidden"
        onClick={onOpen}
        aria-label="Open search"
      >
        <AppIcon icon={Search01Icon} size="md" />
      </Button>
    </>
  )
}

export function GlobalSearchDialog({
  open,
  onClose,
  returnFocusRef,
}: {
  open: boolean
  onClose: () => void
  returnFocusRef?: import('react').RefObject<HTMLElement | null>
}) {
  const navigate = useNavigate()
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim())
  const [selected, setSelected] = useState(0)
  const [recent, setRecent] = useState<RecentSearchItem[]>(() =>
    readRecentSearches(),
  )

  const searchQuery = useQuery({
    queryKey: queryKeys.search.global(deferredQuery),
    queryFn: () => globalSearch(deferredQuery),
    enabled: open && deferredQuery.length > 0,
  })

  const results = searchQuery.data ?? []
  const groups = groupSearchResults(results)
  const flat: Array<SearchResult | RecentSearchItem> =
    deferredQuery.length === 0
      ? recent
      : groups.flatMap((g) => g.items)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelected(0)
    setRecent(readRecentSearches())
    const t = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    setSelected(0)
  }, [deferredQuery, results.length])

  useEffect(() => {
    if (!open) return
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (open) return
    const el = returnFocusRef?.current
    if (el) {
      queueMicrotask(() => el.focus())
    }
  }, [open, returnFocusRef])

  function openResult(item: SearchResult | RecentSearchItem) {
    pushRecentSearch({
      type: item.type,
      id: item.id,
      title: item.title,
      href: item.href,
      subtitle: item.subtitle,
    })
    onClose()
    navigate(item.href)
  }

  function onInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (flat.length === 0) return
      setSelected((i) => (i + 1) % flat.length)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (flat.length === 0) return
      setSelected((i) => (i - 1 + flat.length) % flat.length)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const item = flat[selected]
      if (item) openResult(item)
    }
  }

  if (!open) return null

  const showEmptyQuery = deferredQuery.length === 0
  const showNoResults =
    deferredQuery.length > 0 &&
    !searchQuery.isFetching &&
    results.length === 0
  const showLoading =
    deferredQuery.length > 0 && searchQuery.isFetching && results.length === 0

  let flatIndex = -1

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 p-0 backdrop-blur-[2px] sm:p-6 sm:pt-[12vh]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Business search"
        className="card flex h-dvh w-full flex-col overflow-hidden sm:h-auto sm:max-h-[min(32rem,70vh)] sm:max-w-lg"
        style={{ boxShadow: 'var(--shadow-dialog)' }}
      >
        <div className="border-b border-border px-4 py-3">
          <p className="eyebrow mb-2">Search</p>
          <div className="flex items-center gap-2">
            <span className="text-muted" aria-hidden>
              ⌕
            </span>
            <Input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Search products, sales, IDs…"
              aria-label="Search products, sales, and returns"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                flat[selected] ? `${listId}-option-${selected}` : undefined
              }
              className="border-0 bg-transparent shadow-none focus-visible:outline-none"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 shrink-0 text-muted sm:hidden"
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </div>

        <div
          id={listId}
          role="listbox"
          aria-label="Search results"
          className="min-h-0 flex-1 overflow-y-auto px-2 py-2"
        >
          {showEmptyQuery ? (
            recent.length === 0 ? (
              <p className="px-3 py-8 text-center section-hint">
                Start typing…
              </p>
            ) : (
              <div>
                <p className="px-3 py-2 eyebrow">Recent</p>
                <ul>
                  {recent.map((item) => {
                    flatIndex += 1
                    const idx = flatIndex
                    return (
                      <ResultButton
                        key={`${item.type}-${item.id}`}
                        id={`${listId}-option-${idx}`}
                        active={selected === idx}
                        title={item.title}
                        subtitle={item.subtitle}
                        onSelect={() => openResult(item)}
                        onHover={() => setSelected(idx)}
                      />
                    )
                  })}
                </ul>
              </div>
            )
          ) : null}

          {showLoading ? (
            <p className="px-3 py-8 text-center section-hint" aria-busy="true">
              Searching…
            </p>
          ) : null}

          {showNoResults ? (
            <div className="px-3 py-8 text-center">
              <p className="text-sm font-medium">No matches found.</p>
              <p className="mt-2 section-hint">
                Try a product name, Product ID, Sale number, or Return number.
              </p>
            </div>
          ) : null}

          {!showEmptyQuery && !showNoResults && !showLoading
            ? groups.map((group) => (
                <div key={group.type} className="mb-3">
                  <p className="px-3 py-2 eyebrow">{group.label}</p>
                  <ul>
                    {group.items.map((item) => {
                      flatIndex += 1
                      const idx = flatIndex
                      return (
                        <ResultButton
                          key={`${item.type}-${item.id}`}
                          id={`${listId}-option-${idx}`}
                          active={selected === idx}
                          title={item.title}
                          subtitle={item.subtitle}
                          meta={item.meta}
                          onSelect={() => openResult(item)}
                          onHover={() => setSelected(idx)}
                        />
                      )
                    })}
                  </ul>
                </div>
              ))
            : null}
        </div>
      </div>
    </div>
  )
}

function ResultButton({
  id,
  active,
  title,
  subtitle,
  meta,
  onSelect,
  onHover,
}: {
  id: string
  active: boolean
  title: string
  subtitle?: string
  meta?: string
  onSelect: () => void
  onHover: () => void
}) {
  return (
    <li role="option" id={id} aria-selected={active}>
      <button
        type="button"
        className={cn(
          'flex min-h-12 w-full flex-col items-start rounded-lg px-3 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent sm:min-h-11 sm:py-2.5',
          active ? 'bg-accent-soft/60 dark:bg-teal-950/50' : 'row-hover',
        )}
        onClick={onSelect}
        onMouseEnter={onHover}
      >
        <span className="text-sm font-medium">{title}</span>
        {subtitle ? (
          <span className="mt-0.5 font-mono text-xs text-muted">
            {subtitle}
          </span>
        ) : null}
        {meta ? (
          <span className="mt-0.5 text-xs text-muted">{meta}</span>
        ) : null}
      </button>
    </li>
  )
}
