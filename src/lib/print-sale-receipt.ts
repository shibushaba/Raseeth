import { jsPDF } from 'jspdf'

import { formatDateTime } from '@/lib/format'
import { formatMoneyPdf, parseMoney } from '@/lib/money'
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
  pricing?: {
    subtotal: number
    discount: number
    tax: number
    other: number
    note: string | null
  }
}

const W = 80
const MX = 6
const RX = W - MX
const INNER = W - MX * 2

const VIOLET = { r: 124, g: 58, b: 237 }
const VIOLET_SOFT = { r: 237, g: 233, b: 254 }
const INK = { r: 31, g: 41, b: 55 }
const MUTED = { r: 107, g: 114, b: 128 }
const BORDER = { r: 221, g: 214, b: 254 }

function setInk(doc: jsPDF) {
  doc.setTextColor(INK.r, INK.g, INK.b)
}

function setMuted(doc: jsPDF) {
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
}

function setWhite(doc: jsPDF) {
  doc.setTextColor(255, 255, 255)
}

function wrap(doc: jsPDF, text: string, width: number): string[] {
  return doc.splitTextToSize(text, width) as string[]
}

function estimatePageHeight(receipt: PrintableReceipt): number {
  const header = 36
  const items = receipt.items.reduce((acc, item) => {
    const nameLines = Math.ceil(item.name.length / 22)
    return acc + 14 + nameLines * 3.5 + (item.product_code ? 3 : 0)
  }, 0)
  const pricing =
    receipt.pricing &&
    (receipt.pricing.discount > 0 ||
      receipt.pricing.tax > 0 ||
      receipt.pricing.other > 0)
      ? 32 + (receipt.pricing.note ? 8 : 0)
      : 0
  const payBlock = 22 + receipt.payments.length * 5
  const footer = 12
  return Math.ceil(header + items + pricing + payBlock + footer + MX * 2)
}

function receiptPdfFileName(saleNumber: string): string {
  return `receipt-${saleNumber.replace(/[^\w-]+/g, '_')}.pdf`
}

