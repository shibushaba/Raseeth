import { Navigate } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { useAuth } from '@/features/auth/AuthProvider'
import { PosScreen } from '@/features/sales/components/PosScreen'
import { SalesHistoryList } from '@/features/sales/components/SalesHistoryList'

/** /sales — POS for salesman, history for owner. */
export function SalesPage() {
  const { permissions } = useAuth()

  if (!permissions.canCreateSale) {
    return (
      <div>
        <PageHeader
          title="Sales"
          description="Read-only sales history. You cannot create or edit sales."
        />
        <SalesHistoryList />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Sell"
        description="Search, add to cart, set price, complete."
      />
      <PosScreen />
    </div>
  )
}

/** Explicit history route for salesman (and owner alias). */
export function SalesHistoryPage() {
  const { permissions } = useAuth()

  if (!permissions.canCreateSale) {
    return <Navigate to="/sales" replace />
  }

  return (
    <div>
      <PageHeader title="Sales" description="Recent completed sales." />
      <SalesHistoryList />
    </div>
  )
}
