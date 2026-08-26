import { z } from 'zod'

const moneySchema = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'number' ? v : Number(v)))
  .refine((n) => Number.isFinite(n) && n >= 0, {
    message: 'Must be a valid non-negative amount',
  })

const positiveMoneySchema = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'number' ? v : Number(v)))
  .refine((n) => Number.isFinite(n) && n > 0, {
    message: 'Payment amount must be greater than zero.',
  })

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const createProductSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required'),
  description: z.string().trim().optional(),
  category: z.string().trim().optional(),
  purchase_price: moneySchema,
  retail_price: moneySchema,
  wholesale_price: moneySchema,
  initial_quantity: z.coerce.number().int().min(0),
})

export const addStockSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.coerce.number().int().positive('Quantity must be positive'),
  unit_cost: moneySchema,
  notes: z.string().trim().optional(),
})

export const adjustStockSchema = z
  .object({
    product_id: z.string().uuid(),
    quantity: z.coerce
      .number({ error: 'Enter an adjustment quantity' })
      .int('Adjustment must be a whole number')
      .refine((n) => n !== 0, 'Adjustment cannot be zero'),
    reason: z.enum([
      'Damaged',
      'Missing',
      'Stock count correction',
      'Other',
    ]),
    note: z.string().trim().optional(),
  })
  .transform((data) => ({
    product_id: data.product_id,
    quantity: data.quantity,
    reason:
      data.note && data.note.length > 0
        ? `${data.reason} — ${data.note}`
        : data.reason,
  }))

export const paymentLineSchema = z.object({
  method: z.enum(['CASH', 'UPI', 'CARD']),
  amount: positiveMoneySchema,
})

export const createSaleSchema = z.object({
  items: z
    .array(
      z
        .object({
          product_id: z.string().uuid(),
          quantity: z.coerce
            .number()
            .int()
            .positive('Quantity must be positive'),
          unit_price: moneySchema,
          price_type: z.enum(['RETAIL', 'WHOLESALE', 'CUSTOM']),
        })
        .superRefine((item, ctx) => {
          if (item.price_type === 'CUSTOM' && item.unit_price <= 0) {
            ctx.addIssue({
              code: 'custom',
              message: 'Custom price must be greater than zero.',
              path: ['unit_price'],
            })
          }
        }),
    )
    .min(1, 'Add at least one product to the cart'),
  payments: z
    .array(paymentLineSchema)
    .min(1, 'At least one payment is required'),
})

export const messageSchema = z.object({
  message: z.string().trim().min(1, 'Please enter a valid message.').max(2000),
})

export const createReturnSchema = z.object({
  items: z
    .array(
      z.object({
        sale_item_id: z.string().uuid(),
        quantity: z.coerce
          .number()
          .int()
          .positive('Return quantity must be positive'),
      }),
    )
    .min(1, 'Select at least one item to return'),
  refund_method: z.enum(['CASH', 'UPI', 'CARD']),
})

export type LoginInput = z.infer<typeof loginSchema>
export type CreateProductInput = z.infer<typeof createProductSchema>
export type AddStockInput = z.infer<typeof addStockSchema>
export type AdjustStockInput = z.infer<typeof adjustStockSchema>
export type CreateSaleInput = z.infer<typeof createSaleSchema>
export type PaymentLineInput = z.infer<typeof paymentLineSchema>
export type CreateReturnInput = z.infer<typeof createReturnSchema>
export type MessageInput = z.infer<typeof messageSchema>
