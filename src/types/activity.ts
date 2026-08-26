export type ActivityType =
  | 'SALE'
  | 'RETURN'
  | 'STOCK_ADDED'
  | 'STOCK_ADJUSTED'
  | 'PRODUCT_CREATED'
  | 'MESSAGE'

export type ActivityItem = {
  id: string
  type: ActivityType
  createdAt: string
  title: string
  description?: string
  href?: string
  actor?: {
    id: string
    name: string
  }
}

export type ActivityScope = 'business' | 'mine'
