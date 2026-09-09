import { Navigate } from 'react-router-dom'

import { PortalHeader } from '@/components/layout/portal/PortalHeader'
import { useAuth } from '@/features/auth/AuthProvider'
import { PosScreen } from '@/features/sales/components/PosScreen'
import { SalesHistoryList } from '@/features/sales/components/SalesHistoryList'

/** /sales — POS for salesman, history for owner. */
export function SalesPage() {
  const { permissions, profile, signOut } = useAuth()

  if (!permissions.canCreateSale) {
    const firstName = profile?.full_name?.split(' ')[0] ?? 'Owner'
    return (
      <div className="flex min-h-[calc(100dvh-3rem)] flex-col">
        <PortalHeader
          tone="indigo"
          subtitle="Owner"
          title={`Hi, ${firstName}`}
          onLogout={() => void signOut()}
        />
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
