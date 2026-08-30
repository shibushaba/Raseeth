import { formatDateTime } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import { PAYMENT_METHOD_LABEL } from '@/lib/payment-labels'
import type { PaymentMethod } from '@/types/database'

export type PrintableReceiptItem = {
  name: string
  product_code?: string | null
  quantity: number
  unit_price: number
  line_total: number
}

export type PrintableReceipt = {
  sale_number: string
  created_at: string
  total_amount: number
  items: PrintableReceiptItem[]
  payments: Array<{ method: PaymentMethod; amount: number }>
  sold_by?: string | null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildReceiptHtml(receipt: PrintableReceipt): string {
  const itemsHtml = receipt.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px dashed #ddd;">
          <div style="font-weight:600;">${escapeHtml(item.name)}</div>
          ${item.product_code ? `<div style="font-size:11px;color:#666;">${escapeHtml(item.product_code)}</div>` : ''}
          <div style="font-size:12px;color:#666;">${item.quantity} × ${formatMoney(item.unit_price)}</div>
        </td>
        <td style="padding:8px 0;border-bottom:1px dashed #ddd;text-align:right;font-weight:600;white-space:nowrap;">
          ${formatMoney(item.line_total)}
        </td>
      </tr>`,
    )
    .join('')

  const paymentsHtml = receipt.payments
    .map(
      (p) => `
      <div style="display:flex;justify-content:space-between;margin-top:4px;">
        <span>${escapeHtml(PAYMENT_METHOD_LABEL[p.method])}</span>
        <span style="font-weight:600;">${formatMoney(p.amount)}</span>
      </div>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(receipt.sale_number)}</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 0; padding: 16px; color: #111; }
      .store { text-align: center; margin-bottom: 12px; }
      .store h1 { margin: 0; font-size: 20px; }
      .meta { text-align: center; font-size: 12px; color: #666; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; }
      .total { display:flex; justify-content:space-between; font-size: 18px; font-weight: 700; margin-top: 12px; padding-top: 12px; border-top: 2px solid #111; }
      .payments { margin-top: 16px; font-size: 13px; }
      .footer { margin-top: 20px; text-align: center; font-size: 11px; color: #888; }
      @media print { body { padding: 0; } }
    </style>
  </head>
  <body>
    <div class="store">
      <h1>Raseeth</h1>
      <div>Sale receipt</div>
    </div>
    <div class="meta">
      <div><strong>${escapeHtml(receipt.sale_number)}</strong></div>
      <div>${escapeHtml(formatDateTime(receipt.created_at))}</div>
      ${receipt.sold_by ? `<div>Sold by ${escapeHtml(receipt.sold_by)}</div>` : ''}
    </div>
    <table>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
    <div class="total">
      <span>Total</span>
      <span>${formatMoney(receipt.total_amount)}</span>
    </div>
    <div class="payments">
      <div style="font-weight:700;margin-bottom:4px;">Payment</div>
      ${paymentsHtml}
    </div>
    <div class="footer">Thank you for your business</div>
    <script>window.onload = function() { window.print(); }</script>
  </body>
</html>`
}

export function printSaleReceipt(receipt: PrintableReceipt): boolean {
  if (typeof window === 'undefined') return false
  const html = buildReceiptHtml(receipt)
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=400,height=640')
  if (!printWindow) return false
  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
  return true
}