function drawHeader(doc: jsPDF, receipt: PrintableReceipt): number {
  const headerH = 34
  doc.setFillColor(VIOLET.r, VIOLET.g, VIOLET.b)
  doc.roundedRect(0, 0, W, headerH, 2, 2, 'F')

  setWhite(doc)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('Raseeth', W / 2, 11, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text('TAX INVOICE / RECEIPT', W / 2, 16.5, { align: 'center' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(receipt.sale_number, W / 2, 22.5, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const meta = [
    formatDateTime(receipt.created_at),
    receipt.sold_by ? `Cashier: ${receipt.sold_by}` : null,
  ]
    .filter(Boolean)
    .join('  ·  ')
  doc.text(meta, W / 2, 28, { align: 'center', maxWidth: INNER })

  setInk(doc)
  return headerH + 5
}

function drawRow(
  doc: jsPDF,
  y: number,
  label: string,
  value: string,
  opts?: { bold?: boolean; valueBold?: boolean; muted?: boolean },
): number {
  if (opts?.muted) setMuted(doc)
  else setInk(doc)
  doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal')
  doc.setFontSize(opts?.bold ? 9 : 8)
  doc.text(label, MX, y)
  doc.setFont('helvetica', opts?.valueBold || opts?.bold ? 'bold' : 'normal')
  doc.text(value, RX, y, { align: 'right' })
  setInk(doc)
  return y + (opts?.bold ? 5 : 4.2)
}

function drawItem(doc: jsPDF, y: number, item: PrintableReceiptItem): number {
  const nameLines = wrap(doc, item.name, INNER - 22)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  setInk(doc)
  doc.text(nameLines, MX, y)
  y += nameLines.length * 3.8

  if (item.product_code) {
    setMuted(doc)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.text(item.product_code, MX, y)
    y += 3.2
  }

  setMuted(doc)
  doc.setFontSize(7.5)
  doc.text(
    `${item.quantity} x ${formatMoneyPdf(item.unit_price)}`,
    MX,
    y,
  )

  doc.setFont('helvetica', 'bold')
  setInk(doc)
  doc.setFontSize(8.5)
  doc.text(formatMoneyPdf(item.line_total), RX, y, { align: 'right' })
  y += 4

  doc.setDrawColor(BORDER.r, BORDER.g, BORDER.b)
  doc.setLineWidth(0.15)
  doc.line(MX, y, RX, y)
  return y + 3
}

export async function downloadSaleReceiptPdf(
  receipt: PrintableReceipt,
): Promise<boolean> {
  if (typeof window === 'undefined') return false

  try {
    const pageH = estimatePageHeight(receipt)
    const doc = new jsPDF({
      unit: 'mm',
      format: [W, pageH],
      orientation: 'portrait',
    })

    let y = drawHeader(doc, receipt)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    setMuted(doc)
    doc.text('ITEMS', MX, y)
    y += 5

    for (const item of receipt.items) {
      y = drawItem(doc, y, item)
    }

    const pricing = receipt.pricing
    const hasAdjustments =
      pricing &&
      (pricing.discount > 0 || pricing.tax > 0 || pricing.other > 0)

    if (hasAdjustments && pricing) {
      y += 2
      doc.setFillColor(VIOLET_SOFT.r, VIOLET_SOFT.g, VIOLET_SOFT.b)
      const boxH =
        16 +
        (pricing.discount > 0 ? 4 : 0) +
        (pricing.tax > 0 ? 4 : 0) +
        (pricing.other > 0 ? 4 : 0) +
        (pricing.note ? 6 : 0)
      doc.roundedRect(MX, y - 2, INNER, boxH, 1.5, 1.5, 'F')

      y = drawRow(doc, y + 1, 'Subtotal', formatMoneyPdf(pricing.subtotal))
      if (pricing.discount > 0) {
        y = drawRow(
          doc,
          y,
          'Discount',
          `- ${formatMoneyPdf(pricing.discount)}`,
        )
      }
      if (pricing.tax > 0) {
        y = drawRow(
          doc,
          y,
          'GST / tax',
          `+ ${formatMoneyPdf(pricing.tax)}`,
        )
      }
      if (pricing.other > 0) {
        y = drawRow(
          doc,
          y,
          'Other charges',
          `+ ${formatMoneyPdf(pricing.other)}`,
        )
      }
      if (pricing.note) {
        setMuted(doc)
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(6.5)
        doc.text(`Note: ${pricing.note}`, MX + 1, y + 1, { maxWidth: INNER - 2 })
        y += 6
      }
      y += 4
    }

    y += 1
    doc.setFillColor(VIOLET.r, VIOLET.g, VIOLET.b)
    doc.roundedRect(MX, y, INNER, 10, 1.5, 1.5, 'F')
    setWhite(doc)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Amount paid', MX + 2, y + 6.5)
    doc.setFontSize(11)
    doc.text(formatMoneyPdf(receipt.total_amount), RX - 2, y + 6.5, {
      align: 'right',
    })
    y += 14

    setInk(doc)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text('PAYMENT', MX, y)
    y += 4.5

    for (const pay of receipt.payments) {
      y = drawRow(
        doc,
        y,
        PAYMENT_METHOD_LABEL[pay.method],
        formatMoneyPdf(pay.amount),
      )
    }

    const paidTotal = receipt.payments.reduce(
      (s, p) => s + parseMoney(p.amount),
      0,
    )
    if (receipt.payments.length > 1) {
      y = drawRow(doc, y, 'Total received', formatMoneyPdf(paidTotal), {
        bold: true,
      })
    }

    y += 3
    setMuted(doc)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.text('Thank you for shopping with us', W / 2, y, { align: 'center' })
    doc.text('Powered by Raseeth', W / 2, y + 3.5, { align: 'center' })

    doc.save(receiptPdfFileName(receipt.sale_number))
    return true
  } catch {
    return false
  }
}

export async function printSaleReceipt(
  receipt: PrintableReceipt,
): Promise<boolean> {
  return downloadSaleReceiptPdf(receipt)
}
