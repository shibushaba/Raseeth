import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { CreateProductForm } from '@/features/inventory/components/CreateProductForm'

export function CreateProductPage() {
  return (
    <div>
      <Link
        to="/inventory"
        className="mb-6 inline-block text-sm text-neutral-600 hover:text-black"
      >
        ← Inventory
      </Link>
      <PageHeader
        title="Add product"
        description="Product ID is assigned automatically. Initial stock, if any, is recorded as a purchase."
      />
      <CreateProductForm />
    </div>
  )
}
