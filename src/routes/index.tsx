import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { useAuth } from '@/features/auth/AuthProvider'
import { homePathFor } from '@/lib/roles'
import { LoginPage } from '@/pages/LoginPage'
import { OwnerOverviewPage } from '@/pages/owner/OverviewPage'
import { SalesmanHomePage } from '@/pages/salesman/HomePage'
import { CreateProductPage } from '@/pages/shared/CreateProductPage'
import { ActivityPage } from '@/pages/shared/ActivityPage'
import { InventoryPage } from '@/pages/shared/InventoryPage'
import { MessagesPage } from '@/pages/shared/MessagesPage'
import { ProductDetailPage } from '@/pages/shared/ProductDetailPage'
import { SaleDetailPage } from '@/pages/shared/SaleDetailPage'
import { ReturnDetailPage } from '@/pages/shared/ReturnDetailPage'
import { ReturnItemsPage } from '@/pages/shared/ReturnItemsPage'
import { SalesHistoryPage, SalesPage } from '@/pages/shared/SalesPage'
import {
  ProtectedRoute,
  PublicOnlyRoute,
  RoleRoute,
} from '@/routes/guards'

function RootRedirect() {
  const { role, loading, session } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-neutral-600">
        Loading…
      </div>
    )
  }

  if (!session || !role) return <Navigate to="/login" replace />
  return <Navigate to={homePathFor(role)} replace />
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />

        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<RoleRoute allow={['SALESMAN']} />}>
            <Route path="/home" element={<SalesmanHomePage />} />
            <Route path="/inventory/new" element={<CreateProductPage />} />
            <Route path="/sales/history" element={<SalesHistoryPage />} />
          </Route>

          <Route element={<RoleRoute allow={['OWNER']} />}>
            <Route path="/overview" element={<OwnerOverviewPage />} />
          </Route>

          <Route path="/sales" element={<SalesPage />} />
          <Route path="/sales/:saleId" element={<SaleDetailPage />} />
          <Route
            element={<RoleRoute allow={['SALESMAN']} />}
          >
            <Route
              path="/sales/:saleId/return"
              element={<ReturnItemsPage />}
            />
          </Route>
          <Route path="/returns/:returnId" element={<ReturnDetailPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/inventory/:productId" element={<ProductDetailPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/messages" element={<MessagesPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
