import type { UserRole } from '@/types/database'

/** Owner is observer + communicator only (network-wide). */
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

/** Stock manager — inventory for their assigned shop only. */
export const MANAGER_PERMISSIONS = {
  canCreateProduct: true,
  canEditProduct: true,
  canDeleteProduct: true,
  canAddInventory: true,
  canAdjustInventory: true,
  canCreateSale: false,
  canCreateReturn: false,
  canEditSale: false,
  canDeleteSale: false,
  canChangePrices: true,
  canSendMessages: true,
  canViewSales: false,
  canViewInventory: true,
  canViewProducts: true,
} as const

/** Salesman — POS and returns for their shop only. */
export const SALESMAN_PERMISSIONS = {
  canCreateProduct: false,
  canEditProduct: false,
  canDeleteProduct: false,
  canAddInventory: false,
  canAdjustInventory: false,
  canCreateSale: true,
  canCreateReturn: true,
  canEditSale: false,
  canDeleteSale: false,
  canChangePrices: false,
  canSendMessages: true,
  canViewSales: true,
  canViewInventory: false,
  canViewProducts: true,
} as const

export type Permissions =
  | typeof OWNER_PERMISSIONS
  | typeof MANAGER_PERMISSIONS
  | typeof SALESMAN_PERMISSIONS

export function permissionsFor(role: UserRole | null | undefined): Permissions {
  if (role === 'MANAGER') return MANAGER_PERMISSIONS
  if (role === 'SALESMAN') return SALESMAN_PERMISSIONS
  return OWNER_PERMISSIONS
}

export function isOwner(role: UserRole | null | undefined): boolean {
  return role === 'OWNER'
}

export function isManager(role: UserRole | null | undefined): boolean {
  return role === 'MANAGER'
}

/** Stock / inventory manager (MANAGER role in the database). */
export function isStockManager(role: UserRole | null | undefined): boolean {
  return role === 'MANAGER'
}

export function isSalesman(role: UserRole | null | undefined): boolean {
  return role === 'SALESMAN'
}

export type NavItem = {
  label: string
  to: string
  primary?: boolean
}

function operatorNav(): NavItem[] {
  return [
    { label: 'Home', to: '/home', primary: true },
    { label: 'Sales', to: '/sales', primary: true },
    { label: 'Activity', to: '/activity' },
    { label: 'Messages', to: '/messages' },
    { label: 'Settings', to: '/settings' },
  ]
}

/** Role-specific desktop navigation. Search stays in the header; mobile uses bottom nav. */
export function desktopNavItemsFor(role: UserRole): NavItem[] {
  if (role === 'OWNER') {
    return [
      { label: 'Overview', to: '/overview', primary: true },
      { label: 'Sales', to: '/sales', primary: true },
      { label: 'Inventory', to: '/inventory', primary: true },
      { label: 'Shops', to: '/manage' },
      { label: 'Activity', to: '/activity' },
      { label: 'Messages', to: '/messages' },
      { label: 'Settings', to: '/settings' },
    ]
  }

  if (role === 'MANAGER') {
    return [
      { label: 'Home', to: '/manager/home', primary: true },
      { label: 'Inventory', to: '/inventory', primary: true },
      { label: 'Activity', to: '/activity' },
      { label: 'Messages', to: '/messages' },
      { label: 'Settings', to: '/settings' },
    ]
  }

  return operatorNav()
}

/** @deprecated Use desktopNavItemsFor */
export function navItemsFor(role: UserRole): NavItem[] {
  return desktopNavItemsFor(role)
}

export function homePathFor(role: UserRole): string {
  if (role === 'OWNER') return '/overview'
  if (role === 'MANAGER') return '/manager/home'
  return '/home'
}
