import { Navigate } from 'react-router-dom'

import { useAuth } from '@/features/auth/AuthProvider'
import { PosScreen } from '@/features/sales/components/PosScreen'
import { SalesHistoryList } from '@/features/sales/components/SalesHistoryList'

/** /sales — POS for salesman, history for owner. */
export function SalesPage() {
  const { permissions } = useAuth()

  if (!permissions.canCreateSale) {
    return (
      <div className="flex min-h-dvh flex-col">
        <div className="px-4 pb-2 pt-6">
          <h1 className="text-2xl font-black text-foreground">Sales History</h1>
          <p className="text-sm text-muted">All transactions</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SalesHistoryList ownerMode />
        </div>
      </div>
    )
  }

  return <PosScreen />
}

/** Explicit history route for salesman (redirect to POS recent tab). */
export function SalesHistoryPage() {
  return <Navigate to="/sales" replace />
}
