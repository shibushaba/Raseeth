import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { getMyAccessibleShopIds, getMyShop } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useAuth } from '@/features/auth/AuthProvider'
import { useOwnerShopFilter } from '@/features/shop/OwnerShopContext'
import {
  productShopScopeKey,
  type ProductShopScope,
} from '@/lib/product-shop-scope'

/** Shop filter for managers and cashiers; owners see all unless a shop is selected. */
export function useShopScope(selectedShopId?: string | null) {
  const { role } = useAuth()
  const ownerFilter = useOwnerShopFilter()

  const myShopQuery = useQuery({
    queryKey: queryKeys.shops.mine,
    queryFn: getMyShop,
    enabled: role === 'MANAGER' || role === 'SALESMAN',
  })

  const accessibleShopsQuery = useQuery({
    queryKey: queryKeys.shops.accessible,
    queryFn: getMyAccessibleShopIds,
    enabled: role === 'MANAGER' || role === 'SALESMAN',
  })

  const shopId =
    selectedShopId ??
    (role === 'OWNER'
      ? ownerFilter.selectedShopId
      : role === 'MANAGER' || role === 'SALESMAN'
        ? (myShopQuery.data?.id ?? null)
        : null)

  const accessibleShopIds = accessibleShopsQuery.data ?? []

  /** Product/inventory scope: all assigned shops for staff, optional single shop for owners. */
  const productShopScope: ProductShopScope = useMemo(() => {
    if (role === 'OWNER') return shopId
    if (role === 'MANAGER' || role === 'SALESMAN') {
      if (accessibleShopIds.length > 0) return accessibleShopIds
      return shopId
    }
    return shopId
  }, [role, shopId, accessibleShopIds])

  const productScopeKey = useMemo(
    () => productShopScopeKey(productShopScope),
    [productShopScope],
  )

  const shopsScopeLoading =
    role === 'MANAGER' || role === 'SALESMAN'
      ? myShopQuery.isLoading || accessibleShopsQuery.isLoading
      : false

  return {
    shopId,
    myShop: myShopQuery.data ?? null,
    accessibleShopIds,
    productShopScope,
    productScopeKey,
    isLoading: myShopQuery.isLoading,
    shopsScopeLoading,
  }
}
