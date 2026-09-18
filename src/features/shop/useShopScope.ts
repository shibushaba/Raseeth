import { useQuery } from '@tanstack/react-query'

import { getMyShop } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useAuth } from '@/features/auth/AuthProvider'

/** Shop filter for managers and cashiers; owners see all unless a shop is selected. */
export function useShopScope(selectedShopId?: string | null) {
  const { role } = useAuth()

  const myShopQuery = useQuery({
    queryKey: queryKeys.shops.mine,
    queryFn: getMyShop,
    enabled: role === 'MANAGER' || role === 'SALESMAN',
  })

  const shopId =
    selectedShopId ??
    (role === 'MANAGER' || role === 'SALESMAN'
      ? (myShopQuery.data?.id ?? null)
      : null)

  return {
    shopId,
    myShop: myShopQuery.data ?? null,
    isLoading: myShopQuery.isLoading,
  }
}
