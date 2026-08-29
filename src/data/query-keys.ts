export const queryKeys = {
  products: {
    all: ['products'] as const,
    list: (search: string) => ['products', 'list', search] as const,
    detail: (id: string) => ['products', 'detail', id] as const,
  },
  inventoryHistory: {
    all: ['inventory-history'] as const,
    byProduct: (productId: string) =>
      ['inventory-history', productId] as const,
  },
  sales: {
    all: ['sales'] as const,
    list: ['sales', 'list'] as const,
    detail: (id: string) => ['sales', 'detail', id] as const,
    todaySummary: (dayKey: string) =>
      ['sales', 'today-summary', dayKey] as const,
    recent: (limit: number) => ['sales', 'recent', limit] as const,
  },
  returns: {
    all: ['returns'] as const,
    detail: (id: string) => ['returns', 'detail', id] as const,
    bySale: (saleId: string) => ['returns', 'by-sale', saleId] as const,
  },
  inventory: {
    summary: ['inventory', 'summary'] as const,
  },
  business: {
    all: ['business'] as const,
    summary: (rangeKey: string) => ['business', 'summary', rangeKey] as const,
    topProducts: (rangeKey: string, limit: number) =>
      ['business', 'top-products', rangeKey, limit] as const,
    pulse: (rangeKey: string) => ['business', 'pulse', rangeKey] as const,
    trend: (rangeKey: string) => ['business', 'trend', rangeKey] as const,
  },
  search: {
    global: (query: string) => ['search', 'global', query] as const,
  },
  messages: {
    all: ['messages'] as const,
    thread: ['messages', 'thread'] as const,
    unreadCount: ['messages', 'unread-count'] as const,
  },
  activity: {
    all: ['activity'] as const,
    feed: (role: string, userId: string) =>
      ['activity', 'feed', role, userId] as const,
    preview: (role: string, userId: string) =>
      ['activity', 'preview', role, userId] as const,
  },
}
