import type { UserRole } from '@/types/database'

/** Owner is observer + communicator only. */
export const OWNER_PERMISSIONS = {
  canCreateProduct: false,
  canEditProduct: false,
  canDeleteProduct: false,
  canAddInventory: false,
  canAdjustInventory: false,
  canCreateSale: false,
  canCreateReturn: false,
  canEditSale: false,
  canDeleteSale: false,
  canChangePrices: false,
  canSendMessages: true,
  canViewSales: true,
  canViewInventory: true,
  canViewProducts: true,
} as const

/** Salesman owns operational sales and inventory work. */
export const SALESMAN_PERMISSIONS = {
  canCreateProduct: true,
  canEditProduct: true,
  canDeleteProduct: false,
  canAddInventory: true,
  canAdjustInventory: true,
  canCreateSale: true,
  canCreateReturn: true,
  canEditSale: false,
  canDeleteSale: false,
  canChangePrices: true,
  canSendMessages: true,
  canViewSales: true,
  canViewInventory: true,
  canViewProducts: true,
} as const

export type Permissions =
  | typeof OWNER_PERMISSIONS
  | typeof SALESMAN_PERMISSIONS

export function permissionsFor(role: UserRole | null | undefined): Permissions {
  if (role === 'SALESMAN') return SALESMAN_PERMISSIONS
  return OWNER_PERMISSIONS
}

export function isOwner(role: UserRole | null | undefined): boolean {
  return role === 'OWNER'
}

export function isSalesman(role: UserRole | null | undefined): boolean {
  return role === 'SALESMAN'
}

export type NavItem = {
  label: string
  to: string
}

/** Minimal role-specific navigation. Search stays a header control (not a nav item). */
export function navItemsFor(role: UserRole): NavItem[] {
  if (role === 'OWNER') {
    return [
      { label: 'Overview', to: '/overview' },
      { label: 'Sales', to: '/sales' },
      { label: 'Inventory', to: '/inventory' },
      { label: 'Activity', to: '/activity' },
      { label: 'Messages', to: '/messages' },
    ]
  }

  return [
    { label: 'Home', to: '/home' },
    { label: 'Sell', to: '/sales' },
    { label: 'Inventory', to: '/inventory' },
    { label: 'Activity', to: '/activity' },
    { label: 'Messages', to: '/messages' },
  ]
}

export function homePathFor(role: UserRole): string {
  return role === 'OWNER' ? '/overview' : '/home'
}
