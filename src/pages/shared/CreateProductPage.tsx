import { useNavigate } from 'react-router-dom'

import { PortalBackBar } from '@/components/ui/portal-field'
import { CreateProductForm } from '@/features/inventory/components/CreateProductForm'

export function CreateProductPage() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-dvh flex-col">
      <PortalBackBar
        title="Add New Product"
        onBack={() => navigate('/inventory')}
      />
      <div className="flex-1 overflow-y-auto">
        <CreateProductForm />
      </div>
    </div>
  )
}
