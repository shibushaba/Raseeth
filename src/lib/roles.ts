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
  primary?: boolean
}

/** Role-specific desktop navigation. Search stays in the header; mobile uses bottom nav. */
export function desktopNavItemsFor(role: UserRole): NavItem[] {
  if (role === 'OWNER') {
    return [
      { label: 'Overview', to: '/overview', primary: true },
      { label: 'Sales', to: '/sales', primary: true },
      { label: 'Inventory', to: '/inventory', primary: true },
      { label: 'Activity', to: '/activity' },
      { label: 'Messages', to: '/messages' },
      { label: 'Settings', to: '/settings' },
    ]
  }

  return [
    { label: 'Home', to: '/home', primary: true },
    { label: 'Sales', to: '/sales', primary: true },
    { label: 'Inventory', to: '/inventory', primary: true },
    { label: 'Activity', to: '/activity' },
    { label: 'Messages', to: '/messages' },
    { label: 'Settings', to: '/settings' },
  ]
}

/** @deprecated Use desktopNavItemsFor */
export function navItemsFor(role: UserRole): NavItem[] {
  return desktopNavItemsFor(role)
}

export function homePathFor(role: UserRole): string {
  return role === 'OWNER' ? '/overview' : '/home'
}
